# Archive SHA repoint — edit-workout

## 2026-11-01

- **Target:** `origin/master` (remote default branch, `git ls-remote --symref origin HEAD`), snapshot `965ab1ceef502467d34a9b48fb8b8fdeb31c7be9`, refreshed with `git fetch --no-tags origin +refs/heads/master:refs/remotes/origin/master`.
- **Integration commit:** `7dd943ead72fce2f77e0f6f2aaaabaab0a92c2fe` — `feat(edit-workout): edit a workout (S-05) (#10)`.
- **PR:** https://github.com/fosfor1/movetastic/pull/10 (MERGED, base `master`, squash). PR commit list: `75f1324`, `4b64fed`, `1acb416`.
- **Evidence:**
  - `75f1324` and `4b64fed` resolve to commits and are not ancestors of the target snapshot (`git merge-base --is-ancestor` exit 1).
  - `7dd943e` is an ancestor of the target snapshot (exit 0).
  - `git diff 1acb416 7dd943e` is empty: the squash commit's tree equals the PR head. So the commit carries the full Phase 1 (update policy migration, RLS tests, test-plan note) and Phase 2 (service, endpoint, edit page, dashboard, kitchen sink, smoke) changes.
- **Not repointed:** Phase 3 rows 3.1–3.5 (`58668f4`, already in target history).
- **User decision:** „Zaktualizuj i archiwizuj” (explicit approval in `/10x-archive`, 2026-11-01).

| Row ID | Old suffix (resolved OID) | New SHA |
| --- | --- | --- |
| 1.1 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.2 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.3 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.4 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.5 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.6 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 1.7 | `75f1324` (`75f1324d8272138264c1245486f9d50e63ebeb57`) | `7dd943e` |
| 2.1 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.2 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.3 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.4 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.5 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.6 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.7 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.8 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |
| 2.9 | `4b64fed` (`4b64fedd05eadac56b91ee3b9f569b3d62245cda`) | `7dd943e` |

Total rows repointed: 16.
