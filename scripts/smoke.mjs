// Smoke test: proves the built app, the Cloudflare adapter and the Supabase auth flow still work together,
// that a signed-in user can log a workout and see it on /dashboard (with validation rejecting bad input),
// that the dashboard shows the weekly training load computed from that workout (distance_km × avg_heart_rate / 100),
// that a second user sees neither the first user's workouts nor their load and can neither open nor delete
// them (per-user isolation), that the first user can correct their workout through the edit page (which a second
// user can neither open nor post to, and whose endpoint rejects bad input), and then delete it through the
// confirmation flow.
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
// Mirrors src/lib/training-load.ts (formula) + src/pages/dashboard.astro (formatter); the workout is logged at HR 150.
const loadFormatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const loadDisplay = loadFormatter.format((distanceKm * 150) / 100);
// The edit form pre-fills the distance with a decimal comma (src/lib/format.ts formatDistanceInput); the last digit
// is non-zero, so that shortest form keeps both decimals.
const distanceFormValue = distanceInput.replace(".", ",");
// Corrected distance: the original minus 50 km (50.01–149.99) with the same non-zero last digit, so it is always
// valid, always different, and neither display string contains the other.
const editedDistanceKm = (Math.round(distanceKm * 100) - 5000) / 100;
const editedDistanceInput = editedDistanceKm.toFixed(2);
const editedDistanceDisplay = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(editedDistanceKm);
const editedLoadDisplay = loadFormatter.format((editedDistanceKm * 150) / 100);
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Matches the load number inside its marked element, so it cannot collide with other numbers on the page.
const weeklyLoadPattern = (display) => new RegExp(`data-testid="weekly-load"[^>]*>\\s*${escapeRegExp(display)}\\s*<`);
const EMPTY_STATE = "Brak treningów z ostatnich 7 dni.";
const DELETED_NOTICE = "Trening usunięty.";
const UPDATED_NOTICE = "Trening zaktualizowany.";
const NOT_FOUND = "Nie znaleziono treningu.";

// Id of A's workout, captured from its „Usuń” link on the dashboard. Until then (or if capture fails) it is a
// sentinel that matches no row, so the later delete steps fail on their expectations instead of crashing.
const MISSING_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
let workoutId = MISSING_ID;
const DELETE_LINK_PATTERN = /href="\/dashboard\/workouts\/([0-9a-f-]{36})\/delete"/;
const confirmPath = () => `/dashboard/workouts/${workoutId}/delete`;
const deletePath = () => `/api/workouts/${workoutId}/delete`;
const editPagePath = () => `/dashboard/workouts/${workoutId}/edit`;
const editPath = () => `/api/workouts/${workoutId}/edit`;

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

const postEdit = (fields) =>
  request(editPath(), {
    method: "POST",
    form: { workout_date: today, distance_km: editedDistanceInput, avg_heart_rate: "150", ...fields },
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
  [
    `A: dashboard lists the new workout with weekly load ${loadDisplay}`,
    () => request("/dashboard"),
    { status: 200, bodyIncludes: distanceDisplay, bodyMatches: weeklyLoadPattern(loadDisplay) },
  ],
  [
    "A: dashboard links the workout to its delete confirmation",
    async () => {
      const response = await request("/dashboard");
      const match = DELETE_LINK_PATTERN.exec(response.body);
      if (match) workoutId = match[1];
      return response;
    },
    { status: 200, bodyMatches: DELETE_LINK_PATTERN },
  ],
  [
    "A: delete confirmation shows the workout",
    () => request(confirmPath()),
    { status: 200, bodyIncludes: distanceDisplay },
  ],
  [
    "A: edit page shows the workout in the form",
    () => request(editPagePath()),
    { status: 200, bodyIncludes: `value="${distanceFormValue}"` },
  ],
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
    { status: 200, bodyIncludes: EMPTY_STATE, bodyExcludes: distanceDisplay, bodyMatches: weeklyLoadPattern("0") },
  ],
  [
    "B: A's delete confirmation is not found",
    () => request(confirmPath()),
    { status: 404, bodyIncludes: NOT_FOUND, bodyExcludes: distanceDisplay },
  ],
  [
    "B: deleting A's workout is refused",
    () => request(deletePath(), { method: "POST" }),
    // A function: the workout id is captured by an earlier step, after this array is built.
    () => ({ status: 302, location: `${confirmPath()}?error=` }),
  ],
  [
    "B: A's edit page is not found",
    () => request(editPagePath()),
    { status: 404, bodyIncludes: NOT_FOUND, bodyExcludes: distanceFormValue },
  ],
  [
    "B: editing A's workout is refused",
    () => postEdit({}),
    () => ({ status: 302, location: `${editPagePath()}?error=` }),
  ],
  ["B: signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],

  // User A again: corrects the workout through the edit page, then deletes it through the confirmation flow.
  [
    "A: signin again",
    () => {
      jar.clear();
      return request("/api/auth/signin", { method: "POST", form: userA });
    },
    { status: 302, location: "/dashboard" },
  ],
  [
    "A: edit with heart rate 500 is rejected",
    () => postEdit({ avg_heart_rate: "500" }),
    // The validator's own message, not just any error: the DB CHECK would also refuse 500, so a bare `?error=`
    // would stay green if the endpoint stopped calling validateWorkoutInput (risk #6).
    () => ({ status: 302, location: `${editPagePath()}?error=${encodeURIComponent("Średnie tętno musi")}` }),
  ],
  [
    "A: dashboard still shows the original distance",
    () => request("/dashboard"),
    { status: 200, bodyIncludes: distanceDisplay, bodyMatches: weeklyLoadPattern(loadDisplay) },
  ],
  [
    `A: correcting the distance to ${editedDistanceInput} km redirects with the notice flag`,
    () => postEdit({}),
    { status: 302, location: "/dashboard?updated=1" },
  ],
  [
    `A: dashboard shows the notice and weekly load ${editedLoadDisplay}`,
    () => request("/dashboard?updated=1"),
    { status: 200, bodyIncludes: UPDATED_NOTICE, bodyMatches: weeklyLoadPattern(editedLoadDisplay) },
  ],
  [
    "A: dashboard lists the corrected distance, not the original",
    () => request("/dashboard"),
    { status: 200, bodyIncludes: editedDistanceDisplay, bodyExcludes: distanceDisplay },
  ],
  [
    "A: deleting own workout redirects with the notice flag",
    () => request(deletePath(), { method: "POST" }),
    { status: 302, location: "/dashboard?deleted=1" },
  ],
  [
    "A: dashboard shows the notice, no workout and weekly load 0",
    () => request("/dashboard?deleted=1"),
    {
      status: 200,
      bodyIncludes: DELETED_NOTICE,
      bodyExcludes: editedDistanceDisplay,
      bodyMatches: weeklyLoadPattern("0"),
    },
  ],
  ["A: final signout", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
];

let failed = 0;
for (const [name, run, expectedOrFn] of steps) {
  const actual = await run();
  const expected = typeof expectedOrFn === "function" ? expectedOrFn() : expectedOrFn;
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
  if (expected.bodyMatches !== undefined && !expected.bodyMatches.test(actual.body)) {
    problems.push(`expected body to match ${expected.bodyMatches}`);
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
