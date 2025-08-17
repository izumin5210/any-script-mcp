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

// Error types
export type ConfigError =
  | { type: "LOAD_ERROR"; path: string; message: string }
  | { type: "VALIDATION_ERROR"; path: string; issues: z.ZodIssue[] }
  | {
      type: "MULTIPLE_ERRORS";
      errors: Array<{ path: string; error: ConfigError }>;
    };

// Result type
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

// Load a single config file
async function loadSingleConfig(
  configPath: string,
): Promise<Result<Config, ConfigError>> {
  // Try to load and parse the file
  let parsed: unknown;
  try {
    const content = await readFile(configPath, "utf-8");
    parsed = YAML.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNotFound =
      error instanceof Error && "code" in error && error.code === "ENOENT";

    return {
      ok: false,
      error: {
        type: "LOAD_ERROR",
        path: configPath,
        message: isNotFound ? "Configuration file not found" : errorMessage,
      },
    };
  }

  // Validate with Zod using safeParse
  const result = ConfigSchema.safeParse(parsed);

  if (!result.success) {
    return {
      ok: false,
      error: {
        type: "VALIDATION_ERROR",
        path: configPath,
        issues: result.error.issues,
      },
    };
  }

  return { ok: true, value: result.data };
}

function getDefaultConfigPath(): string {
  const configDir = xdgConfig || path.join(homedir(), ".config");
  return path.join(configDir, "any-script-mcp", "config.yaml");
}

function getConfigPaths(): ReadonlyArray<string> {
  const configPathsStr =
    process.env["ANY_SCRIPT_MCP_CONFIG"] ?? getDefaultConfigPath();
  return configPathsStr.split(path.delimiter).filter((p) => p.length > 0);
}

export async function loadConfig(): Promise<Result<Config, ConfigError>> {
  const configPaths = getConfigPaths();

  // Load and merge configs
  const allTools = new Map<string, ToolConfig>();
  const errors: Array<{ path: string; error: ConfigError }> = [];

  for (const configPath of configPaths) {
    const result = await loadSingleConfig(configPath);

    if (result.ok) {
      // Add tools to map (don't overwrite existing tools)
      for (const tool of result.value.tools) {
        if (!allTools.has(tool.name)) {
          allTools.set(tool.name, tool);
        }
      }
    } else {
      errors.push({ path: configPath, error: result.error });
    }
  }

  // Return success if we have at least one tool
  if (allTools.size > 0) {
    return { ok: true, value: { tools: Array.from(allTools.values()) } };
  }

  // Return error if no tools were loaded
  if (errors.length === 1) {
    const firstError = errors[0];
    if (firstError) {
      return { ok: false, error: firstError.error };
    }
  } else if (errors.length > 1) {
    return {
      ok: false,
      error: {
        type: "MULTIPLE_ERRORS",
        errors: errors,
      },
    };
  }

  // No config files specified and default doesn't exist
  const firstPath = configPaths[0];
  return {
    ok: false,
    error: {
      type: "LOAD_ERROR",
      path: firstPath || "unknown",
      message: "No configuration files found",
    },
  };
}
