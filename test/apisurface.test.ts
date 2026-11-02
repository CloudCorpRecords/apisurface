import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { diffApiSurface } from "../src/apisurface.js";

/**
 * All tests are pure local computation over inline surfaces:
 * no filesystem, no network. Each behaviour in the spec is
 * pinned by its own case.
 */

type Exp = {
  name: string;
  kind: string;
  signature?: string;
  members?: string[];
  deprecated?: boolean;
};
const surf = (exports: Exp[]) => ({ exports });
const diff = (before: Exp[], after: Exp[]) =>
  diffApiSurface({ before: surf(before), after: surf(after) });

describe("diffApiSurface — removed and added", () => {
  it("reports an export only in before as breaking removed", () => {
    const out = diff(
      [{ name: "oldFn", kind: "function" }],
      [],
    );
    assert.deepEqual(out.breaking, [
      { name: "oldFn", kind: "function", change: "removed", breaking: true, detail: "" },
    ]);
    assert.deepEqual(out.non_breaking, []);
    assert.deepEqual(out.summary, {
      before_count: 1,
      after_count: 0,
      breaking_count: 1,
      non_breaking_count: 0,
      verdict: "breaking",
    });
  });

  it("reports an export only in after as non-breaking added with clean verdict", () => {
    const out = diff([], [{ name: "newFn", kind: "function" }]);
    assert.deepEqual(out.breaking, []);
    assert.deepEqual(out.non_breaking, [
      { name: "newFn", kind: "function", change: "added", breaking: false, detail: "" },
    ]);
    assert.equal(out.summary.verdict, "clean");
    assert.equal(out.summary.before_count, 0);
    assert.equal(out.summary.after_count, 1);
  });

  it("uses the before kind for a removed export and the after kind for an added one", () => {
    const out = diff(
      [{ name: "gone", kind: "class" }],
      [{ name: "fresh", kind: "enum" }],
    );
    assert.equal(out.breaking[0].kind, "class");
    assert.equal(out.non_breaking[0].kind, "enum");
  });

  it("reports no changes for identical surfaces", () => {
    const s: Exp[] = [
      { name: "a", kind: "function", signature: "(x: number) => void" },
      { name: "B", kind: "class", members: ["m1", "m2"], deprecated: true },
    ];
    const out = diff(s, s.map((e) => ({ ...e })));
    assert.deepEqual(out.breaking, []);
    assert.deepEqual(out.non_breaking, []);
    assert.equal(out.summary.verdict, "clean");
  });
});

describe("diffApiSurface — kind and signature changes", () => {
  it("reports kind_changed as breaking with 'before -> after' detail and after kind", () => {
    const out = diff(
      [{ name: "thing", kind: "function" }],
      [{ name: "thing", kind: "class" }],
    );
    assert.deepEqual(out.breaking, [
      {
        name: "thing",
        kind: "class",
        change: "kind_changed",
        breaking: true,
        detail: "function -> class",
      },
    ]);
    assert.deepEqual(out.non_breaking, []);
  });

  it("reports signature_changed as breaking with 'before -> after' detail", () => {
    const out = diff(
      [{ name: "fn", kind: "function", signature: "(a: string) => void" }],
      [{ name: "fn", kind: "function", signature: "(a: number) => void" }],
    );
    assert.deepEqual(out.breaking, [
      {
        name: "fn",
        kind: "function",
        change: "signature_changed",
        breaking: true,
        detail: "(a: string) => void -> (a: number) => void",
      },
    ]);
  });

  it("ignores a signature present on only one side", () => {
    const out1 = diff(
      [{ name: "fn", kind: "function", signature: "(a: string) => void" }],
      [{ name: "fn", kind: "function" }],
    );
    assert.deepEqual(out1.breaking, []);
    assert.deepEqual(out1.non_breaking, []);
    const out2 = diff(
      [{ name: "fn", kind: "function" }],
      [{ name: "fn", kind: "function", signature: "(a: string) => void" }],
    );
    assert.deepEqual(out2.breaking, []);
    assert.deepEqual(out2.non_breaking, []);
  });

  it("ignores an identical signature on both sides", () => {
    const out = diff(
      [{ name: "fn", kind: "function", signature: "same" }],
      [{ name: "fn", kind: "function", signature: "same" }],
    );
    assert.deepEqual(out.breaking, []);
    assert.deepEqual(out.non_breaking, []);
  });
});

describe("diffApiSurface — members", () => {
  it("reports member_removed as breaking with names in before-order", () => {
    const out = diff(
      [{ name: "C", kind: "class", members: ["zeta", "alpha", "mid"] }],
      [{ name: "C", kind: "class", members: ["alpha"] }],
    );
    assert.deepEqual(out.breaking, [
      {
        name: "C",
        kind: "class",
        change: "member_removed",
        breaking: true,
        detail: "zeta, mid",
      },
    ]);
  });

  it("reports member_added as non-breaking with names in after-order", () => {
    const out = diff(
      [{ name: "C", kind: "class", members: ["alpha"] }],
      [{ name: "C", kind: "class", members: ["alpha", "zeta", "mid"] }],
    );
    assert.deepEqual(out.non_breaking, [
      {
        name: "C",
        kind: "class",
        change: "member_added",
        breaking: false,
        detail: "zeta, mid",
      },
    ]);
    assert.deepEqual(out.breaking, []);
  });

  it("counts a missing members array as empty on both sides", () => {
    const removed = diff(
      [{ name: "C", kind: "class", members: ["a", "b"] }],
      [{ name: "C", kind: "class" }],
    );
    assert.deepEqual(removed.breaking, [
      {
        name: "C",
        kind: "class",
        change: "member_removed",
        breaking: true,
        detail: "a, b",
      },
    ]);
    const added = diff(
      [{ name: "C", kind: "class" }],
      [{ name: "C", kind: "class", members: ["x"] }],
    );
    assert.deepEqual(added.non_breaking, [
      {
        name: "C",
        kind: "class",
        change: "member_added",
        breaking: false,
        detail: "x",
      },
    ]);
    const neither = diff(
      [{ name: "C", kind: "class" }],
      [{ name: "C", kind: "class" }],
    );
    assert.deepEqual(neither.breaking, []);
    assert.deepEqual(neither.non_breaking, []);
  });

  it("reports removals and additions on the same export as separate entries", () => {
    const out = diff(
      [{ name: "E", kind: "enum", members: ["A", "B"] }],
      [{ name: "E", kind: "enum", members: ["B", "C"] }],
    );
    assert.deepEqual(out.breaking, [
      { name: "E", kind: "enum", change: "member_removed", breaking: true, detail: "A" },
    ]);
    assert.deepEqual(out.non_breaking, [
      { name: "E", kind: "enum", change: "member_added", breaking: false, detail: "C" },
    ]);
  });
});

describe("diffApiSurface — deprecation", () => {
  it("reports deprecated when false/absent becomes true, non-breaking", () => {
    const fromAbsent = diff(
      [{ name: "fn", kind: "function" }],
      [{ name: "fn", kind: "function", deprecated: true }],
    );
    assert.deepEqual(fromAbsent.non_breaking, [
      { name: "fn", kind: "function", change: "deprecated", breaking: false, detail: "" },
    ]);
    const fromFalse = diff(
      [{ name: "fn", kind: "function", deprecated: false }],
      [{ name: "fn", kind: "function", deprecated: true }],
    );
    assert.equal(fromFalse.non_breaking[0].change, "deprecated");
  });

  it("reports undeprecated when true becomes false/absent, non-breaking", () => {
    const toAbsent = diff(
      [{ name: "fn", kind: "function", deprecated: true }],
      [{ name: "fn", kind: "function" }],
    );
    assert.deepEqual(toAbsent.non_breaking, [
      { name: "fn", kind: "function", change: "undeprecated", breaking: false, detail: "" },
    ]);
    const toFalse = diff(
      [{ name: "fn", kind: "function", deprecated: true }],
      [{ name: "fn", kind: "function", deprecated: false }],
    );
    assert.equal(toFalse.non_breaking[0].change, "undeprecated");
  });

  it("reports nothing when the deprecation state is unchanged", () => {
    for (const [b, a] of [
      [true, true],
      [false, false],
      [undefined, false],
      [false, undefined],
    ] as const) {
      const out = diff(
        [{ name: "fn", kind: "function", ...(b !== undefined ? { deprecated: b } : {}) }],
        [{ name: "fn", kind: "function", ...(a !== undefined ? { deprecated: a } : {}) }],
      );
      assert.deepEqual(out.breaking, []);
      assert.deepEqual(out.non_breaking, []);
    }
  });
});

describe("diffApiSurface — multiple entries, sorting, summary", () => {
  it("produces several entries from a single export", () => {
    const out = diff(
      [
        {
          name: "Widget",
          kind: "class",
          signature: "class Widget",
          members: ["render", "mount"],
        },
      ],
      [
        {
          name: "Widget",
          kind: "interface",
          signature: "interface Widget",
          members: ["render"],
          deprecated: true,
        },
      ],
    );
    // breaking: kind_changed, member_removed, signature_changed (sorted by change)
    assert.deepEqual(
      out.breaking.map((e) => e.change),
      ["kind_changed", "member_removed", "signature_changed"],
    );
    assert.deepEqual(
      out.non_breaking.map((e) => e.change),
      ["deprecated"],
    );
    assert.equal(out.summary.breaking_count, 3);
    assert.equal(out.summary.non_breaking_count, 1);
    assert.equal(out.summary.verdict, "breaking");
  });

  it("sorts breaking and non_breaking by name ascending, then change ascending", () => {
    const out = diff(
      [
        { name: "zebra", kind: "function", signature: "v1" },
        { name: "alpha", kind: "function", signature: "v1" },
        { name: "mid", kind: "const" },
      ],
      [
        { name: "zebra", kind: "class", signature: "v2" },
        { name: "alpha", kind: "class", signature: "v2" },
        { name: "beta", kind: "function" },
        { name: "aardvark", kind: "type" },
      ],
    );
    assert.deepEqual(
      out.breaking.map((e) => `${e.name}:${e.change}`),
      [
        "alpha:kind_changed",
        "alpha:signature_changed",
        "mid:removed",
        "zebra:kind_changed",
        "zebra:signature_changed",
      ],
    );
    assert.deepEqual(
      out.non_breaking.map((e) => `${e.name}:${e.change}`),
      ["aardvark:added", "beta:added"],
    );
  });

  it("counts summary fields across mixed changes", () => {
    const out = diff(
      [
        { name: "keep", kind: "function" },
        { name: "drop", kind: "function" },
      ],
      [
        { name: "keep", kind: "function", deprecated: true },
        { name: "fresh", kind: "const" },
      ],
    );
    assert.deepEqual(out.summary, {
      before_count: 2,
      after_count: 2,
      breaking_count: 1,
      non_breaking_count: 2,
      verdict: "breaking",
    });
  });

  it("handles two empty surfaces as a clean diff with zero counts", () => {
    const out = diff([], []);
    assert.deepEqual(out.breaking, []);
    assert.deepEqual(out.non_breaking, []);
    assert.deepEqual(out.summary, {
      before_count: 0,
      after_count: 0,
      breaking_count: 0,
      non_breaking_count: 0,
      verdict: "clean",
    });
  });

  it("accepts every kind in the enum", () => {
    const kinds = ["function", "class", "interface", "type", "const", "enum"];
    const exportsIn: Exp[] = kinds.map((kind, i) => ({ name: `e${i}`, kind }));
    const out = diff(exportsIn, []);
    assert.equal(out.summary.before_count, 6);
    assert.equal(out.summary.breaking_count, 6);
  });
});

describe("diffApiSurface — validation", () => {
  it("rejects missing or non-object before/after, naming the side", () => {
    assert.throws(() => diffApiSurface({}), /before is required/);
    assert.throws(
      () => diffApiSurface({ before: surf([]) }),
      /after is required/,
    );
    assert.throws(
      () => diffApiSurface({ before: "nope", after: surf([]) }),
      /before must be an object/,
    );
    assert.throws(
      () => diffApiSurface({ before: surf([]), after: [] }),
      /after must be an object/,
    );
    assert.throws(() => diffApiSurface(null), /arguments must be an object/);
  });

  it("rejects a missing or non-array exports, naming the side", () => {
    assert.throws(
      () => diffApiSurface({ before: {}, after: surf([]) }),
      /before\.exports is required/,
    );
    assert.throws(
      () => diffApiSurface({ before: surf([]), after: {} }),
      /after\.exports is required/,
    );
    assert.throws(
      () => diffApiSurface({ before: { exports: "x" }, after: surf([]) }),
      /before\.exports must be an array/,
    );
  });

  it("rejects a non-object export entry, naming the path", () => {
    assert.throws(
      () => diffApiSurface({ before: surf([]), after: { exports: ["x"] } }),
      /after\.exports\[0\] must be an object/,
    );
  });

  it("rejects an export missing name or kind, naming the path and side", () => {
    assert.throws(
      () =>
        diffApiSurface({
          before: { exports: [{ kind: "function" }] },
          after: surf([]),
        }),
      /before\.exports\[0\]\.name is required/,
    );
    assert.throws(
      () =>
        diffApiSurface({
          before: surf([]),
          after: { exports: [{ name: "a", kind: "function" }, { name: "b" }] },
        }),
      /after\.exports\[1\]\.kind is required/,
    );
  });

  it("rejects an empty export name, naming the path", () => {
    assert.throws(
      () => diff([{ name: "", kind: "function" }], []),
      /before\.exports\[0\]\.name must be a non-empty string/,
    );
    assert.throws(
      () =>
        diffApiSurface({
          before: surf([]),
          after: { exports: [{ name: 42, kind: "function" }] },
        }),
      /after\.exports\[0\]\.name must be a non-empty string/,
    );
  });

  it("rejects a kind outside the enum with the spec's message, naming side and index", () => {
    assert.throws(
      () =>
        diffApiSurface({
          before: surf([]),
          after: {
            exports: [
              { name: "a", kind: "function" },
              { name: "b", kind: "variable" },
            ],
          },
        }),
      /after\.exports\[1\]\.kind must be one of function, class, interface, type, const, enum/,
    );
    assert.throws(
      () => diff([{ name: "a", kind: "method" }], []),
      /before\.exports\[0\]\.kind must be one of function, class, interface, type, const, enum/,
    );
  });

  it("rejects a duplicate export name within one surface, naming the path", () => {
    assert.throws(
      () =>
        diff(
          [
            { name: "dup", kind: "function" },
            { name: "dup", kind: "const" },
          ],
          [],
        ),
      /before\.exports\[1\]\.name duplicates before\.exports\[0\]\.name/,
    );
    assert.throws(
      () =>
        diff([], [
          { name: "x", kind: "type" },
          { name: "y", kind: "type" },
          { name: "x", kind: "type" },
        ]),
      /after\.exports\[2\]\.name duplicates after\.exports\[0\]\.name/,
    );
  });

  it("allows the same name on both sides (matching is by name, not duplication)", () => {
    const out = diff(
      [{ name: "same", kind: "function" }],
      [{ name: "same", kind: "function" }],
    );
    assert.deepEqual(out.breaking, []);
    assert.deepEqual(out.non_breaking, []);
  });

  it("rejects a non-string members entry, naming the path", () => {
    assert.throws(
      () =>
        diffApiSurface({
          before: {
            exports: [{ name: "C", kind: "class", members: ["ok", 7] }],
          },
          after: surf([]),
        }),
      /before\.exports\[0\]\.members\[1\] must be a string/,
    );
    assert.throws(
      () =>
        diffApiSurface({
          before: surf([]),
          after: {
            exports: [{ name: "C", kind: "class", members: "render" }],
          },
        }),
      /after\.exports\[0\]\.members must be an array/,
    );
  });

  it("rejects a non-boolean deprecated, naming the path", () => {
    assert.throws(
      () =>
        diffApiSurface({
          before: surf([]),
          after: {
            exports: [{ name: "fn", kind: "function", deprecated: "yes" }],
          },
        }),
      /after\.exports\[0\]\.deprecated must be a boolean/,
    );
  });

  it("rejects a non-string signature, naming the path", () => {
    assert.throws(
      () =>
        diffApiSurface({
          before: {
            exports: [{ name: "fn", kind: "function", signature: 3 }],
          },
          after: surf([]),
        }),
      /before\.exports\[0\]\.signature must be a string/,
    );
  });
});
