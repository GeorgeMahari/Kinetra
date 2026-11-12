# Source verification checklist (needs a human with a browser)

These checks could not be completed automatically: the sites block automated access or require a
subscription. Each item states exactly what to compare and where to change the code if the source
differs.

## 1. NICE NG246, waist-to-height ratio (free; needs a normal browser)

- **Open:** https://www.nice.org.uk/guidance/ng246, chapter "Identifying and assessing overweight,
  obesity and central adiposity".
- **Confirm these exact values:**

| What Kinetra uses | Value in code |
|---|---|
| Healthy central adiposity | WHtR 0.40–0.49 |
| Increased central adiposity (increased health risks) | WHtR 0.50–0.59 |
| High central adiposity (further increased risks) | WHtR ≥ 0.60 |
| Applies to | adults (Kinetra: ≥ 18) with BMI < 35, both sexes, all ethnicities |
| Below 0.40 | no category defined, so no classification is shown |

- **Where to change:** `backend/app/modules/assessments/engine/catalog.py` → `nice_whtr_category()`.
  The citation text lives in `engine/references.py` → `NICE_WHTR`.
- **Afterwards:** update the tests in `backend/tests/test_engine.py::TestBody` and bump `ENGINE_VERSION`.
  Stored results keep their version, so they don't change silently.
- [ ] Verified by ________ on ________

## 2. FRIEND 2022 treadmill VO₂max percentiles (subscription or institutional access)

- **Article:** Kaminsky LA et al. *Updated Reference Standards for Cardiorespiratory Fitness Measured with
  Cardiopulmonary Exercise Testing: Data from FRIEND.* Mayo Clin Proc. 2022;97(2):285–293.
  https://doi.org/10.1016/j.mayocp.2021.08.020. Europe PMC confirms it is not open access.
- **Currently used:** the 2015 FRIEND treadmill table (PMC4919021), copied verbatim into
  `engine/references.py` → `FRIEND_TREADMILL`. The 2022 abstract says its treadmill values are
  1.5–4.6 mL/kg/min lower.
- **If you can access the 2022 paper:**
  1. Copy the **treadmill** percentile rows for men and women, every decade available, into a new
     `FRIEND_2022_TREADMILL` with the same shape: percentiles 5, 10, 25, 50, 75, 90, 95. Note which RER
     criterion the table uses.
  2. Add a `FRIEND_2022` `Reference`, switch `friend_band()` to it, and extend age coverage if the paper
     includes 80–89.
  3. Bump `ENGINE_VERSION` and update `TestCooper` boundary tests to the new cut-points.
- [ ] Verified or migrated by ________ on ________

## 3. Push-up (CSEP) and 30-s chair stand (Rikli & Jones) norms (optional)

Only secondary websites were reachable, and their numbers disagreed, so Kinetra shows raw results for
these tests. To enable ratings, copy the tables from the primary sources (CSEP-PATH manual / Payne et
al. 2000; Senior Fitness Test Manual, 2nd ed., 2013) into `engine/references.py` with a citation and
coverage rule, mirroring `friend_band()`.
- [ ] Done by ________ on ________

## 4. Translations

Native-speaker review of safety and science wording: see `TRANSLATION_REVIEW.md` (regenerate with
`cd mobile && npm run review-pack`).
- [ ] Română reviewed by ________ on ________
- [ ] Русский reviewed by ________ on ________
