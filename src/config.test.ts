import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { z } from "zod";

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
