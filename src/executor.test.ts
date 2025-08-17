import { describe, expect, it } from "vitest";
import { executeCommand } from "./executor.js";

describe("executeCommand", () => {
  it("should pass inputs as environment variables with INPUTS__ prefix", async () => {
    const config = {
      name: "echo_test",
      description: "Test echo",
      inputs: {
        message: {
          type: "string" as const,
          description: "Message to echo",
          required: true,
        },
      },
      run: 'echo "$INPUTS__MESSAGE"',
    };

    const result = await executeCommand(config, { message: "Hello World" });
    expect(result.trim()).toBe("Hello World");
  });

  it("should handle hyphenated input names", async () => {
    const config = {
      name: "hyphen_test",
      description: "Test hyphenated names",
      inputs: {
        "user-name": {
          type: "string" as const,
          description: "User name",
          required: true,
        },
      },
      run: 'echo "$INPUTS__USER_NAME"',
    };

    const result = await executeCommand(config, { "user-name": "Alice" });
    expect(result.trim()).toBe("Alice");
  });

  it("should handle multiple inputs", async () => {
    const config = {
      name: "multi_test",
      description: "Test multiple inputs",
      inputs: {
        first: {
          type: "string" as const,
          description: "First value",
          required: true,
        },
        second: {
          type: "number" as const,
          description: "Second value",
          required: true,
        },
      },
      run: 'echo "$INPUTS__FIRST $INPUTS__SECOND"',
    };

    const result = await executeCommand(config, {
      first: "Value",
      second: 42,
    });
    expect(result.trim()).toBe("Value 42");
  });

  it("should handle boolean inputs", async () => {
    const config = {
      name: "boolean_test",
      description: "Test boolean inputs",
      inputs: {
        enabled: {
          type: "boolean" as const,
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
    };

    const result = await executeCommand(config, { enabled: true });
    expect(result.trim()).toBe("enabled");

    const result2 = await executeCommand(config, { enabled: false });
    expect(result2.trim()).toBe("disabled");
  });

  it("should handle multiline scripts", async () => {
    const config = {
      name: "multiline_test",
      description: "Test multiline scripts",
      inputs: {
        name: {
          type: "string" as const,
          description: "Name",
          required: true,
        },
      },
      run: `
echo "Hello, $INPUTS__NAME!"
echo "Welcome to the test"
echo "Line 3"`,
    };

    const result = await executeCommand(config, { name: "Bob" });
    const lines = result.trim().split("\n");
    expect(lines[0]).toBe("Hello, Bob!");
    expect(lines[1]).toBe("Welcome to the test");
    expect(lines[2]).toBe("Line 3");
  });

  it("should use custom timeout when specified", async () => {
    const config = {
      name: "timeout_test",
      description: "Test custom timeout",
      inputs: {},
      run: 'sleep 2 && echo "Should timeout"',
      timeout: 100, // 100ms timeout, should fail
    };

    await expect(executeCommand(config, {})).rejects.toThrow();
  });

  it("should succeed with longer timeout", async () => {
    const config = {
      name: "timeout_success_test",
      description: "Test successful execution with timeout",
      inputs: {},
      run: 'echo "Quick execution"',
      timeout: 60_000, // 1 minute timeout
    };

    const result = await executeCommand(config, {});
    expect(result.trim()).toBe("Quick execution");
  });

  it("should use default timeout when not specified", async () => {
    const config = {
      name: "default_timeout_test",
      description: "Test default timeout",
      inputs: {},
      run: 'echo "Default timeout"',
      // No timeout specified, should use default (5 minutes)
    };

    const result = await executeCommand(config, {});
    expect(result.trim()).toBe("Default timeout");
  });
});
