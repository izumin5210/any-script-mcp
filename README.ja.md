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

`ANY_SCRIPT_MCP_CONFIG` 環境変数を使用してカスタム設定ファイルのパスを指定することもできます：

```shell-session
# 単一の設定ファイル
$ ANY_SCRIPT_MCP_CONFIG=/path/to/custom/config.yaml npx any-script-mcp

# 複数の設定ファイル（Unix/macOS - コロンで区切る）
$ ANY_SCRIPT_MCP_CONFIG=/path/to/custom.yaml:$XDG_CONFIG_HOME/any-script-mcp/config.yaml npx any-script-mcp

# 複数の設定ファイル（Windows - セミコロンで区切る）
$ ANY_SCRIPT_MCP_CONFIG=C:\path\to\custom.yaml;%APPDATA%\any-script-mcp\config.yaml npx any-script-mcp
```

複数の設定ファイルを指定した場合：
- すべてのファイルのツールが1つのコレクションにマージされます
- 同じツール名が複数のファイルに存在する場合、最初に出現したものが優先されます
- 少なくとも1つの有効な設定ファイルが正常に読み込まれる必要があります
- 共通ツールとプロジェクト固有またはパーソナルカスタマイゼーションを分離するのに便利です

### 設定のテスト

MCP Inspectorを使って設定をテストできます：

```shell-session
$ npx @modelcontextprotocol/inspector npx any-script-mcp
```

登録されたツールを確認し、対話的にテストできるWebインターフェースが開きます。

### 設定ファイルの例

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
    timeout: 600000  # 複雑なAI処理のため10分
      
  - name: build
    description: ビルドプロセスとテストの実行
    run: |
      npm run build
      npm test
    timeout: 180000  # ビルドとテストのため3分
```

## 設定フォーマット

### ツール定義

各ツールは以下のフィールドを持ちます：

- `name`: ツール名（英数字、アンダースコア、ハイフンのみ使用可能）
- `description`: ツールの説明
- `inputs`: 入力パラメータの定義（オブジェクト形式）
- `run`: 実行するシェルスクリプト
- `shell`: スクリプトを実行するシェルコマンド（オプション、デフォルト: `"bash -e {0}"`）
- `timeout`: 実行タイムアウト（ミリ秒単位、オプション、デフォルト: 300000 = 5分）

### 入力パラメータ

各入力パラメータは以下のフィールドを持ちます：

- `type`: パラメータの型（`string`, `number`, `boolean`）
- `description`: パラメータの説明
- `required`: 必須かどうか（デフォルト: `true`）
- `default`: デフォルト値（オプション）

入力パラメータはシェルスクリプトに2つの方法で環境変数として渡されます：

#### 個別の環境変数
変数名は `INPUTS__` プレフィックスが付き、大文字に変換されます（ハイフンはアンダースコアに変換）。

例：
- `message` → `$INPUTS__MESSAGE`
- `branch-name` → `$INPUTS__BRANCH_NAME`

#### JSON形式（INPUTS_JSON）
すべての入力は `INPUTS_JSON` 環境変数に単一のJSONオブジェクトとしても利用できます。これにより型情報が保持され、シェル以外のインタープリタでの作業が容易になります。

使用例：
```javascript
// Node.js
const inputs = JSON.parse(process.env.INPUTS_JSON);
console.log(inputs.num * 2); // numは文字列ではなく数値
```

### Shellオプション

`shell` オプションを使用すると、スクリプトを実行するためのカスタムシェルまたはインタープリタを指定できます。`{0}` プレースホルダーは一時スクリプトファイルのパスに置き換えられます。

デフォルト: `"bash -e {0}"`

例：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/izumin5210/any-script-mcp/main/config.schema.json
tools:
  # Pythonスクリプト
  - name: python_analysis
    description: Pythonでデータ分析
    shell: "python {0}"
    inputs:
      data:
        type: string
        description: 分析するデータ
    run: |
      import os
      import json
      
      data = os.environ['INPUTS__DATA']
      # Pythonでデータを処理
      result = {"analysis": f"Processed: {data}"}
      print(json.dumps(result))

  # Denoスクリプト
  - name: deno_fetch
    description: Denoでデータを取得
    shell: "deno run --allow-net {0}"
    inputs:
      endpoint:
        type: string
        description: APIエンドポイント
    run: |
      const endpoint = Deno.env.get("INPUTS__ENDPOINT");
      const response = await fetch(endpoint);
      console.log(await response.json());
  
  # INPUTS_JSONを使用した型保持の例
  - name: add_2
    description: add 2 to a number
    shell: "node {0}"
    inputs:
      num:
        type: number
        description: a number to add 2 to
    run: |
      const inputs = JSON.parse(process.env.INPUTS_JSON);
      console.log(inputs.num + 2); // numは文字列ではなく数値
```

#### 高度な例 - AIエージェントとWeb検索

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
        input: inputs.input,
        instructions: "...",
      });
      console.log(res.output_text);
```

## ライセンス

MIT
