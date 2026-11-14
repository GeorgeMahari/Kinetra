# Decision log

Short records of non-obvious decisions. Newest last.

### D1 — Product name: Kinetra
*Kinetic + spectra.* The product shows the *spectrum* of a person's physical capabilities
rather than one number. The name is short, pronounceable in English, Romanian and Russian, and
works as an umbrella brand for future apps ("Kinetra Sleep", "Kinetra Coach").
The logo is an eight-axis spectrum with an asymmetric inner profile — literally the radar
view of the product.

### D2 — Modular monolith
One deployable backend. The domain is cohesive, the team is small, and transactions
across assessments, results and achievements are simpler in one database.
Module boundaries (router → service → models) keep a later split possible.

### D3 — Deterministic engine, isolated from I/O
See ARCHITECTURE.md. Scientific logic must be reproducible and unit-tested with known values.

### D4 — Weight is a measurement, not a profile field
Body weight changes; storing it on the profile would overwrite history. Height stays on the
profile (stable in adults). For minors, height becomes a measurement too (added with the minors work).

### D5 — `sex_for_norms`, optional
Collected only to select sex-specific reference tables, with "prefer not to say" as the
default. When it is not specified, sex-specific interpretations are not produced; raw results
and sex-neutral indicators still work.

### D6 — Node 24 for the mobile toolchain
Expo SDK 58 / React Native 0.88 require Node ≥ 22.13. The machine default is Node 20, so the
mobile commands run with Node 24.13 (installed via nvm) without changing the global default.

### D7 — System fonts for the MVP
SF Pro / Roboto give excellent legibility and full Romanian and Cyrillic coverage at zero
bundle cost. A display face can be added later through the expo-font config plugin.

### D8 — Readiness probe drives the app's offline state
`/health/ready` returns 503 with a body when the database is down. The app distinguishes
"server unreachable" from "server up, database down". DB connections time out after 3s
so the probe never hangs.

### D9 — PostgreSQL on host port 5433
Avoids clashing with any local PostgreSQL. A separate `kinetra_test` database is created on the
first container start. The test suite refuses to run against any database whose name does not
start with `kinetra_test`.

### D11 — No passwords in files
The DB password exists only in the `POSTGRES_PASSWORD` environment variable. Compose passes it
to the container; the backend builds a SQLAlchemy `URL` object from parts at runtime; Alembic
receives a `URL` object, never a string in `alembic.ini`. Ports are bound to 127.0.0.1.

### D12 — Token design
- **Access token:** a 15-minute HS256 JWT held only in app memory. The signing key exists only in the
  `KINETRA_JWT_SECRET` environment variable. In development, a missing key is replaced by a random
  per-process key, so a server restart signs everyone out, which the app handles. Production refuses to start
  without it.
- **Refresh token:** 256-bit random, opaque, 30 days. Stored on the device (Keychain/Keystore via
  expo-secure-store) and on the server only as a SHA-256 hash. Single-use with rotation. Replaying a used token
  revokes the whole token family (RFC 6819 §5.2.2.3 / OAuth 2.0 Security BCP refresh-token rotation).
- Logout revokes only that device's family; other devices stay signed in.
- The app serializes concurrent refreshes, because two parallel refreshes would look like a replay.

### D13 — Login hardening
- **Password hashing:** Argon2id with RFC 9106 defaults; hashes are upgraded transparently on login.
- **Password policy:** NIST SP 800-63B (≥10 chars, blocklist, no email-derived passwords, no composition rules).
- **Timing:** an unknown email is verified against a dummy hash, so response timing doesn't reveal accounts.
  "Wrong password" and "unknown email" return identical responses.
- **Rate limiting:** a sliding window per email+IP, held in memory. Valid for one API process; a multi-instance
  deployment must move it to a shared store (noted in `app/core/rate_limit.py`).

### D14 — Web preview storage
expo-secure-store has no web implementation. On web (a development preview only) the refresh token is kept
in `sessionStorage`: it survives a reload and is gone when the tab closes. A production web client
should use an httpOnly, SameSite cookie instead.

### D15 — Account deletion and export
- **Deletion** is a hard delete with cascades: the account, profile and sessions go. It needs the password and
  uses `POST /me/delete`, because the confirmation travels in the request body.
- **Export** returns every stored field except secrets, as JSON (GDPR Art. 15/20). Each new module must add its
  data to the export.

### D16 — Minimum age 16 enforced now
Registration requires a date of birth and refuses users under 16 (client and server). This implements
D10's interim rule until a parental-consent flow exists.

### D17 — Tabs appear with their features
The app shows only tabs that work. "Assess" and "Progress" are added in the milestones that
implement them, so there is never a tab whose content is "coming soon".

### D18 — Own icon set, JS tabs
- **Icons:** 22 stroke icons drawn on a 24-px grid with react-native-svg (already a dependency). There is no
  icon-font package; the style is consistent with the logo; the icons work offline and on web.
- **Tabs:** expo-router 58 no longer bundles React Navigation; JS tabs come from `expo-router/js-tabs`. JS
  (not native) tabs were chosen so the custom icons and the theme look identical on iOS, Android and web.

### D19 — Device preferences vs. account preferences
- **Account (server):** the language, so it follows the user across devices.
- **Device (AsyncStorage):** the appearance, and the language used before sign-in.
- Reads and writes are guarded, so the app behaves identically when storage is unavailable.

### D20 — One offline signal
The signed-in layout polls `/health/ready` every 30 s and on focus. A single banner explains
"offline" vs. "database unavailable" instead of each screen inventing its own message.

### D21 — Onboarding answers: draft as JSON, results normalised
While in progress, answers are a size-limited JSONB draft, so any step can be saved and resumed
without strict validation. On completion they are validated strictly and written once, in a single
transaction, into normalised tables. Invalid answers write nothing.

### D22 — History over overwrite for self-reports
Activity profiles and readiness screenings are append-only snapshots stamped with the rule version, so
later results can always be interpreted against what was known at the time. Goals are a current
preference set and are replaced on update.

### D23 — Text + CHECK instead of PostgreSQL ENUM for vocabularies
Onboarding vocabularies change more often than identity enums. Text columns with CHECK constraints let
values be added with a simple constraint change. Migrations freeze their own copy of the value lists.

### D24 — Own screening wording, ACSM logic
The PAR-Q+ is copyrighted, so Kinetra uses its own seven questions with the ACSM 2015 decision logic.
The result caps the intensity of suggested tests and never claims a diagnosis. Translations of the
safety text must be reviewed by native speakers before public release (see SCIENCE.md).

### D25 — Store computed indicators, don't recompute history
Each result keeps the indicators exactly as computed, plus the `engine_version`. Correcting a
reference or formula later creates a new engine version, so old results never change silently.

### D26 — Raw-only beats unverified norms (relaxed by D41)
A norm is used only if its numbers were read in the primary source or an official page. Where only
secondary reproductions were reachable (push-ups, chair stand), the result is shown raw with a note.
This is worse for engagement and better for trust; the norms can be enabled once verified.

### D27 — No assessment "sessions" yet
Results stand alone and the dashboard groups them by date. A session entity ("today's assessment")
adds UX weight without new information in the MVP; it can be introduced without migrating results.

### D28 — Safety ceiling enforced on the server
The app hides tests above the user's intensity ceiling, and the API also rejects them (403
`test_not_allowed`). The safety rule therefore doesn't depend on client correctness.

### D29 — A coverage map instead of a performance radar (superseded by D40)
The eight dimensions have no common scale: VO₂max bands, BMI categories and plank seconds can't
share an axis. A performance radar would therefore invent a score, which is exactly what the product
promises not to do. The eight-spoke figure shows how well each dimension is *known*: assessed
recently, assessed long ago, reported only, or not assessed. It is encoded by length and shape, with
a legend, so it is never colour alone. There is still no overall score (see the spec: only if defensible).

### D30 — Neutral change wording
Changes are shown as signed numbers ("+3 vs previous") in text colour, without green/red.
"Up" is good for push-ups but not for resting heart rate or weight, and judging direction would
imply clinical meaning the engine doesn't have.

### D31 — Recommendations: sourced, proportional, never assumed
Every habit recommendation cites WHO 2020 or AASM/SRS 2015.
- **Proportional:** recommendations propose the next small step (1 strength session; +30 minutes at most),
  not the whole target.
- **Never assumed:** a rule fires only when its inputs were reported. An unknown session length means
  no aerobic advice, not a guess.
- **Safety first:** a "consult" screening suppresses all effort habits and puts the safety message first.

### D32 — Visual checks in headless Edge
On Windows, headless Edge enforces a minimum window width of about 500 px. A narrower `--window-size`
crops the screenshot while the page lays out at about 500 px, which looks like an overflow bug.
Visual checks therefore use 500 px. The dev gallery prints the window and content widths to make
this verifiable.

### D33 — Gamification rewards knowing and consistency, not performance
- **No leaderboards, no comparison with others.**
- **Points** reward measuring, repeating, checking in, meeting one's own small objectives and beating one's
  own records.
- **Personal bests** exist only for indicators where higher is unambiguously better (reps, hold
  seconds, reach, distance). Resting heart rate, heart-rate recovery, weight, BMI and waist never become
  "records": rewarding a direction there would imply health claims or encourage unhealthy goals.
- **Retest points** are capped at one per test per week, so testing can't be farmed.
- **Weekly objectives** are self-relative ("one more session than you reported"). There are none after a
  "consult" screening, and none for minors.
- **Tone:** no confetti and no streak-loss shaming. An unfinished current week never breaks a streak.

### D34 — Achievements are permanent once earned
`user_achievements` records the first time a condition was met. Deleting the result that earned it
doesn't revoke it, because the moment happened. Recomputing achievements from data stays possible,
since the rules are pure.

### D35 — "/" is an unguarded redirect
With `Stack.Protected`, the app falls back to "/" whenever a guard flips (sign-in, sign-out) and on
cold start. "/" must therefore exist for every session state. It redirects to `/today` or `/welcome`,
and the welcome screen lives at `/welcome`.

### D36 — Devices reach the API through `adb reverse`, not the LAN
The API stays bound to 127.0.0.1. `10.0.2.2` doesn't reach a loopback-bound server, and binding to
0.0.0.0 would expose personal data on the local network. `adb reverse tcp:8000 tcp:8000` tunnels the
device's `localhost:8000` to the host, for the emulator and for USB phones alike.

### D37 — Security middleware is pure ASGI and answers 413 itself
FastAPI converts exceptions raised while reading the body into its own 400, so the size limit sends
the 413 directly and makes the app see a disconnected client. This covers chunked bodies, which carry
no Content-Length.

### D38 — Health Connect: read-only import, chosen after the MVP (2026-11-13)
Spec §16 kept external integrations out of the initial version. After the MVP the owner chose Android
Health Connect as the first one.
- **What is read:** resting heart rate, weight and daily steps, for the last 30 days, and only on request
  ("Sync"). Kinetra never writes to Health Connect.
- **Where it goes:** values land in `measurements` with `source = health_connect` and the source's own
  record id, so a re-sync updates rows instead of duplicating them. Steps come from Health Connect's
  aggregate, which removes phone + watch double counting, keyed per local day.
- **What it never does:** imported values never become test results or interpretations. The screen labels
  them "Source: Health Connect".
- **Removal:** the user can delete every imported value. Account deletion and the data export cover them.
- **Where it works:** it needs a development or store build (`expo-dev-client`), because Expo Go has no
  native module. In Expo Go, on iOS and on the web the screen says so honestly and nothing is simulated.
  Apple Health remains future scope.

### D39 — Parental consent for ages 14–15 (2026-11-13)
The owner chose these settings, all configurable:
- **Ages:** 14 is the absolute minimum. From 14 to 15 a parent must agree; from 16 no consent is needed.
- **How:** the parent receives an email link.
- **Deadline:** a request not answered within 7 days deletes the account.

**Registration.** A 14–15-year-old must give a parent's email, different from their own. The account is
created `pending` and holds only the email, the password hash and the date of birth. For anyone 16 or
older a `parent_email` sent by the client is ignored and never stored.

**Locked account.** `get_current_user` refuses every data route with `403 parental_consent_pending`.
Only `get_user_allow_pending` routes work: read `/me`, change the language, export, delete, and the
consent status and resend. The app shows nothing but the waiting screen. The server enforces the lock
too.

**The parent's page.**
- It is served by the API, in the parent's own browser, separate from the child's phone. Its CSP allows
  no scripts and no external resources, only inline styles and posting back to itself.
- GET only shows the page, because email scanners prefetch links. Only the POST from the page's form
  records "agree" or "refuse".
- The page lists what is collected and what never happens under 18: no maximal tests, no adult norms,
  no comparisons with others, no social features, no advertising.

**The link.**
- 256 random bits, stored as SHA-256 only. It works once.
- A resend, at most every 10 minutes, replaces it. The deadline still counts from registration.

**Refusal or expiry.** The account and everything linked to it are deleted (cascade), including the
parent's email. Expiry is enforced three ways:
- the link stops working;
- signing in deletes the account on the spot;
- an hourly job in the API process purges the rest. The tests disable it so it never touches the
  development database.

**Limits, accepted for now.**
- Email possession is the only proof that the person is the parent. This is the usual "email plus"
  level; stronger verification would need an identity provider.
- Real delivery needs SMTP. With the console backend the email is only printed to the API log.
- `public_base_url` must point to where a parent's browser can reach the API.

### D10 — Minors (16–17 implemented; under 16 pending)
Users under 18 get a reduced data set, no adult norms, no maximal-effort tests, and no
public or social features. Under the minimum age (16 by default, configurable per
jurisdiction under GDPR Art. 8) registration requires a parental-consent flow. Until that flow
exists, registration is limited to users aged 16 or older rather than collecting a minor's data
without safeguards.

Status (2026-11-13):
- **No adult norms:** FRIEND starts at 20, WHO BMI at 20 and NICE WHtR at 18.
- **No effort objectives:** weekly objectives skip minors.
- **No maximal-effort tests:** missing until today. A regularly active 17-year-old was cleared for the
  Cooper run. Fixed in two places:
  - the screening rule caps under-18s at submaximal, with the reason `under_18`;
  - the stored ceiling is capped again by the *current* age (`cap_for_age`) wherever tests are offered
    or accepted.

  A screening stored before the fix therefore can't unlock maximal tests either. Unknown age is
  treated as not adult.

### D40 — The profile map shows where you stand, from verified norms only (2026-11-14)
Supersedes D29 at the product owner's request. Each spoke now places a point where the person
stands: the centre means "not rated", next to the centre (0.2) is a norm's lowest band, and the rim
(1.0) is its best band. The rated points, joined, form the pale area.

- **Only verified norms place a point** (D26): FRIEND VO₂max bands (cardio), WHO BMI and NICE
  waist-to-height categories (body), AASM/SRS ≥ 7 h of sleep (lifestyle, ages 18–60). A dimension that
  was measured but has no verified norm (strength, endurance, mobility, balance, recovery) stays at the
  centre, drawn differently from "not assessed". An unrecognised label is ignored, never guessed.
- **Positions are steps along each norm's own ordered bands**, not a common score: there is still no
  overall score, and dimensions are not compared or added. Several rated indicators in one dimension
  (BMI and WHtR) sit at their mean.
- **Binary norms are drawn halfway when not met** (sleep below 7 h → 0.5), because the norm does not
  grade how far below.
- The rule is server-side and pure (`insights.rules.standing`, `insights-2`); the app only draws it.
  New verified norms extend the same table and appear on the map without app changes.

### D41 — Approximate, age- and sex-specific norms for every test that has a source (2026-11-14)
Relaxes D26 at the product owner's request: norms are approximated as objectively as possible
instead of leaving results raw. `engine-2` rates each test against its age and sex group:

| Test | Source | Why it is approximate |
|---|---|---|
| Resting pulse | CDC NHANES 1999–2008 percentiles (Ostchega 2011) | not approximate: same method (seated, 30 s × 2) |
| 30-s chair stand | Tveter 2014 reference equations (age, sex, weight over 50) | normal spread assumed around the prediction |
| Forearm plank | Strand 2014 percentiles (college students) | used for ages 17–25 only |
| Push-ups | CSEP-PATH 2019 categories (men on toes, women on knees) | read from the ACE reprint |
| Sit-and-reach | Statistics Canada, CHMS 2016–17 percentiles | our zero is the toes; 26 cm added for the CSEP box |
| Single-leg stance | Springer 2007, eyes open | hands on hips and 60 s here, arms crossed and 45 s there |
| 3-min step test (recovery) | YMCA ratings (Golding 2000), 7 categories by age and sex | read from a reprint; needs the optional count of beats in the first seated minute |

- **Never extrapolated.** Outside a table's ages, or for a sex it does not cover, the result stays raw.
- **Still unrated:** pull-ups (the official USMC table refused automated access and no adult population
  norm was found). The step test's drop at 60 s stays raw (references for it come from maximal lab tests);
  only the YMCA one-minute count is rated.
- Approximate norms carry the note `approximate_reference`, shown under the result.
- Results stored under `engine-1` keep their indicators (D25) unless they are re-scored explicitly.
