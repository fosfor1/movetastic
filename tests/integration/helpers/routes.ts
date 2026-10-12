// Route discovery for risk #4 (test-plan §2): turns every file under src/pages/ into (path, methods), so a
// route added later is probed automatically. Protection is opt-in in two places (middleware prefix list or a
// manual check in the handler), which is why the source of truth is the file system, not a list in the test.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const PAGES_DIR = path.resolve(import.meta.dirname, "../../../src/pages");

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface DiscoveredRoute {
  path: string;
  methods: HttpMethod[];
  /** Repo-relative, for failure messages. */
  file: string;
}

/** Stand-in value for dynamic segments (`[id]`, `[...rest]`). */
export const DYNAMIC_SEGMENT_VALUE = "00000000-0000-0000-0000-000000000000";

const PAGE_EXTENSIONS = new Set([".astro", ".md", ".mdx", ".html"]);
const ENDPOINT_EXTENSIONS = new Set([".ts", ".js"]);
const EXPORTED_METHOD = /export\s+(?:const|(?:async\s+)?function)\s+(GET|POST|PUT|PATCH|DELETE|ALL)\b/g;

function toUrlPath(relativeFile: string): string {
  const withoutExt = relativeFile.replace(/\.[^.]+$/, "");
  const segments = withoutExt
    .split(path.sep)
    .filter((segment, index, all) => !(segment === "index" && index === all.length - 1))
    .map((segment) => (/^\[.+\]$/.test(segment) ? DYNAMIC_SEGMENT_VALUE : segment));
  return `/${segments.join("/")}`;
}

function endpointMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  for (const [, name] of source.matchAll(EXPORTED_METHOD)) {
    if (name === "ALL") {
      methods.add("GET");
      methods.add("POST");
    } else {
      methods.add(name as HttpMethod);
    }
  }
  return [...methods].sort();
}

export function discoverRoutes(): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  for (const entry of readdirSync(PAGES_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = path.relative(PAGES_DIR, absolute);
    // Astro does not route files or directories prefixed with `_`.
    if (relative.split(path.sep).some((segment) => segment.startsWith("_"))) continue;
    const ext = path.extname(entry.name);
    const file = path.posix.join("src/pages", relative.split(path.sep).join("/"));
    if (PAGE_EXTENSIONS.has(ext)) {
      routes.push({ path: toUrlPath(relative), methods: ["GET"], file });
    } else if (ENDPOINT_EXTENSIONS.has(ext)) {
      routes.push({ path: toUrlPath(relative), methods: endpointMethods(readFileSync(absolute, "utf8")), file });
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/** Routes that are public by design. Every entry needs a reason; an entry for a missing route fails the test. */
export const PUBLIC_ROUTES: readonly { path: string; reason: string }[] = [
  { path: "/", reason: "landing page, no user data" },
  { path: "/auth/signin", reason: "sign-in form" },
  { path: "/auth/signup", reason: "sign-up form" },
  { path: "/auth/confirm-email", reason: "post-signup notice, no user data" },
  { path: "/api/auth/signin", reason: "sign-in endpoint" },
  { path: "/api/auth/signup", reason: "sign-up endpoint" },
  { path: "/api/auth/signout", reason: "sign-out endpoint, clears the session only" },
  { path: "/dev/kitchen-sink/dashboard", reason: "dev-only fixtures, 404 in production" },
];
