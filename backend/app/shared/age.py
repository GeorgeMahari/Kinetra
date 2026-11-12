from datetime import date


def age_on(date_of_birth: date, on: date) -> int:
    """Completed years on a given day.

    Someone born on 29 February turns a year older on 1 March in non-leap years.
    """
    had_birthday = (on.month, on.day) >= (date_of_birth.month, date_of_birth.day)
    return on.year - date_of_birth.year - (0 if had_birthday else 1)
