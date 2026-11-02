/**
 * apisurface MCP server. Tools: diff_api_surface.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The diff is pure local computation: no upstream API, no
 * authentication, no configuration.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { diffApiSurface, formatPayload, VERSION } from "./apisurface.js";

const TOOLS = [
  {
    name: "diff_api_surface",
    description:
      "Diff the public API surface between two versions: removed and added exports, kind and signature changes, member changes, and deprecation changes, split into breaking and non-breaking lists with a verdict.",
    inputSchema: {
      type: "object" as const,
      properties: {
        before: {
          type: "object",
          description: "The earlier version's public API surface",
          properties: {
            exports: {
              type: "array",
              description: "Exports in this version (may be empty)",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Export name (unique within the surface)",
                  },
                  kind: {
                    type: "string",
                    description: "Export kind",
                    enum: ["function", "class", "interface", "type", "const", "enum"],
                  },
                  signature: {
                    type: "string",
                    description: "Normalized signature text (optional)",
                  },
                  members: {
                    type: "array",
                    description:
                      "Member names for class, interface, or enum exports (optional)",
                    items: { type: "string" },
                  },
                  deprecated: {
                    type: "boolean",
                    description: "Whether the export is deprecated (optional)",
                  },
                },
                required: ["name", "kind"],
              },
            },
          },
          required: ["exports"],
        },
        after: {
          type: "object",
          description: "The later version's public API surface",
          properties: {
            exports: {
              type: "array",
              description: "Exports in this version (may be empty)",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Export name (unique within the surface)",
                  },
                  kind: {
                    type: "string",
                    description: "Export kind",
                    enum: ["function", "class", "interface", "type", "const", "enum"],
                  },
                  signature: {
                    type: "string",
                    description: "Normalized signature text (optional)",
                  },
                  members: {
                    type: "array",
                    description:
                      "Member names for class, interface, or enum exports (optional)",
                    items: { type: "string" },
                  },
                  deprecated: {
                    type: "boolean",
                    description: "Whether the export is deprecated (optional)",
                  },
                },
                required: ["name", "kind"],
              },
            },
          },
          required: ["exports"],
        },
      },
      required: ["before", "after"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "apisurface", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "diff_api_surface") {
      out = diffApiSurface(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
