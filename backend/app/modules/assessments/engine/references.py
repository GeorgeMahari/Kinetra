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

ALL = {r.id: r for r in (FRIEND_2015, COOPER_1968, WHO_BMI, NICE_WHTR)}

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
