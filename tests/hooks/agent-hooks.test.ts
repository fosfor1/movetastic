// Proof for the Claude Code hooks in .claude/hooks/ (Claude Code signal protocol: exit 2 + stderr
// reaches the agent). Each case pipes a payload into the real script inside a throwaway git repo.
// Real git and node; only the slow tools (eslint, tsc, astro, vitest) are stubbed by markers:
// LINT_ERROR, TYPE_ERROR, TEST_FAIL, and "bg-blue-500" for the UI literal guard.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HOOKS_DIR = resolve(import.meta.dirname, "../../.claude/hooks");
const SETTINGS = resolve(import.meta.dirname, "../../.claude/settings.json");

interface HookCommand {
  command: string;
}
interface Settings {
  hooks: Record<string, { hooks: HookCommand[] }[]>;
}

const STUB_HEADER = `const fs = process.getBuiltinModule("node:fs");
const path = process.getBuiltinModule("node:path").posix;
const args = process.argv.slice(2);
if (process.env.HOOK_TEST_LOG) fs.appendFileSync(process.env.HOOK_TEST_LOG, NAME + " " + args.join(" ") + "\\n");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.name === "node_modules" || e.name === ".git" ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const typeErrors = (exts) => walk(".").filter((f) => exts.some((x) => f.endsWith(x)) && fs.readFileSync(f, "utf8").includes("TYPE_ERROR"));
`;

const STUBS: Record<string, string> = {
  "node_modules/eslint/bin/eslint.js": `const NAME = "eslint";\n${STUB_HEADER}
const bad = args.filter((a) => !a.startsWith("-") && fs.readFileSync(a, "utf8").includes("LINT_ERROR"));
for (const f of bad) console.log(f + "\\n  1:1  error  LINT_ERROR marker  no-restricted-syntax");
process.exit(bad.length ? 1 : 0);`,
  "node_modules/typescript/bin/tsc": `const NAME = "tsc";\n${STUB_HEADER}
const bad = typeErrors([".ts", ".tsx"]);
for (const f of bad) console.log(f + "(1,1): error TS2322: Type 'string' is not assignable to type 'number'.");
process.exit(bad.length ? 2 : 0);`,
  "node_modules/astro/bin/astro.mjs": `const NAME = "astro";\n${STUB_HEADER}
if (args[0] === "sync") { fs.mkdirSync(".astro", { recursive: true }); fs.writeFileSync(".astro/types.d.ts", ""); process.exit(0); }
const bad = typeErrors([".ts", ".tsx", ".astro"]);
for (const f of bad) console.log(f + ":1:1 - error ts(2322): Type 'string' is not assignable to type 'number'.");
process.exit(bad.length ? 1 : 0);`,
  "node_modules/vitest/vitest.mjs": `const NAME = "vitest";\n${STUB_HEADER}
const filter = args.includes("--project") ? args[args.indexOf("--project") + 1] : "";
const files = args.slice(1).filter((a) => !a.startsWith("-") && a !== filter);
if (filter === "!integration") { console.error("Error: No projects were found. The filter matched no projects: !integration."); process.exit(1); }
if (process.env.FAKE_INFRA_DOWN && files.some((f) => f.startsWith("tests/integration/"))) {
  console.error("Error: Integration setup: \`npx supabase status\` failed — local Supabase is not running."); process.exit(1);
}
const bad = files.filter((f) => fs.readFileSync(f, "utf8").includes("TEST_FAIL"));
for (const f of bad) console.log("FAIL " + f + " > adds\\nAssertionError: expected 3 to be 4");
process.exit(bad.length ? 1 : 0);`,
};

const UI_GUARD_STUB = `import { readFileSync } from "node:fs";
const FILES = ["src/view.astro"];
const bad = FILES.filter((f) => readFileSync(f, "utf8").includes("bg-blue-500"));
for (const f of bad) console.error(f + ":1: bg-blue-500");
process.exit(bad.length ? 1 : 0);
`;

const temps: string[] = [];
const sessions: string[] = [];

afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
  for (const s of sessions.splice(0)) rmSync(join(tmpdir(), "claude-hooks", `${s}.roots`), { force: true });
});

function tempDir(): string {
  const d = realpathSync.native(mkdtempSync(join(tmpdir(), "agent-hooks-")));
  temps.push(d);
  return d;
}

function write(root: string, rel: string, content: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

function installStubs(root: string) {
  for (const [rel, content] of Object.entries(STUBS)) write(root, rel, content);
}

function gitIn(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

/** Throwaway repo: stubbed tools, a copy of the real hooks, a committed clean tree. */
function makeRepo(): string {
  const root = tempDir();
  gitIn(root, "init", "-q");
  gitIn(root, "config", "user.email", "hooks@test.local");
  gitIn(root, "config", "user.name", "hooks test");
  gitIn(root, "config", "core.autocrlf", "false");
  write(root, ".gitignore", "node_modules/\n.astro/\n");
  write(root, "src/ok.ts", "export const ok = 1;\n");
  write(root, "src/view.astro", "<div class='bg-card'></div>\n");
  write(root, "scripts/check-ui-literals.mjs", UI_GUARD_STUB);
  write(root, "README.md", "# fixture\n");
  cpSync(HOOKS_DIR, join(root, ".claude/hooks"), { recursive: true });
  installStubs(root);
  write(root, ".astro/types.d.ts", "");
  gitIn(root, "add", "-A");
  gitIn(root, "commit", "-q", "-m", "init");
  return root;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  calls: string[];
}

function run(
  root: string,
  script: "lint-edited-file.mjs" | "end-of-turn.mjs",
  input: string | object,
  env: Record<string, string> = {},
  spawnCwd = root,
): RunResult {
  const log = join(tempDir(), "calls.log");
  const r = spawnSync(process.execPath, [join(root, ".claude/hooks", script)], {
    cwd: spawnCwd,
    input: typeof input === "string" ? input : JSON.stringify(input),
    encoding: "utf8",
    env: { ...process.env, HOOK_TEST_LOG: log, ...env },
  });
  const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, calls };
}

let sessionCounter = 0;
function session(): string {
  const s = `hooktest-${String(process.pid)}-${String(Date.now())}-${String(sessionCounter++)}`;
  sessions.push(s);
  return s;
}

function edit(root: string, filePath: string, extra: object = {}) {
  return {
    session_id: session(),
    cwd: root,
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    tool_input: { file_path: filePath },
    ...extra,
  };
}

function stop(root: string, extra: object = {}) {
  return { session_id: session(), cwd: root, hook_event_name: "Stop", stop_hook_active: false, ...extra };
}

/** Git Bash on Windows (what Claude Code uses), never WSL's bash.exe. */
function bashPath(): string {
  if (process.platform !== "win32") return "bash";
  const exec = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
  return resolve(exec, "../../../bin/bash.exe");
}

describe("lint-edited-file.mjs (PostToolUse Write|Edit)", () => {
  it("blocks with exit 2 and names the file and the lint error", () => {
    const root = makeRepo();
    write(root, "src/bad.ts", "export const bad = 1; // LINT_ERROR\n");
    const r = run(root, "lint-edited-file.mjs", edit(root, join(root, "src/bad.ts")));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint reported errors in src/bad.ts");
    expect(r.stderr).toContain("LINT_ERROR");
    expect(r.calls).toEqual(["eslint --quiet src/bad.ts"]);
  });

  it("blocks when an edited view guarded by lint:ui gains a palette class", () => {
    const root = makeRepo();
    write(root, "src/view.astro", "<div class='bg-blue-500'></div>\n");
    const r = run(root, "lint-edited-file.mjs", edit(root, join(root, "src/view.astro")));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("lint:ui");
    expect(r.stderr).toContain("src/view.astro:1: bg-blue-500");
  });

  it("passes silently on a clean file", () => {
    const root = makeRepo();
    const r = run(root, "lint-edited-file.mjs", edit(root, join(root, "src/ok.ts")));
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.calls).toEqual(["eslint --quiet src/ok.ts"]);
  });

  it.each([
    ["an uncovered type", "README.md"],
    ["a missing file", "src/does-not-exist.ts"],
    ["agent tooling ignored by eslint.config.js", ".claude/hooks/lib.mjs"],
  ])("passes without linting for %s", (_label, rel) => {
    const root = makeRepo();
    const r = run(root, "lint-edited-file.mjs", edit(root, join(root, rel)));
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it.each([
    ["{}", "{}"],
    ["not json", "not json"],
    ["empty stdin", ""],
    ["a tool call without a path", JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } })],
  ])("passes on payload %s", (_label, input) => {
    const root = makeRepo();
    const r = run(root, "lint-edited-file.mjs", input);
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it("resolves a relative path against the payload cwd", () => {
    const root = makeRepo();
    write(root, "src/bad.ts", "// LINT_ERROR\n");
    const r = run(root, "lint-edited-file.mjs", edit(root, "src/bad.ts"));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/bad.ts");
  });

  it("skips a broken file of another repository", () => {
    const root = makeRepo();
    const other = makeRepo();
    write(other, "src/bad.ts", "// LINT_ERROR\n");
    const r = run(root, "lint-edited-file.mjs", edit(root, join(other, "src/bad.ts")));
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it("fails visibly when eslint is not installed", () => {
    const root = makeRepo();
    rmSync(join(root, "node_modules/eslint"), { recursive: true });
    const r = run(root, "lint-edited-file.mjs", edit(root, join(root, "src/ok.ts")));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("eslint is not installed");
  });
});

describe("end-of-turn.mjs (Stop)", () => {
  it("passes without running any check when nothing changed", () => {
    const root = makeRepo();
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
    expect(r.calls).toEqual([]);
  });

  it("catches a lint error written through the shell, with no per-edit payload", () => {
    const root = makeRepo();
    write(root, "src/shell-written.ts", "// LINT_ERROR\n");
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint errors in changed files");
    expect(r.stderr).toContain("src/shell-written.ts");
  });

  it.each([
    [
      "a tsc type error in .ts",
      "src/ok.ts",
      "export const ok: number = 'x'; // TYPE_ERROR\n",
      "Typecheck (tsc) fails",
      "tsc",
    ],
    [
      "an astro check error in .astro",
      "src/view.astro",
      "<p>{x}</p> <!-- TYPE_ERROR -->\n",
      "Typecheck (astro check) fails",
      "astro check",
    ],
    [
      "a failing related test",
      "src/sum.test.ts",
      "// TEST_FAIL\n",
      "Tests related to changed files fail",
      "vitest related",
    ],
    [
      "a palette class in a guarded view",
      "src/view.astro",
      "<div class='bg-blue-500'></div>\n",
      "lint:ui failed",
      "eslint",
    ],
  ])("blocks on %s", (_label, rel, content, header, call) => {
    const root = makeRepo();
    write(root, rel, content);
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(header);
    expect(r.stderr).toContain(rel);
    expect(r.calls.some((c) => c.startsWith(call))).toBe(true);
  });

  it("passes on a clean change and runs lint, related tests and tsc", () => {
    const root = makeRepo();
    write(root, "src/ok.ts", "export const ok = 2;\n");
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.calls).toEqual([
      "eslint --quiet src/ok.ts",
      "vitest related src/ok.ts --run",
      "tsc --noEmit --pretty false",
    ]);
  });

  it("generates the gitignored astro types before tsc", () => {
    const root = makeRepo();
    rmSync(join(root, ".astro"), { recursive: true });
    write(root, "src/ok.ts", "export const ok = 2;\n");
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(0);
    expect(r.calls.slice(-2)).toEqual(["astro sync", "tsc --noEmit --pretty false"]);
  });

  it.each([
    ["stop_hook_active", { stop_hook_active: true }],
    ["Cursor loop_count", { loop_count: 1 }],
  ])("lets the agent finish on retry (%s) even when the error remains", (_label, extra) => {
    const root = makeRepo();
    write(root, "src/bad.ts", "// LINT_ERROR\n");
    const r = run(root, "end-of-turn.mjs", stop(root, extra));
    expect(r.code).toBe(0);
    expect(r.calls).toEqual([]);
  });

  it("skips integration tests when local infra is down, and says so to the user", () => {
    const root = makeRepo();
    write(root, "tests/integration/rls.test.ts", "export {};\n");
    const r = run(root, "end-of-turn.mjs", stop(root), { FAKE_INFRA_DOWN: "1" });
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout) as { systemMessage: string };
    expect(out.systemMessage).toContain("skipped on this host");
    expect(out.systemMessage).toContain("local Supabase is not running");
  });

  it("names the skip in the block message when other checks fail", () => {
    const root = makeRepo();
    write(root, "tests/integration/rls.test.ts", "export {}; // LINT_ERROR\n");
    const r = run(root, "end-of-turn.mjs", stop(root), { FAKE_INFRA_DOWN: "1" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint errors");
    expect(r.stderr).toContain("Skipped on this host: integration tests");
  });

  it("fails visibly when the typechecker is not installed", () => {
    const root = makeRepo();
    rmSync(join(root, "node_modules/typescript"), { recursive: true });
    write(root, "src/ok.ts", "export const ok = 2;\n");
    const r = run(root, "end-of-turn.mjs", stop(root));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("tsc is not installed");
  });

  it.runIf(process.platform === "win32")("accepts a Git Bash style cwd (/c/Users/...)", () => {
    const root = makeRepo();
    write(root, "src/bad.ts", "// LINT_ERROR\n");
    const msys = root.replace(/^([A-Za-z]):\\/, (_m, d: string) => `/${d.toLowerCase()}/`).replace(/\\/g, "/");
    // Spawned outside the repo: only the translated payload cwd can find the checkout.
    const r = run(root, "end-of-turn.mjs", stop(root, { cwd: msys }), {}, tempDir());
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/bad.ts");
  });

  it("checks the session checkout, not a stale CLAUDE_PROJECT_DIR pointing at a broken one", () => {
    const root = makeRepo();
    const other = makeRepo();
    write(other, "src/bad.ts", "// LINT_ERROR\n");
    const r = run(root, "end-of-turn.mjs", stop(root), { CLAUDE_PROJECT_DIR: other });
    expect(r.code).toBe(0);
  });

  it("sweeps a sibling worktree the per-edit hook registered for this session", () => {
    const root = makeRepo();
    const wt = join(tempDir(), "wt");
    gitIn(root, "worktree", "add", "-q", wt);
    installStubs(wt);
    write(wt, ".astro/types.d.ts", "");
    write(wt, "src/bad.ts", "// LINT_ERROR\n");
    const sid = session();
    const perEdit = run(root, "lint-edited-file.mjs", { ...edit(root, join(wt, "src/bad.ts")), session_id: sid });
    expect(perEdit.code).toBe(2);
    const r = run(root, "end-of-turn.mjs", { ...stop(root), session_id: sid });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/bad.ts");
    expect(r.stderr).toContain(wt.replace(/\\/g, "/").split("/").pop());
  });
});

describe(".claude/settings.json commands", () => {
  const settings = JSON.parse(readFileSync(SETTINGS, "utf8")) as Settings;
  const commands = Object.entries(settings.hooks).flatMap(([event, groups]) =>
    groups.flatMap((g) => g.hooks.map((h) => [event, h.command] as const)),
  );

  it.each(commands)(
    "%s command reaches its script from a worktree with a nonexistent CLAUDE_PROJECT_DIR",
    (event, command) => {
      const root = makeRepo();
      const wt = join(tempDir(), "wt");
      gitIn(root, "worktree", "add", "-q", wt);
      installStubs(wt);
      write(wt, ".astro/types.d.ts", "");
      write(wt, "src/bad.ts", "// LINT_ERROR\n");
      const payload = event === "Stop" ? stop(wt) : edit(wt, join(wt, "src/bad.ts"));
      const r = spawnSync(bashPath(), ["-c", command], {
        cwd: wt,
        input: JSON.stringify(payload),
        encoding: "utf8",
        env: { ...process.env, CLAUDE_PROJECT_DIR: join(wt, "does-not-exist") },
      });
      // Exit 2 with an ESLint message proves the script ran (a missing script exits 1: "hook error").
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("src/bad.ts");
    },
  );
});
