import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config, ToolConfig } from "./config.js";
import { executeCommand } from "./executor.js";

export async function createServer(config: Config): Promise<McpServer> {
  const server = new McpServer({
    name: "any-script-mcp",
    version: "1.0.0",
  });

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

  return server;
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
