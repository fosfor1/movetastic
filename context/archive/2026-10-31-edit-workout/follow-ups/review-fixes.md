# Review follow-ups — edit-workout

Queued from `reviews/impl-review.md` (2026-11-01). Each item needs its own change (`/10x-new`); none blocks archiving S-05.

## F3 — Token-clean workout form

- **What**: `WorkoutForm.tsx`, `FormField.tsx`, `SubmitButton.tsx` and `ServerError.tsx` still use palette classes (`text-purple-300`, `bg-white/10`, `text-white`, `text-blue-100/80`, `border-red-400/60`, `focus:ring-purple-400`, `bg-purple-600`, `red-*`). They render inside views that `lint:ui` lists as clean (`EditWorkoutView.astro`, and the add page's form).
- **Suggested route**: `/10x-ui` on the workout form, then add the form components to `scripts/check-ui-literals.mjs`.

## F4 — Shared hardening of the add / delete / edit pages

- **Reflected `?error=` text**: `new.astro`, `[id]/delete.astro` and `[id]/edit.astro` display any query text (escaped, but a crafted link can show a fake message). Redirect with a fixed error code and look up the message server-side.
- **Non-form POST body**: `context.request.formData()` is unwrapped in `src/pages/api/workouts.ts` and `src/pages/api/workouts/[id]/edit.ts`, so a non-form body gives a bare 500. Catch it, log with cause, and redirect with an error.
- **Integration test rows**: the RLS tests never delete the rows they insert. Each run uses fresh users, so runs stay isolated, but rows accumulate in the local DB. Optionally clean them up in `afterAll`.
