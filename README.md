# CC-Reasonix

Claude Code 审查 + Reasonix 执行，三阶段自动化工作流。实测缓存命中 85%，省 97% 实现成本。

## 快速开始

### 1. 复制的项目

```bash
cp -r .claude/*   your-project/.claude/
cp -r .reasonix/* your-project/.reasonix/
cp REASONIX.md     your-project/
mkdir -p your-project/docs/{plans,review}
```

### 2. 配置 Claude Code

`~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]"
  },
  "permissions": {
    "allow": ["Bash(*)", "Read(*)", "Write(*)", "Edit(*)", "Glob(*)", "Grep(*)", "Skill(*)", "Agent(*)", "mcp__codegraph__*"],
    "defaultMode": "acceptEdits"
  },
  "enableAllProjectMcpServers": true
}
```

### 3. 配置 Reasonix

安装：

```bash
npm install -g reasonix
pip install mcp
export DEEPSEEK_API_KEY="your-key"
```

适配项目路径（在项目根执行）：

```bash
# Linux
python3 -c "
import os, json
root = os.getcwd()
c = json.load(open('.reasonix/config.json'))
c['workspaceDir'] = root
c['mcp'] = [
    f'codegraph=codegraph serve --mcp --project {root}',
    f'filesystem=python3 {root}/.reasonix/mcp-servers/filesystem/run.py'
]
json.dump(c, open('.reasonix/config.json', 'w'), indent=2)
"
```

```powershell
# Windows
$root = (Get-Location).Path -replace '\\', '/'
$cfg = Get-Content '.reasonix/config.json' | ConvertFrom-Json
$cfg.workspaceDir = $root
$cfg.mcp = @(
    "codegraph=codegraph serve --mcp --project $root",
    "filesystem=python $root/.reasonix/mcp-servers/filesystem/run.py"
)
$cfg | ConvertTo-Json -Depth 4 | Set-Content '.reasonix/config.json'
```

### 4. 初始化 & 检测

```bash
codegraph init .
test -f CMakeLists.txt && echo "cmake --build build" > .claude/build-cmd
test -f Makefile && echo "make" > .claude/build-cmd
test -f package.json && echo "npm run build" > .claude/build-cmd
```

### 5. 验证

```bash
cd your-project
reasonix doctor
# 期望：10 ok · 0 warn · 0 fail
```

## 包含的技能

### Claude Code (`.claude/skills/`)

| 技能 | 用途 |
|------|------|
| `caveman` | Token 压缩 75% |
| `cavecrew` | 子代理委派，省主上下文 |
| `brainstorming` | 创意/设计前结构化思考 |
| `using-superpowers` | 技能纪律（始终先调用） |

### Reasonix (`.reasonix/skills/`)

| 技能 | 用途 |
|------|------|
| `using-superpowers` | 技能纪律 |
| `image-describe` | 图像分析（需 multimodal MCP） |

### 可选 Language Profiles (`.claude/profiles/`)

| Profile | 内容 |
|---------|------|
| `cpp/` | cpp-reviewer, cpp-build-resolver, C++ rules |
| `embedded/` | board-run（SSH 硬件交互） |

激活：`cp -r .claude/profiles/cpp/* .claude/`

### 兼容的全局技能

| 生态 | 命令 |
|------|------|
| **Gstack** | `/review` `/cso` `/qa` `/ship` `/investigate` `/autoplan` |
| **ECC** | `/ecc:code-review` `/ecc:security-review` `/ecc:quality-gate` |

## MCP 工具

### Reasonix 端（本模板提供）

| MCP Server | 工具 | 说明 |
|------------|------|------|
| **filesystem** | `read_file` `write_file` `edit_file` `grep` `glob_files` `run_bash` | 文件 I/O（自建，120 行 Python） |
| **codegraph** | `codegraph_context` `codegraph_search` `codegraph_trace` `codegraph_impact` `codegraph_explore` | 代码智能分析 |
| **multimodal** | `analyze_image` | 图像理解 |

> filesystem MCP server 是核心桥接层 — Reasonix 原生没有文件工具，靠它获得读写能力，从而和 Claude Code 在同一个文件系统上接力。

## 自动工作流

### 工作流引擎 (`cc-reasonix.js`)

```
Phase 1: Claude Code → 审查 + codegraph 分析 → 写 plan
Phase 2: Reasonix  → 读 plan → implement → build → verify → self-review
                     ↓ 发现 issue → fix → 重走 → 直到 clean
Phase 3: Claude Code → git diff + build + impact → PASS/FAIL
```

### Hooks (`.claude/settings.json`)

| Hook | 触发时机 | 行为 |
|------|---------|------|
| `PostToolUse` | Write/Edit 后 | 设置审查触发器 |
| `Stop` | 会话结束 | 清理触发器 |
| `UserPromptSubmit` | 每次对话前 | 显示待处理的 plan/review 数量 |

### Phase 1→2 交接模板 (`agents/plan-template.md`)

Claude 写完 plan 后 Reasonix 直接读取，包含 codegraph findings、符号依赖表、变更清单和边缘情况。Reasonix 不需要重新研究代码。

## 目录结构

```
project/
├── .claude/
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── build-cmd              # 单行构建命令
│   ├── workflows/cc-reasonix.js
│   ├── agents/plan-template.md
│   ├── skills/
│   └── profiles/
├── .reasonix/
│   ├── config.json
│   ├── mcp-servers/filesystem/run.py
│   └── skills/
├── REASONIX.md
└── docs/{plans,review}/
```

## License

MIT
