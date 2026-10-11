// Risk #4 (test-plan §2): an anonymous request to any non-public route must be denied — never data, never a
// write. Probes the real server (middleware + handlers), every route discovered from src/pages/ and every
// exported HTTP method, so a route added later without protection fails here.
import { describe, expect, inject, test } from "vitest";
import { discoverRoutes, type HttpMethod, PUBLIC_ROUTES } from "./helpers/routes";

const baseUrl = inject("baseUrl");
const routes = discoverRoutes();
const publicPaths = new Set(PUBLIC_ROUTES.map((route) => route.path));
const probes = routes
  .filter((route) => !publicPaths.has(route.path))
  .flatMap((route) => route.methods.map((method) => ({ ...route, method })));

async function anonymousRequest(urlPath: string, method: HttpMethod) {
  const hasBody = method !== "GET";
  return fetch(baseUrl + urlPath, {
    method,
    redirect: "manual",
    // Astro's origin check rejects cross-site form posts with 403; send Origin so a 403 means "no session".
    headers: {
      Origin: baseUrl,
      ...(hasBody ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: hasBody ? "" : undefined,
  });
}

function isDenied(response: Response): boolean {
  if (response.status === 401 || response.status === 403) return true;
  if (response.status !== 302) return false;
  const location = response.headers.get("location") ?? "";
  return location.startsWith("/auth/signin") || location.startsWith(`${baseUrl}/auth/signin`);
}

describe("route discovery (controls)", () => {
  test("finds the known protected routes", () => {
    const found = routes.map((route) => `${route.methods.join(",")} ${route.path}`);
    expect(found).toContain("GET /dashboard");
    expect(found).toContain("POST /api/workouts");
  });

  test("every endpoint file exports at least one detected HTTP method", () => {
    expect(routes.filter((route) => route.methods.length === 0).map((route) => route.file)).toEqual([]);
  });

  test("every public allowlist entry matches a discovered route and has a reason", () => {
    const discovered = new Set(routes.map((route) => route.path));
    for (const entry of PUBLIC_ROUTES) {
      expect(discovered.has(entry.path), `stale PUBLIC_ROUTES entry: ${entry.path}`).toBe(true);
      expect(entry.reason.trim(), entry.path).not.toBe("");
    }
  });

  test("there is at least one protected route to probe", () => {
    expect(probes.length).toBeGreaterThan(0);
  });
});

describe("anonymous access is denied", () => {
  for (const probe of probes) {
    test(`${probe.method} ${probe.path} (${probe.file})`, async () => {
      const response = await anonymousRequest(probe.path, probe.method);
      const location = response.headers.get("location") ?? "";
      expect(
        isDenied(response),
        `expected 302→/auth/signin or 401/403, got ${response.status}${location ? ` → ${location}` : ""}`,
      ).toBe(true);
    });
  }
});
