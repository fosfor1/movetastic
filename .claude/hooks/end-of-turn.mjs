// Stop: sweep everything this turn changed before the agent finishes, with one retry.
// Lint + lint:ui + related tests on changed files, then a typecheck. Also catches files rewritten
// through Bash, which never reach the per-edit hook. Exit 2 + stderr sends the agent back.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LINTED,
  LINT_IGNORED,
  UI_GUARD,
  block,
  git,
  payloadCwd,
  readPayload,
  registryPath,
  runBin,
  runNode,
  samePath,
  sessionId,
  toplevel,
} from "./lib.mjs";

const payload = readPayload();

// Already sent back once by this hook: let it finish; the commit gate and CI catch the rest.
// (loop_count covers Cursor, which imports hooks from .claude/settings.json.)
if (payload.stop_hook_active === true || Number(payload.loop_count ?? 0) > 0) process.exit(0);

// Checkouts to sweep: the session's (payload cwd follows EnterWorktree) plus every checkout
// lint-edited-file.mjs registered for this session.
const sid = sessionId(payload);
const registry = registryPath(sid);
const candidates = [toplevel(payloadCwd(payload))];
if (sid && existsSync(registry)) {
  candidates.push(...readFileSync(registry, "utf8").split(/\r?\n/).map((r) => r.trim()));
}
const roots = [];
for (const r of candidates) {
  if (r && existsSync(r) && !roots.some((x) => samePath(x, r))) roots.push(r);
}
if (roots.length === 0) {
  // Not silent: the user sees why nothing was checked.
  console.log(JSON.stringify({ systemMessage: `end-of-turn.mjs: no git checkout at ${payloadCwd(payload)}, nothing checked.` }));
  process.exit(0);
}

const report = [];
const skipped = [];

for (const root of roots) {
  // Changed and new files. Nothing changed (a Q&A turn): nothing to check here.
  const lines = [git(root, ["diff", "--name-only", "HEAD"]), git(root, ["ls-files", "-o", "--exclude-standard"])]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .filter(Boolean);
  const changed = [...new Set(lines)].filter((f) => existsSync(join(root, f)));
  if (changed.length === 0) continue;

  const linted = changed.filter((f) => LINTED.test(f) && !LINT_IGNORED.test(f));

  if (linted.length) {
    const lint = runBin(root, "eslint", ["--quiet", ...linted]);
    if (!lint.ok) report.push(`ESLint errors in changed files (${root}):\n${lint.output}`);

    // Cheap (<1 s) guard over its own file list.
    if (existsSync(join(root, UI_GUARD))) {
      const ui = runNode(root, UI_GUARD);
      if (!ui.ok) report.push(`lint:ui failed (${root}):\n${ui.output}`);
    }

    // Integration tests need local Supabase + an app server; their global setup fails with
    // "Integration setup:" when those are down. That is the host, not the code: rerun without
    // the integration project and say what was skipped. Never skip silently.
    let tests = runBin(root, "vitest", ["related", ...linted, "--run"]);
    if (!tests.ok && tests.output.includes("Integration setup:")) {
      const reason = tests.output.split(/\r?\n/).find((l) => l.includes("Integration setup:"))?.trim();
      skipped.push(`integration tests related to changed files (${reason ?? "local infra down"})`);
      tests = runBin(root, "vitest", ["related", ...linted, "--run", "--project", "!integration"]);
      if (!tests.ok && tests.output.includes("matched no projects")) tests = { ok: true, output: "" };
    }
    if (!tests.ok) report.push(`Tests related to changed files fail (${root}):\n${tests.output}`);
  }

  // Typecheck the whole project when code changed. `astro check` covers .astro files (slow, ~50 s);
  // otherwise `tsc` (~6 s), which needs the gitignored .astro/ types generated first.
  const astroChanged = changed.some((f) => f.endsWith(".astro"));
  const codeChanged = linted.length > 0 || changed.some((f) => /(^|\/)tsconfig.*\.json$|^astro\.config\./.test(f));
  if (astroChanged) {
    const check = runBin(root, "astro", ["check"]);
    if (!check.ok) report.push(`Typecheck (astro check) fails (${root}):\n${check.output}`);
  } else if (codeChanged) {
    if (!existsSync(join(root, ".astro/types.d.ts"))) {
      const sync = runBin(root, "astro", ["sync"]);
      if (!sync.ok) report.push(`astro sync failed, typecheck could not run (${root}):\n${sync.output}`);
    }
    const tsc = runBin(root, "tsc", ["--noEmit", "--pretty", "false"]);
    if (!tsc.ok) report.push(`Typecheck (tsc) fails (${root}):\n${tsc.output}`);
  }
}

const skippedNote = skipped.length ? `\nSkipped on this host: ${skipped.join("; ")}` : "";
if (report.length) block(`Fix these before you finish:\n\n${report.join("\n\n")}${skippedNote}`);

// Green: the registered checkouts are clean; start the next turn with an empty registry.
if (sid && existsSync(registry)) writeFileSync(registry, "");
if (skipped.length) {
  console.log(JSON.stringify({ systemMessage: `end-of-turn.mjs passed, but skipped on this host: ${skipped.join("; ")}` }));
}
process.exit(0);
