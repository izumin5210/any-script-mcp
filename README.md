# any-script-mcp

An MCP server that exposes arbitrary CLI tools and shell scripts as MCP Tools

[日本語版](./README.ja.md)

## Overview

An MCP server that publishes commands defined in YAML files as MCP Tools. By defining tools in a configuration file, you can execute arbitrary shell scripts from MCP clients.

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

Place the configuration file at `$XDG_CONFIG_HOME/any-script-mcp/config.yaml` (typically `~/.config/any-script-mcp/config.yaml`).

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
      
  - name: list_files
    description: List files in a directory
    inputs:
      path:
        type: string
        description: Directory path
        required: false
        default: "."
    run: |
      ls -la "$INPUTS__PATH"
      
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

## Development

```bash
# Run tests
pnpm test

# Code formatting
pnpm check

# Build
pnpm build
```

## Security

- Parameters are passed via environment variables (command injection prevention)
- Input name character restrictions
- Timeout and output size limits (60 seconds, 10MB)

## License

MIT