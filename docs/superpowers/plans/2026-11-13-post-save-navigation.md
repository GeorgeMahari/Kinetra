# Post-save navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After saving a test result the result screen offers "Next test" and "Back to home"; after saving the profile or finishing onboarding the user lands on Today.

**Architecture:** Mobile-only. A pure function picks the next test from the dashboard recommendations already served by `GET /dashboard`; two small navigation helpers reset the stack to Today (optionally pushing a test). The record screen marks the result it opens as `fresh`.

**Tech Stack:** Expo Router 58 (`router.dismissTo`, `router.push`), React Query, i18next, jest + `expo-router/testing-library` + `test-utils/fakeBackend`.

**Spec:** `docs/superpowers/specs/2026-11-13-post-save-navigation-design.md`

## Global Constraints

- No backend changes. No change to how a result is rendered (`ResultView`).
- Next test comes only from dashboard recommendations with a non-null `test_code` different from the test just recorded (respects readiness and the under-18 rule).
- Buttons appear only right after recording (`fresh=1`), never on a result opened from history.
- Labels in en, ro, ru. Put the new keys in `i18n/locales/assess.{en,ro,ru}.ts` (do not touch `en.ts`/`ro.ts`/`ru.ts`, they carry uncommitted parental-consent work).
- The final commit includes only files from this plan, not the uncommitted parental-consent changes in the tree.

## Review Focus

- Dashboard still loading when the result opens → "Back to home" shows at once; "Next test" appears when data arrives, never a spinner blocking the result.
- Dashboard request fails → result and "Back to home" still work; no error state replaces the result.
- Only recommendation is for the test just done → no "Next test" button.
- Pressing "Back" (header) on the next test's detail → lands on the tabs, not on the previous result.
- Profile save fails (API error) → stay on the form with the error, no navigation.

---

### Task 1: Next test / Back to home on a fresh result

**Files:**
- Create: `mobile/src/features/insights/nextTest.ts`
- Create: `mobile/src/navigation/afterSave.ts`
- Modify: `mobile/src/app/(app)/record/[code].tsx:61` (add `fresh: '1'` param)
- Modify: `mobile/src/app/(app)/result/[id].tsx`
- Modify: `mobile/src/i18n/locales/assess.{en,ro,ru}.ts`
- Modify: `mobile/src/test-utils/fakeBackend.tsx` (add `setRecommendations`)
- Test: `mobile/src/features/insights/__tests__/nextTest-test.ts`, `mobile/src/app/__tests__/assessment-flow-test.tsx`

**Interfaces:**
- Produces: `nextSuggestedTest(recs: Recommendation[], done: TestCode): TestCode | null` — first rec (array order = priority order from backend) with `test_code` set and `!== done`.
- Produces: `goHome(): void` (stack back to `/today`), `goToTest(code: TestCode): void` (back to `/today`, then push `/test/[code]`). Use `router.dismissTo` / `router.push`; verify the resulting stack in the tests.
- Produces i18n keys: `assess.nextTest` = `Next test: {{name}}` / `Testul următor: {{name}}` / `Следующий тест: {{name}}`; `assess.backHome` = `Back to home` / `Înapoi la pagina principală` / `На главную`.
- Produces in fake backend: `setRecommendations(recs: unknown[]): void` overriding the dashboard list.

- [ ] **Step 1: Write failing unit tests** in `nextTest-test.ts`: returns `'single_leg_stance'` for `[habit(null), assess(single_leg_stance)]` with done `'pushups'`; skips a rec whose `test_code === done` and returns the next one; returns `null` for `[]` and for only-habit recs.
- [ ] **Step 2: Write failing flow tests** in `assessment-flow-test.tsx` (add `'(tabs)/today': () => <Text>Today stub</Text>` to `routes`):
  - `after saving, offers the next suggested test and a way home`: record pushups as in the existing test → `findByTestId('next-test')` has text `Next test: Single-leg stance` (use the real i18n name); press it → `toHavePathname('/test/single_leg_stance')`.
  - `back to home returns to Today`: record → press `back-home` → `toHavePathname('/today')`.
  - `no next test when nothing else is recommended`: `backend.setRecommendations([])` → after save, `back-home` present, `queryByTestId('next-test')` null.
  - `an old result opened directly has no after-save buttons`: `backend.seedResult(20)`, `initialUrl: '/result/r1'` → `queryByTestId('back-home')` and `queryByTestId('next-test')` null.
- [ ] **Step 3: Run** `cd mobile && npx jest nextTest assessment-flow` — expect the new tests to FAIL (module missing / testID not found).
- [ ] **Step 4: Implement** `nextTest.ts`, `afterSave.ts`, the i18n keys, `fresh: '1'` in record, `setRecommendations` in the fake. In `result/[id].tsx` read `fresh` from params; when `'1'`, call `useDashboard()` and render, between `ResultView` and the error/delete block: primary `Button` `testID="next-test"` (only when `nextSuggestedTest` returns a code) and secondary `Button` `testID="back-home"`. Dashboard errors/loading must not hide the result.
- [ ] **Step 5: Run** `cd mobile && npx jest nextTest assessment-flow` — expect PASS. Then `npm run typecheck`.

### Task 2: Profile save and onboarding Done land on Today

**Files:**
- Modify: `mobile/src/app/(app)/edit-profile.tsx`
- Modify: `mobile/src/app/(app)/onboarding.tsx:167` (summary Done only; `saveAndExit` keeps `router.back()`)
- Test: `mobile/src/app/__tests__/signed-in-navigation-test.tsx`, `mobile/src/app/__tests__/onboarding-flow-test.tsx`

**Interfaces:**
- Consumes: `goHome()` from Task 1.

- [ ] **Step 1: Write failing tests:**
  - signed-in-navigation: `saving the profile returns to Today`: open editor from Profile tab, change name field, press save → `toHavePathname('/today')`.
  - signed-in-navigation: `a failed profile save stays on the form` — make the fake reject `PATCH /me/profile` (add a toggle in the fake if none exists) → pathname still `/edit-profile`, error text shown.
  - onboarding-flow: in the existing complete-journey test, add a `'(tabs)/today'` stub route and assert that pressing `onboarding-done` → `toHavePathname('/today')`.
- [ ] **Step 2: Run** `cd mobile && npx jest signed-in-navigation onboarding-flow` — new assertions FAIL.
- [ ] **Step 3: Implement:** edit-profile passes `onSubmit={async (u) => { await updateProfile(u); goHome(); }}` (error path unchanged: ProfileForm already shows it); onboarding Done calls `goHome()`.
- [ ] **Step 4: Run** `cd mobile && npm test && npm run typecheck && npm run lint` — all PASS.

### Task 3: Check in the emulator and commit

- [ ] **Step 1:** With API, Metro (Expo Go) and emulator running, record a Cooper or push-ups result; screenshot shows both buttons under the result; press each and screenshot the destination. Save the profile and confirm it lands on Today.
- [ ] **Step 2: Commit** only the files listed in Tasks 1–2 plus the spec and this plan:

```bash
git add docs/superpowers/specs/2026-11-13-post-save-navigation-design.md docs/superpowers/plans/2026-11-13-post-save-navigation.md mobile/src/features/insights/nextTest.ts mobile/src/features/insights/__tests__/nextTest-test.ts mobile/src/navigation/afterSave.ts "mobile/src/app/(app)/record/[code].tsx" "mobile/src/app/(app)/result/[id].tsx" "mobile/src/app/(app)/edit-profile.tsx" "mobile/src/app/(app)/onboarding.tsx" mobile/src/i18n/locales/assess.en.ts mobile/src/i18n/locales/assess.ro.ts mobile/src/i18n/locales/assess.ru.ts mobile/src/app/__tests__/assessment-flow-test.tsx mobile/src/app/__tests__/signed-in-navigation-test.tsx mobile/src/app/__tests__/onboarding-flow-test.tsx
git commit -m "Offer next test or home after saving a result; return to Today after profile/onboarding"
```

`mobile/src/test-utils/fakeBackend.tsx` already has uncommitted parental-consent changes, but the new tests need this plan's hunk. Stage only that hunk: write it as a patch against `HEAD` and run `git apply --cached <patch>`, then check `git diff --cached` for that file shows only `setRecommendations`/`PATCH /me/profile` changes. Before committing, run the touched test files against the staged tree mentally: they must not rely on parental-consent code.
