/**
 * apisurface types.
 *
 * apisurface compares the public API surface of two versions
 * of a library or service. The caller describes each version
 * as a list of exports — a name, a kind, and, where known, a
 * normalized signature, a list of member names, and a
 * deprecation flag — and apisurface reports, as pure local
 * computation:
 *
 *   - exports that were removed or added
 *   - exports whose kind or signature changed
 *   - members that were removed from or added to an export
 *   - exports that became deprecated or stopped being
 *     deprecated
 *   - a summary with both export counts, both change
 *     counts, and a breaking / clean verdict
 *
 * Nothing is fetched or guessed: the diff comes only from
 * the two surfaces supplied.
 */

/** The kind of a single export. */
export type ExportKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "const"
  | "enum";

/** One export in one version of the surface. */
export interface ApiExport {
  /** Export name; unique within its surface. */
  name: string;
  /** What kind of export this is. */
  kind: ExportKind;
  /** Normalized signature text, when known. */
  signature?: string;
  /** Member names, for class / interface / enum exports. */
  members?: string[];
  /** Whether the export is deprecated. */
  deprecated?: boolean;
}

/** One version of the public API surface. */
export interface ApiSurface {
  /** Exports in this version; may be empty. */
  exports: ApiExport[];
}

/** The kind of change recorded for one export. */
export type ChangeKind =
  | "removed"
  | "added"
  | "kind_changed"
  | "signature_changed"
  | "member_removed"
  | "member_added"
  | "deprecated"
  | "undeprecated";

/** One change entry for one export. */
export interface ChangeEntry {
  /** Export name the entry is about. */
  name: string;
  /**
   * The export's kind: the after kind when the export exists
   * in after, otherwise the before kind.
   */
  kind: ExportKind;
  /** What changed. */
  change: ChangeKind;
  /** Whether this change breaks existing consumers. */
  breaking: boolean;
  /** Extra detail (e.g. "function -> class"); "" when none. */
  detail: string;
}

/** Counts and verdict for a completed diff. */
export interface DiffSummary {
  before_count: number;
  after_count: number;
  breaking_count: number;
  non_breaking_count: number;
  /** "breaking" when breaking_count > 0, otherwise "clean". */
  verdict: "breaking" | "clean";
}

/** The full surface diff. */
export interface ApiSurfaceDiff {
  /** Breaking entries, sorted by name then change. */
  breaking: ChangeEntry[];
  /** Non-breaking entries, sorted by name then change. */
  non_breaking: ChangeEntry[];
  summary: DiffSummary;
}
