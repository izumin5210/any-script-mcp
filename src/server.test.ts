import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { afterEach, describe, expect, it } from "vitest";
import type { Config } from "./config.js";
import { createServer } from "./server.js";

describe("MCP Server E2E Tests", () => {
  let server: McpServer;
  let client: Client;
  let cleanup: () => Promise<void>;

  async function setupTestServer(config: Config) {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    server = await createServer(config);
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(clientTransport);

    cleanup = async () => {
      await client.close();
      await server.close();
    };

    return { server, client, cleanup };
  }

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  describe("Basic tool execution", () => {
    it("should execute a simple echo command", async () => {
      const config: Config = {
        tools: [
          {
            name: "echo_test",
            description: "Test echo command",
            inputs: {
              message: {
                type: "string",
                description: "Message to echo",
                required: true,
              },
            },
            run: 'echo "$INPUTS__MESSAGE"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      // List tools to verify registration
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(1);
      expect(tools.tools[0].name).toBe("echo_test");
      expect(tools.tools[0].description).toBe("Test echo command");

      // Call the tool
      const result = await client.callTool({
        name: "echo_test",
        arguments: { message: "Hello World" },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello World",
            "type": "text",
          },
        ]
      `);
    });

    it("should execute tool without inputs", async () => {
      const config: Config = {
        tools: [
          {
            name: "no_inputs",
            description: "Tool without inputs",
            inputs: {},
            run: 'echo "No inputs needed"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "no_inputs",
        arguments: {},
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "No inputs needed",
            "type": "text",
          },
        ]
      `);
    });
  });

  describe("Multiple tools registration", () => {
    it("should register and execute multiple tools", async () => {
      const config: Config = {
        tools: [
          {
            name: "tool_one",
            description: "First tool",
            inputs: {
              param: {
                type: "string",
                description: "Parameter for tool one",
                required: true,
              },
            },
            run: 'echo "Tool 1: $INPUTS__PARAM"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
          {
            name: "tool_two",
            description: "Second tool",
            inputs: {
              value: {
                type: "number",
                description: "Numeric value",
                required: true,
              },
            },
            run: 'echo "Tool 2: $INPUTS__VALUE"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(2);

      const toolNames = tools.tools.map((t) => t.name);
      expect(toolNames).toContain("tool_one");
      expect(toolNames).toContain("tool_two");

      // Call first tool
      const result1 = await client.callTool({
        name: "tool_one",
        arguments: { param: "test" },
      });
      expect(result1.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Tool 1: test",
            "type": "text",
          },
        ]
      `);

      // Call second tool
      const result2 = await client.callTool({
        name: "tool_two",
        arguments: { value: 42 },
      });
      expect(result2.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Tool 2: 42",
            "type": "text",
          },
        ]
      `);
    });
  });

  describe("Input parameter variations", () => {
    it("should handle hyphenated input names", async () => {
      const config: Config = {
        tools: [
          {
            name: "hyphen_test",
            description: "Test hyphenated names",
            inputs: {
              "user-name": {
                type: "string",
                description: "User name",
                required: true,
              },
              "is-active": {
                type: "boolean",
                description: "Active status",
                required: true,
              },
            },
            run: 'echo "User: $INPUTS__USER_NAME, Active: $INPUTS__IS_ACTIVE"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "hyphen_test",
        arguments: { "user-name": "Alice", "is-active": true },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "User: Alice, Active: true",
            "type": "text",
          },
        ]
      `);
    });

    it("should handle optional parameters with defaults", async () => {
      const config: Config = {
        tools: [
          {
            name: "optional_test",
            description: "Test optional parameters",
            inputs: {
              required_param: {
                type: "string",
                description: "Required parameter",
                required: true,
              },
              optional_param: {
                type: "string",
                description: "Optional parameter",
                required: false,
                default: "default_value",
              },
            },
            run: 'echo "Required: $INPUTS__REQUIRED_PARAM, Optional: ${INPUTS__OPTIONAL_PARAM:-not_set}"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      // Call with only required parameter
      const result1 = await client.callTool({
        name: "optional_test",
        arguments: { required_param: "test" },
      });
      expect(result1.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Required: test, Optional: default_value",
            "type": "text",
          },
        ]
      `);

      // Call with both parameters
      const result2 = await client.callTool({
        name: "optional_test",
        arguments: { required_param: "test", optional_param: "custom" },
      });
      expect(result2.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Required: test, Optional: custom",
            "type": "text",
          },
        ]
      `);
    });

    it("should handle all input types", async () => {
      const config: Config = {
        tools: [
          {
            name: "all_types",
            description: "Test all input types",
            inputs: {
              str_param: {
                type: "string",
                description: "String parameter",
                required: true,
              },
              num_param: {
                type: "number",
                description: "Number parameter",
                required: true,
              },
              bool_param: {
                type: "boolean",
                description: "Boolean parameter",
                required: true,
              },
            },
            run: `
if [ "$INPUTS__BOOL_PARAM" = "true" ]; then
  echo "String: $INPUTS__STR_PARAM, Number: $INPUTS__NUM_PARAM, Boolean: enabled"
else
  echo "String: $INPUTS__STR_PARAM, Number: $INPUTS__NUM_PARAM, Boolean: disabled"
fi`,
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "all_types",
        arguments: {
          str_param: "test",
          num_param: 42,
          bool_param: true,
        },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "String: test, Number: 42, Boolean: enabled",
            "type": "text",
          },
        ]
      `);
    });
  });

  describe("Error handling", () => {
    it("should handle missing required parameters", async () => {
      const config: Config = {
        tools: [
          {
            name: "required_test",
            description: "Test required parameters",
            inputs: {
              required_param: {
                type: "string",
                description: "Required parameter",
                required: true,
              },
            },
            run: 'echo "$INPUTS__REQUIRED_PARAM"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      await expect(
        client.callTool({
          name: "required_test",
          arguments: {},
        }),
      ).rejects.toThrow();
    });

    it("should handle invalid parameter types", async () => {
      const config: Config = {
        tools: [
          {
            name: "type_test",
            description: "Test parameter types",
            inputs: {
              num_param: {
                type: "number",
                description: "Number parameter",
                required: true,
              },
            },
            run: 'echo "$INPUTS__NUM_PARAM"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      await expect(
        client.callTool({
          name: "type_test",
          arguments: { num_param: "not_a_number" },
        }),
      ).rejects.toThrow();
    });

    it("should handle script execution errors", async () => {
      const config: Config = {
        tools: [
          {
            name: "error_test",
            description: "Test execution errors",
            inputs: {},
            run: "exit 1",
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "error_test",
        arguments: {},
      });
      expect((result.content as any)[0].text).toMatch(
        /Error: Command failed with exit code 1/,
      );
    });

    it("should handle script timeout", async () => {
      const config: Config = {
        tools: [
          {
            name: "timeout_test",
            description: "Test timeout",
            inputs: {},
            run: 'sleep 2 && echo "Should timeout"',
            shell: "bash -e {0}",
            timeout: 100, // 100ms timeout
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "timeout_test",
        arguments: {},
      });

      expect((result.content as any)[0].text).toMatch(
        /Error: Command timed out after 100 milliseconds:/,
      );
    });

    it("should handle non-existent tool", async () => {
      const config: Config = {
        tools: [
          {
            name: "existing_tool",
            description: "Existing tool",
            inputs: {},
            run: 'echo "exists"',
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      await expect(
        client.callTool({
          name: "non_existent_tool",
          arguments: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe("Custom shell options", () => {
    it("should execute Node.js scripts with custom shell", async () => {
      const config: Config = {
        tools: [
          {
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
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "node_test",
        arguments: { value: 21 },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Result: 42",
            "type": "text",
          },
        ]
      `);
    });

    it("should execute with sh shell", async () => {
      const config: Config = {
        tools: [
          {
            name: "sh_test",
            description: "Test sh shell",
            shell: "sh {0}",
            inputs: {
              text: {
                type: "string",
                description: "Text to output",
                required: true,
              },
            },
            run: `echo "Shell: $INPUTS__TEXT"`,
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "sh_test",
        arguments: { text: "test message" },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Shell: test message",
            "type": "text",
          },
        ]
      `);
    });

    it("should handle multiline scripts", async () => {
      const config: Config = {
        tools: [
          {
            name: "multiline_test",
            description: "Test multiline scripts",
            inputs: {
              name: {
                type: "string",
                description: "Name",
                required: true,
              },
              count: {
                type: "number",
                description: "Count",
                required: true,
              },
            },
            run: `
echo "Hello, $INPUTS__NAME!"
echo "Count: $INPUTS__COUNT"
result=$((INPUTS__COUNT * 2))
echo "Double: $result"`,
            shell: "bash -e {0}",
            timeout: 60_000,
          },
        ],
      };

      await setupTestServer(config);

      const result = await client.callTool({
        name: "multiline_test",
        arguments: { name: "Bob", count: 5 },
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "Hello, Bob!
        Count: 5
        Double: 10",
            "type": "text",
          },
        ]
      `);
    });
  });
});
