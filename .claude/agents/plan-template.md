# Plan Template — CC-Reasonix Phase 1 → Phase 2 Handoff

## Why This Format

Reasonix has NO Claude context. It cold-starts. This template passes Claude's review reasoning as structured data so Reasonix can execute without re-researching.

---

## Plan: <short-descriptive-name>

**Status:** pending | in-progress | done | rejected
**Created:** YYYY-MM-DD HH:MM
**Target Files:** file1.ext, file2.ext, ...

---

## 1. Context (from Phase 1 Codegraph Review)

### Symbols Involved
<!-- Paste codegraph_context / codegraph_node output here. This is Reasonix's map. -->

```
Symbol: <name> at <file>:<line>
  Role: <what it does in one sentence>
  Called by: <list>
  Calls: <list>
  Impact if changed: <list of dependent symbols>
```

### Key Files
| File | Role | Must Read? |
|------|------|------------|
| `path/to/file.ext:100-200` | Core logic to change | Yes |
| `path/to/interface.ext:30-50` | Interface to keep compatible | Yes |
| `path/to/caller.ext:500-520` | Caller, must not break | No (unchanged) |

### Constraints
- **Must NOT change:** <interface signatures, public APIs, anything that breaks callers>
- **Must preserve:** <behavior, performance characteristics, conventions>
- **Build:** build command must pass after changes

---

## 2. Changes (ordered, one per section)

### Change 1: <title>

**Why:** <one sentence rationale>

**What:**
```
File: path/to/file.ext
Location: function <name>, around line <N>
Action: <replace / insert / refactor>
```

**Before (current code):**
```lang
// paste exact current code snippet
```

**After (target code):**
```lang
// paste exact target code
```

**Verify:** <specific grep/re-read check to confirm>

### Change 2: <title>
...

---

## 3. Edge Cases

| Scenario | Expected Behavior | How to Verify |
|----------|------------------|---------------|
| <edge case 1> | <behavior> | <check> |

## 4. Build & Test

```bash
# Run build command (from .claude/build-cmd if present)
# Verify no stale references
grep -r "<changed symbol>" src/
```
