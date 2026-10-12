// Direct Postgres connection for catalog checks (PostgREST does not expose pg_catalog).
import postgres from "postgres";
import { inject } from "vitest";

/** Anything that can run a tagged query: a connection or a transaction inside `sql.begin`. */
export type QueryExecutor = postgres.ISql;

/** One connection per test file; close it with `sql.end()` in `afterAll`. */
export function connectDb() {
  return postgres(inject("dbUrl"), { max: 1, onnotice: () => undefined });
}
