# Changelog

## 2026-11-19: Phase 1, independent improvements

Scope: the work in `docs/IMPLEMENTATION_PLAN.md` that needs no company decision (spider diagram,
less text, activity picker, duplicate-save protection). Out of scope and untouched: assessment-first
plan blocking, score formulas, the activity journal, Helfcode, any deployment, existing user plans
and results.

### Spider diagram (profile map)

- Each spoke now ends in the dimension's own pictogram on its trail colour (`DimensionMark`). Before,
  it was an abstract trail blaze, and cardio, strength and body shared the same "band" shape. The key
  list next to the chart uses the same marks.
- The balance icon is a figure standing on one leg, the measured test, instead of a weighing scale.
- Opening the map from Today no longer chains five movements (card spring, slide-up, zoom, regrowing
  area, staggered rows). The card dims on press, the screen fades in, and nothing else moves.
  Reduce Motion is still honoured everywhere.
- Unchanged: levels, positions, data and the tap on a key row, which still opens that dimension's
  tests. Marks and points are looked up by dimension key, never by position; a test renders the
  chart in shuffled order and checks every mark against its spoke.

### Less text up front

- A shared `Disclosure` toggle, the existing "Limits and accuracy" pattern, now also holds the
  "why this test" explanation on test pages and the evidence behind the plan's suggested focus.
- The map caption is gone from Today and shortened to one line on the map screen.
- Onboarding keeps its "why" line only where it says what to do ("Choose up to 3", "Optional") or why
  health data is asked (the safety questions).
- Unchanged: safety instructions, test steps, consent and privacy text, and result interpretation.
  Recommendation cards are unchanged too: the whole card is a tap target, and its extra lines carry
  "not a diagnosis" wording, so collapsing them needs a design decision.
- en, ro and ru were edited together.

### Activity picker

- Onboarding and the sport profile share `ActivityPicker`: a search field, the catalogue grouped by
  category, and an empty state that suggests Other.
- Search ignores case and diacritics ("inot" finds "Înot", "gheata" finds "gheață") and matches the
  name in the app's language, the English name and the code. Russian й stays its own letter.
- Unchanged: identifiers, the 10-sport limit, selection and saved data. Chosen sports stay chosen
  while the list is filtered.
- **Not done: "recently used".** No table records which activity a person actually did and when.
  - `activity_profile_sports` records sports declared as usual.
  - `activity_checkins` holds weekly totals with no activity.
  - `plan_task_completions` holds plan tasks.
  - `measurements` holds steps.

  Showing "recent" from any of these would invent history. **Proposal, for approval:** derive
  "recently used" from the activity journal once it exists (Phase H: `activity_sessions`, see
  IMPLEMENTATION_PLAN §3), as the 8 most recent distinct activities. No other new storage is needed.

### Duplicate test-result protection (D46)

- **Problem.** The app gives up after 10 s. If the server had already saved the result, tapping Save
  again created a second, identical result. Nothing existed to prevent it: no idempotency key and no
  uniqueness rule on `test_results`.
- **App.** Each measurement gets a random UUID, sent as the `Idempotency-Key` header. It is reused
  only when the same values are saved again; changed values are a new measurement with a new key.
- **Server (Python and Edge Function, identical).** The key is stored in `result_requests`
  (migration 0012, a new table; `test_results` is untouched).
  - A request with a key the user already used returns the saved result.
  - The same key for another test is refused with 409 `idempotency_key_reused`.
  - An invalid key is a 422 validation error.
  - Requests without the header behave exactly as before, so old and new app builds and servers
    work in any combination.
  - Concurrent retries are serialised by a per-key lock.
  - A daily pg_cron job, added to `db/sql/supabase/03_jobs.sql`, deletes keys older than 30 days.
- **Found on the way.** The Edge Function rejected UUIDs written as `{...}` or `urn:uuid:...`, which
  Python accepts. Fixed, with 742 golden cases exported from Pydantic.

### Tests

- The mobile Jest run is capped at half the CPU threads. One worker per thread made the router suites
  time out at random (recovery-test, auth-routing-test). Now all 196, later 213, pass in about 30 s.

### Before deploying this

- **Migration 0012 is applied only to the test database.** The SQL is in
  `db/sql/0012_result_requests.sql`.
- **The public Python API (`infra/public/start-public.ps1`) will refuse to restart** until 0012 is
  applied on Supabase. This is by design; the process running now is unaffected. To apply it, after
  your confirmation and a backup:
  1. Run `infra\supabase\backup-supabase.ps1`.
  2. Run `alembic upgrade head` as `postgres.<ref>`.
  3. Run `infra\supabase\apply-security.ps1 -SkipRole` (RLS, privileges and the new cleanup job).
- A new APK is needed for the app-side changes. The server change works with the current APK
  (it simply sends no key).

### Results

| Check | Result |
|---|---|
| Mobile Jest | 213 of 213 pass |
| Mobile `tsc --noEmit` | no errors |
| Mobile eslint, changed files | no errors; the only warnings are an import pattern already present in existing tests |
| Python API, in-process | 474 of 474 pass |
| Python suite over HTTP against the Edge Function | 470 pass, 4 skipped (need the Python process) |
| Deno tests | 13 of 13 pass, including 742 UUID and 1600 validation golden cases |
| Replay, Python vs Edge Function | 9 of 9 scenarios identical (including the new `retries`) |
| ruff, mypy, deno lint | clean |
