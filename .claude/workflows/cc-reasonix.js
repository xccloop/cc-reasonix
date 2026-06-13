export const meta = {
  name: 'cc-reasonix',
  description: 'CC-Reasonix: spawns self-correcting Reasonix executor, then final verification. Claude does Phase 1 review+plan directly BEFORE invoking this.',
  phases: [
    { title: 'Implement', detail: 'Self-correcting Reasonix: implement → build → self-review → fix → repeat until done' },
    { title: 'Verify', detail: 'Claude final check: diff + impact + build' },
  ],
  whenToUse: 'After Claude has written a plan to docs/plans/. NOT for single-line fixes.',
}

// ── Resolve workspace root ──────────────────────────────────────
var workspaceRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// ── Resolve build command ───────────────────────────────────────
var buildCmd = './build.sh'
try {
  var buildCmdPath = require('path').join(workspaceRoot, '.claude', 'build-cmd')
  var fs = require('fs')
  if (fs.existsSync(buildCmdPath)) {
    buildCmd = fs.readFileSync(buildCmdPath, 'utf8').trim()
    if (!buildCmd) buildCmd = 'echo "no build command configured"'
  } else {
    // Auto-detect
    if (fs.existsSync(require('path').join(workspaceRoot, 'CMakeLists.txt'))) buildCmd = 'cmake --build build'
    else if (fs.existsSync(require('path').join(workspaceRoot, 'Makefile'))) buildCmd = 'make'
    else if (fs.existsSync(require('path').join(workspaceRoot, 'package.json'))) buildCmd = 'npm run build'
    else if (fs.existsSync(require('path').join(workspaceRoot, 'Cargo.toml'))) buildCmd = 'cargo build'
  }
} catch (e) {}

// ── Resolve Python ──────────────────────────────────────────────
var pythonCmd = 'python3'
try {
  var { execSync } = require('child_process')
  try { execSync('python3 --version', { stdio: 'pipe' }) } catch (e) {
    try { execSync('python --version', { stdio: 'pipe' }); pythonCmd = 'python' } catch (e2) {
      try { execSync('py --version', { stdio: 'pipe' }); pythonCmd = 'py' } catch (e3) {}
    }
  }
} catch (e) {}

// ── Extract plan info ──────────────────────────────────────────
var planPath = args.planPath || ''

if (!planPath) {
  log('ERROR: No planPath provided. Cannot execute without a plan.')
  return { status: 'FAILED', phase: 'Init', reason: 'Missing required arg: planPath' }
}

var planSlug = planPath.replace(/^.*\/|\.md$/g, '')
log('Workspace: ' + workspaceRoot)
log('Build: ' + buildCmd)
log('Plan: ' + planPath + ' (slug: ' + planSlug + ')')

// ── Phase 2: Self-Correcting Reasonix ──────────────────────────
phase('Implement')

const implementResult = await agent(
  'You are Reasonix — a SELF-CORRECTING Phase 2 executor (deepseek-v4-pro).\n\n' +
  'Read your full system prompt from REASONIX.md at the project root.\n\n' +
  '## Workspace\n' +
  'Root: ' + workspaceRoot + '\n' +
  'Build command: ' + buildCmd + '\n\n' +
  '## Your Job\n' +
  '1. Read the plan: ' + planPath + '\n' +
  '2. Read the plan\'s Context section — it has Phase 1\'s codegraph findings\n' +
  '3. Implement every change exactly as specified\n' +
  '4. Run build: ' + buildCmd + '\n' +
  '5. If build fails → fix root cause → re-run. Max 3 rounds.\n' +
  '6. Run each change\'s "Verify" check from the plan\n' +
  '7. Run edge case checks from the plan\n' +
  '8. Self-review your own diff — did you miss anything? Add anything extra?\n' +
  '9. If you find issues → fix them → go back to step 4\n' +
  '10. Only report done when: build passes + all verify checks pass + edge cases pass\n\n' +
  '## Self-Correction Loop (do this INTERNALLY, do not ask)\n' +
  '```\n' +
  'implement → build → verify → self-review\n' +
  '                             ↓ issues found\n' +
  '                        fix → build → verify → self-review\n' +
  '                             ↓ clean\n' +
  '                           REPORT DONE\n' +
  '```\n\n' +
  '## You Have These Tools\n' +
  '- filesystem MCP: read_file, write_file, edit_file, grep, glob_files, run_bash\n' +
  '- codegraph MCP: codegraph_context, codegraph_search, codegraph_trace\n' +
  '- Skills: using-superpowers (+ language-specific if activated)\n\n' +
  '## Rules\n' +
  '- Follow the plan EXACTLY. No extras, no omissions.\n' +
  '- If "Before" code doesn\'t match the file, STOP — plan is stale.\n' +
  '- If plan is ambiguous, make the BEST choice, note it in issues[].\n' +
  '- Write "done" to docs/plans/' + planSlug + '.status when complete.\n' +
  '- Do NOT ask for help. Do NOT give up on first build error. Fix it.\n' +
  '- You are the last line before Claude\'s final check. Make it count.',
  {
    label: 'Phase 2: Self-Correcting Reasonix',
    phase: 'Implement',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['done', 'failed'] },
        changesMade: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'string' }, description: { type: 'string' } } } },
        buildStatus: { type: 'string', enum: ['pass', 'fail'] },
        selfReviewPassed: { type: 'boolean', description: 'Did internal self-review pass?' },
        codegraphReused: { type: 'boolean', description: 'Was plan Context sufficient? false = had to re-explore' },
        correctionRounds: { type: 'number', description: 'How many self-correction cycles were needed' },
        issues: { type: 'array', items: { type: 'string' }, description: 'Known issues or plan ambiguities encountered' },
      },
      required: ['status', 'changesMade', 'buildStatus', 'selfReviewPassed', 'codegraphReused', 'correctionRounds'],
    },
  }
)

if (!implementResult) {
  log('Reasonix failed.')
  return { status: 'FAILED', phase: 'Implement', reason: 'Reasonix returned no result' }
}

log('Status: ' + implementResult.status + ' | Build: ' + implementResult.buildStatus)
log('Self-review: ' + (implementResult.selfReviewPassed ? 'passed' : 'failed'))
log('Correction rounds: ' + (implementResult.correctionRounds || 0))
log('Codegraph reused: ' + implementResult.codegraphReused)

if (implementResult.changesMade) {
  implementResult.changesMade.forEach(function(c) { log('  ' + c.file + ':' + c.line + ' — ' + c.description) })
}
if (implementResult.issues && implementResult.issues.length > 0) {
  log('Issues noted: ' + implementResult.issues.join('; '))
}

// ── Final Verification ─────────────────────────────────────────
phase('Verify')

const verifyResult = await agent(
  'Final verification — ONE pass, no loops.\n\n' +
  'Plan: ' + planPath + '\n' +
  'Reasonix status: ' + implementResult.status + ' | Build: ' + implementResult.buildStatus + ' | Self-review: ' + implementResult.selfReviewPassed + '\n\n' +
  '## Your Job (quick, one pass)\n' +
  '1. git diff — glance at all changes\n' +
  '2. codegraph_impact on changed symbols — any new blast radius?\n' +
  '3. ' + buildCmd + ' — does it still pass?\n' +
  '4. Compare plan vs diff — anything obviously missing or extra?\n' +
  '5. Return verdict: PASS (ship it) or FAIL (list what to fix, for manual review)\n\n' +
  '## IMPORTANT\n' +
  'This is a FINAL GLANCE, not a deep review. Phase 1 already did that.\n' +
  'Reasonix already self-corrected. You\'re just confirming it\'s not broken.\n' +
  'If Reasonix said status=done + build=pass + selfReview=true → default to PASS\n' +
  'unless you see something OBVIOUSLY wrong (build broken, missing file, etc).',
  {
    label: 'Final Verification',
    phase: 'Verify',
    schema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
        notes: { type: 'string', description: 'Brief note — what was checked, any concerns' },
        buildFinal: { type: 'string', enum: ['pass', 'fail'] },
      },
      required: ['verdict', 'buildFinal'],
    },
  }
)

var finalVerdict = verifyResult ? verifyResult.verdict : 'FAIL'
var finalNotes = verifyResult ? (verifyResult.notes || '') : 'Verification failed to run'

log('Final verdict: ' + finalVerdict + ' | Build: ' + (verifyResult ? verifyResult.buildFinal : 'unknown'))

return {
  status: finalVerdict === 'PASS' ? 'COMPLETE' : 'REJECTED',
  verdict: finalVerdict,
  notes: finalNotes,
  plan: planPath,
  planSlug: planSlug,
  changes: implementResult.changesMade || [],
  planCodegraphReused: implementResult.codegraphReused,
  selfReviewPassed: implementResult.selfReviewPassed,
  correctionRounds: implementResult.correctionRounds || 0,
  builderIssues: implementResult.issues || [],
}
