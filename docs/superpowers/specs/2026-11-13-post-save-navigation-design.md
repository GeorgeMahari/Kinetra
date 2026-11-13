# What happens after saving: next test or back home

Date: 2026-11-13 · Size: small change

## Why

After saving a test result or profile data the user is left on a screen with no clear next step
(the result screen has no way forward; Edit profile stays on the form). The app should guide
them: back to the main page, or straight on to the next suggested test.

## Goals

- Right after saving a test result (e.g. Cooper: metres in 12 min), the result screen shows the
  result as today and, below it, two buttons:
  - **Next test** — opens the next suggested test's detail screen (instructions + safety), not
    its data-entry form.
  - **Back to home** — returns to the Today tab.
- After **Save** in Edit profile, and after **Done** at the end of onboarding, the user lands on
  Today, wherever they started from.

## Non-goals / anti-goals

- No new backend logic. No change to how results are shown.
- Never suggest a test that the recommendations would not (anti-goal: offering a
  maximal-effort test to a user under 18 or one whose readiness screening blocks it).
- Opening an old result from history (Today "recent", Progress, test detail) is unchanged: no
  new buttons there.

## Approaches

- **A. First test recommended by the backend (chosen).** Reuse `GET /api/v1/dashboard`
  recommendations, take the first with a `test_code` different from the test just done. Already
  respects goals, readiness and the under-18 rule. Costs one request (usually cached by React
  Query, refreshed by the existing invalidation after saving).
- **B. Next not-done test in Assess order.** Simpler, but ignores priorities and safety. Rejected.

## Design

- `record/[code].tsx`: after saving, `router.replace` to the result with a `fresh=1` param.
- `result/[id].tsx`: when `fresh` is set, render the two buttons under the result (above the
  delete action). Next test is hidden when no recommendation with a different `test_code` exists.
  - Next test: clear the stack back to the tabs, then push `/test/[code]`, so Back from the new
    test goes to Today, not the previous test.
  - Back to home: clear the stack and go to `/today`.
- `edit-profile.tsx`: on successful submit go to `/today` (same stack reset).
- `onboarding.tsx`: summary **Done** goes to `/today` (same stack reset). "Save and exit"
  mid-way keeps `router.back()`.
- New i18n keys in en/ro/ru for the two button labels.
- Tests (jest + fakeBackend): result after recording shows both buttons; Next opens the
  recommended test; no recommendation → only Back to home; old result has no buttons; profile
  save and onboarding Done land on Today.

## Left to the builder

Exact expo-router calls for the stack reset (`dismissAll`/`dismissTo`), button order and variants
following existing `Button` usage, and the precise key names.
