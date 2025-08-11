# any-scripts-mcp-server

任意のCLIツールやシェルスクリプトをMCP Toolとして提供できるMCPサーバー

## 概要

YAMLファイルで定義したコマンドをMCP Toolとして公開できるMCPサーバーです。設定ファイルにツールの定義を記述することで、任意のシェルスクリプトをMCPクライアントから実行できるようになります。

## インストール

```bash
pnpm install
pnpm build
```

## 設定

設定ファイルを `$XDG_CONFIG_HOME/any-scripts-mcp-server/config.yaml` に配置します（通常は `~/.config/any-scripts-mcp-server/config.yaml`）。

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

## 開発

```bash
# テスト実行
pnpm test

# コードフォーマット
pnpm check

# ビルド
pnpm build
```

## ライセンス

MIT