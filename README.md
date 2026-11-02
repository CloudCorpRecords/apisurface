# apisurface

You are about to release version two of a library. Will it
break anyone who upgrades? apisurface answers that from two
plain descriptions of the public surface — the exports each
version exposes — without reading any source code:

- **Removed exports** — present before, gone after.
  Breaking.
- **Added exports** — new in the later version.
  Non-breaking.
- **Kind changes** — an export that was a `function` and is
  now a `class`, or any other switch among `function`,
  `class`, `interface`, `type`, `const`, and `enum`.
  Breaking, with the detail recorded as
  `before kind -> after kind`.
- **Signature changes** — when both versions carry a
  signature for the same export and the text differs.
  Breaking, with both signatures in the detail. A signature
  present on only one side is not, on its own, a change.
- **Member changes** — for exports that list members
  (classes, interfaces, enums): names that disappeared are
  one breaking entry, in the order they appeared before;
  names that appeared are one non-breaking entry, in the
  order they appear after. An export with no members list
  counts as having no members.
- **Deprecation flips** — an export that became deprecated,
  or one that stopped being deprecated. Both are
  non-breaking entries.

A single export can contribute several entries — a widget
that changed kind, lost a member, and was deprecated all at
once produces three. Every entry names the export, reports
its kind (the later kind when the export still exists),
says what changed and whether it breaks, and carries a
detail string where the change defines one.

The result splits entries into a `breaking` list and a
`non_breaking` list, each sorted by export name and then by
change, plus a summary: how many exports each surface had,
how many entries landed in each list, and a verdict —
`breaking` when the breaking list is non-empty, `clean`
otherwise. The computation is pure and local: no network,
no configuration, no files beyond the input you pass in.
Malformed input — a surface without its exports list, an
export with no name, a kind outside the allowed set, a
duplicated export name inside one surface — is rejected
with an error naming the side and the exact path, and no
partial diff is produced.

## CLI

```bash
npx @reneturcios/apisurface diff --input args.json
npx @reneturcios/apisurface --version
```

`args.json` contains the full arguments object:

```json
{
  "before": {
    "exports": [
      { "name": "parse", "kind": "function", "signature": "(text: string) => Ast" },
      { "name": "Widget", "kind": "class", "members": ["render", "mount"] }
    ]
  },
  "after": {
    "exports": [
      { "name": "parse", "kind": "function", "signature": "(text: string, opts: Opts) => Ast" },
      { "name": "Widget", "kind": "class", "members": ["render"] },
      { "name": "format", "kind": "function" }
    ]
  }
}
```

`signature`, `members`, and `deprecated` are optional per
export. The diff is printed as JSON.

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or invalid
input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/apisurface mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "apisurface": {
      "command": "npx",
      "args": ["-y", "@reneturcios/apisurface", "mcp"]
    }
  }
}
```

### Tools

- `diff_api_surface` — Diff the public API surface between
  two versions.
  - `before` (surface object, required) — the earlier
    version, as `{exports}` where each export is
    `{name, kind, signature?, members?, deprecated?}`
  - `after` (surface object, required) — the later version,
    in the same shape

  Returns `{breaking, non_breaking, summary}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/apisurface
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/apisurface diff --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
