from datetime import date, timedelta
import holidays

# Using python-holidays library if available, or manual list?
# Implementation plan suggested manual list or library. 
# Let's try to use `holidays` library if installed, otherwise manual fallback.
# Checking requirements.txt for holidays would be good, but I'll implement a robust manual fallback for CZ since the list is stable.

CZ_HOLIDAYS_FIXED = {
    (1, 1),   # Nový rok
    (5, 1),   # Svátek práce
    (5, 8),   # Den vítězství
    (7, 5),   # Den slovanských věrozvěstů Cyrila a Metoděje
    (7, 6),   # Den upálení mistra Jana Husa
    (9, 28),  # Den české státnosti
    (10, 28), # Den vzniku samostatného československého státu
    (11, 17), # Den boje za svobodu a demokracii
    (12, 24), # Štědrý den
    (12, 25), # 1. svátek vánoční
    (12, 26), # 2. svátek vánoční
}

def get_easter_monday(year):
    """
    Easter calculation via nature method (Meeus/Jones/Butcher).
    Returns date of Easter Monday.
    """
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    
    easter_sunday = date(year, month, day)
    return easter_sunday + timedelta(days=1)

def get_good_friday(year):
    """
    Returns date of Good Friday (Velký pátek) - 2 days before Easter Sunday.
    """
    monday = get_easter_monday(year)
    return monday - timedelta(days=3)

def is_holiday(d: date) -> bool:
    # Check fixed holidays
    if (d.month, d.day) in CZ_HOLIDAYS_FIXED:
        return True
        
    # Check Easter (Movable)
    if d == get_easter_monday(d.year):
        return True
    if d == get_good_friday(d.year):
        return True
        
    return False

def is_weekend(d: date) -> bool:
    return d.weekday() >= 5 # 5=Saturday, 6=Sunday

def calculate_business_days(start_date: date, end_date: date) -> float:
    """
    Calculate business days between start and end (inclusive).
    Skips weekends and CZ holidays.
    """
    business_days = 0.0
    current = start_date
    while current <= end_date:
        if not is_weekend(current) and not is_holiday(current):
            business_days += 1.0
        current += timedelta(days=1)
    
    return business_days

if __name__ == "__main__":
    # Simple test
    print(f"Business days 2023-12-23 to 2023-12-27 (Xmas): {calculate_business_days(date(2023, 12, 23), date(2023, 12, 27))}")
    # Sat 23 (Weekend), Sun 24 (Weekend+Holiday), Mon 25 (Holiday), Tue 26 (Holiday), Wed 27 (Work) -> 1 day
