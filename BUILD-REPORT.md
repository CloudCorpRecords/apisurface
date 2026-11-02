# apisurface — Build Report

MCP Rebuild 1000, Batch 13. Original program build from the
packages-100 plan (cluster D #44), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch13/apisurface.md`
(read first). There is no external original; the tool
surface is the program's defined spec. Local build only —
nothing pushed or published.

Identity: repo `apisurface`, npm `@reneturcios/apisurface`,
MCP name `io.github.CloudCorpRecords/apisurface`, version
`0.1.0`, bin `apisurface` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Public API
  surface diff between two versions: removed exports,
  signature changes, breaking list.", 96 chars ≤100; npm
  entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/apisurface:0.1.0` carries
  **no** `version` field), `Dockerfile` (node:20-alpine
  two-stage, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/apisurface"`),
  `tsconfig.json`, `.gitignore`, `LICENSE` (MIT, Copyright
  (c) 2026 Rene Turcios), `README.md` (fresh text),
  `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27),
  `package-lock.json` (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`diff --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/apisurface.ts` (core,
  `VERSION = "0.1.0"`)
- `test/apisurface.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/apisurface`)

## Tools implemented (1)

- `diff_api_surface` — arguments: `before` (surface object,
  required) and `after` (surface object, required), where a
  surface is `{exports (array, required, may be empty) of
  {name (string, required, non-empty, unique within the
  surface), kind (string, required, one of function,
  class, interface, type, const, enum), signature (string,
  optional), members (array of strings, optional),
  deprecated (boolean, optional)}}`.

  Returns `{breaking, non_breaking, summary}`: exports are
  matched by name; only-in-before is `removed` (breaking),
  only-in-after is `added` (non-breaking); for exports on
  both sides, a kind difference is `kind_changed`
  (breaking, detail `"<before kind> -> <after kind>"`), a
  signature present on both sides and different is
  `signature_changed` (breaking, detail
  `"<before> -> <after>"`), members in before but not
  after are one `member_removed` entry (breaking, detail
  the names joined `", "` in before-order), members in
  after but not before are one `member_added` entry
  (non-breaking, detail in after-order, a missing members
  array counting as empty), and a deprecation flip is
  `deprecated` or `undeprecated` (both non-breaking). A
  single export can produce several entries. Each entry
  is `{name, kind, change, breaking, detail}` with kind
  the after kind when the export exists in after, else
  the before kind, and detail `""` when the change kind
  defines none. Both lists are sorted by name ascending,
  then change ascending. `summary` is `{before_count,
  after_count, breaking_count, non_breaking_count,
  verdict}`, verdict `"breaking"` when breaking_count > 0,
  else `"clean"`.

  The fixture literal
  (`harness/fixtures/apisurface-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties`. The surface-object schema
  is written out in full for both `before` and `after`.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation.
- The core is a single exported function,
  `diffApiSurface(args)`, taking the whole arguments
  object `{before, after}` and validating the raw unknown
  input itself, mirroring how the reference core validates
  raw input.
- Validation is path-naming and total, naming the side:
  a missing or non-object `before`/`after`, a missing or
  non-array `exports`, a non-object export entry, an
  export missing `name`/`kind`, an empty name, a kind
  outside the enum, a duplicate export name within one
  surface, a non-string `members` entry (or a non-array
  `members`), a non-boolean `deprecated`, or a non-string
  `signature` throws an Error naming the offending path
  (e.g. `after.exports[1].kind must be one of function,
  class, interface, type, const, enum`) and produces no
  partial result (MCP: `isError`; CLI: exit 1).

## Verification (foreground, this session)

- `npx tsc` exit 0 (`dist/cli.js` built)
- `npm test` (`tsx --test test/*.test.ts`): **31 tests,
  31 pass, 0 fail** — removed/added with kinds and
  summary, identical surfaces, kind_changed with detail
  and after kind, signature_changed with detail,
  signature ignored when present on only one side or
  identical, member_removed / member_added with
  before-order / after-order preserved, missing members
  counting as empty in both directions, removals and
  additions on the same export, deprecated and
  undeprecated from absent/false and to absent/false,
  unchanged deprecation, multiple entries from one
  export, breaking/non-breaking sorting by name then
  change, summary counts, empty surfaces with clean
  verdict, every kind in the enum, and the validation
  paths (missing/non-object before/after, missing/
  non-array exports, non-object export, missing
  name/kind, empty name, kind enum error naming side
  and index, duplicate export name on both sides, same
  name allowed across sides, non-string members entry
  and non-array members, non-boolean deprecated,
  non-string signature)
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `diff` with no `--input` exits 2;
  `diff --input <missing file>` exits 1 naming the file;
  `diff --input <invalid file>` exits 1 with
  `after.exports[1].kind must be one of function, class,
  interface, type, const, enum`; `diff --input <valid
  file>` exits 0 and prints the diff JSON (verified by
  hand: Widget member_removed "mount", oldFn removed,
  parse signature_changed with both signatures in the
  detail, format added; summary 3/3, breaking 3,
  non-breaking 1, verdict breaking)
- Parity: `harness/parity.py` vs
  `harness/fixtures/apisurface-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1**

## Lockfile status

`package-lock.json` generated clean via Route 3 (temp copy
without `node_modules`/`dist`/`package-lock.json`, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/apisurface`, **128 package entries**. Local
`node_modules` was installed via `npm install
--ignore-scripts --offline` for build/test; gitignored.

## Gaps / honest notes

- **Sort order:** name/change sorting uses plain string
  (code-unit) ascending order, so capitalised names sort
  before lower-case ones; the spec says only "ascending"
  and does not specify a collation. The CLI verification
  example shows this ordering (Widget before oldFn/parse).
- **Extra validation beyond the listed cases:** a
  non-array `exports`, a non-object export entry, a
  non-array `members`, and a non-string `signature` are
  also rejected with path-naming errors; the spec lists
  the members-entry and deprecated cases explicitly and
  these sibling checks keep the input shape total, in the
  reference core's style.
- **Duplicate detail:** the duplicate-name error names
  both the offending index and the first occurrence
  (`before.exports[1].name duplicates
  before.exports[0].name`); the spec requires naming the
  offending path and side but does not fix the wording.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
