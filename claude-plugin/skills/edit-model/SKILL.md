---
name: edit-model
description: Read and change the data model open in DB Modeler, the visual PostgreSQL modeler running in the browser. Use whenever the user asks to look at, describe or change that model — add or rename tables, columns, primary keys, foreign keys, relations, indexes, constraints, sequences, tablespaces, comments; lay out the diagram; or produce the creation script or a migration. Also use before calling get_document or apply_document for the first time in a conversation, as it describes the .dbm format those tools exchange.
---

# Changing the model open in DB Modeler

DB Modeler keeps the model in a browser window. **The window is the source of truth**: you never write the
user's `.dbm` file, and the user saves it themselves (Ctrl+S). You work through a copy.

## The loop

1. `get_status` — is a window connected, and what does it hold? If none, `open_app`.
2. `get_document` — writes the open document to a **working file** and gives you its path.
3. Read that file and **retouch it** with Edit. Keep everything you are not changing, ids first.
4. `apply_document` — the application checks it, normalizes it and replaces its document in **one undoable
   step**. It answers with the changes, what the normalization put right and the warnings of the SQL script.
5. Read that answer. The working file is rewritten with the applied document, so you can edit it again
   straight away, without a new `get_document`.

Two rules that matter:

- **Always `get_document` before editing.** `apply_document` refuses a document the user changed in the
  meantime, and tells you to read again. Do not keep a copy from earlier in the conversation.
- **Never rewrite the file from scratch.** Edit the parts you change. Rewriting loses ids, which are what the
  diff, the diagram and the relations hang on.

To read without changing anything: `get_sql` (the creation script, or one object by its id), `get_migration`
(from a reference `.dbm` on disk), `get_selection` (what the user has selected, by ids).

## The file

JSON, two-space indent, a fixed key order. Minimal example:

```json
{
  "format": "db-modeler",
  "version": 1,
  "model": {
    "info": { "name": "Shop", "version": "1.0", "description": "Sales" },
    "typeCatalog": ["uuid", "varchar(255)"],
    "schemas": [{ "id": "s_k3f9a2", "name": "sales" }],
    "tables": [
      {
        "id": "t_8x2mq1",
        "schema": "s_k3f9a2",
        "name": "customer",
        "columns": [
          { "id": "c_p0z7r4", "name": "id", "type": "uuid", "required": true },
          { "id": "c_w5n1d8", "name": "email", "type": "varchar(255)", "required": true }
        ],
        "primaryKey": { "name": "customer_pk", "columns": ["c_p0z7r4"] }
      }
    ]
  },
  "diagram": {
    "layout": { "paper": "A4", "orientation": "landscape", "scale": 1, "marginMm": 10 },
    "symbols": [{ "id": "v_a1b2c3", "kind": "table", "ref": "t_8x2mq1", "x": 120, "y": 80 }]
  }
}
```

**An empty list may be omitted**, so a new table needs only its `id`, `name` and `columns`. An **unknown
property is refused**, and so is a link to an id that does not exist.

### Ids

A type prefix, an underscore, six characters from `0-9a-z`: `t_8x2mq1`. **Make up ids for the objects you
create** (any unused suffix will do) and **never change an existing one**: ids are how the application
recognises an object across a change, and how the diff detects a rename instead of a drop and a create.

| Prefix | Object | Prefix | Object |
|---|---|---|---|
| `p_` | tablespace | `c_` | column |
| `s_` | schema | `i_` | index |
| `t_` | table | `k_` | constraint (UNIQUE, CHECK) |
| `q_` | sequence | `r_` | foreign key (reference) |
| `v_` | symbol of the diagram | | |

A primary key has no id: it is the one of its table.

### `model`

- `info`: `name` (required), `version`, `description`, `modified`. **Leave `modified` alone**: the application
  sets it when the user saves.
- `typeCatalog`: the types offered for completion. You need not maintain it — the types of your columns are
  added when the document is applied.
- `tablespaces`: `id`, `name`, `location` (absent: expected to exist on the server), `comment`.
- `defaultTablespaces`: `{ "tables": "p_…", "indexes": "p_…" }`, given to new objects by the application only.
- `schemas`: `id`, `name`, `comment`. A table or a sequence **without** `schema` is in the default schema.
- `tables`: `id`, `schema`, `name`, `comment`, `tablespace`, `columns`, `primaryKey`, `indexes`,
  `constraints`, `references`.
- `sequences`: `id`, `schema`, `name`, `type` (`smallint` | `integer` | `bigint`), `start`, `increment`,
  `min`, `max`, `cache` (integers **written as strings**, a `bigint` going beyond JavaScript numbers),
  `cycle` (boolean, false by default), `comment`. Sequences have no link with columns: a column uses one
  through its `default`, `"nextval('order_seq')"`.

A column is `{ id, name, type, required }` plus the optional `default` (an SQL expression written as typed)
and `comment`. `type` is free text. A primary key is `{ "name": …, "columns": ["c_…", …] }`, in key order,
plus the optional `tablespace`; its columns are always `required`.

### Indexes and constraints

**Every field below is required unless marked optional** — an index without `unique`, or a constraint without
`kind`, is refused:

- index: `{ "id": "i_…", "name": …, "unique": false, "definition": … }`, plus the optional `comment` and
  `tablespace`;
- constraint: `{ "id": "k_…", "name": …, "kind": "unique", "definition": … }`, `kind` being `unique` or
  `check`, plus the optional `comment` and `tablespace` (used by a `unique` one only).

Both carry a free **definition** in which **`${c_…}` designates a column by its id**:

- index: everything after `ON table` — `"(${c_w5n1d8})"`, `"(lower(${c_w5n1d8}))"`,
  `"USING gin (${c_p0z7r4})"`, `"(${c_w5n1d8}) WHERE ${c_p0z7r4} IS NULL"`;
- `unique` constraint: what follows `UNIQUE` — `"(${c_w5n1d8})"`;
- `check` constraint: the boolean expression alone, without its parentheses — `"${c_p0z7r4} > 0"`.

`${?name}` is a broken reference to a deleted column: such an object is reported and left out of the SQL.

### Relations: declare them, do not write their columns

A `reference` in a table is a foreign key **owned by that table** (the child), pointing at `target` (the
parent). With a `relation`, the application **generates and maintains** everything else:

```json
"references": [
  {
    "id": "r_m4k8t2",
    "name": "order_customer_fk",
    "target": "t_8x2mq1",
    "columns": [],
    "relation": { "cardinality": "1:n", "constraint": "optional", "index": "i_z3p7h5" }
  }
]
```

Write `"columns": []` and let the normalization fill them: it creates one column per column of the parent
primary key, named `<parent>_<column>`, with the same type, the right nullability, and puts them in the child
key when `constraint` is `primary`. If you want to name an FK column yourself, declare the column and the pair
`{ "column": "c_…", "target": "c_…" }`; the name is kept, the rest is still driven.

A table whose key is made only of identifying relations (an association table such as `order_line`, keyed by
its order and its product) may leave its key empty: `"primaryKey": { "name": "order_line_pk", "columns": [] }`.
The normalization fills it, keeping its name. Two relations of one table to the same parent (a shipping and a
billing address) would generate the same `<parent>_<column>` name: name those columns yourself.

- `cardinality`: `1:n` or `1:1` (which makes the held index unique).
- `constraint`: `optional` (FK columns nullable), `required` (NOT NULL), `primary` (identifying — the FK
  columns join the child primary key; no cycle of identifying relations is allowed).
- `index`: id of an index of the **child** table, which the relation holds and maintains; omit it for no index.
  You must also create that index in `indexes`, with an empty definition and `"unique": false` — the relation
  writes both: `{ "id": "i_z3p7h5", "name": "order_customer_idx", "unique": false, "definition": "" }`.

**Never edit a column a relation drives** (type, nullability, key membership) nor the definition of a held
index: the normalization puts them back and tells you it did. Its name is yours to choose.

A `reference` **without** `relation` is a plain foreign key: you write its `columns` pairs yourself and
nothing is generated.

### `diagram`

A table exists in the dictionary even without a symbol, but **the user only sees what the diagram draws**:
after creating a table, add a symbol for it, or the model will look empty.

- `layout`: `paper` (`A4` | `A3` | `A2`), `orientation` (`portrait` | `landscape`), `scale` (0.4 to 1.6),
  `marginMm` (0 to 30). Required.
- `display`: `showTypes`, `showKeyMarkers`, `showSchema`, `keysOnly`, `showLinkNames`, `showComments`. May be
  omitted.
- `symbols`, in drawing order — texts are always drawn under the tables and the links:
  - table: `{ "id": "v_…", "kind": "table", "ref": "t_…", "x": 120, "y": 80, "width": 220, "color": "#eaf3ff" }`.
    `width` and `color` are optional; the height is computed from the columns shown. Leave room between two
    tables and place each one so that its links stay short.
  - link: `{ "id": "v_…", "kind": "link", "ref": "r_…", "from": "v_child", "to": "v_parent" }` — `from` is the
    symbol of the table **owning** the foreign key. The route is computed; `fromAnchor`, `toAnchor` and
    `middle` only hold what the user has moved by hand, so do not write them.
  - text: `{ "id": "v_…", "kind": "text", "title": "Customers", "text": "", "x": 40, "y": 20, "width": 300,
    "height": 60, "color": "none" }` — a titled frame used to name or group an area; `"none"` draws no
    background. It does not contain the tables it covers.

A symbol whose object disappears is removed when the document is applied.

## What is refused, and what is only reported

**Refused** (nothing changes, you get the error with its place, like
`model.tables[2].columns[0].name: must not be empty`): malformed JSON, a wrong header, an unknown property, a
missing or ill-typed field, an empty name, an id pointing at nothing, a link symbol whose ends do not match
its tables.

**Only warned**, in the answer of `apply_document` and in `get_sql`: duplicate names where the uniqueness
rules forbid them, an index or constraint with an empty or broken definition, a foreign key without column, a
table without column, a reserved word used unquoted. The model accepts them; PostgreSQL refuses the script.

Names are written to SQL **exactly as typed**: double quotes come from the user. `"Order"` is a quoted
identifier, `order` is a reserved word that will be reported.
