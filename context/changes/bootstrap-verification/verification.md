---
bootstrapped_at: 2026-09-26T07:31:26Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: movetastic
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: movetastic
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Movetastic is a solo, after-hours web app with a 3-week MVP timeline and authentication in scope (email + password login, FR-001). This is the recommended default for `(web-app, js)`: Astro + Supabase + Cloudflare ships auth, a Postgres database, and edge deployment out of the box, so no manual wiring is needed for the login flow or data persistence the suggestion engine needs. The stack is TypeScript end-to-end and clears all four agent-friendly gates (typed, convention-based, popular in training, well-documented), which matters most for a solo builder working after hours with AI-assisted implementation. Bootstrapper confidence is first-class — the CLI is registered and expected to work, though not yet battle-tested end-to-end, so expect occasional manual steps during scaffolding. Deployment defaults to Cloudflare Pages (the starter's own default) with GitHub Actions running auto-deploy on merge to main, matching the solo/small-team default flow.

## Pre-scaffold verification

| Signal      | Value                                                   | Severity | Notes                                                                                   |
| ----------- | ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| npm package | not run                                                 | —        | cmd_template starts with `git clone`; no npm CLI package to check                       |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-09-12 | fresh    | from card.docs_url; `gh` not installed, queried public GitHub REST API via curl instead |

Local toolchain at run time: node v24.19.0, npm 11.17.0, git 2.55.0 (card expects node 22; `.nvmrc` shipped by the starter).

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 21 top-level entries (.env.example, .github/, .gitignore, .husky/, .nvmrc, .prettierrc.json, .vscode/, AGENTS.md, README.md, astro.config.mjs, components.json, eslint.config.js, node_modules/, package-lock.json, package.json, public/, scripts/, src/, supabase/, tsconfig.json, wrangler.jsonc)
**Conflicts (.scaffold siblings)**: CLAUDE.md → CLAUDE.md.scaffold
**.gitignore handling**: moved silently (absent in cwd)
**context/ handling**: starter shipped no `context/`; cwd `context/` untouched
**.bootstrap-scaffold cleanup**: left in place — contains only the starter's cloned `.git/`. Deleting it was blocked by the agent's permission policy; remove manually with `rm -rf .bootstrap-scaffold`.

**npm install notes**: added 648 packages, audited 649. npm warned that install scripts for `esbuild@0.28.2`, `esbuild@0.28.1` and `workerd@1.20260911.1` (postinstall: `node install.js`) are not yet covered by `allowScripts` and were not run. If `astro dev` / `wrangler` fail to find native binaries, run `npm approve-scripts --allow-scripts-pending` to review and approve them.

## Post-scaffold audit

**Tool**: npm audit --json
**Exit code**: 0
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (0 INFO)
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0
**Dependencies audited**: 804 total (377 prod, 269 dev, 167 optional)

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

None.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
