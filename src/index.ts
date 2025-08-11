#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { type ConfigError, loadConfig, type ToolConfig } from "./config.js";
import { executeCommand } from "./executor.js";

function printConfigError(error: ConfigError): void {
  console.error("Configuration Error:\n");

  switch (error.type) {
    case "LOAD_ERROR":
      console.error(`Failed to load config from: ${error.path}`);
      console.error(`Error: ${error.message}`);
      break;

    case "VALIDATION_ERROR":
      console.error(`Invalid configuration in: ${error.path}`);
      console.error("\nValidation errors:");
      error.issues.forEach((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        console.error(`  - ${path}: ${issue.message}`);
      });
      break;
  }

  console.error(
    "\nSee documentation at: https://github.com/izumin5210/any-script-mcp",
  );
}

async function main() {
  const server = new McpServer({
    name: "any-script-mcp",
    version: "1.0.0",
  });

  // Load configuration file
  const result = await loadConfig();

  if (!result.ok) {
    printConfigError(result.error);
    process.exit(1);
  }

  const config = result.value;

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
