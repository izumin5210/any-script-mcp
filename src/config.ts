import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { xdgConfig } from "xdg-basedir";
import YAML from "yaml";
import { z } from "zod";

// Input name constraint (alphanumeric, underscore, and hyphen only)
const INPUT_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

const ToolInputSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string(),
  required: z.boolean().optional().default(true),
  default: z.any().optional(),
});

const ToolConfigSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string(),
  inputs: z
    .record(
      z
        .string()
        .regex(INPUT_NAME_REGEX), // Key constraint
      ToolInputSchema,
    )
    .optional()
    .default({}),
  run: z.string(),
});

const ConfigSchema = z.object({
  tools: z.array(ToolConfigSchema),
});

export type ToolInput = z.infer<typeof ToolInputSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(): Promise<Config> {
  // Use .config from home directory if xdgConfig is null
  const configDir = xdgConfig || path.join(homedir(), ".config");
  const configPath = path.join(configDir, "any-script-mcp", "config.yaml");

  const content = await readFile(configPath, "utf-8");
  const parsed = YAML.parse(content);
  return ConfigSchema.parse(parsed);
}
