import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YAML from "yaml";
import { z } from "zod";
import { loadConfig } from "./config";

// Schema definitions (extracted from config.ts for testing)
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
    .record(z.string().regex(INPUT_NAME_REGEX), ToolInputSchema)
    .optional()
    .default({}),
  run: z.string(),
});

const ConfigSchema = z.object({
  tools: z.array(ToolConfigSchema),
});

describe("config schema", () => {
  it("should parse valid config", () => {
    const yaml = `
tools:
  - name: echo
    description: Echo command
    inputs:
      message:
        type: string
        description: Message to echo
    run: echo "$INPUTS__MESSAGE"
`;
    const parsed = YAML.parse(yaml);
    const result = ConfigSchema.parse(parsed);

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("echo");
    expect(result.tools[0].inputs.message.type).toBe("string");
  });

  it("should reject invalid input names", () => {
    const yaml = `
tools:
  - name: test
    description: Test
    inputs:
      "invalid name!":
        type: string
        description: Invalid
    run: echo test
`;
    const parsed = YAML.parse(yaml);
    expect(() => ConfigSchema.parse(parsed)).toThrow();
  });

  it("should reject invalid tool names", () => {
    const yaml = `
tools:
  - name: "invalid name!"
    description: Test
    inputs:
      message:
        type: string
        description: Test
    run: echo test
`;
    const parsed = YAML.parse(yaml);
    expect(() => ConfigSchema.parse(parsed)).toThrow();
  });

  it("should handle optional inputs with defaults", () => {
    const yaml = `
tools:
  - name: test
    description: Test
    inputs:
      optional-param:
        type: string
        description: Optional parameter
        required: false
        default: "default-value"
    run: echo test
`;
    const parsed = YAML.parse(yaml);
    const result = ConfigSchema.parse(parsed);

    expect(result.tools[0].inputs["optional-param"].required).toBe(false);
    expect(result.tools[0].inputs["optional-param"].default).toBe(
      "default-value",
    );
  });

  it("should handle tools with no inputs", () => {
    const yaml = `
tools:
  - name: simple_command
    description: Simple command without inputs
    run: echo "No inputs needed"
`;
    const parsed = YAML.parse(yaml);
    const result = ConfigSchema.parse(parsed);

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe("simple_command");
    expect(result.tools[0].inputs).toEqual({});
  });

  it("should handle all input types", () => {
    const yaml = `
tools:
  - name: all_types
    description: Test all input types
    inputs:
      str_param:
        type: string
        description: String parameter
      num_param:
        type: number
        description: Number parameter
      bool_param:
        type: boolean
        description: Boolean parameter
    run: echo test
`;
    const parsed = YAML.parse(yaml);
    const result = ConfigSchema.parse(parsed);

    expect(result.tools[0].inputs.str_param.type).toBe("string");
    expect(result.tools[0].inputs.num_param.type).toBe("number");
    expect(result.tools[0].inputs.bool_param.type).toBe("boolean");
  });

  it("should handle default values for different types", () => {
    const yaml = `
tools:
  - name: defaults_test
    description: Test default values
    inputs:
      str_with_default:
        type: string
        description: String with default
        default: "hello"
      num_with_default:
        type: number
        description: Number with default
        default: 42
      bool_with_default:
        type: boolean
        description: Boolean with default
        default: true
    run: echo test
`;
    const parsed = YAML.parse(yaml);
    const result = ConfigSchema.parse(parsed);

    expect(result.tools[0].inputs.str_with_default.default).toBe("hello");
    expect(result.tools[0].inputs.num_with_default.default).toBe(42);
    expect(result.tools[0].inputs.bool_with_default.default).toBe(true);
  });

  it("should validate input name patterns", () => {
    const validNames = [
      "simple",
      "with_underscore",
      "with-hyphen",
      "with123numbers",
      "MixedCase",
      "_start_underscore",
      "-start-hyphen",
    ];

    for (const name of validNames) {
      const yaml = `
tools:
  - name: test
    description: Test
    inputs:
      ${name}:
        type: string
        description: Test
    run: echo test
`;
      const parsed = YAML.parse(yaml);
      expect(() => ConfigSchema.parse(parsed)).not.toThrow();
    }

    const invalidNames = [
      "with space",
      "with.dot",
      "with/slash",
      "with@symbol",
      "with!exclamation",
    ];

    for (const name of invalidNames) {
      const yaml = `
tools:
  - name: test
    description: Test
    inputs:
      "${name}":
        type: string
        description: Test
    run: echo test
`;
      const parsed = YAML.parse(yaml);
      expect(() => ConfigSchema.parse(parsed)).toThrow();
    }
  });
});

describe("loadConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(tmpdir(), "any-script-mcp-test", Date.now().toString());
    await mkdir(testDir, { recursive: true });
    vi.unstubAllEnvs();
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("should load config from environment variable when ANY_SCRIPT_MCP_CONFIG is set", async () => {
    const configPath = path.join(testDir, "custom-config.yaml");
    const configContent = `
tools:
  - name: custom_tool
    description: Tool from custom config
    inputs:
      param:
        type: string
        description: A parameter
    run: echo "$INPUTS__PARAM"
`;
    await writeFile(configPath, configContent);

    vi.stubEnv("ANY_SCRIPT_MCP_CONFIG", configPath);

    const result = await loadConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tools).toHaveLength(1);
      expect(result.value.tools[0].name).toBe("custom_tool");
      expect(result.value.tools[0].description).toBe("Tool from custom config");
    }
  });

  it("should return error when config file does not exist", async () => {
    const nonExistentPath = path.join(testDir, "non-existent.yaml");
    vi.stubEnv("ANY_SCRIPT_MCP_CONFIG", nonExistentPath);

    const result = await loadConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("LOAD_ERROR");
      expect(result.error.message).toBe("Configuration file not found");
      expect(result.error.path).toBe(nonExistentPath);
    }
  });

  it("should return validation error for invalid config", async () => {
    const configPath = path.join(testDir, "invalid-config.yaml");
    const invalidContent = `
tools:
  - name: "invalid-name!"
    description: Invalid tool
    run: echo test
`;
    await writeFile(configPath, invalidContent);

    vi.stubEnv("ANY_SCRIPT_MCP_CONFIG", configPath);

    const result = await loadConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("VALIDATION_ERROR");
      expect(result.error.path).toBe(configPath);
      expect(result.error.issues).toBeDefined();
    }
  });

  it("should return error for malformed YAML", async () => {
    const configPath = path.join(testDir, "malformed.yaml");
    const malformedContent = `
tools:
  - name: test
    description: [this is not valid
`;
    await writeFile(configPath, malformedContent);

    vi.stubEnv("ANY_SCRIPT_MCP_CONFIG", configPath);

    const result = await loadConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("LOAD_ERROR");
      expect(result.error.path).toBe(configPath);
    }
  });

  it("should load configs from multiple paths", async () => {
    const config1Path = path.join(testDir, "config1.yaml");
    const config2Path = path.join(testDir, "config2.yaml");

    const config1Content = `
tools:
  - name: tool1
    description: Tool from config1
    run: echo "tool1"
  - name: shared_tool
    description: Shared tool from config1
    run: echo "config1 version"
`;
    const config2Content = `
tools:
  - name: tool2
    description: Tool from config2
    run: echo "tool2"
  - name: shared_tool
    description: Shared tool from config2
    run: echo "config2 version"
`;

    await writeFile(config1Path, config1Content);
    await writeFile(config2Path, config2Content);

    vi.stubEnv(
      "ANY_SCRIPT_MCP_CONFIG",
      `${config1Path}${path.delimiter}${config2Path}`,
    );

    const result = await loadConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tools).toHaveLength(3);

      const toolNames = result.value.tools.map((t) => t.name);
      expect(toolNames).toContain("tool1");
      expect(toolNames).toContain("tool2");
      expect(toolNames).toContain("shared_tool");

      // First config's shared_tool should be used
      const sharedTool = result.value.tools.find(
        (t) => t.name === "shared_tool",
      );
      expect(sharedTool?.description).toBe("Shared tool from config1");
      expect(sharedTool?.run).toBe('echo "config1 version"');
    }
  });

  it("should handle partial failures when loading multiple configs", async () => {
    const validPath = path.join(testDir, "valid.yaml");
    const nonExistentPath = path.join(testDir, "non-existent.yaml");
    const invalidPath = path.join(testDir, "invalid.yaml");

    const validContent = `
tools:
  - name: valid_tool
    description: Valid tool
    run: echo "valid"
`;
    const invalidContent = `
tools:
  - name: "invalid-name!"
    description: Invalid tool
    run: echo test
`;

    await writeFile(validPath, validContent);
    await writeFile(invalidPath, invalidContent);

    vi.stubEnv(
      "ANY_SCRIPT_MCP_CONFIG",
      `${nonExistentPath}${path.delimiter}${validPath}${path.delimiter}${invalidPath}`,
    );

    const result = await loadConfig();

    // Should succeed because at least one config is valid
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tools).toHaveLength(1);
      expect(result.value.tools[0].name).toBe("valid_tool");
    }
  });

  it("should handle empty path segments", async () => {
    const configPath = path.join(testDir, "config.yaml");
    const configContent = `
tools:
  - name: test_tool
    description: Test tool
    run: echo "test"
`;
    await writeFile(configPath, configContent);

    // Include empty segments
    vi.stubEnv(
      "ANY_SCRIPT_MCP_CONFIG",
      `${path.delimiter}${configPath}${path.delimiter}${path.delimiter}`,
    );

    const result = await loadConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tools).toHaveLength(1);
      expect(result.value.tools[0].name).toBe("test_tool");
    }
  });

  it("should return MULTIPLE_ERRORS when all configs fail", async () => {
    const invalid1Path = path.join(testDir, "invalid1.yaml");
    const invalid2Path = path.join(testDir, "invalid2.yaml");

    const invalid1Content = `
tools:
  - name: "invalid-name!"
    description: Invalid tool
    run: echo test
`;
    const invalid2Content = `
tools:
  - name: test
    inputs:
      "bad input!":
        type: string
        description: Bad
    run: echo test
`;

    await writeFile(invalid1Path, invalid1Content);
    await writeFile(invalid2Path, invalid2Content);

    vi.stubEnv(
      "ANY_SCRIPT_MCP_CONFIG",
      `${invalid1Path}${path.delimiter}${invalid2Path}`,
    );

    const result = await loadConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("MULTIPLE_ERRORS");
      if (result.error.type === "MULTIPLE_ERRORS") {
        expect(result.error.errors).toHaveLength(2);
        expect(result.error.errors[0].error.type).toBe("VALIDATION_ERROR");
        expect(result.error.errors[1].error.type).toBe("VALIDATION_ERROR");
      }
    }
  });
});
