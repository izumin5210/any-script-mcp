[![MSeeP.ai Security Assessment Badge](https://mseep.net/pr/izumin5210-any-script-mcp-badge.png)](https://mseep.ai/app/izumin5210-any-script-mcp)

# any-script-mcp

An MCP server that exposes arbitrary CLI tools and shell scripts as MCP Tools

[日本語版](./README.ja.md)

## Overview

An MCP server that publishes commands defined in YAML files as MCP Tools. By defining tools in a configuration file, you can execute arbitrary shell scripts from MCP clients.

## Installation

### npx

Claude Code:

```shell-session
$ claude mcp add any-script \
  -s user \
  -- npx any-script-mcp
```

json:

```json
{
  "mcpServers": {
     "any-script": {
       "command": "npx",
       "args": ["any-script-mcp"]
     }
  }
}
```

## Configuration

Create a configuration file at `$XDG_CONFIG_HOME/any-script-mcp/config.yaml` (typically `~/.config/any-script-mcp/config.yaml`).

You can also specify custom configuration file paths using the `ANY_SCRIPT_MCP_CONFIG` environment variable:

```shell-session
# Single configuration file
$ ANY_SCRIPT_MCP_CONFIG=/path/to/custom/config.yaml npx any-script-mcp

# Multiple configuration files (Unix/macOS - separated by colon)
$ ANY_SCRIPT_MCP_CONFIG=/path/to/custom.yaml:$XDG_CONFIG_HOME/any-script-mcp/config.yaml npx any-script-mcp

# Multiple configuration files (Windows - separated by semicolon)
$ ANY_SCRIPT_MCP_CONFIG=C:\path\to\custom.yaml;%APPDATA%\any-script-mcp\config.yaml npx any-script-mcp
```

When multiple configuration files are specified:
- All tools from all files are merged into a single collection
- If the same tool name appears in multiple files, the first occurrence takes precedence
- At least one valid configuration file must be successfully loaded
- This is useful for separating common tools from project-specific or personal customizations

### Testing Your Configuration

You can test your configuration using the MCP Inspector:

```shell-session
$ npx @modelcontextprotocol/inspector npx any-script-mcp
```

This will open a web interface where you can see your registered tools and test them interactively.

### Example Configuration

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/izumin5210/any-script-mcp/main/config.schema.json
tools:
  - name: echo
    description: Echo a message
    inputs:
      message:
        type: string
        description: Message to echo
    run: |
      echo "Received: $INPUTS__MESSAGE"
      
  - name: git_status
    description: Check git status with optional branch
    inputs:
      branch-name:
        type: string
        description: Branch to check out
        required: false
      verbose:
        type: boolean
        description: Show verbose output
        default: false
    run: |
      if [ -n "${INPUTS__BRANCH_NAME:-}" ]; then
        git checkout "$INPUTS__BRANCH_NAME"
      fi
      
      if [ "$INPUTS__VERBOSE" = "true" ]; then
        git status -v
      else
        git status
      fi
      
  # Delegate search to codex CLI. Inspired by https://github.com/yoshiko-pg/o3-search-mcp
  - name: codex-search
    description: AI agent with web search for researching latest information, troubleshooting program errors, discussing complex problems and design decisions, exploring advanced library usage, and investigating upgrade paths. Supports natural language queries.
    inputs:
      prompt:
        type: string
        description: What you want to search, analyze, or discuss with the AI agent
    run: |
      codex exec \
        --model gpt-5 \
        --sandbox workspace-write \
        --config "sandbox_workspace_write.network_access=true" \
        "$INPUTS__PROMPT" \
        --json \
        | jq -sr 'map(select(.msg.type == "agent_message") | .msg.message) | last'
    timeout: 600000  # 10 minutes for complex AI operations
      
  - name: build
    description: Run build process with tests
    run: |
      npm run build
      npm test
    timeout: 180000  # 3 minutes for build and test
```

## Configuration Format

### Tool Definition

Each tool has the following fields:

- `name`: Tool name (alphanumeric, underscore, and hyphen only)
- `description`: Tool description
- `inputs`: Input parameter definitions (object format)
- `run`: Shell script to execute
- `shell`: Shell command to execute the script (optional, default: `"bash -e {0}"`)
- `timeout`: Execution timeout in milliseconds (optional, default: 300000 = 5 minutes)

### Input Parameters

Each input parameter has the following fields:

- `type`: Parameter type (`string`, `number`, `boolean`)
- `description`: Parameter description
- `required`: Whether the parameter is required (default: `true`)
- `default`: Default value (optional)

Input parameters are passed as environment variables to shell scripts in two ways:

#### Individual Environment Variables
Variable names have the `INPUTS__` prefix and are converted to uppercase (hyphens are converted to underscores).

Examples:
- `message` → `$INPUTS__MESSAGE`
- `branch-name` → `$INPUTS__BRANCH_NAME`

#### JSON Format (INPUTS_JSON)
All inputs are also available as a single JSON object in the `INPUTS_JSON` environment variable. This preserves type information, making it easier to work with non-shell interpreters.

Example usage:
```javascript
// Node.js
const inputs = JSON.parse(process.env.INPUTS_JSON);
console.log(inputs.num * 2); // count is a number, not a string
```

### Shell Option

The `shell` option allows you to specify a custom shell or interpreter for executing scripts. The `{0}` placeholder is replaced with the path to the temporary script file.

Default: `"bash -e {0}"`

Examples:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/izumin5210/any-script-mcp/main/config.schema.json
tools:
  # Python script
  - name: python_analysis
    description: Analyze data with Python
    shell: "python {0}"
    inputs:
      data:
        type: string
        description: Data to analyze
    run: |
      import os
      import json
      
      data = os.environ['INPUTS__DATA']
      # Process data with Python
      result = {"analysis": f"Processed: {data}"}
      print(json.dumps(result))

  # Deno script
  - name: deno_fetch
    description: Fetch data with Deno
    shell: "deno run --allow-net {0}"
    inputs:
      endpoint:
        type: string
        description: API endpoint
    run: |
      const endpoint = Deno.env.get("INPUTS__ENDPOINT");
      const response = await fetch(endpoint);
      console.log(await response.json());
  
  # Using INPUTS_JSON for type preservation
  - name: add_2
    description: add 2 to a number
    shell: "node {0}"
    inputs:
      num:
        type: number
        description: a number to add 2 to
    run: |
      const inputs = JSON.parse(process.env.INPUTS_JSON);
      console.log(inputs.num + 2); // number is a number, not a string
```

#### Advanced Examples - AI Agents with Web Search

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/izumin5210/any-script-mcp/main/config.schema.json
tools:
  - name: gemini-search
    description: AI agent with web search using Gemini 2.5 Flash
    shell: "deno run -N -E {0}"
    inputs:
      query:
        type: string
        description: Query for AI search
        required: true
    run: |
      import { GoogleGenAI } from "npm:@google/genai@^1";
      const inputs = JSON.parse(Deno.env.get("INPUTS_JSON"));
      const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY") });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: inputs.query,
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: "...",
        },
      });
      console.log(
        res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join(""),
      );

  - name: gpt-5-search
    description: AI agent with web search using GPT-5
    shell: "deno run -N -E {0}"
    inputs:
      query:
        type: string
        description: Query for AI search
        required: true
    run: |
      import OpenAI from "jsr:@openai/openai";
      const inputs = JSON.parse(Deno.env.get("INPUTS_JSON"));
      const client = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
      const res = await client.responses.create({
        model: "gpt-5",
        tools: [{ type: "web_search_preview" }],
        input: inputs.query,
        instructions: "...",
      });
      console.log(res.output_text);
```

## License

MIT
