---
name: dynamo-maintainer
description: Maintain and release the Dynamo library (Elixir + DynamoDB) itself. Covers the module map and the invariants that must hold, how to run unit, property and live-AWS tests, how to add a feature end to end (type, schema, request, repo, fake, tests, docs, skill, website), the release checklist for GitHub tags and Hex, and the traps hit during the 0.2 rewrite. Use when changing code under lib/ or test/ in bmalum/dynamo, cutting a release, or updating elixir-dynamodb.dev after a library change. Not for using the library in an application; that is the dynamo-elixir skill.
version: 0.2.0
tags: [elixir, dynamodb, maintainer, release, hex, testing]
---

# Maintaining Dynamo

This is the procedure for changing the library, not for using it. Follow the
steps in order; each names the check that proves it is done.

## 1. Orientation: the invariants

Read `Agents.md` first (mental model, cheat sheet). Then hold these while editing:

- **One owner per decision.** Item keys: `Dynamo.Schema.primary_key/1` and `index_key/2`, nothing else builds a key. AWS errors: `Dynamo.Error.from_aws/2` via `Dynamo.Client`, nothing above the client reads `__type`. Expressions: `Dynamo.Update` and `Dynamo.Condition`. If you find a second implementation of any of these, that is the bug.
- **Fail loud.** Nil partition key, separator inside a key value, unknown option, wrong type, updating a key field, embedded schema stored as an item: all return `{:error, %Dynamo.Error{type: :validation_error}}` before any request. Never a sentinel string, never a silent drop.
- **`Dynamo.Request` is pure.** No I/O, returns `{:ok, {action, payload}}`. Every builder has a golden-payload test.
- **Every public operation returns `{:ok, _} | {:error, %Dynamo.Error{}}`** and has a `!` variant generated in `Dynamo.Repo.__using__`.
- **Options are validated** with `Keyword.validate/2` at every public entry point; unknown keys are errors.
- **Docs and code agree.** README, `Agents.md`, guides and the website snippets are run against the code. If you change an API, grep all of them.

Module map: `lib/dynamo/{error,type,type/builtin,raw,encodable,key,schema,update,condition,request,credentials,client,page,repo,stream}.ex`, `lib/mix/tasks/dynamo/{helpers,create_table,delete_table,list_tables,generate_schema}.ex`.

## 2. Test tiers

```bash
mix format --check-formatted
MIX_ENV=test mix compile --force --warnings-as-errors   # also plain dev env
mix test                                                # unit + property, ~1 s, uses test/support/fake_dynamo.ex
mix docs                                                # must be warning-free
```

Live suite (creates and deletes its own tables; ~2 min; costs cents):

```bash
eval "$(aws configure export-credentials --profile elixir-playground --format env)"
AWS_REGION=eu-central-1 mix test --include integration test/integration/live_test.exs
aws dynamodb list-tables --profile elixir-playground --output text | grep -c livetest   # MUST print 0 afterwards
```

DynamoDB Local instead: `DYNAMO_ENDPOINT=http://localhost:8000 AWS_ACCESS_KEY_ID=l AWS_SECRET_ACCESS_KEY=l mix test --include integration ...`. Set `DYNAMO_LIVE_SUFFIX=<name>` at compile time when several people share an account. `DYNAMO_LIVE_KEEP=1` leaves tables for inspection.

Rules: a change to `Request`/`Schema`/`Update`/`Condition` needs a unit test; a change that touches the wire (new action, new attribute type, endpoint) needs a live scenario too. The fake only implements what the tests need; extend `test/support/fake_dynamo.ex` rather than weakening an assertion. Run the live suite at least once with a random seed different from the last run (ordering bugs, idempotency tokens).

## 3. Adding a feature end to end

Order matters; each step has a place to put it.

1. **Type** (if a new value kind): module in `lib/dynamo/type/builtin.ex` implementing `dump/1`, `load/1`; register in `Dynamo.Type.@builtin` or `resolve!/1`; parameterised types resolve to `{Module, param}` (see `TypedList`, `Vector`) and `Type.call/3` dispatches. Property test in `test/dynamo/type_test.exs`.
2. **Schema DSL** (if declared per schema): macro in `Dynamo.Schema`, imported in `item/1`'s `only:` list, a `__thing__/3` compile-time validator, stored in `@dynamo_compiled`, exposed via `__schema__/1,2`. Compile-error tests in `test/dynamo/schema_test.exs` (define bad modules inside `assert_raise`; define good ones in `test/support/test_schemas.ex`, never inline in a test, because struct literals in the same context fail to compile).
3. **Request builder**: function in `Dynamo.Request` with an `@opts` allow-list, `validate/2`, `expression_opts/3` for condition/filter/projection. Golden test with the exact map.
4. **Repo**: delegate in `Dynamo.Repo.__using__` (both plain and `!`), implementation as `Dynamo.Repo.fn/…` taking `repo` first, loading results through `Schema.load/2`.
5. **Fake**: `handle/3` clause in `test/support/fake_dynamo.ex`; repo test in `test/dynamo/repo_test.exs` (that module is `async: false`, it restarts `Dynamo.TestRepo`).
6. **Mix task** if the feature has table-level shape (`create_table` derives GSIs and vector indexes from schemas; add there).
7. **Live scenario** in `test/integration/live_test.exs`; schemas in `test/support/live_schemas.ex`.
8. **Docs**: README section, `Agents.md` cheat-sheet line and rule of thumb, relevant `guides/*.md`, `CHANGELOG.md`, `skills/dynamo-elixir/SKILL.md` if it changes how a user should work. Then `cp Agents.md skills/dynamo-elixir/references/cheatsheet.md`.
9. **Website**: see `../dynamo_website/AGENTS.md`; run `./build-docs.sh ../dynamo` there and push.

## 4. Release checklist

```bash
# 0. on the release branch, everything green
mix format --check-formatted && MIX_ENV=test mix compile --force --warnings-as-errors && mix test && mix docs
# live suite against AWS (section 2), tables cleaned up

# 1. version
#    mix.exs @version, CHANGELOG.md heading (unreleased -> date), skills/dynamo-elixir/SKILL.md `version:`,
#    ../dynamo_website index.html JSON-LD softwareVersion + release pill + build-docs llms.txt "Current version"

# 2. merge and tag
git checkout main && git merge --no-ff rewrite/repo-architecture
git tag -a v0.2.0 -m "Dynamo 0.2.0" && git push origin main --tags

# 3. Hex (first publish: `mix hex.user register` / auth; package name `dynamo` was free on 2026-09-27)
mix hex.build            # inspect the file list; must include lib, mix.exs, README, CHANGELOG, LICENSE, guides
mix hex.publish          # publishes package + docs to hexdocs.pm/dynamo

# 4. after Hex: switch website docs links back to hexdocs or keep both; README install line to {:dynamo, "~> 0.2"}

# 5. website
cd ../dynamo_website && ./build-docs.sh ../dynamo && git commit -am "Docs for vX.Y.Z" && git push
```

Do not publish to Hex from a branch or with the live suite red. Do not tag before the website's docs are regenerated from the same commit (the docs page shows the git SHA in `llms-full.txt`).

## 5. Traps (each one happened)

- **Formatter idempotency.** `mix format` flips on multi-line `gen all` with trailing keyword options and on `with` clauses with keyword args split across lines. If `--check-formatted` disagrees with `mix format`, restructure the expression (bind the keyword list to a variable) instead of fighting it.
- **Struct literals in the same compilation unit** (`%Foo{}` where `Foo` is defined in the same `.exs`) fail. Test schemas go in `test/support/`; `mix run` scripts need `-r schemas.exs` as a separate file.
- **`@derive`/`defimpl` in tests** needs `consolidate_protocols: Mix.env() != :test` (already set in `mix.exs`). Keep it.
- **Code Defender** blocks pushes to unapproved public repos on Amazon-managed machines and blocks commits containing AWS-looking secrets (even the official `EXAMPLE` key). Tests use `not-a-real-secret-key-used-only-in-tests`. Pushes need `git-defender request-repo` approval or, as the owner did once, `git config --local core.hooksPath /dev/null` per repo.
- **`SearchVectors` is served from `search-dynamodb.<region>.amazonaws.com`**, not the regular endpoint (`UnknownOperationException` otherwise). `Dynamo.Client.endpoint_for/2` routes it; a custom `:endpoint` (DynamoDB Local) is reused unless `:search_endpoint` is set. New actions with an `IsSearchOperation`-style ruleset flag need the same treatment; check `botocore/data/dynamodb/2012-08-10/endpoint-rule-set-1.json`.
- **Projections drop source attributes.** `KEYS_ONLY`/`INCLUDE` on GSIs and vector indexes return `pk`/`sk` but not the fields they were built from; `Schema.load/2` parses them back (`recover_key_fields/2`). This only works because separators inside key values are rejected on write. Do not relax that rule.
- **Vector indexes**: on-demand billing only; every `SearchSchema` attribute must appear in `AttributeDefinitions`; the index is eventually consistent (live test polls); the score direction depends on the distance function.
- **`ClientRequestToken` is deduplicated by DynamoDB for 10 minutes.** Tests must generate random tokens, not `System.unique_integer` (collides across VM restarts).
- **BETWEEN on composite string keys**: `"2024-01-05"` excludes `"2024-01-05T10:00:00Z#o1"`. The inclusive upper bound is `"2024-01-05~"`, not `"2024-01-05#~"` (`#` < `T`).
- **Credentials**: `Credentials.resolve/1` takes `:env`, `:ecs_host`, `:imds_base` for tests; the cache is `:persistent_term` on the read path; `req_options:` (not `req_opts:`) is the option name, a typo there once silently disabled the test plug and timeouts on the IMDS path.
- **`mock`/meck** does not compile on OTP 29. The suite uses `Req.Test` plugs and the in-memory fake; keep it that way.
- **Live test teardown** runs in a different process; the repo linked to `setup_all` may already be gone. Teardown restarts it and tolerates `:already_started`.

## 6. Where things are documented for others

- Users: README, `guides/`, `Agents.md`, `skills/dynamo-elixir/` (all published on elixir-dynamodb.dev and in `llms-full.txt`).
- Website maintainers: `../dynamo_website/AGENTS.md`.
- CI: `.github/workflows/ci.yml` (format, warnings-as-errors, unit matrix 1.16/26 and 1.18/27, live suite against DynamoDB Local). Local toolchain is Elixir 1.20/OTP 29; if `erlef/setup-beam` lacks a matrix version, bump the matrix, not the code.
