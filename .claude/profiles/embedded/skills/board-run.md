---
name: board-run
description: SSH to embedded dev board — upload firmware, run program, view logs. ⚠️ MANUAL ONLY — motors can start unexpectedly. Never invoke automatically. Only when user explicitly asks.
---

# Board Run — Embedded Hardware Interaction

## ⚠️ SAFETY: Manual Use Only

**This skill controls physical hardware including motors. It must NEVER be invoked automatically.** Claude must NOT run this skill without the user explicitly asking. Motors spinning unexpectedly can cause injury or damage.

Only use when the user says things like:
- "run it on the board"
- "upload and test"
- "check the board output"
- "show me the logs from the board"

## When to Use

- User explicitly asks to run on hardware
- User asks "What's the actual output?" / "What does the board show?"
- Debugging runtime crashes, timing issues, sensor values
- Any time the user requests hardware verification

## Setup (First Time)

Check for board connection config in `.claude/board-config.json`. If it doesn't exist, ask the user:

```
I need SSH details to connect to the dev board:

1. Hostname/IP: ?
2. Username: ?
3. Port: (default 22)
4. Auth: password or SSH key path?
5. Firmware upload path on board: ? (e.g., /home/root/nova/)
6. Run command: ? (e.g., ./nova, or a launch script)
7. Log file path: ? (e.g., /var/log/nova.log, or serial output file)
```

Save answers to `.claude/board-config.json`:

```json
{
  "host": "<ip>",
  "user": "<username>",
  "port": 22,
  "authMethod": "key",
  "keyPath": "~/.ssh/id_rsa",
  "uploadPath": "/home/root/nova/",
  "runCommand": "./nova",
  "logPath": "/tmp/nova.log",
  "buildOutputPath": "build/nova"
}
```

## Commands

### Upload Firmware
```bash
scp -P <port> build/nova <user>@<host>:<uploadPath>/
```

### Run Program (background + capture log)
```bash
ssh <user>@<host> "cd <uploadPath> && nohup ./nova > <logPath> 2>&1 & echo PID=\$!"
```

### View Logs (tail)
```bash
ssh <user>@<host> "tail -n 100 <logPath>"
```

### View Logs (follow — use Monitor for live streaming)
```bash
ssh <user>@<host> "tail -f <logPath>"
```

### Check if Running
```bash
ssh <user>@<host> "ps aux | grep nova | grep -v grep"
```

### Stop Program
```bash
ssh <user>@<host> "pkill -f nova"
```

### Run with Immediate Output (short test)
```bash
ssh <user>@<host> "cd <uploadPath> && timeout 10 ./nova 2>&1"
```

### Full Pipeline (build → upload → run → tail)
```bash
./build.sh \
  && scp -P <port> build/nova <user>@<host>:<uploadPath>/ \
  && ssh <user>@<host> "cd <uploadPath> && pkill -f nova 2>/dev/null; nohup ./nova > <logPath> 2>&1 & sleep 2 && tail -n 50 <logPath>"
```

## Safety Rules

- **Read logs first** — before changing code based on "what you think" is happening, ALWAYS check actual board output
- **Stop before re-upload** — pkill the running process before uploading a new binary
- **Don't leave processes running** — after debugging, stop the program unless the user explicitly wants it running
- **Ask before destructive operations** — `rm -rf`, `dd`, flashing bootloader, anything that modifies board system files

## Integration with CC-Reasonix

```
Phase 1: Claude reviews code → writes plan
Phase 2: Reasonix implements → ./build.sh passes
Phase 3: Claude final glance
    ↓
Phase 4 (optional): board-run
    ├── upload to board
    ├── run program
    ├── view logs
    └── report: runtime behavior matches expectations? Y/N
```

If runtime behavior is wrong:
- Claude reads logs → updates plan → Reasonix re-implements
- This closes the loop: code → build → deploy → observe → refine

## Interpreting Embedded Logs

When viewing board output, look for:
- **Crash messages**: segfault, stack overflow, watchdog reset
- **Timing**: "loop took X ms" — is it within deadline?
- **Sensor values**: camera frame stats, motor encoder counts — do they make sense?
- **Control output**: offset values, motor PWM — are they in expected range?
- **Initialization**: did all modules init successfully?
- **Memory**: heap/stack usage warnings

Report findings with specific log lines, not "it doesn't work."
