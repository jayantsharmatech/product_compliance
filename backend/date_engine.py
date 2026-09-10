from datetime import datetime
from dateutil.relativedelta import relativedelta
import dateparser
import re


def parse_date(date_string):
    """Parse various date formats found on Indian product labels."""
    if not date_string or str(date_string).strip() == "":
        return None
    
    date_string = str(date_string).strip()
    
    # Try dateparser first
    parsed = dateparser.parse(
        date_string,
        settings={
            'PREFER_DAY_OF_MONTH': 'first',
            'PREFER_DATES_FROM': 'past'
        }
    )
    
    if parsed:
        return parsed
    
    # Try common formats manually
    formats_to_try = [
        "%b %Y", "%B %Y", "%m/%Y", "%m/%y",
        "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%Y-%m",
    ]
    
    for fmt in formats_to_try:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue
    
    return None


def extract_relative_period(expiry_string):
    """Extract relative period from strings like 'Best Before 6 Months'"""
    if not expiry_string:
        return None, None
    
    expiry_string = str(expiry_string).lower()
    
    patterns = [
        (r'(\d+)\s*months?', 'months'),
        (r'(\d+)\s*m\b', 'months'),
        (r'(\d+)\s*years?', 'years'),
        (r'(\d+)\s*y\b', 'years'),
        (r'(\d+)\s*days?', 'days'),
    ]
    
    for pattern, unit in patterns:
        match = re.search(pattern, expiry_string)
        if match:
            return int(match.group(1)), unit
    
    return None, None


def calculate_expiry(mfg_date, expiry_string):
    """Calculate expiry date from absolute date or relative period."""
    if not expiry_string:
        return None
    
    # Try parsing as absolute date first
    expiry_date = parse_date(expiry_string)
    if expiry_date:
        return expiry_date
    
    # Try relative calculation from mfg date
    if mfg_date:
        number, unit = extract_relative_period(expiry_string)
        if number and unit:
            if unit == 'months':
                return mfg_date + relativedelta(months=number)
            elif unit == 'years':
                return mfg_date + relativedelta(years=number)
            elif unit == 'days':
                return mfg_date + relativedelta(days=number)
    
    return None


def validate_dates(mfg_date_str, expiry_date_str):
    """Main function to validate dates and detect violations."""
    today = datetime.now()
    violations = []
    
    # Parse dates
    mfg_date = parse_date(mfg_date_str) if mfg_date_str else None
    expiry_date = calculate_expiry(mfg_date, expiry_date_str)
    
    # Calculate days until expiry
    days_until_expiry = None
    if expiry_date:
        days_until_expiry = (expiry_date - today).days
    
    # Check violations
    
    # Missing manufacturing date
    if not mfg_date_str:
        violations.append({
            "rule_code": "MISSING_MFG_DATE",
            "severity": "CRITICAL",
            "field_name": "mfg_date",
            "message": "Manufacturing date is missing from the label"
        })
    elif not mfg_date:
        violations.append({
            "rule_code": "INVALID_MFG_DATE_FORMAT",
            "severity": "WARNING",
            "field_name": "mfg_date",
            "message": f"Manufacturing date format not recognized: {mfg_date_str}"
        })
    
    # Future manufacturing date (fraud)
    if mfg_date and mfg_date > today:
        violations.append({
            "rule_code": "FUTURE_MFG_DATE",
            "severity": "CRITICAL",
            "field_name": "mfg_date",
            "message": f"Manufacturing date {mfg_date.strftime('%Y-%m-%d')} is in the future - possible fraud"
        })
    
    # Missing expiry date
    if not expiry_date and not expiry_date_str:
        violations.append({
            "rule_code": "MISSING_EXPIRY_DATE",
            "severity": "WARNING",
            "field_name": "expiry_date",
            "message": "Expiry/Best Before date is missing from the label"
        })
    
    # Expired product
    if expiry_date and expiry_date < today:
        violations.append({
            "rule_code": "EXPIRED_PRODUCT",
            "severity": "CRITICAL",
            "field_name": "expiry_date",
            "message": f"Product expired on {expiry_date.strftime('%Y-%m-%d')} ({abs(days_until_expiry)} days ago)"
        })
    
    # Expiring soon
    if expiry_date and 0 <= days_until_expiry <= 30:
        violations.append({
            "rule_code": "EXPIRING_SOON",
            "severity": "WARNING",
            "field_name": "expiry_date",
            "message": f"Product expires in {days_until_expiry} days"
        })
    
    return {
        "mfg_date": mfg_date.isoformat() if mfg_date else None,
        "expiry_date": expiry_date.isoformat() if expiry_date else None,
        "is_expired": expiry_date < today if expiry_date else False,
        "days_until_expiry": days_until_expiry,
        "violations": violations
    }