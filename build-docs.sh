#!/usr/bin/env bash
# Regenerates /docs, /skills, llms.txt and llms-full.txt from the dynamo library
# checkout (default: ../dynamo). Usage: ./build-docs.sh [path-to-dynamo]
set -euo pipefail
LIB="${1:-../dynamo}"

( cd "$LIB" && mix docs --formatter html >/dev/null )
rm -rf docs skills
cp -R "$LIB/doc" docs
rm -f docs/*.epub
cp -R "$LIB/skills" skills

# llms.txt: the index AI crawlers and agents read first (https://llmstxt.org)
cat > llms.txt <<'TXT'
# Dynamo

> Ecto-inspired Repo and schema library for Amazon DynamoDB in Elixir. Typed schemas that generate composite keys, native DynamoDB vector search (vector_index + search_vectors), a supervised Repo with credential resolution, retries and telemetry, pure request builders, and one normalised %Dynamo.Error{} for every failure. MIT licensed, by Martin Karrer (https://karrer.solutions).

Install: `{:dynamo, github: "bmalum/dynamo"}` in mix.exs (Elixir 1.16+). Current version 0.2.0. The 0.1 API (Dynamo.Table, table_name, untyped fields, belongs_to) is removed; see the changelog for the migration table.

## Docs

- [README](https://elixir-dynamodb.dev/docs/readme.html): overview, installation, every operation with examples
- [Getting started](https://elixir-dynamodb.dev/docs/getting_started.html): DynamoDB Local, repo, schema, CRUD in six steps
- [Data modelling](https://elixir-dynamodb.dev/docs/data_modelling.html): composite keys, sort-key strategies, GSIs, single-table design, embedded schemas, vector search, custom types
- [Streaming, batches and transactions](https://elixir-dynamodb.dev/docs/streaming.html)
- [Testing](https://elixir-dynamodb.dev/docs/testing.html): pure request builders, Req.Test plugs, in-memory fake, DynamoDB Local
- [Agent guide](https://elixir-dynamodb.dev/docs/agents.html): compact cheat sheet and modelling rules for AI agents and humans
- [Changelog](https://elixir-dynamodb.dev/docs/changelog.html): 0.2 rewrite, bugs fixed, 0.1 to 0.2 migration table
- [API reference](https://elixir-dynamodb.dev/docs/api-reference.html)

## Agent skill

- [dynamo-elixir SKILL.md](https://elixir-dynamodb.dev/skills/dynamo-elixir/SKILL.md): step-by-step skill for coding agents working on projects that use Dynamo
- [Cheat sheet](https://elixir-dynamodb.dev/skills/dynamo-elixir/references/cheatsheet.md)
- [0.1 migration](https://elixir-dynamodb.dev/skills/dynamo-elixir/references/migration-0.1.md)

## Optional

- [Source on GitHub](https://github.com/bmalum/dynamo)
- [Full text of all docs in one file](https://elixir-dynamodb.dev/llms-full.txt)
TXT

{
  echo "# Dynamo: full documentation (generated $(date -u +%Y-%m-%d) from $(git -C "$LIB" rev-parse --short HEAD))"
  echo
  for f in README.md guides/GETTING_STARTED.md guides/DATA_MODELLING.md guides/STREAMING.md guides/TESTING.md Agents.md CHANGELOG.md skills/dynamo-elixir/SKILL.md; do
    echo; echo "---"; echo; echo "<!-- source: $f -->"; echo
    cat "$LIB/$f"
  done
} > llms-full.txt

echo "docs, skills and llms.txt updated from $(git -C "$LIB" rev-parse --short HEAD) ($(git -C "$LIB" rev-parse --abbrev-ref HEAD))"

# cache-bust styles.css / script.js references in index.html
css=$(shasum styles.css | cut -c1-8); js=$(shasum script.js | cut -c1-8)
sed -i '' -E "s|href=\"styles\.css(\?v=[0-9a-f]+)?\"|href=\"styles.css?v=$css\"|; s|src=\"script\.js(\?v=[0-9a-f]+)?\"|src=\"script.js?v=$js\"|" index.html
