---
name: dynamo-elixir
description: Use Dynamo, the Ecto-inspired Repo and schema library for Amazon DynamoDB in Elixir. Covers defining typed schemas with composite keys, GSIs and vector indexes (DynamoDB native vector search), single-table design with entity_name, configuring a supervised Repo, put/get/update/delete, query with sort-key conditions and the condition DSL, pagination and streams, batches, transactions, error handling with %Dynamo.Error{}, testing with Req.Test plugs or DynamoDB Local, and the mix tasks. Use when a project depends on {:dynamo, github: "bmalum/dynamo"} or asks how to model or access DynamoDB from Elixir.
version: 0.2.0
tags: [elixir, dynamodb, aws, database, ecto, single-table-design]
homepage: https://elixir-dynamodb.dev
---

# Working with Dynamo (Elixir + DynamoDB)

Dynamo gives DynamoDB an Ecto shape: `Dynamo.Schema` for typed items,
`Dynamo.Repo` as the supervised process you call, pure `Dynamo.Request`
builders underneath, and one `%Dynamo.Error{}` for every failure. Docs:
https://elixir-dynamodb.dev/docs/ (API reference, guides, changelog).

Read `references/cheatsheet.md` for the compact API. Follow the workflow
below in order; every step names the check that confirms it.

## Workflow

### 1. Confirm the version and the repo

- `mix.exs` MUST contain `{:dynamo, github: "bmalum/dynamo"}` (0.2 API). If
  code uses `Dynamo.Table.put_item`, `table_name`, `belongs_to` or untyped
  `field :x`, it is the 0.1 API; migrate using the table in
  `references/migration-0.1.md` before changing anything else.
- Exactly one module SHOULD `use Dynamo.Repo, otp_app: :app`, be configured
  under `config :app, MyApp.Dynamo, region: ..., endpoint: ...`, and be listed
  in the application's supervision tree. Check: `MyApp.Dynamo.config()` returns
  the config without raising "is not started".

### 2. Model before coding

- List access patterns first. Each `query` needs a partition key; each range
  needs a sort key that sorts the way the query reads (ISO 8601 datetimes do).
- Partition keys MUST be high-cardinality (never a date or status alone).
- Prefer one table with several schemas. Distinguish entities with
  `entity_name`; put child items in the parent's partition with
  `entity_name ParentModule` plus a sort-key field with a default prefix
  (`field :kind, :string, sort_key: true, default: "order"`).
- Use GSIs for the second and third pattern; GSI keys keep the field's own
  type, so numeric ranges work.
- Keep items under 400 KB; store blobs in S3.

### 3. Write the schema

```elixir
defmodule MyApp.Order do
  use Dynamo.Schema

  item do
    table "app"
    field :user_id, :string, partition_key: true
    field :placed_at, :utc_datetime, sort_key: true
    field :order_id, :string, sort_key: true
    field :total, :decimal
    field :status, :string, default: "pending"
    global_secondary_index "StatusIndex", partition_key: :status, sort_key: :placed_at
  end
end
```

Rules the compiler enforces (do not work around them): a `table`, at least
one partition key, known types, known options, fields referenced by keys and
indexes exist. Use explicit types; `:any` loses dates and decimals. Nested
data with types belongs in an embedded schema (`use Dynamo.Schema,
embedded: true`) or `{:list, type}`, not in `:map`.

Check: `Dynamo.Schema.primary_key(%MyApp.Order{user_id: "u", placed_at: dt,
order_id: "o"})` returns `{:ok, %Dynamo.Key{pk: %{"S" => "order#u"}, ...}}`.
Key values containing the separator (`#`) and nil partition keys return
`{:error, %Dynamo.Error{type: :validation_error}}`; change the data or the
separator, never suppress the error.

### 4. Use the Repo

- All operations return `{:ok, _} | {:error, %Dynamo.Error{}}`; use `!` variants only where a crash is the right outcome.
- `get`, `delete`, `update` need the full key populated on the struct.
- Prefer `condition: [field: {:op, value}]` over hand-written expression strings; the DSL types the values.
- `update` never changes key fields; delete and re-put (in a transaction if atomic).
- Counters: guard with a version condition or use `transaction/2` with `client_request_token:`; transport timeouts are retried and `{:increment, n}` is not idempotent.
- Reads: `query/2` returns `%Dynamo.Page{}`; loop with `start_key: page.last_evaluated_key`, or use `stream/2` / `query_all/2` with `limit:`. Scans read the whole table; use `stream(Schema, segments: n)` for migrations only.
- Batches: pass any number of items; the Repo chunks and retries unprocessed ones. Check `unprocessed == []`.

### 4b. Vector search (when the project embeds text/images)

- Declare `field :embedding, {:vector, n}` with `n` equal to the embedding model's output, plus `vector_index "Name", field: :embedding, distance: :cosine | :dot_product | :euclidean`.
- Add `partition_key: :tenant` to the index when searches are always scoped; the search `filter:` MUST then include `[tenant: value]`. Add `filters: [...]` for attributes you filter on.
- Project only what the UI needs (`projection: :include, projected_attributes: [...]`); the vector is never returned by default.
- `Repo.search_vectors(Schema, "Name", embedding, top_k: k, filter: [...])` returns `{:ok, %{results: [{struct, score}, ...]}}`. Lower score is closer for cosine/euclidean, higher for dot product.
- Tables with vector indexes MUST use on-demand billing; the index is eventually consistent, so do not assert a search result immediately after a write in tests without polling.

### 5. Handle errors by type

Match on `%Dynamo.Error{type: ...}`: `:conditional_check_failed`,
`:resource_not_found`, `:validation_error`, `:transaction_canceled` (read
`cancellation_reasons`), `:throttled` / `:provisioned_throughput_exceeded`
(`retryable?: true`, already retried by the client). Never parse `message`.

### 6. Test without AWS

- Unit: assert on `Dynamo.Request.*` and `Dynamo.Schema.dump/1` output; both are pure.
- Integration: configure `req_options: [plug: {Req.Test, MyApp.Dynamo}]` and stub responses with real DynamoDB JSON shapes, or run DynamoDB Local with `endpoint: "http://localhost:8000"`.
- Add `consolidate_protocols: Mix.env() != :test` to `mix.exs` when schemas are defined in tests.

### 7. Tables

`mix dynamo.create_table --schema MyApp.Order --schema MyApp.User --repo MyApp.Dynamo`
creates the table and merged GSIs for a single-table design. Never create
tables from application code at boot.

## Do not

- Do not write `NULL` to "remove" an attribute; use `update(item, field: :remove)`.
- Do not use `-` as `key_separator` with date sort keys (dates contain `-`); the library rejects it at runtime.
- Do not read `Dynamo.Client` responses directly; go through the Repo.
- Do not mock `Dynamo.Repo` or `Dynamo.Client` modules; stub HTTP.
- Do not put example schemas in `lib/` of a library.

## References

| File | Use |
|---|---|
| `references/cheatsheet.md` | every operation and option on one page |
| `references/migration-0.1.md` | mapping from the 0.1 API |
| https://elixir-dynamodb.dev/docs/data_modelling.html | keys, GSIs, single-table, embedded schemas |
| https://elixir-dynamodb.dev/docs/testing.html | Req.Test, in-memory fake, DynamoDB Local |
