// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together,
// that a signed-in user can log a workout and see it on /dashboard (with validation rejecting bad input),
// and that a second user does not see the first user's workouts (per-user isolation).
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const runId = Date.now();
const userA = { email: `smoke-${runId}-a@example.com`, password: "Smoke-Test-Passw0rd!" };
const userB = { email: `smoke-${runId}-b@example.com`, password: "Smoke-Test-Passw0rd!" };
const jar = new Map();

// Same calendar logic as src/lib/dates.ts (reimplemented: this script cannot import TypeScript).
function todayInWarsaw() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const today = todayInWarsaw();
const futureDate = addDays(today, 2);

// Unique distance 1XX.YZ (100.01–199.99) with a non-zero last digit, so its display string is unambiguous.
const distanceHundredths = 10000 + Math.floor(Math.random() * 9999) + 1;
const distanceKm = (distanceHundredths - (distanceHundredths % 10 === 0 ? 1 : 0)) / 100;
const distanceInput = distanceKm.toFixed(2);
// Same formatter as src/pages/dashboard.astro.
const distanceDisplay = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
  distanceKm,
);
const EMPTY_STATE = "Brak treningów z ostatnich 7 dni.";

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) jar.delete(name.trim());
    else jar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response);
  const body = await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", body };
}

const postWorkout = (fields) =>
  request("/api/workouts", {
    method: "POST",
    form: { workout_date: today, distance_km: distanceInput, avg_heart_rate: "150", ...fields },
  });

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  ["anonymous workout post redirects to signin", () => postWorkout({}), { status: 302, location: "/auth/signin" }],

  // User A: auth flow, then the add-workout flow.
  [
    "A: signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: userA }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "A: signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email: userA.email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "A: signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: userA }),
    { status: 302, location: "/dashboard" },
  ],
  ["A: dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
  [
    `A: valid workout (${today}, ${distanceInput} km) is saved`,
    () => postWorkout({}),
    { status: 302, location: "/dashboard" },
  ],
  ["A: dashboard lists the new workout", () => request("/dashboard"), { status: 200, bodyIncludes: distanceDisplay }],
  [
    "A: heart rate 500 is rejected",
    () => postWorkout({ avg_heart_rate: "500" }),
    { status: 302, location: "/dashboard/workouts/new?error=" },
  ],
  [
    `A: future date (${futureDate}) is rejected`,
    () => postWorkout({ workout_date: futureDate }),
    { status: 302, location: "/dashboard/workouts/new?error=" },
  ],
  ["A: signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["A: dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],

  // User B: fresh cookie jar, must not see A's workout.
  [
    "B: signup creates account",
    () => {
      jar.clear();
      return request("/api/auth/signup", { method: "POST", form: userB });
    },
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "B: signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: userB }),
    { status: 302, location: "/dashboard" },
  ],
  [
    "B: dashboard shows empty state, not A's workout",
    () => request("/dashboard"),
    { status: 200, bodyIncludes: EMPTY_STATE, bodyExcludes: distanceDisplay },
  ],
  ["B: signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const problems = [];
  if (actual.status !== expected.status) problems.push(`expected status ${expected.status}`);
  if (expected.location !== undefined && !actual.location.startsWith(expected.location)) {
    problems.push(`expected location starting with "${expected.location}"`);
  }
  if (expected.bodyIncludes !== undefined && !actual.body.includes(expected.bodyIncludes)) {
    problems.push(`expected body to include "${expected.bodyIncludes}"`);
  }
  if (expected.bodyExcludes !== undefined && actual.body.includes(expected.bodyExcludes)) {
    problems.push(`expected body to exclude "${expected.bodyExcludes}"`);
  }
  const ok = problems.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    for (const problem of problems) console.log(`      ${problem}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
