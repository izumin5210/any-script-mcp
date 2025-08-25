import { describe, expect, it } from "vitest";
import type z from "zod";
import { ToolConfigSchema } from "./config.js";
import { executeCommand } from "./executor.js";

function buildToolConfig(cfg: z.input<typeof ToolConfigSchema>) {
  return ToolConfigSchema.parse(cfg);
}

describe("executeCommand", () => {
  it("should pass inputs as environment variables with INPUTS__ prefix", async () => {
    const config = buildToolConfig({
      name: "echo_test",
      description: "Test echo",
      inputs: {
        message: {
          type: "string",
          description: "Message to echo",
          required: true,
        },
      },
      run: 'echo "$INPUTS__MESSAGE"',
    });

    const result = await executeCommand(config, { message: "Hello World" });
    expect(result.trim()).toBe("Hello World");
  });

  it("should handle hyphenated input names", async () => {
    const config = buildToolConfig({
      name: "hyphen_test",
      description: "Test hyphenated names",
      inputs: {
        "user-name": {
          type: "string",
          description: "User name",
          required: true,
        },
      },
      run: 'echo "$INPUTS__USER_NAME"',
    });

    const result = await executeCommand(config, { "user-name": "Alice" });
    expect(result.trim()).toBe("Alice");
  });

  it("should handle multiple inputs", async () => {
    const config = buildToolConfig({
      name: "multi_test",
      description: "Test multiple inputs",
      inputs: {
        first: {
          type: "string",
          description: "First value",
          required: true,
        },
        second: {
          type: "number",
          description: "Second value",
          required: true,
        },
      },
      run: 'echo "$INPUTS__FIRST $INPUTS__SECOND"',
    });

    const result = await executeCommand(config, {
      first: "Value",
      second: 42,
    });
    expect(result.trim()).toBe("Value 42");
  });

  it("should handle boolean inputs", async () => {
    const config = buildToolConfig({
      name: "boolean_test",
      description: "Test boolean inputs",
      inputs: {
        enabled: {
          type: "boolean",
          description: "Enabled flag",
          required: true,
        },
      },
      run: `
if [ "$INPUTS__ENABLED" = "true" ]; then
  echo "enabled"
else
  echo "disabled"
fi`,
    });

    const result = await executeCommand(config, { enabled: true });
    expect(result.trim()).toBe("enabled");

    const result2 = await executeCommand(config, { enabled: false });
    expect(result2.trim()).toBe("disabled");
  });

  it("should handle multiline scripts", async () => {
    const config = buildToolConfig({
      name: "multiline_test",
      description: "Test multiline scripts",
      inputs: {
        name: {
          type: "string",
          description: "Name",
          required: true,
        },
      },
      run: `
echo "Hello, $INPUTS__NAME!"
echo "Welcome to the test"
echo "Line 3"`,
    });

    const result = await executeCommand(config, { name: "Bob" });
    const lines = result.trim().split("\n");
    expect(lines[0]).toBe("Hello, Bob!");
    expect(lines[1]).toBe("Welcome to the test");
    expect(lines[2]).toBe("Line 3");
  });

  it("should use custom timeout when specified", async () => {
    const config = buildToolConfig({
      name: "timeout_test",
      description: "Test custom timeout",
      inputs: {},
      run: 'sleep 2 && echo "Should timeout"',
      timeout: 100, // 100ms timeout, should fail
    });

    await expect(executeCommand(config, {})).rejects.toThrow();
  });

  it("should succeed with longer timeout", async () => {
    const config = buildToolConfig({
      name: "timeout_success_test",
      description: "Test successful execution with timeout",
      inputs: {},
      run: 'echo "Quick execution"',
      timeout: 60_000, // 1 minute timeout
    });

    const result = await executeCommand(config, {});
    expect(result.trim()).toBe("Quick execution");
  });

  it("should use default timeout when not specified", async () => {
    const config = buildToolConfig({
      name: "default_timeout_test",
      description: "Test default timeout",
      inputs: {},
      run: 'echo "Default timeout"',
      // No timeout specified, should use default (5 minutes)
    });

    const result = await executeCommand(config, {});
    expect(result.trim()).toBe("Default timeout");
  });

  it("should execute non-bash scripts with custom shell option", async () => {
    // This test verifies:
    // 1. Non-bash interpreters can be invoked correctly
    // 2. Environment variables (INPUTS__*) are passed correctly
    const config = buildToolConfig({
      name: "node_test",
      description: "Test Node.js execution",
      shell: "node {0}",
      inputs: {
        value: {
          type: "number",
          description: "Value to multiply",
          required: true,
        },
      },
      run: `const value = parseInt(process.env.INPUTS__VALUE);
console.log(\`Result: \${value * 2}\`);`,
    });

    const result = await executeCommand(config, { value: 21 });
    expect(result.trim()).toBe("Result: 42");
  });

  it("should use custom shell command", async () => {
    const config = buildToolConfig({
      name: "custom_shell_test",
      description: "Test custom shell command",
      shell: "sh {0}",
      inputs: {
        text: {
          type: "string",
          description: "Text to output",
          required: true,
        },
      },
      run: `echo "Custom shell: $INPUTS__TEXT"`,
    });

    const result = await executeCommand(config, { text: "test message" });
    expect(result.trim()).toBe("Custom shell: test message");
  });

  it("should use default shell option from config", async () => {
    const config = buildToolConfig({
      name: "default_shell_test",
      description: "Test default shell from config",
      inputs: {},
      run: `echo "Default shell"
echo "Success"`,
      // Uses default shell from config (bash -e {0})
    });

    const result = await executeCommand(config, {});
    expect(result.trim()).toContain("Default shell");
    expect(result.trim()).toContain("Success");
  });

  it("should correctly replace {0} placeholder with script path", async () => {
    // Test that {0} is replaced with the actual script file path
    const config = buildToolConfig({
      name: "placeholder_test",
      description: "Test {0} placeholder replacement",
      shell: "echo 'Script path: {0}' && sh {0}",
      inputs: {
        message: {
          type: "string",
          description: "Message to output",
        },
      },
      run: `echo "$INPUTS__MESSAGE"`,
    });

    const result = await executeCommand(config, { message: "Hello" });
    const lines = result.trim().split("\n");
    expect(lines[0]).toMatch(/^Script path: .*script-.*$/);
    expect(lines[1]).toBe("Hello");
  });

  it("should pass inputs as INPUTS_JSON environment variable", async () => {
    const config = buildToolConfig({
      name: "json_test",
      description: "Test INPUTS_JSON environment variable",
      inputs: {
        message: {
          type: "string",
          description: "Message",
          required: true,
        },
        count: {
          type: "number",
          description: "Count",
          required: true,
        },
      },
      run: `echo "$INPUTS_JSON"`,
    });

    const inputs = { message: "Hello", count: 42 };
    const result = await executeCommand(config, inputs);
    const parsed = JSON.parse(result.trim());
    expect(parsed).toEqual(inputs);
  });

  it("should preserve types in INPUTS_JSON for Node.js", async () => {
    const config = buildToolConfig({
      name: "node_json_test",
      description: "Test INPUTS_JSON with Node.js",
      shell: "node {0}",
      inputs: {
        text: {
          type: "string",
          description: "Text value",
          required: true,
        },
        number: {
          type: "number",
          description: "Numeric value",
          required: true,
        },
        flag: {
          type: "boolean",
          description: "Boolean flag",
          required: true,
        },
      },
      run: `
const inputs = JSON.parse(process.env.INPUTS_JSON);
console.log(JSON.stringify({
  textType: typeof inputs.text,
  numberType: typeof inputs.number,
  flagType: typeof inputs.flag,
  values: inputs
}));`,
    });

    const result = await executeCommand(config, {
      text: "test",
      number: 123,
      flag: true,
    });
    const parsed = JSON.parse(result.trim());
    expect(parsed.textType).toBe("string");
    expect(parsed.numberType).toBe("number");
    expect(parsed.flagType).toBe("boolean");
    expect(parsed.values).toEqual({
      text: "test",
      number: 123,
      flag: true,
    });
  });

  it("should preserve types in INPUTS_JSON for Python", async () => {
    const config = buildToolConfig({
      name: "python_json_test",
      description: "Test INPUTS_JSON with Python",
      shell: "python3 {0}",
      inputs: {
        text: {
          type: "string",
          description: "Text value",
          required: true,
        },
        number: {
          type: "number",
          description: "Numeric value",
          required: true,
        },
        flag: {
          type: "boolean",
          description: "Boolean flag",
          required: true,
        },
      },
      run: `
import os
import json

inputs = json.loads(os.environ['INPUTS_JSON'])
result = {
    'textType': type(inputs['text']).__name__,
    'numberType': type(inputs['number']).__name__,
    'flagType': type(inputs['flag']).__name__,
    'values': inputs
}
print(json.dumps(result))`,
    });

    const result = await executeCommand(config, {
      text: "test",
      number: 456,
      flag: false,
    });
    const parsed = JSON.parse(result.trim());
    expect(parsed.textType).toBe("str");
    // Python3 では number は int または float として解釈される
    expect(["int", "float"]).toContain(parsed.numberType);
    expect(parsed.flagType).toBe("bool");
    expect(parsed.values).toEqual({
      text: "test",
      number: 456,
      flag: false,
    });
  });

  it("should handle complex objects in INPUTS_JSON", async () => {
    const config = buildToolConfig({
      name: "complex_json_test",
      description: "Test INPUTS_JSON with complex data",
      shell: "node {0}",
      inputs: {
        "user-name": {
          type: "string",
          description: "User name with hyphen",
          required: true,
        },
        age: {
          type: "number",
          description: "User age",
          required: false,
        },
        active: {
          type: "boolean",
          description: "Active status",
          default: true,
        },
      },
      run: `
const inputs = JSON.parse(process.env.INPUTS_JSON);
console.log(JSON.stringify(inputs));`,
    });

    const inputs = { "user-name": "Alice", age: 30, active: false };
    const result = await executeCommand(config, inputs);
    const parsed = JSON.parse(result.trim());
    expect(parsed).toEqual(inputs);
  });

  it("should maintain backward compatibility with individual env vars", async () => {
    const config = buildToolConfig({
      name: "compatibility_test",
      description: "Test backward compatibility",
      inputs: {
        message: {
          type: "string",
          description: "Message",
          required: true,
        },
        count: {
          type: "number",
          description: "Count",
          required: true,
        },
      },
      run: `
# Both individual env vars and INPUTS_JSON should be available
echo "Individual: $INPUTS__MESSAGE - $INPUTS__COUNT"
echo "JSON: $INPUTS_JSON"`,
    });

    const result = await executeCommand(config, { message: "Test", count: 99 });
    const lines = result.trim().split("\n");
    expect(lines[0]).toBe("Individual: Test - 99");
    const parsed = JSON.parse(lines[1].replace("JSON: ", ""));
    expect(parsed).toEqual({ message: "Test", count: 99 });
  });
});
