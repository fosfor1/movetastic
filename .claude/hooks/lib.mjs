// Shared helpers for the Claude Code hooks in this directory (Node, because the host has no jq).
// Signal protocol (Claude Code): exit 2 + stderr is the only combination the agent sees;
// exit 0 + stdout JSON {"systemMessage"} reaches the user only.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Model reads the output, not a terminal.
const PLAIN_ENV = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", GREP_OPTIONS: "" };

// Files ESLint covers (eslint.config.js: JS/TS defaults, react config, eslint-plugin-astro).
export const LINTED = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|astro)$/;
// eslint.config.js ignores agent tooling.
export const LINT_IGNORED = /^\.claude\//;

export const BINS = {
  eslint: "node_modules/eslint/bin/eslint.js",
  tsc: "node_modules/typescript/bin/tsc",
  astro: "node_modules/astro/bin/astro.mjs",
  vitest: "node_modules/vitest/vitest.mjs",
};

// Payloads are untrusted shapes: empty stdin, non-JSON or missing fields mean "nothing to check".
export function readPayload() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: PLAIN_ENV });
  return r.status === 0 ? r.stdout.trim() : null;
}

// Windows: git prints C:/x, the payload carries C:\x; compare normalized.
export function samePath(a, b) {
  const norm = (p) => resolve(p).replace(/\\/g, "/").replace(/\/$/, "");
  return process.platform === "win32" ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
}

export function toplevel(dir) {
  return existsSync(dir) ? git(dir, ["rev-parse", "--show-toplevel"]) : null;
}

export function commonDir(dir) {
  return existsSync(dir) ? git(dir, ["rev-parse", "--path-format=absolute", "--git-common-dir"]) : null;
}

export function sessionId(payload) {
  return typeof payload.session_id === "string" ? payload.session_id.replace(/[^A-Za-z0-9_-]/g, "") : "";
}

export function registryPath(sid) {
  return join(tmpdir(), "claude-hooks", `${sid || "none"}.roots`);
}

// Git Bash paths (/c/Users/...) mean nothing to Node on Windows; a cwd that does not exist falls
// back to the hook process cwd (the session's directory).
export function toNativePath(p) {
  return process.platform === "win32" ? p.replace(/^\/([a-zA-Z])\//, "$1:/") : p;
}

export function payloadCwd(payload) {
  const cwd = typeof payload.cwd === "string" && payload.cwd ? toNativePath(payload.cwd) : "";
  return cwd && existsSync(cwd) ? cwd : process.cwd();
}

// Run a repo-local tool with node. A missing binary is a failure the agent must see, never a pass.
export function runBin(root, name, args, extraEnv = {}) {
  const bin = join(root, BINS[name]);
  if (!existsSync(bin)) {
    return { ok: false, output: `${name} is not installed in ${root} (${BINS[name]} missing): run npm ci.` };
  }
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...PLAIN_ENV, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? String(r.error) : ""}`.trim();
  return { ok: r.status === 0, status: r.status, output };
}

export function runNode(root, script, args = []) {
  const r = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    env: PLAIN_ENV,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

// The UI literal guard checks its own FILES list; a file is covered when that list names it.
export const UI_GUARD = "scripts/check-ui-literals.mjs";
export function uiGuarded(root, rel) {
  const guard = join(root, UI_GUARD);
  if (!existsSync(guard)) return false;
  return rel === UI_GUARD || readFileSync(guard, "utf8").includes(`"${rel}"`);
}

export function block(message) {
  process.stderr.write(`${message.trim()}\n`);
  process.exit(2);
}

export { dirname };
