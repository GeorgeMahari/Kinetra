# Roadmap

Each milestone leaves the project runnable and tested. ✅ = done and verified.

## Milestone 1 — Foundation ✅ (2026-11-12)
- Monorepo layout: `backend/`, `mobile/`, `infra/`, `db/sql/`, `docs/`
- FastAPI app factory, settings from env, error envelope, logging, CORS
- SQLAlchemy 2 base with naming conventions; Alembic configured; migration `0001` (users, user_profiles)
- Health probes (`/health/live`, `/health/ready`) with fast DB timeout
- Docker Compose: PostgreSQL 18 (persistent named volume) + optional API container
- Expo SDK 58 app: Expo Router, strict TypeScript, design tokens (light/dark), Kinetra logo,
  i18n (en/ro/ru, typed keys, parity test), API client with error mapping, welcome screen with
  a live server-status indicator and language switching
- Tests: backend unit + migration tests; mobile client, locale-parity and component tests

## Milestone 2 — Authentication and profiles ✅ (2026-11-12)
- Migration `0002`: `users.privacy_consent_at`, `refresh_tokens`
- `auth` module: register (age ≥ 16, explicit privacy consent), login, logout, refresh-token rotation
  with reuse detection, Argon2id, NIST-style password policy, login/register rate limiting
- `/me`: read, language preference, partial profile update, JSON data export, password-confirmed deletion
- Mobile: welcome → sign up / sign in, protected routes (`Stack.Protected`), session restore and
  transparent token renewal, home with a profile summary and completion checklist, profile editing,
  settings (language saved to the account, export, delete account, sign out)
- Tests: backend 58 (auth flows, rotation and replay, isolation, export, cascade deletion, validation);
  mobile 48 (validation, sign-in/up forms, session logic); end-to-end HTTP run of the full flow

## Milestone 3 — Design system and navigation ✅ (2026-11-12)
- **Navigation:** tabs Today · Profile (`expo-router/js-tabs`). Profile editing and Account & data open
  above the tabs. Assess and Progress tabs arrive with Milestones 5 and 6, never as empty placeholders.
- **Today:** greeting, profile-completion card, and the eight physical dimensions, each truthfully
  marked "Not assessed".
- **Profile tab:** personal details, appearance (Automatic / Light / Dark, saved on the device), link to
  Account & data.
- **Design system:** own 22-icon SVG set; Loading, Empty and Error states; Skeleton, ListRow, Divider and
  SectionHeader; a global offline/database banner (30 s health polling); a dev-only component
  gallery at `/dev-gallery`.
- **Device preferences** (AsyncStorage): theme, and the language chosen before signing in.
- **Tests:** mobile 69 (adds signed-in tab navigation, a real-route-tree smoke test, theme persistence,
  states, offline banner).

## Milestone 4 — Adaptive onboarding ✅ (2026-11-12)
- **Migration `0003`:** a seeded sports catalogue (30), `user_goals`, append-only `activity_profiles`
  plus `activity_profile_sports`, append-only `readiness_screenings`, and `onboarding_states` (resume).
- **Pure rules** (`onboarding-rules-1`): adaptive follow-ups with stated reasons; an ACSM-logic readiness
  screening with its own wording (`kinetra-readiness-1`) that sets the test-intensity ceiling; and
  dimension priorities from goals plus information gaps. See `docs/SCIENCE.md`.
- **API:** `/catalog/sports`; `/onboarding` for status, draft, follow-up questions, complete and summary.
  The data export now includes onboarding data.
- **Mobile:** a 5-step questionnaire between an intro and a summary, saved after every step,
  "save and finish later", skippable follow-ups, an automatic first open for new users, and a "Your focus" card
  on Today once complete.
- **Tests:**
  - backend 103 (rules with known inputs, resume, validation without partial writes, history kept,
    isolation, export, cascade deletion);
  - mobile 83 (flow logic, the full questionnaire journey with the exact payload, resume, save and exit);
  - an end-to-end HTTP run.
- **Physical tests are not part of this milestone.** Suggesting specific tests (spec step 5) arrives with the
  test catalogue in Milestone 5, which uses the stored intensity ceiling.

## Milestone 5 — Assessment engine ✅ (2026-11-12)
- **Migration `0004`:** append-only `test_results` (inputs, indicators, engine version, protocol key) and a
  source-tagged `measurements` time series, ready for wearables.
- **Pure engine `engine-1`:** 9 tests across 7 dimensions, with provenance on every indicator.
  - Cooper → VO₂max *estimated*, with a FRIEND 2015 band.
  - BMI (WHO) and waist-to-height ratio (NICE), each with its coverage rules.
  - Everything else raw-only (see SCIENCE.md for why).
- **Server-side safety:** tests above the screening's intensity ceiling are rejected.
- **API:** `/assessments` tests, results (create, list, get, delete), overview. Data export extended.
- **Mobile:**
  - **Assess** tab grouped by dimension, with locked reasons and suggestions.
  - **Test detail** screen: purpose, equipment, steps, safety, limitations, history.
  - **Result entry** with a built-in countdown or stopwatch and a "stopped early" option.
  - **Result screen** with provenance badges, comparison sentence, sources and delete.
  - **Today** shows each dimension's real status: assessed, reported only, or not assessed.
- **Tests:** backend 161 (engine with hand-calculated values, band boundaries, coverage edges, gating,
  history, protocol separation, isolation, export, cascade); mobile 95 (form parsing, result view,
  the full record journey); an end-to-end HTTP run with values checked by hand.

## Milestone 6 — Dashboard and analysis ✅ (2026-11-12)
- **Backend `insights` module** (pure rules `insights-1`, no new tables):
  - **Progress:** series per protocol (never mixed), with the change vs the previous and the first
    result. Incomplete or missing values are left out, not zeroed.
  - **Profile map coverage:** current, dated (> 8 weeks), reported or unknown.
  - **Recommendations:** setup, safety, height, the next 2 dimensions to assess with the least
    strenuous allowed test, retests due, and habits. Habits are WHO 2020 strength (proportional step)
    and aerobic minutes (+≤ 30 min step), balance for 65+, and AASM/SRS sleep for 18–60. All are
    suppressed when the screening says consult, fire only on known inputs, carry a source, and are
    labelled general guidance.
  - **API:** `GET /dashboard`, `GET /progress?test_code=`.
- **Mobile:**
  - **Today** becomes the dashboard: coverage map plus legend, recommendations (tap to act),
    recent results, and the dimensions.
  - **New Progress tab:** a card per tested item, with the latest value, neutral signed changes, a line
    chart and a table view.
  - **Progress detail:** every indicator and protocol.
- **Charts** follow the dataviz rules: one axis, a hairline grid, a 2px line, 8px ringed markers, the end
  label only, tap targets ≥ 32px, a table view, and the brand colour validated for light and dark.
  Checked visually in headless Edge, which led to fixes for clipped axis labels, end-label overflow,
  the serif SVG font on web and an a11y prop warning.
- **Tests:** backend 183, mobile 110.

## Milestone 7 — Gamification ✅ (2026-11-12)
- **Migration `0005`:**
  - `activity_checkins`: weekly self-report, one per Monday, editable for this week and the previous one.
  - `user_achievements`: earned once, kept even if the source data is deleted.
- **Pure rules `progression-1`:**
  - **Points** for knowing and consistency: profile set up, first measurement per dimension, retests
    (capped at once per test per week), weekly check-ins, own objectives met, own personal bests.
    Never for raw performance or comparison with others.
  - **Levels:** 10, with fixed thresholds.
  - **Personal bests:** only for higher-is-better performance indicators, within one protocol.
    A first result is a baseline, not a record.
  - **Streak:** consecutive active weeks; an unfinished current week doesn't break it.
  - **Achievements:** 9.
  - **Weekly objectives:** the next small step from the user's own baseline. None after a "consult"
    screening, and none for minors.
- **API:** `GET /progression`, `PUT /progression/checkin`. Data export extended.
- **Mobile:**
  - **Progress tab:** a level card with a meter, this week's objectives plus the check-in form, personal
    bests, achievements (earned first) and a "new achievement" notice. Then the trend charts.
  - **Today:** this week's objectives.
  - **Achievements screen.**
- **Fix found by tests:** the number stepper's first "+" from empty now gives 1, not 0. Zero is still
  possible with + then −.
- **Tests:** backend 207; mobile 115; end-to-end HTTP run with points checked by hand.

## Milestone 8 — Quality ✅ (2026-11-12)
- **Security review** (see `docs/SECURITY.md`):
  - New: security-header middleware, a 64 KB body limit (including chunked bodies, after finding that
    the framework swallowed the first implementation's exception), docs disabled in production,
    tightened CORS, and `--no-server-header` in the image.
  - Ownership: every user-data query reviewed for user scoping.
  - Dependency audit: Python runtime clean; npm findings limited to test and build tooling.
- **End-to-end:** a full-journey API test, and a deletion check that leaves zero rows across 8 tables.
- **Performance:** a heavy account (400 results) answers in 19–74 ms per endpoint, under a 1 s budget.
- **Android:**
  - The app runs on the Android emulator via Expo Go; the API is reached through `adb reverse`.
  - The "Unmatched Route" after sign-in was fixed: `/` is now an unguarded redirect, and the welcome
    screen moved to `/welcome`. Regression tests cover it.
- **UX:**
  - Keyboard handling on every screen: taps go through while the keyboard is open, and iOS avoidance.
  - The consent text now says "above"; Expo patch versions are aligned (`expo-doctor` 20/20).
- **Docs:** SECURITY.md, TESTING.md, an updated ARCHITECTURE, and README sections for Android.
- **Tests:** backend 217, mobile 119.

## Post-MVP 1 — Verification, recovery, CI ✅ (2026-11-13)
- **Account recovery:**
  - Migration `0006`: `users.email_verified_at` and `auth_codes` (HMAC-only one-time codes).
  - API: email verification (request/confirm) and password reset (forgot/reset). Responses are identical
    for unknown emails, and a reset revokes every session.
  - Pluggable email: a dev console backend, or SMTP. Production requires SMTP. Emails go out in the
    account's language.
  - Mobile: "Forgot your password?" (email → code + new password) and "Verify your email" (from Account
    & data).
- **Review material:**
  - `docs/TRANSLATION_REVIEW.md` (138 safety/science strings, EN|RO|RU), generated by
    `npm run review-pack`.
  - `docs/SOURCE_VERIFICATION.md`: NICE and FRIEND 2022 checks that need a human browser or a subscription.
- **CI:** `.github/workflows/ci.yml` runs both suites, lint, types, audits, expo-doctor and a
  review-pack freshness check. It uses an ephemeral DB with a random per-run password.
- **Fix:** logs are UTF-8 on Windows (Romanian/Russian text was escaped).
- **Tests:** backend 227, mobile 121.

## After the MVP (remaining)
- Native-speaker review of the Romanian and Russian safety and scientific text; manual check of the
  NICE thresholds and the FRIEND 2022 tables.
- An SMTP provider for real email delivery; a parental-consent flow for under-16s.
- A shared rate-limit store and an httpOnly-cookie web client before any public web deployment.
- Wearable imports (HealthKit / Health Connect) into `measurements` with new `source` values.
- An EAS development build and store builds; a CI pipeline running both suites.
