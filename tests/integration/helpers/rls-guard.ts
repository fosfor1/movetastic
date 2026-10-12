// Catalog guard for risk #2 (test-plan §2): finds objects in the `public` schema that weaken per-user
// isolation. Discovered from pg_catalog, never from a table list, so a new table is covered automatically.
import type { QueryExecutor } from "./db";

export type RlsRule =
  | "rls-disabled"
  | "policy-for-anon-or-public"
  | "policy-always-true"
  | "view-without-security-invoker"
  | "materialized-view";

/** `object` is a relation name, or `table.policy` for policy rules. */
export interface Violation {
  object: string;
  rule: RlsRule;
}

export interface AllowlistEntry extends Violation {
  reason: string;
}

/** Deliberate exceptions. Every entry needs a reason; an entry for a missing object fails the guard test. */
export const RLS_GUARD_ALLOWLIST: readonly AllowlistEntry[] = [];

/** Takes an executor so the positive control can run it inside a rolled-back transaction. */
export async function findRlsViolations(sql: QueryExecutor): Promise<Violation[]> {
  const rows = await sql<Violation[]>`
    select c.relname::text as object, 'rls-disabled' as rule
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    union all
    select tablename || '.' || policyname, 'policy-for-anon-or-public'
      from pg_policies
     where schemaname = 'public' and roles && array['anon', 'public']::name[]
    union all
    select tablename || '.' || policyname, 'policy-always-true'
      from pg_policies
     where schemaname = 'public' and (qual = 'true' or with_check = 'true')
    union all
    select c.relname::text, 'view-without-security-invoker'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
       and not coalesce(c.reloptions && array['security_invoker=true', 'security_invoker=on'], false)
    union all
    select c.relname::text, 'materialized-view'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'm'
    order by 1, 2
  `;
  return rows.map(({ object, rule }) => ({ object, rule }));
}

export function withoutAllowlisted(
  violations: Violation[],
  allowlist: readonly AllowlistEntry[] = RLS_GUARD_ALLOWLIST,
) {
  return violations.filter((v) => !allowlist.some((entry) => entry.object === v.object && entry.rule === v.rule));
}

/** Whether an allowlisted object (relation, or `table.policy`) still exists in `public`. */
export async function objectExists(sql: QueryExecutor, object: string): Promise<boolean> {
  const [table, policy] = object.split(".");
  const rows = policy
    ? await sql`select 1 from pg_policies where schemaname = 'public' and tablename = ${table} and policyname = ${policy}`
    : await sql`
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = ${table}`;
  return rows.length > 0;
}

/** Ordinary and partitioned tables in `public` — the scope the guard scans. */
export async function listPublicTables(sql: QueryExecutor): Promise<string[]> {
  const rows = await sql<{ relname: string }[]>`
    select c.relname::text as relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  `;
  return rows.map((row) => row.relname);
}
