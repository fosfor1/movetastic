---
starter_id: 10x-astro-starter
package_manager: npm
project_name: movetastic
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

Movetastic is a solo, after-hours web app with a 3-week MVP timeline and authentication in scope (email + password login, FR-001). This is the recommended default for `(web-app, js)`: Astro + Supabase + Cloudflare ships auth, a Postgres database, and edge deployment out of the box, so no manual wiring is needed for the login flow or data persistence the suggestion engine needs. The stack is TypeScript end-to-end and clears all four agent-friendly gates (typed, convention-based, popular in training, well-documented), which matters most for a solo builder working after hours with AI-assisted implementation. Bootstrapper confidence is first-class — the CLI is registered and expected to work, though not yet battle-tested end-to-end, so expect occasional manual steps during scaffolding. Deployment targets Cloudflare Workers with static assets (the scaffolded `wrangler.jsonc`; Cloudflare now steers new projects there instead of Pages — deploy with `wrangler deploy`, not `wrangler pages deploy`, see `context/foundation/infrastructure.md`), with GitHub Actions running auto-deploy on merge to master, matching the solo/small-team default flow.
