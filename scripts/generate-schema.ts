import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ConfigSchema } from "../src/config.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Generate JSON Schema
const jsonSchema = zodToJsonSchema(ConfigSchema, {
  name: "AnyScriptMCPConfig",
  $refStrategy: "none",
});

// Add additional metadata
const schemaWithMetadata = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://raw.githubusercontent.com/izumin5210/any-script-mcp/main/config.schema.json",
  title: "Any Script MCP Configuration",
  description:
    "Configuration schema for any-script-mcp - MCP server that exposes arbitrary CLI tools and shell scripts as MCP Tools via YAML configuration",
  ...jsonSchema,
};

// Write to file
const outputPath = `${__dirname}/../config.schema.json`;
await writeFile(outputPath, JSON.stringify(schemaWithMetadata, null, 2) + "\n");

console.log(`✅ Schema generated at: config.schema.json`);
