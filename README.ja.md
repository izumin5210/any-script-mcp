# any-script-mcp

任意のCLIツールやシェルスクリプトをMCP Toolとして提供できるMCPサーバー

## 概要

YAMLファイルで定義したコマンドをMCP Toolとして公開できるMCPサーバーです。設定ファイルにツールの定義を記述することで、任意のシェルスクリプトをMCPクライアントから実行できるようになります。

## インストール

### npx

Claude Code:

```shell-session
$ claude mcp add any-script \
  -s user \
  -- npx any-script-mcp
```

json:

```
{
  "mcpServers": {
     "any-script": {
       "command": "npx",
       "args": ["any-script-mcp"]
     }
  }
}
```

## 設定

設定ファイルを `$XDG_CONFIG_HOME/any-script-mcp/config.yaml` に作成します（通常は `~/.config/any-script-mcp/config.yaml`）。

### 設定のテスト

MCP Inspectorを使って設定をテストできます：

```shell-session
$ npx @modelcontextprotocol/inspector npx any-script-mcp
```

登録されたツールを確認し、対話的にテストできるWebインターフェースが開きます。

### 設定ファイルの例

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
        --model gpt-5 \
        --sandbox workspace-write \
        --config "sandbox_workspace_write.network_access=true" \
        "$INPUTS__PROMPT" \
        --json \
        | jq -sr 'map(select(.msg.type == "agent_message") | .msg.message) | last'
```

## 設定フォーマット

### ツール定義

各ツールは以下のフィールドを持ちます：

- `name`: ツール名（英数字、アンダースコア、ハイフンのみ使用可能）
- `description`: ツールの説明
- `inputs`: 入力パラメータの定義（オブジェクト形式）
- `run`: 実行するシェルスクリプト

### 入力パラメータ

各入力パラメータは以下のフィールドを持ちます：

- `type`: パラメータの型（`string`, `number`, `boolean`）
- `description`: パラメータの説明
- `required`: 必須かどうか（デフォルト: `true`）
- `default`: デフォルト値（オプション）

入力パラメータはシェルスクリプトに環境変数として渡されます。変数名は `INPUTS__` プレフィックスが付き、大文字に変換されます（ハイフンはアンダースコアに変換）。

例：
- `message` → `$INPUTS__MESSAGE`
- `branch-name` → `$INPUTS__BRANCH_NAME`

## ライセンス

MIT
