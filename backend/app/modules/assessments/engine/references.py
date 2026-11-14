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
