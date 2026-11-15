"""Reference standards, copied from their sources — never invented or interpolated.

Each reference records where the numbers come from and what population they cover. A value
outside a reference's coverage gets no interpretation (the raw result is shown instead).
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Reference:
    id: str
    citation: str
    url: str
    note: str
    # True when our home protocol differs from the source's, so the comparison is an approximation.
    approximate: bool = False


FRIEND_2015 = Reference(
    id="friend_2015_treadmill",
    citation=(
        "Kaminsky LA, Arena R, Myers J. Reference Standards for Cardiorespiratory Fitness Measured With "
        "Cardiopulmonary Exercise Testing: Data From the Fitness Registry and the Importance of Exercise "
        "National Database. Mayo Clin Proc. 2015;90(11):1515-1523. Table 3 (FRIEND rows)."
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/",
    note=(
        "Directly measured treadmill VO2max (CPX, RER >= 1.00), apparently healthy US adults 20-79. "
        "A 2022 update (Mayo Clin Proc 97:285-293) reports treadmill values 1.5-4.6 mL/kg/min lower; "
        "its tables could not be accessed for verification, so the 2015 tables are used."
    ),
)

COOPER_1968 = Reference(
    id="cooper_1968",
    citation=(
        "Cooper KH. A means of assessing maximal oxygen intake. Correlation between field and treadmill "
        "testing. JAMA. 1968;203(3):201-204."
    ),
    url="https://doi.org/10.1001/jama.1968.03140030033008",
    note="VO2max (mL/kg/min) = (distance in metres - 504.9) / 44.73. Derived in young men.",
)

WHO_BMI = Reference(
    id="who_bmi_adults",
    citation=(
        "World Health Organization. Obesity and overweight (fact sheet), adults: overweight BMI >= 25, "
        "obesity BMI >= 30; WHO Global Database on BMI: normal range 18.50-24.99."
    ),
    url="https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
    note="Adult cut-offs. WHO uses BMI-for-age up to 19 years, so adult categories start at 20.",
)

NICE_WHTR = Reference(
    id="nice_ng246_whtr",
    citation=(
        "NICE guideline NG246 (2025), Overweight and obesity management: waist-to-height ratio "
        "0.4-0.49 healthy central adiposity; 0.5-0.59 increased; 0.6 or more high."
    ),
    url="https://www.nice.org.uk/guidance/NG246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity",
    note="Adults with BMI under 35 kg/m2, both sexes and all ethnicities.",
)

NHANES_RHR = Reference(
    id="nhanes_rhr_2011",
    citation=(
        "Ostchega Y, Porter KS, Hughes J, Dillon CF, Nwankwo T. Resting pulse rate reference data for "
        "children, adolescents, and adults: United States, 1999-2008. National Health Statistics Reports "
        "no. 41. Hyattsville, MD: NCHS; 2011. Tables 2 and 3."
    ),
    url="https://www.cdc.gov/nchs/data/nhsr/nhsr041.pdf",
    note=(
        "Seated radial pulse counted for 30 s and doubled, after about 4-5 minutes of rest; US population "
        "without conditions or medicines that affect the pulse. A lower pulse ranks higher here. Ages 12-79; "
        "the 80+ rows are incomplete in the source, so they are not used."
    ),
)

TVETER_2014 = Reference(
    id="tveter_2014_sts",
    citation=(
        "Tveter AT, Dagfinrud H, Moseng T, Holm I. Health-related physical fitness measures: reference "
        "values and reference equations for use in clinical practice. Arch Phys Med Rehabil. "
        "2014;95(7):1366-1373. "
        "Table 3 (30-s sit-to-stand)."
    ),
    url="https://doi.org/10.1016/j.apmr.2014.02.016",
    note=(
        "Arms folded across the chest, chair 44-45 cm, 370 Norwegian adults 18-90. Under 50: "
        "25.14 + 2.85 x sex; 50 and over: 50.61 - 0.36 x age - 0.10 x weight + 3.81 x sex "
        "(95% prediction interval +/-12.2 and "
        "+/-9.6). The percentile assumes a normal spread around the prediction."
    ),
    approximate=True,
)

STRAND_2014 = Reference(
    id="strand_2014_plank",
    citation=(
        "Strand SL, Hjelm J, Shoepe TC, Fajardo MA. Norms for an isometric muscle endurance test. "
        "J Hum Kinet. 2014;40:93-102. Table 2."
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC4096102/",
    note=(
        "Forearm plank held to fatigue or loss of form, 471 US college students (mean age 20). Used for ages "
        "17-25 only: no source with age-specific plank norms for older adults was found."
    ),
    approximate=True,
)

CSEP_PUSHUPS = Reference(
    id="csep_path_pushups",
    citation=(
        "Canadian Society for Exercise Physiology (2019). CSEP Physical Activity Training for Health "
        "(CSEP-PATH) Resource Manual, 2nd ed. Push-up health benefit rating, as reprinted by ACE."
    ),
    url="https://contentcdn.eacefitness.com/assets/certification/ace-answers/forms/pt/36_Push-up_Assessment_Protocol.pdf",
    note=(
        "Consecutive push-ups to fatigue, chest to a fist-height block. Men on toes, women on knees; other "
        "variants are not rated. Ages 15-69. Read from the ACE reprint, not the CSEP manual itself."
    ),
    approximate=True,
)

CHMS_SIT_REACH = Reference(
    id="chms_2019_sit_reach",
    citation=(
        "Hoffmann MD, Colley RC, Doyon CY, Wong SL, Tomkinson GR, Lang JJ. Normative-referenced percentile "
        "values for physical fitness among Canadians. Health Reports. 2019;30(10):14-22. Table 3."
    ),
    url="https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002/tbl/tbl03-eng.htm",
    note=(
        "Canadian Health Measures Survey 2016-2017, CSEP sit-and-reach box. Our reach is measured "
        "from the toes; 26 cm is added to match the CSEP box, whose zero is 26 cm before the toes. "
        "Ages 14-69 used."
    ),
    approximate=True,
)

SPRINGER_2007 = Reference(
    id="springer_2007_upst",
    citation=(
        "Springer BA, Marin R, Cyhan T, Roberts H, Gill NW. Normative values for the unipedal stance test "
        "with eyes open and closed. J Geriatr Phys Ther. 2007;30(1):8-15. Table 1."
    ),
    url="https://geriatrictoolkit.missouri.edu/balance/Normative_Values_for_the_Unipedal_Stance_Test_Springer-JGPT.pdf",
    note=(
        "Eyes open, arms crossed on the chest, best of 3 trials capped at 45 s, 549 adults 18-99; no sex "
        "difference. Our test uses hands on hips and a 60 s cap, so the better leg is capped at 45 s "
        "and compared with the age group's mean and spread (the table's column says SE, but the "
        "values are SDs)."
    ),
    approximate=True,
)

YMCA_STEP = Reference(
    id="ymca_3min_step",
    citation=(
        "Golding LA, ed. YMCA Fitness Testing and Assessment Manual, 4th ed. Champaign, IL: Human Kinetics; "
        "2000. 3-minute step test ratings, as reprinted by TotalWellness (2018)."
    ),
    url="https://www.totalwellnesshealth.com/wp-content/uploads/2018/08/StepTestProcedure.pdf",
    note=(
        "30 cm (12 in) step, 24 steps a minute for 3 minutes, then seated; the score is the heart beats "
        "counted for one full minute starting 5 s after stepping. Ages 18 and over, by sex. Read from a "
        "reprint, not the manual itself."
    ),
    approximate=True,
)

# --- engine-3: sport and goal test modules (personalisation). None of these rates a result: they give
# the protocol, its reliability and, where one exists, a documented threshold. Abstract or full text
# read through Europe PMC / PMC (see docs/SCIENCE.md section 9).

MARIN_JIMENEZ_2024 = Reference(
    id="marin_jimenez_2024_slj",
    citation=(
        "Marin-Jimenez N, et al. Eur J Sport Sci. 2024. doi:10.1002/ejsc.12182 [standing long jump "
        "reliability in adults, Adult-Fit]"
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC11369318/",
    note=(
        "Protocol: best of 2 jumps, two-foot take-off and landing, distance to the back of the nearest heel. "
        "Adults 18-64: ICC 0.94 without familiarisation (retest about 12 cm longer, MDC90 29 cm); after 3 "
        "practice sessions ICC 1.00. No adult age-by-sex norms were found, so results are self-comparison."
    ),
)

MARKOVIC_2004 = Reference(
    id="markovic_2004_jumps",
    citation=(
        "Markovic G, et al. J Strength Cond Res. 2004;18(3):551. "
        "doi:10.1519/1533-4287(2004)18<551:rafvos>2.0.co;2 [reliability of seven jump tests]"
    ),
    url="https://doi.org/10.1519/1533-4287(2004)18<551:RAFVOS>2.0.CO;2",
    note=(
        "Seven jump tests including the jump-and-reach (Sargent): Cronbach alpha 0.93-0.98, within-subject "
        "CV 2.4-4.6%. Jump-and-reach and flight-time heights differ, so one method is used throughout. "
        "Canadian adult norms exist (Payne et al. 2000) but their values could not be read; not used."
    ),
)

BARRERA_505_2025 = Reference(
    id="barrera_2025_505",
    citation=(
        "Barrera-Dominguez FJ, et al. Eur J Sport Sci. 2025. doi:10.1002/ejsc.12252 [505 "
        "change-of-direction test timed with a phone]"
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC11730434/",
    note=(
        "505: 10 m run-up (traditional) or standing start 5 m from the line (modified), 5 m in, 180-degree "
        "turn, 5 m out; slips and early turns discarded; 3 min rest. "
        "Phone video vs timing gates ICC >= 0.91. "
        "Hand stopwatch timing is less reliable (Chen 2021) and is flagged. No adult norms found."
    ),
)

HAUGEN_BUCHHEIT_2016 = Reference(
    id="haugen_buchheit_2016",
    citation=(
        "Haugen T, Buchheit M. Sports Med. 2016. doi:10.1007/s40279-015-0446-0 [sprint timing methods]"
    ),
    url="https://doi.org/10.1007/s40279-015-0446-0",
    note=(
        "Manual timing should be avoided over 10-20 m because of large absolute errors; Kinetra therefore "
        "accepts only phone-video or timing-gate times for the sprint. No adult norms found."
    ),
)

ECKNER_2011 = Reference(
    id="eckner_2011_ruler_drop",
    citation=(
        "Eckner JT, Kutcher JS, Richardson JK. J Athl Train. 2011;46(4):409-414. "
        "doi:10.4085/1062-6050-46.4.409 [clinical reaction time, ruler-drop method]"
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC3419153/",
    note=(
        "Reaction time from the fall distance: t = sqrt(2d/g). Season-to-season ICC 0.65 (SEM 16.6 ms). "
        "With a plain ruler in adults 60+ reliability was lower (Ferreira 2024, ICC 0.57). Needs a helper. "
        "No adult norms found."
    ),
)

ALBRECHT_2021 = Reference(
    id="albrecht_2021_back_scratch",
    citation=(
        "Albrecht BM, Stalling I, Bammann K. BMC Geriatr. 2021. doi:10.1186/s12877-021-02188-9 [Senior "
        "Fitness Test percentiles, ages 65-75]"
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC8074447/",
    note=(
        "Back-scratch: one hand over the shoulder, the other up the back, distance between the middle "
        "fingers. Norms cover 65-75 (values not read) and Rikli & Jones 60-94; none under 60, so results "
        "are self-comparison."
    ),
)

PLISKY_2006 = Reference(
    id="plisky_2006_sebt",
    citation=(
        "Plisky PJ, et al. J Orthop Sports Phys Ther. 2006. doi:10.2519/jospt.2006.2244 [Star Excursion "
        "Balance Test and injury in high-school basketball]"
    ),
    url="https://doi.org/10.2519/jospt.2006.2244",
    note=(
        "Players with an anterior reach difference above 4 cm were 2.5 times more likely to be injured. "
        "A 2021 meta-analysis (Plisky et al., IJSPT, PMC8486397) found this link in only 3 of 13 studies, so "
        "Kinetra shows the difference as a flag to look at, never as a risk score or a diagnosis."
    ),
    approximate=True,
)

MUNRO_HERRINGTON_2011 = Reference(
    id="munro_herrington_2011_hop",
    citation=(
        "Munro AG, Herrington LC. J Strength Cond Res. 2011. doi:10.1519/jsc.0b013e3181d83335 "
        "[between-session reliability of hop tests]"
    ),
    url="https://doi.org/10.1519/JSC.0b013e3181d83335",
    note=(
        "Single-leg hop ICC 0.76-0.92 with a learning effect; all healthy subjects reached a limb symmetry "
        "index of at least 90%, which they recommend as a reference. The 90% figure comes from small and "
        "clinical samples and can overestimate function after knee injury (Wellsandt 2017): a flag only."
    ),
    approximate=True,
)

NACHER_2026 = Reference(
    id="nacher_2026_isak_girths",
    citation=(
        "Nacher-Fernandez M, et al. J Int Soc Sports Nutr. 2026. doi:10.1080/15502783.2026.2724094 [ISAK "
        "girth measurement reliability]"
    ),
    url="https://pmc.ncbi.nlm.nih.gov/articles/PMC13591961/",
    note=(
        "ISAK sites; each girth measured twice (a third time if they differ by more than 1%). "
        "Trained-measurer "
        "error about 0.6%; self-measurement reliability is unknown. Arm circumference tracked training "
        "change in young men (Gentil 2020). Population girth tables describe fat plus muscle, not muscle "
        "size, so results are self-comparison."
    ),
)

CONLEY_1991 = Reference(
    id="conley_1991_swim",
    citation=(
        "Conley DS, et al. Med Sci Sports Exerc. 1991. doi:10.1249/00005768-199106000-00019 [12-minute "
        "swim as a field test of peak aerobic power, men]"
    ),
    url="https://doi.org/10.1249/00005768-199106000-00019",
    note=(
        "Distance in 12 min correlated only r = 0.40 with peak aerobic power (0.42 in women, Conley 1992): "
        "a progress measure for swimmers, not a VO2 estimate. No norms or retest data were found."
    ),
)

ALL = {
    r.id: r
    for r in (
        FRIEND_2015,
        COOPER_1968,
        WHO_BMI,
        NICE_WHTR,
        NHANES_RHR,
        TVETER_2014,
        STRAND_2014,
        CSEP_PUSHUPS,
        CHMS_SIT_REACH,
        SPRINGER_2007,
        YMCA_STEP,
        MARIN_JIMENEZ_2024,
        MARKOVIC_2004,
        BARRERA_505_2025,
        HAUGEN_BUCHHEIT_2016,
        ECKNER_2011,
        ALBRECHT_2021,
        PLISKY_2006,
        MUNRO_HERRINGTON_2011,
        NACHER_2026,
        CONLEY_1991,
    )
}

# --- FRIEND 2015, Table 3, FRIEND rows. Percentiles 5,10,25,50,75,90,95 (mL O2/kg/min).
FRIEND_PERCENTILES = (5, 10, 25, 50, 75, 90, 95)
FRIEND_TREADMILL: dict[str, dict[tuple[int, int], tuple[float, ...]]] = {
    "male": {
        (20, 29): (29.0, 32.1, 40.1, 48.0, 55.2, 61.8, 66.3),
        (30, 39): (27.2, 30.2, 35.9, 42.4, 49.2, 56.5, 59.8),
        (40, 49): (24.2, 26.8, 31.9, 37.8, 45.0, 52.1, 55.6),
        (50, 59): (20.9, 22.8, 27.1, 32.6, 39.7, 45.6, 50.7),
        (60, 69): (17.4, 19.8, 23.7, 28.2, 34.5, 40.3, 43.0),
        (70, 79): (16.3, 17.1, 20.4, 24.4, 30.4, 36.6, 39.7),
    },
    "female": {
        (20, 29): (21.7, 23.9, 30.5, 37.6, 44.7, 51.3, 56.0),
        (30, 39): (19.0, 20.9, 25.3, 30.2, 36.1, 41.4, 45.8),
        (40, 49): (17.0, 18.8, 22.1, 26.7, 32.4, 38.4, 41.7),
        (50, 59): (16.0, 17.3, 19.9, 23.4, 27.6, 32.0, 35.9),
        (60, 69): (13.4, 14.6, 17.2, 20.0, 23.8, 27.0, 29.4),
        (70, 79): (13.1, 13.6, 15.6, 18.3, 20.8, 23.1, 24.1),
    },
}
