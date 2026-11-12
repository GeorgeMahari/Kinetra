# Science notes

How Kinetra's assessment logic is grounded, and where its limits are. Every rule here is
implemented deterministically in `backend/app/modules/*/rules.py` and covered by unit tests
with known inputs.

## 1. Pre-exercise readiness screening (`kinetra-readiness-1`)

**Purpose.** This screening decides only *how intense the tests Kinetra suggests may be*. It does
not diagnose, and it does not tell anyone that they are healthy.

**Basis.** The decision logic follows the ACSM pre-participation screening algorithm
(Riebe D, et al. *Updating ACSM's recommendations for exercise preparticipation health
screening.* Med Sci Sports Exerc. 2015;47(11):2473–2479):

- **Signs or symptoms** suggestive of cardiovascular, metabolic or renal disease mean medical
  clearance is recommended before exercise. In Kinetra this leads to `consult`, and only
  non-exertional measurements are suggested.
- **Known disease**, without symptoms, means medical clearance is recommended before vigorous
  exercise. In Kinetra this leads to `caution`, and only submaximal tests are suggested.
- **Currently inactive** people should progress gradually. In Kinetra they are `clear` but capped at
  submaximal (`build_up_first`) until they report at least 2 exercise sessions a week and an activity level of
  "moderate" or higher.

**Questions.** Kinetra wrote its own seven yes/no questions. It does not reproduce the copyrighted
PAR-Q+.

| Code | Topic | Effect if "yes" |
|---|---|---|
| `chest_pain` | Chest pain or discomfort at rest or on exertion | consult |
| `dizziness_or_fainting` | Loss of balance from dizziness, or fainting, in 12 months | consult |
| `heart_condition` | Diagnosed heart condition or high blood pressure | caution |
| `chronic_condition` | Other chronic condition affecting exercise | caution |
| `musculoskeletal` | Bone, joint or muscle problem that activity could worsen | caution |
| `supervised_only` | Told to exercise only under medical supervision | caution |
| `pregnancy` | Pregnant, or gave birth in the last 6 months | caution |

**Limitations.**
- The screening is self-reported and unverified, and it is brief by design. It is not a replacement
  for professional evaluation.
- The question wording, and above all the **Romanian and Russian translations, need review** by a
  qualified native speaker before public release.
- Every test can be skipped whatever the result, and test instructions always say to stop when
  symptoms appear.

## 2. Adaptive follow-up questions (`onboarding-rules-1`)

Sports practised are used to choose **what to ask**, never to conclude anything about ability.

| Follow-up | Asked when | Reason shown to the user |
|---|---|---|
| Strength sessions/week | No strength or mixed sport | "Your sports say little about strength…" |
| Cardio sessions/week | No endurance or mixed sport | "…little about endurance training…" |
| Mobility practice | No mind–body sport | "Mobility isn't covered by your sports…" |
| Stairs tolerance | Sedentary or light activity, or 0 sessions/week | "Helps suggest tests that suit your current activity level" |
| Rising from the floor | Low activity, or age ≥ 60 | Same as above, or "everyday-movement question" |
| Sleep hours and quality | Always | "Sleep supports recovery" |

Every follow-up can be skipped. Skipped answers are stored as `NULL`, never as zero.

## 3. Dimension priorities

These priorities rank which of the eight dimensions are **most useful to measure first**. They rank
measurement value, not the person.

- Each chosen goal adds 2 points to the dimensions it maps to; "perform better in my sport" maps
  through the categories of the sports practised.
- Each *information gap* adds 1 point: for example, no strength sport and no reported strength
  training leaves a gap for the strength dimension.
- Ties keep a fixed canonical order, so the result is deterministic.

Information gaps are worded as gaps ("not reported, worth measuring") and never as weaknesses.

## 4. Physical tests (`engine-1`)

**Rules**
- **Inputs:** every result stores its inputs, its indicators and the `engine_version`. History is
  never recomputed silently.
- **Provenance:** every indicator is tagged `measured`, `calculated` or `estimated`.
- **Interpretation:** given only when a reference below covers the person's age, sex-for-norms and
  protocol. Otherwise the raw value is shown with a note.
- **Protocol:** the result's `protocol_key` records the version, the recovery mode, the push-up variant and
  so on. Trends (Milestone 6) compare only identical keys.
- **Effort limits:** the readiness screening's intensity ceiling gates which tests are offered.
  The server enforces it as well, not only the app.

| Test | Dimension | Intensity | Indicators | Interpretation |
|---|---|---|---|---|
| Resting heart rate | cardio | none | bpm (measured) | none (raw + trend) |
| HRR step test (3 min, 30 cm, 24 steps/min) | recovery | submaximal | HR end; HRR60 and HRR120 (calculated) | none; same recovery mode only |
| Cooper 12-minute run | cardio | **maximal** | distance (measured), VO₂max (**estimated**) | FRIEND 2015 percentile band, ages 20–79, sex specified |
| Push-ups (toes or knees) | muscular endurance | submaximal | reps | none |
| 30-s chair stand | strength | submaximal | reps | none |
| Plank | strength | submaximal | seconds | none |
| Sit and reach | mobility | none | cm relative to toes | none |
| Single-leg stance (eyes open, ≤ 60 s) | balance | none | each leg, difference | none |
| Body measurements | body | none | weight, waist (measured); BMI and waist-to-height ratio (calculated) | WHO adult BMI (age ≥ 20); NICE waist-to-height ratio (adults, BMI < 35) |

### References used, and how they were verified

- **Cooper (1968), JAMA 203:201–204.**
  - Equation: VO₂max = (distance in metres − 504.9) / 44.73.
  - Verification: the original is paywalled. The equation is reproduced identically by many independent
    sources.
  - Limits: derived in young men. Accuracy depends on pacing and motivation. No estimate is given when
    the test was stopped early.
- **FRIEND 2015** (Kaminsky, Arena and Myers, Mayo Clin Proc 90:1515–1523), Table 3.
  - What it is: treadmill VO₂max percentiles (5–95) by sex and decade for ages 20–79, measured
    directly by CPX with RER ≥ 1.00.
  - Verification: copied verbatim from the PMC author manuscript (PMC4919021).
  - Caveats:
    - Kinetra compares an *estimate* with *measured* values, so the band is approximate.
    - The 2022 FRIEND update (Mayo Clin Proc 97:285–293) reports treadmill values 1.5–4.6 mL/kg/min
      lower, but its tables could not be accessed for verification. Switch to them once verified.
- **WHO BMI.** Adults: overweight ≥ 25, obesity ≥ 30 (WHO fact sheet, read directly); normal range
  18.5–24.99 (WHO Global Database on BMI). Applied only from age 20, because WHO uses BMI-for-age up to 19.
  Users are always shown the limitations of BMI.
- **NICE NG246 waist-to-height ratio.**
  - Bands: 0.40–0.49 healthy, 0.50–0.59 increased, ≥ 0.60 high; for adults with BMI < 35.
  - Verification: the official page refuses automated access, so the values come from the page's
    search-indexed text and are consistent across clinical summaries. **Re-check manually before release.**

## 5. Recommendations (`insights-1`)

| Rule | Fires when | Source |
|---|---|---|
| Strength, 2 days a week | Adult, no strength or mixed sport, reported strength sessions < 2. Step: start 1, or add a 2nd. | WHO 2020: muscle-strengthening on ≥ 2 days a week |
| Aerobic, 150 minutes | Adult, sessions × typical minutes known and < 150. Step: + min(30, gap) minutes. | WHO 2020: 150–300 min moderate or 75–150 min vigorous a week |
| Balance, 3 days a week | Age ≥ 65 | WHO 2020, older adults: multicomponent balance and strength on ≥ 3 days a week |
| Sleep, 7 hours or more | Age 18–60, reported sleep < 7 h | Watson et al., AASM/SRS consensus, *Sleep* 2015 |

- **Verification:** the WHO aerobic figures were confirmed from WHO pages. The day counts come from WHO
  IRIS-indexed guideline text, because the PMC article was behind a bot check. The AASM/SRS
  recommendation was read on aasm.org.
- **Suppression:**
  - Effort habits are suppressed when the screening says *consult*.
  - Under *caution*, or with no screening, they add an "increase gradually" note.
  - No adult habits are given to under-18s.

### Tests deliberately shown without ratings

Norm tables for push-ups (CSEP / Payne et al. 2000) and the 30-s chair stand (Rikli & Jones, ages
60–94) exist, but only secondary websites were reachable, and their numbers disagree. Until the
primary tables are verified, Kinetra shows raw results and personal trends only. There are no
validated general-population norms for the plank, the home sit-and-reach or the HRR step protocol.
The HRR clinical thresholds (for example Cole et al., NEJM 1999) come from laboratory exercise testing in patients
and are not applied to a home step test.
