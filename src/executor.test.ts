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
});
