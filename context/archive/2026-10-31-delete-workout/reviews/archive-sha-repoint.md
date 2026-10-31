# Archive SHA repoint — delete-workout

## 2026-10-31

- **Target:** `origin/master` (remote default branch, `git ls-remote --symref origin HEAD`), snapshot `15d34b1ec9c793801ca8939e75e3c6a017bfd703`, refreshed with `git fetch --no-tags origin +refs/heads/master:refs/remotes/origin/master`.
- **Integration commit:** `c33bbba7703fa678c298d2c750b741219b21d494` — `feat(delete-workout): delete a workout after confirmation (S-04) (#9)`.
- **PR:** https://github.com/fosfor1/movetastic/pull/9 (MERGED, base `master`, squash). PR commit list: `30ab124`, `af98ffa`, `832d5e9`, `d63ca6c`.
- **Evidence:**
  - `af98ffa` and `832d5e9` resolve to commits and are not ancestors of the target snapshot (`git merge-base --is-ancestor` exit 1).
  - `c33bbba` is an ancestor of the target snapshot (exit 0).
  - `git diff d63ca6c c33bbba` is empty: the squash commit's tree equals the PR head. So the commit carries the full Phase 1 (migration, RLS tests, test-plan note) and Phase 2 (service, endpoint, confirmation page, dashboard, kitchen sink, smoke) changes.
- **Not repointed:** Phase 3 rows 3.1–3.5 (`dc5ed9e`, already in target history).
- **User decision:** „Zaktualizuj i archiwizuj” (explicit approval in `/10x-archive`, 2026-10-31).

| Row ID | Old suffix (resolved OID) | New SHA |
| --- | --- | --- |
| 1.1 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 1.2 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 1.3 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 1.4 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 1.5 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 1.6 | `af98ffa` (`af98ffa336bca33b608013a97e0879163fcfe9e3`) | `c33bbba` |
| 2.1 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.2 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.3 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.4 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.5 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.6 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.7 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.8 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |
| 2.9 | `832d5e9` (`832d5e93b00ede76dec3a6764c0207ecd0723b26`) | `c33bbba` |

Total rows repointed: 15.
