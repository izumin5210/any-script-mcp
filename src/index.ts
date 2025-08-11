#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, type ToolConfig } from "./config.js";
import { executeCommand } from "./executor.js";

async function main() {
  const server = new McpServer({
    name: "any-scripts-mcp-server",
    version: "1.0.0",
  });

  // Load configuration file
  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig();
  } catch (error) {
    console.error("Failed to load config:", error);
    process.exit(1);
  }

  // Register each tool
  for (const tool of config.tools) {
    // Generate input schema dynamically
    const inputSchema = createInputSchema(tool);

    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema,
      },
      async (inputs) => {
        try {
          const output = await executeCommand(tool, inputs);
          return {
            content: [{ type: "text", text: output }],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function createInputSchema(tool: ToolConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [name, input] of Object.entries(tool.inputs)) {
    let schema: z.ZodTypeAny;

    switch (input.type) {
      case "string":
        schema = z.string().describe(input.description);
        break;
      case "number":
        schema = z.number().describe(input.description);
        break;
      case "boolean":
        schema = z.boolean().describe(input.description);
        break;
    }

    // Apply default value if exists
    if (input.default !== undefined) {
      schema = schema.default(input.default);
    } else if (input.required === false) {
      schema = schema.optional();
    }

    shape[name] = schema;
  }

  return shape;
}

main().catch(console.error);
