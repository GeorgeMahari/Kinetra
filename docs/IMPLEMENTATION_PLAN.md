# Kinetra: implementation plan against the specification (draft, 2026-11-19)

Source: `docs/KINETRA_SPECIFICATION.md` v0.1. Evidence: `docs/TECHNICAL_ARCHITECTURE.md` and
`docs/AUDIT_REPORT.md`. Labels: **CONFIRMED** (in the reviewer's feedback), **EXISTING** (verified
in code), **PROPOSED** (recommendation, not approved), **BLOCKED** (needs company input),
**RISK**. Nothing in this plan has been implemented.

## 1. Gap analysis

| Req. | Requirement (CONFIRMED unless noted) | Status | Evidence | Gap |
|---|---|---|---|---|
| 2.1 / FR-01 | Required tests before a plan; enforced on the backend | **Missing** | `plans/service.py:233` `start()` checks only date and "one active plan"; `StartPlan.tsx:79` always offers Start; `plan.reasonUnknown` exists for "nothing measured" | No completion rule, no 4xx, no locked UI. The rule itself is BLOCKED (which tests) |
| FR-01 | Know whether the initial assessment is complete | **Partial** | `overview` gives per-dimension `status` and `suggested_tests`; Today shows `known/8` (`today.tsx`) | No notion of "required set complete" |
| FR-01 | Existing users handled safely | **Not started** | Production: 2 active plans, 1 started before any test (read-only count) | Needs a grandfathering rule |
| FR-02 | Test definitions, units, timestamps, provenance, validation | **Existing** | `catalog.py` input models (Pydantic bounds), indicators with unit + provenance, `performed_at` with offset, `protocol_key`, `engine_version` | Only change if the company's tests differ (BLOCKED) |
| FR-03 | Physical Score traced and documented | **Existing, different concept** | Per-dimension levels from published norms, no combined score by decision D40/D41 (`insights/rules.py:107-200`) | The company's "physical score" may mean one number: BLOCKED. Hardcoded presentation values listed in TECHNICAL_ARCHITECTURE §6 |
| 2.2 / FR-04 | Usual activities, editable, stored as profile data | **Existing** | Onboarding step `SportsStep` (`features/onboarding/Steps.tsx:255`), `sport-profile.tsx`; `activity_profile_sports` snapshots, deduplicated per snapshot (PK profile+sport) | No search, no recent; renamed/retired catalogue rule = `sports.is_active` flag only |
| FR-05 | Dated activity log with CRUD | **Missing** | No table or route; `activity_checkins` stores weekly totals only; Health Connect imports steps | New model + routes + screens; fields BLOCKED |
| FR-06 | Picker: recent first, search, browse, empty state, i18n | **Missing** | Pickers are a flat grid of 33 chips (`Steps.tsx:280`, `sport-profile.tsx:189`) | Can start now on the existing catalogue (no new taxonomy) |
| 2.3 / FR-07 | Stable dimension ids for axis/label/icon/marker | **Existing** | Map items keyed by `dimension` (`ProfileMap.tsx:104-165`); badges looked up by key; API order = `Dimension` enum = app `DIMENSIONS` | Add a mapping test (none exists for ProfileMap) |
| 2.3 / FR-07 | Icons clearly represent the dimension | **Missing** | Spokes end in abstract trail "Blaze" marks (`ProfileMap.tsx:161`): cardio, strength and body share the same "band" shape, told apart only by colour | Use the dimension pictograms that already exist (`DIMENSIONS[].icon`, `Icon.tsx`) |
| 2.3 / FR-07 | No unwanted click animation; reduced motion | **Partial** | Tap on Today's map runs: card spring to 0.97 + haptic (`motion.tsx:102`), `fade_from_bottom` transition (`_layout.tsx`), `ZoomIn.springify()` (`profile-map.tsx:39`), polygon regrow 650 ms (`ProfileMap.tsx:78`), staggered rows. All respect Reduce Motion | Remove the zoom/spring and the regrow on navigation |
| 2.4 / FR-08 | Less redundant copy; keep safety/consent/interpretation | **Partial** | About 7,400 English words; see AUDIT_REPORT §5 for the screen-by-screen list | Copy edits in en/ro/ru; native review of ro/ru |
| 2.5 | Reliable server; Helfcode | **Partial / BLOCKED** | Downtime = API on a sleeping PC. Edge Function ready (verified), not deployed. Helfcode: no information | Deploy the Edge Function now, or wait for Helfcode: owner's decision |
| FR-09 | Loading/offline/retry/error; failures not shown as empty; no duplicates on retry | **Partial** | `ErrorState`/`OfflineBanner`/`ServerStatusBanner`; 10 s timeout; shared token refresh. No idempotency keys on POST (`assessments/results`, `progression/checkin` is an upsert, plan tasks are idempotent) | Duplicate test result possible after a timeout followed by a manual retry |

## 2. Work that can proceed now (no company input needed)

### Phase A: infrastructure reliability (PROPOSED; owner approval)
- Deploy the verified Edge Function (`docs/SUPABASE_EDGE_MIGRATION.md`, go-live runbook), probe the
  client address, smoke test, new APK. Removes the PC from the request path.
- Whether to do this before or instead of Helfcode is decision Q-H1 in `OPEN_QUESTIONS.md`.
- **Acceptance:** `/health/ready` up for 7 days without the PC; Python API test suite over HTTP
  against the deployed function, using a test project, not production.
- **Rollback:** the old APK keeps using the PC endpoint; `KINETRA_FALLBACK_URL` forwards to Python.

### Phase B: spider diagram (CONFIRMED feedback; presentation only)
- Replace the spoke-end `Blaze` with the dimension's pictogram, `DIMENSIONS[].icon` through `Icon`
  or `Pictogram`. Keep the blaze colour as the icon tint if the design system wants it.
- Tap on the Today map: keep the press tint, drop the scale spring (`PressableScale` `highlight`
  only), use the default stack transition, remove `ZoomIn.springify()`, do not regrow the area when
  the screen opens from Today. Keep the one-time grow on first paint, or remove it (Q-D3).
- **Tests:** a Jest test that renders `ProfileMap` with items in shuffled order and asserts that each
  `map-badge-<key>` and `map-point-<key>` sits on the spoke of the same key, and that the badge's
  icon matches `DIMENSIONS`. A test that the profile-map screen mounts with no entering animation.
- **Files:** `components/charts/ProfileMap.tsx`, `app/(app)/profile-map.tsx`,
  `app/(app)/(tabs)/today.tsx`, `app/(app)/_layout.tsx`, new
  `components/charts/__tests__/ProfileMap-test.tsx`.
- **Score semantics unchanged** (radius = level, no backend change).

### Phase C: information density (CONFIRMED feedback)
- Apply the AUDIT_REPORT §5 list: one explanation per concept, moved behind "Why?" or "About"
  disclosures. Shorten captions repeated on several screens. Keep test protocols, safety screening,
  consent and privacy text, and result interpretation.
- **Acceptance:** each changed key has a before/after in the PR; `i18n/__tests__/locales-test.ts`
  passes (en/ro/ru key parity); the translation review pack is regenerated (`npm run review-pack`,
  checked in CI).

### Phase D: activity picker on the existing catalogue (CONFIRMED UX direction)
- One reusable `ActivityPicker`: a search field (locale-aware, accent-insensitive), "Your sports"
  first (from the current snapshot), then the catalogue grouped by `category`, with a selected state
  and an empty state. Use it in onboarding and in `sport-profile`.
- No schema change. **Files:** new `features/activities/ActivityPicker.tsx`, `Steps.tsx`,
  `sport-profile.tsx`, locale files.

### Phase E: error handling hardening (FR-09)
- Idempotency for `POST /assessments/results`: an optional `client_request_id` (UUID) stored with a
  unique index per user; a retry returns the first result. Needs an additive migration, applied with
  approval and a backup first. Same change in Python and in the Edge Function; replay scenario
  extended.
- Stabilise the flaky Jest suite (`app/__tests__/recovery-test.tsx` times out under parallel load).

## 3. Work blocked by company input

| Phase | Blocked by | Then |
|---|---|---|
| F. Assessment gating (FR-01) | Q-A1–A4 (required tests and completion rule), Q-P4 (unlock conditions), Q-P5 (existing plans) | Backend: a pure `assessment_complete(results, profile)` rule. `POST /plan` returns 409 `assessment_incomplete` with the missing test codes. `GET /plan` exposes `locked` + `missing`. App: locked state with the list of missing tests linking to Assess. Existing active plans keep running (PROPOSED grandfathering). Python + Edge + tests + replay |
| G. Physical Score (FR-03) | Q-S1–S5 | If the company defines one score: a new, versioned calculation next to the per-dimension levels (never replacing them silently), with golden cases from the company's examples |
| H. Activity log (FR-05/06) | Q-C1–C5 | PROPOSED minimal model below; CRUD routes; log screen with the picker; history in Progress |
| I. Helfcode (2.5) | Q-H1–H9 | Integration plan only after the API contract, environment and data ownership are known |
| J. Plan rules | Q-P1–P3 | Adapt `plans/rules.py` only to approved rules; today it follows ACSM/WHO structure with a 1 %/day dose increase |

PROPOSED minimal activity log model (if no company model is given):

```
activity_sessions(id uuid pk, user_id fk users on delete cascade, sport_code fk sports null,
                  custom_name varchar(60) null, started_at timestamptz, duration_min smallint null,
                  distance_m int null, intensity varchar(10) null, source varchar(20) default 'manual',
                  external_id varchar(200) null, notes varchar(500) null, created_at, updated_at,
                  check (sport_code is not null or custom_name is not null),
                  unique (user_id, source, external_id))
```

"Recent" = `select sport_code from activity_sessions where user_id = $1 order by started_at desc`,
distinct, limit 8. No calories (CONFIRMED: Kinetra is not a calorie tracker).

## 4. Order and dependencies

1. **A** (server): independent; biggest user-visible effect; needs only the owner's decision and
   two credentials.
2. **B** (diagram) and **C** (copy): independent of everything; small and reviewable.
3. **D** (picker on the existing catalogue): before H, which reuses it.
4. **E** (idempotency): before H, so new POST routes follow the same pattern.
5. **F** (gating) as soon as Q-A/Q-P are answered; then G and J.
6. **H** (activity log) after Q-C.
7. **I** (Helfcode) only after Q-H, and after A if A is approved, since A makes the backend
   portable (stateless function, schema in Alembic).

## 5. Verification strategy (every phase)

- Backend: unit tests for pure rules, API tests in `backend/tests/`. The same suite runs over HTTP
  against the Edge Function (`KINETRA_TEST_API_URL`); `tools/differential/api_diff.py` gets a
  scenario for each changed route.
- Mobile: Jest tests for each changed screen/component; `tsc --noEmit`; `expo lint`.
- Database changes: Alembic migration + rendered SQL in `db/sql/`. Backup before applying; additive
  only; `Kinetra.md` updated.
- Release: new-user and existing-user journeys on a real Android device before publishing.
