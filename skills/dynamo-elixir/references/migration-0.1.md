# Migrating from Dynamo 0.1 to 0.2

| 0.1 | 0.2 |
|---|---|
| `Dynamo.Table.put_item(s)` | `MyRepo.put(s)` |
| `Dynamo.Table.get_item(s)` | `MyRepo.get(s)` (full key required) |
| `Dynamo.Table.list_items(s, sk_operator: :begins_with, sort_key: v)` | `MyRepo.query(s, sort_key: {:begins_with, v})` → `%Dynamo.Page{}` |
| `Dynamo.Table.list_items(s, index_name: "X")` | `MyRepo.query(s, index: "X")` |
| `Dynamo.Table.update_item(s, %{a: 1})` | `MyRepo.update(s, a: 1)` |
| `Dynamo.Table.batch_write_item(list)` | `MyRepo.batch_write(list)` |
| `Dynamo.Table.parallel_scan(M, segments: 4)` | `MyRepo.stream(M, segments: 4)` |
| `Dynamo.Table.Stream.scan(M)` | `MyRepo.stream(M)` |
| `Dynamo.Transaction.transact([...])` | `MyRepo.transaction([...])` (ops now `{:put, s, opts}` etc.) |
| `table_name "t"` | `table "t"` |
| `field :x` (untyped) | `field :x, :string` (or the real type) |
| `belongs_to :parent, P, sk_strategy: :prefix` | `entity_name P` + `field :kind, :string, sort_key: true, default: "child"` |
| `Dynamo.Config.put_process_config/1` | repo config / `use Dynamo.Schema, opts` |
| `Dynamo.Logger.enable/0` | attach to `[:dynamo, :request, :stop]` |

Stored keys are compatible for schemas that used the default `#` separator,
single-field keys, default `pk`/`sk` names **and single-word module names**.
The default entity name is now `Macro.underscore/1` of the module basename
(`UserProfile` → `"user_profile"`); 0.1 lower-cased it (`"userprofile"`).
Set `entity_name "userprofile"` explicitly on such schemas to keep reading
existing data. Composite sort keys written by 0.1 with values containing the
separator are corrupted and must be re-written.
