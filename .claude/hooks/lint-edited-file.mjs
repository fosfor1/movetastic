// PostToolUse (Write|Edit): lint only the file the agent just edited, in its own checkout.
// Exit 2 + stderr reaches the agent next to the tool result; exit 0 means clean or nothing to check.
import { appendFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  LINTED,
  LINT_IGNORED,
  UI_GUARD,
  block,
  commonDir,
  dirname,
  payloadCwd,
  readPayload,
  registryPath,
  runBin,
  runNode,
  samePath,
  sessionId,
  toNativePath,
  toplevel,
  uiGuarded,
} from "./lib.mjs";

const payload = readPayload();
const input = payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
const raw = input.file_path ?? input.notebook_path;
if (typeof raw !== "string" || !raw) process.exit(0);

const cwd = payloadCwd(payload);
const native = toNativePath(raw);
const file = isAbsolute(native) ? native : resolve(cwd, native);
if (!LINTED.test(file) || !existsSync(file) || !statSync(file).isFile()) process.exit(0);

// Checkout of the edited file, not $CLAUDE_PROJECT_DIR (stale after EnterWorktree). Files of other
// repositories (~/.claude, other projects) are skipped; any worktree of this repository is checked.
const root = toplevel(dirname(file));
if (!root) process.exit(0);
const repo = commonDir(root);
const sessionRepo = commonDir(cwd);
if (!repo || !sessionRepo || !samePath(repo, sessionRepo)) process.exit(0);

const rel = relative(root, file).replace(/\\/g, "/");
if (LINT_IGNORED.test(rel)) process.exit(0);

// Register the checkout so the Stop hook sweeps it too, even when it is not the session cwd.
const sid = sessionId(payload);
if (sid) {
  try {
    const reg = registryPath(sid);
    mkdirSync(dirname(reg), { recursive: true });
    appendFileSync(reg, `${root}\n`);
  } catch {
    // Registry is an optimisation for sibling worktrees; the session checkout is swept regardless.
  }
}

const problems = [];
// No --fix: rewriting the file under the agent makes its next Edit fail with "modified since read".
const lint = runBin(root, "eslint", ["--quiet", rel]);
if (!lint.ok) problems.push(`ESLint reported errors in ${rel}:\n${lint.output}`);

if (uiGuarded(root, rel)) {
  const ui = runNode(root, UI_GUARD);
  if (!ui.ok) problems.push(`lint:ui (${UI_GUARD}) failed after editing ${rel}:\n${ui.output}`);
}

if (problems.length) block(problems.join("\n\n"));
process.exit(0);
