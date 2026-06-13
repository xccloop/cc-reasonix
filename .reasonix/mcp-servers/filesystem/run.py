#!/usr/bin/env python3
"""Filesystem MCP server for Reasonix — provides file I/O tools via FastMCP.

Gives Reasonix (which has no built-in file tools) the ability to:
  read_file, write_file, edit_file, grep, glob_files, run_bash

Workspace root: set via REASONIX_WORKSPACE env var, or auto-detected.
Cross-platform: Windows (python) and Linux (python3) compatible.
"""

import os
import re
import subprocess
import fnmatch
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# Workspace detection: env var > ../.. from this file > cwd
_workspace = os.environ.get("REASONIX_WORKSPACE", "")
if _workspace:
    WORKSPACE = Path(_workspace).resolve()
else:
    # Auto-detect: this file is at <workspace>/.reasonix/mcp-servers/filesystem/run.py
    _this_file = Path(__file__).resolve()
    WORKSPACE = _this_file.parent.parent.parent.parent.resolve()

mcp = FastMCP("filesystem")


def _resolve(path: str) -> Path:
    """Resolve a path: absolute paths stay as-is; relative paths resolve to workspace."""
    p = Path(path)
    if not p.is_absolute():
        p = WORKSPACE / p
    return p.resolve()


@mcp.tool()
def read_file(path: str, offset: int = 0, limit: int = 2000) -> str:
    """Read a file from the filesystem. Returns content with line numbers.

    Args:
        path: Absolute or workspace-relative path to the file.
        offset: Start reading from this line (0-indexed).
        limit: Maximum number of lines to return.
    """
    p = _resolve(path)
    if not p.exists():
        return f"[ERROR] File not found: {p}"
    if p.is_dir():
        return f"[ERROR] Path is a directory: {p}"

    try:
        lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        total = len(lines)
        chunk = lines[offset: offset + limit]
        result = []
        for i, line in enumerate(chunk, start=offset + 1):
            result.append(f"{i:6d}\t{line}")
        header = f"# {p}  (lines {offset+1}-{min(offset+limit, total)} of {total})"
        return header + "\n" + "\n".join(result)
    except Exception as e:
        return f"[ERROR] Failed to read {p}: {e}"


@mcp.tool()
def write_file(path: str, content: str) -> str:
    """Write content to a file. Creates parent directories if needed.

    Args:
        path: Absolute or workspace-relative path to write.
        content: The full text content to write.
    """
    p = _resolve(path)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"[OK] Wrote {len(content)} bytes to {p}"
    except Exception as e:
        return f"[ERROR] Failed to write {p}: {e}"


@mcp.tool()
def edit_file(path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
    """Perform exact string replacement in a file.

    Args:
        path: Absolute or workspace-relative path.
        old_string: The exact text to replace (must match uniquely).
        new_string: The replacement text.
        replace_all: If True, replace all occurrences.
    """
    p = _resolve(path)
    if not p.exists():
        return f"[ERROR] File not found: {p}"

    try:
        content = p.read_text(encoding="utf-8")
        count = content.count(old_string)
        if count == 0:
            return f"[ERROR] old_string not found in {p}"
        if count > 1 and not replace_all:
            return f"[ERROR] Found {count} matches. Set replace_all=true or make old_string more specific."

        new_content = content.replace(old_string, new_string) if replace_all else content.replace(old_string, new_string, 1)
        p.write_text(new_content, encoding="utf-8")
        replaced = count if replace_all else 1
        return f"[OK] Replaced {replaced} occurrence(s) in {p}"
    except Exception as e:
        return f"[ERROR] Failed to edit {p}: {e}"


@mcp.tool()
def grep(pattern: str, path: str = ".", glob: str = "", output_mode: str = "files_with_matches") -> str:
    """Search for a regex pattern in files.

    Args:
        pattern: Regular expression to search for.
        path: Directory or file to search in (workspace-relative or absolute).
        glob: Optional file pattern filter, e.g. "*.cpp".
        output_mode: "files_with_matches" (default) or "content".
    """
    p = _resolve(path)
    if not p.exists():
        return f"[ERROR] Path not found: {p}"

    files = [p] if p.is_file() else list(p.rglob("*"))
    if glob:
        files = [f for f in files if fnmatch.fnmatch(f.name, glob)]
    files = [f for f in files if f.is_file()]

    try:
        regex = re.compile(pattern)
    except re.error as e:
        return f"[ERROR] Invalid regex pattern: {e}"

    results = []
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if regex.search(line):
                if output_mode == "content":
                    results.append(f"{f}:{lineno}: {line.strip()[:200]}")
                else:
                    results.append(str(f))
                    break

    if not results:
        return "No matches found."
    return "\n".join(results)


@mcp.tool()
def glob_files(pattern: str, path: str = ".") -> str:
    """Find files matching a glob pattern.

    Args:
        pattern: Glob pattern, e.g. "**/*.cpp" or "src/*.h".
        path: Root directory to search from.
    """
    p = _resolve(path)
    if not p.exists():
        return f"[ERROR] Path not found: {p}"

    matches = list(p.glob(pattern) if "**" in pattern else Path(p).glob(pattern))
    if not matches and "**" not in pattern:
        matches = list(p.rglob(pattern))

    files = [str(m) for m in matches if m.is_file()]
    if not files:
        return f"No files matching '{pattern}' in {p}"
    return "\n".join(sorted(files))


@mcp.tool()
def run_bash(command: str, timeout: int = 120) -> str:
    """Execute a shell command in the workspace directory.

    Args:
        command: Shell command to execute.
        timeout: Maximum execution time in seconds.
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(WORKSPACE),
        )
        output = result.stdout
        if result.stderr:
            output += "\n[STDERR]\n" + result.stderr
        if result.returncode != 0:
            output += f"\n[EXIT CODE] {result.returncode}"
        return output or "(no output)"
    except subprocess.TimeoutExpired:
        return f"[ERROR] Command timed out after {timeout}s: {command}"
    except Exception as e:
        return f"[ERROR] Failed to run command: {e}"


if __name__ == "__main__":
    mcp.run()
