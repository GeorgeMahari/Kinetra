# Kinetra: open questions for the company (2026-11-19)

For the product owner to send to the reviewer/company. Each question says what it blocks. Priority:
**P0** blocks the reviewer's main request; **P1** blocks a feature; **P2** improves quality. The
current behaviour is given so the company can simply answer "keep it" where it agrees.

## Assessment methodology

| # | P | Question | Why it is needed | Today |
|---|---|---|---|---|
| Q-A1 | P0 | Which physical dimensions are official? | The score, the diagram and the plan depend on them | 8: cardio, recovery, strength, muscular endurance, mobility, balance, body, lifestyle |
| Q-A2 | P0 | Which tests are required before a plan can be created: one per dimension, a fixed list, or a minimum number? | It is the rule the backend must enforce (FR-01) | No rule; 10 "core" tests exist (resting HR, step test, Cooper 12 min, push-ups, pull-ups or inverted rows, 30 s chair stand, plank, sit-and-reach, single-leg stance, body measurements) |
| Q-A3 | P0 | What replaces a test a user is not allowed to do (safety screening says "consult", or under 18)? | Otherwise these users could never unlock a plan | The safety ceiling hides maximal and submaximal tests |
| Q-A4 | P1 | Exact protocols, units and instructions for each required test, if different from ours? | Results must be comparable | Protocols with sources in `docs/SCIENCE.md` |
| Q-A5 | P1 | Can an assessment be left incomplete and resumed? Does a result expire for gating purposes? | Resume and "current" rules | Results never expire; a dimension counts as "current" for 8 weeks |
| Q-A6 | P2 | When may a user retest, and must conditions (same protocol, time of day) match to compare? | Reassessment | Comparisons only within the same protocol; retest suggested after 8 weeks |

## Physical Score

| # | P | Question | Why | Today |
|---|---|---|---|---|
| Q-S1 | P0 | Is the "physical score" one combined number, or a score per dimension? | The app deliberately has no combined number (decision D40) | Per dimension, 0.2–1.0 from published norms |
| Q-S2 | P0 | If combined: the formula, weights, normalisation, rounding and how missing dimensions count | We must not invent them | — |
| Q-S3 | P1 | Which reference norms (age/sex tables) should be used? | Our norms come from published studies | NHANES, FRIEND, CSEP, CHMS, Tveter, Strand, Springer, YMCA, WHO, NICE |
| Q-S4 | P1 | A few worked examples (inputs → expected score) | For automated acceptance tests | — |
| Q-S5 | P2 | What may be said to the user about a score (wording, medical disclaimers)? | Interpretation text | "Not a diagnosis" wording exists |

## Plans

| # | P | Question | Why | Today |
|---|---|---|---|---|
| Q-P1 | P1 | Which plan types are allowed? | Plan generator | One type: 8 weeks, daily tasks, +1 %/day |
| Q-P2 | P1 | Which dimensions influence the plan, and how? | Plan generator | Lowest-standing dimension first, a second focus from another family |
| Q-P3 | P1 | Company rules or templates for plans? | We must not invent recommendations | ACSM/WHO structure (`docs/SCIENCE.md`) |
| Q-P4 | P0 | The exact unlock condition (see Q-A2) | Gating | None |
| Q-P5 | P0 | What happens to users who already have a plan without the required tests? | Existing data must not be silently invalidated | Proposed: the running plan continues; the next one needs the assessment |

## Activities

| # | P | Question | Why | Today |
|---|---|---|---|---|
| Q-C1 | P1 | Is there an official activity list, with categories and names in ro/ru/en? | Picker and log | 33 sports in 7 categories |
| Q-C2 | P1 | Which fields does a logged activity need: date/time, duration, distance, intensity, notes? Per activity type? | Data model (FR-05) | No activity log |
| Q-C3 | P1 | Are custom activities allowed? | Model and moderation | Only "other" |
| Q-C4 | P2 | Should Health Connect (Android) or HealthKit (iOS) import workouts automatically? | Scope | Steps, resting HR and weight only |
| Q-C5 | P2 | Is asking for usual activities mandatory, or can it be skipped? | Onboarding rule | Skippable (0 sports allowed) |

## Helfcode server

| # | P | Question | Why |
|---|---|---|---|
| Q-H1 | P0 | Should we wait for Helfcode, or first move the API off the personal PC to the already-prepared Supabase Edge Function (free, verified)? | The current downtime is the PC sleeping; this is the fastest fix |
| Q-H2 | P0 | Base URLs for development, staging and production | Configuration |
| Q-H3 | P0 | Is Helfcode a hosting platform for our backend, or an existing API we must call? | Completely different work |
| Q-H4 | P0 | API documentation (OpenAPI/Swagger) | Integration contract |
| Q-H5 | P0 | Authentication mechanism, who issues credentials, and how they are rotated | Security |
| Q-H6 | P0 | Who owns the database and migrations; must the current data (Supabase) move? | Data integrity, GDPR |
| Q-H7 | P1 | Runtime offered (Docker? Python 3.11? Deno?), outbound email, scheduled jobs | Deployment |
| Q-H8 | P1 | Network restrictions (IP allow-lists, VPN), TLS, domain | Mobile access |
| Q-H9 | P1 | Backups, monitoring, uptime commitment, support contact | Operations |

## UX and design

| # | P | Question | Why |
|---|---|---|---|
| Q-D1 | P1 | Is there a company design system or reference UI? | Visual changes |
| Q-D2 | P1 | Which texts are mandatory for legal, safety or company reasons? | What must not be removed |
| Q-D3 | P2 | What should happen when a user taps a spider-chart dimension: open details, go to its tests, or nothing? | Interaction design |
| Q-D4 | P2 | Final icon set for the dimensions: ours, or the company's? | Diagram icons |

## Release

| # | P | Question | Why |
|---|---|---|---|
| Q-R1 | P1 | Who tests a build before release, on which devices? | Validation |
| Q-R2 | P2 | Is an iOS build expected (needs the Apple Developer Program)? | Scope and cost |
