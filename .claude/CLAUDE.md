# CC-Reasonix Collaborative Workflow — Generic Template

## Architecture

```
User Task
    │
    ▼
┌──────────────────────────────────────────────────────┐
│  Phase 1: Claude Code DIRECT (Reviewer + Planner)    │
│  Claude does this HIMSELF — NOT a subagent.          │
│  Skills: brainstorming → codegraph → code-review     │
│  - Analyze target code (codegraph first, always)     │
│  - Write BULLETPROOF plan to docs/plans/             │
│  - Plan has full codegraph findings as Reasonix map  │
└──────────────┬───────────────────────────────────────┘
               │ plan file
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 2: Reasonix (Self-Correcting Executor)        │
│  Single agent call. Reasonix handles its own loop:   │
│  implement → build → verify → self-review → fix → …  │
│  Reports done only when all checks pass.             │
└──────────────┬───────────────────────────────────────┘
               │ changed files
               ▼
┌──────────────────────────────────────────────────────┐
│  Phase 3: Claude Code (Final Glance)                 │
│  ONE pass only: git diff + build + impact.           │
│  Reasonix already self-corrected. Default to PASS    │
│  unless something obviously broken.                  │
└──────────────────────────────────────────────────────┘
```

## ⚠️ HARD GATE: Claude Reviews, Reasonix Implements

**This is the core token-efficiency contract. Do NOT violate it.**

| | Claude Code (You) | Reasonix (deepseek-v4-pro) |
|---|---|---|
| **Role** | Reviewer + Planner + Verifier | Executor |
| **Does** | Understand, review, plan, verify | Read plan → write code → build |
| **Does NOT** | Implement code changes | Design, plan, decide architecture |
| **Token cost** | Expensive cache, keep lean | Cheaper, bulk implementation |
| **Context** | Shared with user conversation | Isolated, disposable |

### Rules

1. **When user reports a problem / bug / feature request:**
   - Phase 1: Claude reviews with codegraph → writes plan to `docs/plans/`
   - Then invoke `cc-reasonix` workflow
   - Reasonix implements + self-corrects → Claude does final glance
   - If trivial (single-line typo, comment, config value, formatting) → fix directly, skip workflow.

2. **Never write implementation code for non-trivial changes.** You burn expensive context tokens on work deepseek-v4-pro can do cheaper. Your job is review + plan. Reasonix implements.

## Priority Skills (in .claude/skills/)

| Skill | When | Effect |
|-------|------|--------|
| `using-superpowers` | **ALWAYS first** — every response | Skill discipline |
| `caveman` | Always active | 75% token reduction |
| `cavecrew` | Multi-file investigation | Delegate search to subagents |
| `brainstorming` | Before ANY creative/design work | Structure thinking first |

### Optional Language Profiles (in profiles/)

| Profile | Skills + Agents + Rules | Activate |
|---------|------------------------|----------|
| `cpp` | cpp-reviewer, cpp-build-resolver, cpp-coding-standards, C++ rules | Copy to .claude/ |
| `embedded` | board-run (SSH hardware) | Copy + configure board-config.json |

To activate a profile: copy its contents into the main `.claude/` directories.

## Skill Routing

**MANDATORY:** Invoke `using-superpowers` FIRST before any response. Then route:

- **Non-trivial change (>5 lines, new logic, refactor) → Phase 1→2→3 workflow**
- Code review/diff check → invoke `/review` or spawn reviewer agent
- Security, vulnerabilities → invoke `/security-review`
- Bug report / "something's wrong" → review with codegraph → plan → Reasonix
- Architecture → invoke `brainstorming`, then design
- Ship/deploy/PR → invoke `/ship`
- QA/testing → invoke `/qa`

## Codegraph Mandatory Usage

Before ANY code exploration, editing, or review:

| Task | Codegraph Tool |
|------|---------------|
| Find symbol/function/file | `codegraph_search` or `codegraph_context` |
| Understand architecture | `codegraph_context` (search + callers + callees in one call) |
| Trace call chain | `codegraph_trace` (from → to, one call) |
| Assess change impact | `codegraph_impact` |
| Before writing code | `codegraph_context` to understand conventions |
| After writing code | `codegraph_impact` to verify no breakage |

**Principle: Codegraph first, then act. Never blind-write.**

## Build & Verify

Build command is defined in `.claude/build-cmd` (one line). If absent, auto-detect:
```bash
test -f CMakeLists.txt && echo "cmake --build build" > .claude/build-cmd
test -f Makefile && echo "make" > .claude/build-cmd
test -f package.json && echo "npm run build" > .claude/build-cmd
```

After any code change that affects compilation, run the build command. Fail → stop → fix → retry.

## ECC + Gstack Integration

This template works with the global ECC and Gstack skill ecosystems. No need to copy — they're auto-available.

### Gstack Review Pipeline
| Command | What it does |
|---------|-------------|
| `/review` | Full code review of uncommitted changes |
| `/cso` | OWASP + STRIDE security audit |
| `/qa` | Browser-based QA on running dev server |
| `/autoplan` | All reviews automated |
| `/ship` | Create PR and ship |
| `/investigate` | Debug bugs systematically |

### ECC Specialized Agents
| Command | What it does |
|---------|-------------|
| `/ecc:code-review` | Structured code review with specialized agents |
| `/ecc:security-review` | Security vulnerability scan |
| `/ecc:plan` | Architectural planning |
| `/ecc:feature-dev` | Guided feature development |
| `/ecc:quality-gate` | Pre-ship quality pipeline |
| `/ecc:silent-failure-hunter` | Find swallowed errors |

### When to Use Which

```
Code change done?
  ├─ Security-sensitive? → /cso + /ecc:security-review
  ├─ User-facing? → /qa (if dev server running)
  ├─ C++ specific? → spawn cpp-reviewer agent
  ├─ General? → /review
  └─ Before shipping? → /ecc:quality-gate
```

## Workflow Summary

```
Understand → codegraph_context / codegraph_trace
     ↓
Design/Plan → brainstorming → docs/plans/
     ↓
Implement → Reasonix Phase 2 (self-correcting)
     ↓
Build → $(cat .claude/build-cmd) (must pass)
     ↓
Verify → Phase 3 verification + codegraph_impact
```
