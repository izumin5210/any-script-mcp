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

### Testing Your Configuration

You can test your configuration using the MCP Inspector:

```shell-session
$ npx @modelcontextprotocol/inspector npx any-script-mcp
```

This will open a web interface where you can see your registered tools and test them interactively.

### Example Configuration

```yaml
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
        --sandbox workspace-write \
        --config "sandbox_workspace_write.network_access=true" \
        "$INPUTS__PROMPT" \
        --json \
        | jq -sr 'map(select(.msg.type == "agent_message") | .msg.message) | last'
```

## Configuration Format

### Tool Definition

Each tool has the following fields:

- `name`: Tool name (alphanumeric, underscore, and hyphen only)
- `description`: Tool description
- `inputs`: Input parameter definitions (object format)
- `run`: Shell script to execute

### Input Parameters

Each input parameter has the following fields:

- `type`: Parameter type (`string`, `number`, `boolean`)
- `description`: Parameter description
- `required`: Whether the parameter is required (default: `true`)
- `default`: Default value (optional)

Input parameters are passed as environment variables to shell scripts. Variable names have the `INPUTS__` prefix and are converted to uppercase (hyphens are converted to underscores).

Examples:
- `message` → `$INPUTS__MESSAGE`
- `branch-name` → `$INPUTS__BRANCH_NAME`

## License

MIT