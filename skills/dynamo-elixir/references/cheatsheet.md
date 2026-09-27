# Dynamo Agent Guide

A concise reference for AI agents and developers using the Dynamo library. Every
snippet here compiles against the current API; if something in this file
disagrees with the code, the code is right and this file has a bug.

## Mental model

```
Schema  – typed fields + key layout. Pure. `Dynamo.Schema.primary_key/1`, `dump/1`, `load/2`.
Request – pure builders: struct + opts -> {action, payload}. `Dynamo.Request`, `Dynamo.Update`.
Client  – SigV4, retries, telemetry, error normalisation. `Dynamo.Client`.
Repo    – supervised owner of client + credentials. The thing you call. `use Dynamo.Repo`.
```

All operations return `{:ok, value} | {:error, %Dynamo.Error{}}`. Nothing above
the client ever sees a raw AWS error map.

## Defining a schema

```elixir
defmodule MyApp.Order do
  use Dynamo.Schema                       # opts: key_separator, partition_key_name, sort_key_name,
                                          #       prefix_sort_key, raw_keys, omit_nil
  item do
    table "app"
    entity_name "order"                   # default: underscored module basename

    field :user_id, :string, partition_key: true
    field :placed_at, :utc_datetime, sort_key: true
    field :order_id, :string, sort_key: true
    field :total, :decimal
    field :status, :string, default: "pending"
    field :version, :integer, default: 0

    global_secondary_index "StatusIndex", partition_key: :status, sort_key: :placed_at
  end
end
```

Types: `:string :integer :float :decimal :boolean :binary :utc_datetime
:naive_datetime :date :time :map :list :string_set :number_set :binary_set :any`,
`{:list, type}`, `{:vector, n}` (embedding), an embedded schema module
(`use Dynamo.Schema, embedded: true`), or a module implementing `Dynamo.Type`.

Nil fields are omitted on write (`omit_nil: true`); `update(item, f: :remove)`
deletes an attribute, `update(item, f: nil)` writes `NULL`.

Generated keys: `pk = "order#<user_id>"`, `sk = "<placed_at>#<order_id>"`.
Alternative: `partition_key [:a, :b]` / `sort_key [:c, :d]` instead of per-field flags.

Compile-time errors for: missing `table`, no partition key, unknown option,
unknown type, undefined field in a key/index, duplicate field/index.

## Defining a repo

```elixir
defmodule MyApp.Dynamo do
  use Dynamo.Repo, otp_app: :my_app
end

config :my_app, MyApp.Dynamo, region: "eu-central-1", endpoint: System.get_env("DYNAMO_ENDPOINT")
children = [MyApp.Dynamo]
```

## Operations cheat sheet

```elixir
alias MyApp.Dynamo, as: Repo

Repo.put(struct, condition: "attribute_not_exists(pk)")           # {:ok, struct}
Repo.put(struct, condition: [pk: :not_exists, status: {:in, ["a", "b"]}])   # DSL → same expression
Repo.put(struct, return_values: :all_old)                          # {:ok, old | nil}
Repo.get(%Order{user_id: "u", placed_at: dt, order_id: "o"})       # {:ok, struct | nil}; full key required
Repo.get(key, consistent: true, projection: [:total])
Repo.delete(key)                                                   # {:ok, nil}
Repo.delete(key, return_values: :all_old)                          # {:ok, old | nil}
Repo.update(key, status: "paid", version: {:increment, 1})         # {:ok, nil}
Repo.update(key, [tags: {:add, MapSet.new(["x"])}, tmp: :remove], return_values: :all_new)

Repo.query(%Order{user_id: "u"})                                   # {:ok, %Dynamo.Page{}}
Repo.query(%Order{user_id: "u"}, sort_key: {:begins_with, "2024-06"})
Repo.query(%Order{user_id: "u"}, sort_key: {:between, "2024-01-01", "2024-12-31~"}, descending: true, limit: 50)
Repo.query(%Order{user_id: "u", placed_at: dt})                    # struct sk fields => begins_with on partial sk
Repo.query(%Order{user_id: "u", placed_at: dt}, sort_key: :none)   # ignore struct sk fields
Repo.query(%Order{status: "paid"}, index: "StatusIndex", sort_key: {:gt, ~U[2024-01-01 00:00:00Z]})
Repo.query(%Order{user_id: "u"}, filter: "#t > :m", names: %{"#t" => "total"}, values: %{m: 100})
Repo.query(%Order{user_id: "u"}, filter: [total: {:gt, 100}])                # same, via Dynamo.Condition
Repo.query(%Order{user_id: "u"}, filter: {:or, [status: "open"], [total: {:gte, 100}]})
Repo.query(%Order{user_id: "u"}, limit: 50, start_key: page.last_evaluated_key)
Repo.query_all(%Order{user_id: "u"}, limit: 1_000)                 # {:ok, [struct]}

Repo.scan(Order, limit: 100)                                       # {:ok, %Dynamo.Page{}}
Repo.stream(%Order{user_id: "u"}, page_size: 100)                  # lazy Stream (raises Dynamo.Error on failure)
Repo.stream(Order, segments: 8, max_concurrency: 4)                # parallel scan

Repo.batch_write(structs ++ [{:delete, s}])                        # {:ok, %{unprocessed: []}}
Repo.batch_get([key1, key2])                                       # {:ok, %{items: [...], unprocessed_keys: []}}

Repo.transaction([
  {:update, %Acct{id: "a"}, [balance: {:decrement, 5}], condition: "#b >= :v", names: %{"#b" => "balance"}, values: %{v: 5}},
  {:update, %Acct{id: "b"}, [balance: {:increment, 5}]},
  {:put, %Ledger{id: "l1"}, condition: "attribute_not_exists(pk)"},
  {:check, %Acct{id: "c"}, "attribute_exists(pk)"},
  {:delete, %Hold{id: "h"}}
], client_request_token: "idem-1")

# vector search (schema declares `vector_index "Semantic", field: :embedding, partition_key: :tenant, filters: [:lang]`)
Repo.search_vectors(Doc, "Semantic", embedding, top_k: 5, filter: [tenant: "t", lang: "en"])
#=> {:ok, %{results: [{%Doc{}, score}, ...], consumed_capacity: ...}}

Repo.request("DescribeTable", %{"TableName" => "app"})              # raw escape hatch
```

Update operators: plain value, `{:increment, n}`, `{:decrement, n}`, `{:add, n | set}`,
`{:delete, set}`, `{:append, list}`, `{:prepend, list}`, `{:if_not_exists, v}`, `:remove`.
Key fields cannot be updated (error) – delete and re-put.

Expression options everywhere: `condition:`/`filter:` (raw string, or a
`Dynamo.Condition` DSL: keyword list = AND of `field: value | {op, v} | :exists | ...`,
`{:and | :or, a, b}`, `{:not, a}`, nested path as list), `projection:` (string or
field list), `names:` (`%{"#n" => "attr"}`), `values:` (`%{v: elixir_value}`,
encoded for you). `return_values: :none | :all_old | :all_new | :updated_old | :updated_new`.

Retries: throttling/5xx are retried with backoff. Transport timeouts are retried
too, so `{:increment, n}` updates can double-apply after a timeout – guard with a
version `condition:` or use `transaction/2` + `client_request_token:`.

## Errors

```elixir
%Dynamo.Error{type: atom, message: String.t, aws_type: "ConditionalCheckFailedException" | nil,
              status: 400 | nil, retryable?: boolean, cancellation_reasons: [...] | nil, details: term}
```

Common `type`s: `:validation_error :resource_not_found :conditional_check_failed
:provisioned_throughput_exceeded :throttled :access_denied :authentication_error
:transaction_canceled :transaction_conflict :internal_server_error :transport_error
:decode_error :no_credentials`. Retryable ones are retried by the client (3× default).

Local validation failures (nil partition key, separator in a key value, unknown
option, wrong type, updating a key field, >25 batch items, duplicate items in a
transaction) return `{:error, %Dynamo.Error{type: :validation_error}}` *before*
any request is sent.

## Modelling rules of thumb

1. **List access patterns first.** Every query needs a partition key; design keys from queries, not from entities.
2. **High-cardinality partition keys.** Never a date or status alone. Combine (`partition_key [:tenant, :customer_id]`) or shard.
3. **Sort keys drive ranges.** Put the dimension you range over first (ISO 8601 datetimes sort correctly). Prefix with a type string for single-partition adjacency lists.
4. **GSIs for the second and third pattern.** Keys keep their field type (numbers stay `N`). Use `:keys_only`/`:include` to cut cost. No consistent reads on GSIs.
5. **Single table:** several schemas share `table "app"`; `entity_name` disambiguates the `pk`. Child items in the parent's partition: `entity_name ParentModule` (compile-time link) + `field :kind, :string, sort_key: true, default: "child"`.
6. **Items < 400 KB.** Store blobs in S3, keep the reference.
7. **Unbounded lists don't belong in one item.** One item per element with a composite sort key.
8. **Scans are for migrations.** They read every item; `stream/2` bounds memory, not cost.
9. **Idempotency:** `client_request_token:` on transactions; `condition: "attribute_not_exists(pk)"` on creates.
10. **Vectors:** `{:vector, n}` field + `vector_index`; `:cosine` for unnormalised embeddings, `:dot_product` for unit vectors. Add `partition_key:` to scope searches to a tenant (required in the filter). On-demand billing only; searches are eventually consistent.
11. **Fail loud:** the library never writes `"empty"` or silently drops data. If you get a `:validation_error`, fix the data or the schema.

## Testing

- Request building is pure: assert on `Dynamo.Request.*` output directly.
- Stub HTTP with `req_options: [plug: {Req.Test, MyRepo}]` in the repo config, or
  copy `test/support/fake_dynamo.ex` (in-memory DynamoDB) from this repo.
- Set `consolidate_protocols: Mix.env() != :test` in `mix.exs` if schemas are defined in tests.

## Mix tasks

```
mix dynamo.create_table --schema MyApp.Order [--repo MyApp.Dynamo | --endpoint URL --region R]
mix dynamo.create_table NAME --partition-key id --no-sort-key
mix dynamo.list_tables [--name-contains x]
mix dynamo.delete_table NAME [--force]
mix dynamo.generate_schema NAME [--module M] [--output path] [--overwrite]
```

All exit non-zero on failure and honour the application's config.

## Maintaining the library itself

See `skills/dynamo-maintainer/SKILL.md`: invariants, test tiers (unit, property,
live AWS), adding a feature end to end, release checklist, known traps. The
website (`../dynamo_website/AGENTS.md`) is regenerated from this repo with
`./build-docs.sh`.
