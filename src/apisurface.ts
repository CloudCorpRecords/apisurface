/**
 * apisurface core: public API surface diff between two
 * versions.
 *
 *   diffApiSurface({ before, after }) -> { breaking,
 *   non_breaking, summary }
 *
 * Behaviour:
 * - Exports are matched by name. An export only in before
 *   is "removed" (breaking); only in after is "added"
 *   (non-breaking).
 * - For an export present on both sides, each difference
 *   produces its own entry, so one export can appear
 *   several times: a kind change (breaking, detail
 *   "<before kind> -> <after kind>"), a signature change
 *   when a signature is present on both sides and differs
 *   (breaking, detail "<before> -> <after>"), member
 *   removals (breaking, detail the removed names in
 *   before-order) and member additions (non-breaking,
 *   detail the added names in after-order), and a
 *   deprecation flip in either direction (non-breaking).
 *   A missing members array counts as empty, and a missing
 *   deprecated flag counts as false.
 * - Every entry carries the after kind when the export
 *   exists in after, otherwise the before kind, and a
 *   detail of "" when the change kind defines none.
 * - The breaking and non-breaking lists are each sorted by
 *   name ascending, then change ascending. The verdict is
 *   "breaking" when any breaking entry exists, otherwise
 *   "clean".
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and
 * side (for example "after.exports[1].kind must be one of
 * function, class, interface, type, const, enum") and no
 * partial result is produced.
 */
import type {
  ApiExport,
  ApiSurface,
  ApiSurfaceDiff,
  ChangeEntry,
  ExportKind,
} from "./types.js";

export const VERSION = "0.1.0";

const KINDS: readonly ExportKind[] = [
  "function",
  "class",
  "interface",
  "type",
  "const",
  "enum",
];

const KIND_LIST = KINDS.join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateExport(
  raw: unknown,
  side: string,
  index: number,
  seen: Map<string, number>,
): ApiExport {
  const path = `${side}.exports[${index}]`;
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  if (raw.name === undefined) throw new Error(`${path}.name is required`);
  if (typeof raw.name !== "string" || raw.name.length === 0) {
    throw new Error(`${path}.name must be a non-empty string`);
  }
  const prior = seen.get(raw.name);
  if (prior !== undefined) {
    throw new Error(
      `${path}.name duplicates ${side}.exports[${prior}].name ("${raw.name}")`,
    );
  }
  seen.set(raw.name, index);
  if (raw.kind === undefined) throw new Error(`${path}.kind is required`);
  if (
    typeof raw.kind !== "string" ||
    !(KINDS as readonly string[]).includes(raw.kind)
  ) {
    throw new Error(`${path}.kind must be one of ${KIND_LIST}`);
  }
  if (raw.signature !== undefined && typeof raw.signature !== "string") {
    throw new Error(`${path}.signature must be a string`);
  }
  if (raw.members !== undefined) {
    if (!Array.isArray(raw.members)) {
      throw new Error(`${path}.members must be an array`);
    }
    raw.members.forEach((member, j) => {
      if (typeof member !== "string") {
        throw new Error(`${path}.members[${j}] must be a string`);
      }
    });
  }
  if (raw.deprecated !== undefined && typeof raw.deprecated !== "boolean") {
    throw new Error(`${path}.deprecated must be a boolean`);
  }
  const out: ApiExport = { name: raw.name, kind: raw.kind as ExportKind };
  if (raw.signature !== undefined) out.signature = raw.signature;
  if (raw.members !== undefined) out.members = [...(raw.members as string[])];
  if (raw.deprecated !== undefined) out.deprecated = raw.deprecated;
  return out;
}

function validateSurface(raw: unknown, side: string): ApiSurface {
  if (raw === undefined) throw new Error(`${side} is required`);
  if (!isRecord(raw)) throw new Error(`${side} must be an object`);
  if (raw.exports === undefined) {
    throw new Error(`${side}.exports is required`);
  }
  if (!Array.isArray(raw.exports)) {
    throw new Error(`${side}.exports must be an array`);
  }
  const seen = new Map<string, number>();
  return {
    exports: raw.exports.map((entry, i) =>
      validateExport(entry, side, i, seen),
    ),
  };
}

function compareEntries(a: ChangeEntry, b: ChangeEntry): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.change !== b.change) return a.change < b.change ? -1 : 1;
  return 0;
}

/** Diff the public API surface between two versions. */
export function diffApiSurface(args: unknown): ApiSurfaceDiff {
  if (!isRecord(args)) throw new Error("arguments must be an object");
  const before = validateSurface(args.before, "before");
  const after = validateSurface(args.after, "after");

  const beforeByName = new Map(before.exports.map((e) => [e.name, e]));
  const afterByName = new Map(after.exports.map((e) => [e.name, e]));

  const entries: ChangeEntry[] = [];
  const names = new Set([
    ...beforeByName.keys(),
    ...afterByName.keys(),
  ]);

  for (const name of names) {
    const b = beforeByName.get(name);
    const a = afterByName.get(name);
    const kind = (a ?? b)!.kind;
    if (b && !a) {
      entries.push({ name, kind, change: "removed", breaking: true, detail: "" });
      continue;
    }
    if (!b && a) {
      entries.push({ name, kind, change: "added", breaking: false, detail: "" });
      continue;
    }
    // Present on both sides: each difference is its own entry.
    const bb = b as ApiExport;
    const aa = a as ApiExport;
    if (bb.kind !== aa.kind) {
      entries.push({
        name,
        kind,
        change: "kind_changed",
        breaking: true,
        detail: `${bb.kind} -> ${aa.kind}`,
      });
    }
    if (
      bb.signature !== undefined &&
      aa.signature !== undefined &&
      bb.signature !== aa.signature
    ) {
      entries.push({
        name,
        kind,
        change: "signature_changed",
        breaking: true,
        detail: `${bb.signature} -> ${aa.signature}`,
      });
    }
    const beforeMembers = bb.members ?? [];
    const afterMembers = aa.members ?? [];
    const afterMemberSet = new Set(afterMembers);
    const beforeMemberSet = new Set(beforeMembers);
    const removedMembers = beforeMembers.filter((m) => !afterMemberSet.has(m));
    const addedMembers = afterMembers.filter((m) => !beforeMemberSet.has(m));
    if (removedMembers.length > 0) {
      entries.push({
        name,
        kind,
        change: "member_removed",
        breaking: true,
        detail: removedMembers.join(", "),
      });
    }
    if (addedMembers.length > 0) {
      entries.push({
        name,
        kind,
        change: "member_added",
        breaking: false,
        detail: addedMembers.join(", "),
      });
    }
    const wasDeprecated = bb.deprecated ?? false;
    const isDeprecated = aa.deprecated ?? false;
    if (!wasDeprecated && isDeprecated) {
      entries.push({
        name,
        kind,
        change: "deprecated",
        breaking: false,
        detail: "",
      });
    } else if (wasDeprecated && !isDeprecated) {
      entries.push({
        name,
        kind,
        change: "undeprecated",
        breaking: false,
        detail: "",
      });
    }
  }

  const breaking = entries.filter((e) => e.breaking).sort(compareEntries);
  const nonBreaking = entries
    .filter((e) => !e.breaking)
    .sort(compareEntries);

  return {
    breaking,
    non_breaking: nonBreaking,
    summary: {
      before_count: before.exports.length,
      after_count: after.exports.length,
      breaking_count: breaking.length,
      non_breaking_count: nonBreaking.length,
      verdict: breaking.length > 0 ? "breaking" : "clean",
    },
  };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
