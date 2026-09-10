import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("uvicorn")


def run_compliance_checks(
    extracted_fields: Dict[str, Any],
    readability_data: Dict[str, Any],
    is_food_or_perishable: bool = True,
    requires_fssai: bool = False,
    barcode_analysis: Optional[Dict[str, Any]] = None,
    is_offline: bool = False
) -> Dict[str, Any]:
    """
    Evaluates extracted label declarations against Legal Metrology (Packaged Commodities) Rules, 2011,
    performs cross-checks for barcode integrity, and calculates statutory penalty estimates under
    Section 36(1) of the Legal Metrology Act, 2009. Gracefully handles offline fallback modes.
    """
    violations: List[Dict[str, str]] = []

    # ==========================================
    # 1. MANDATORY DECLARATIONS VALIDATION (RULE 6)
    # ==========================================
    rule_checks = [
        ('mrp', 'MISSING_MRP', 'CRITICAL', 'Maximum Retail Price (MRP) is missing from the label.'),
        ('net_quantity', 'MISSING_NET_QUANTITY', 'CRITICAL', 'Net Quantity declaration is missing from the label.'),
        ('manufacturer_name', 'MISSING_MANUFACTURER_NAME', 'CRITICAL', 'Manufacturer or Packer Name is missing.'),
        ('manufacturer_address', 'MISSING_MANUFACTURER_ADDRESS', 'CRITICAL', 'Manufacturer or Packer Address is missing.'),
        ('consumer_care', 'MISSING_CONSUMER_CARE', 'CRITICAL', 'Consumer Care contact details (phone/email/address) are missing.'),
        ('country_of_origin', 'MISSING_COUNTRY_OF_ORIGIN', 'WARNING', 'Country of Origin declaration is missing from the label.')
    ]

    # Dynamic rules for perishable/food items
    if is_food_or_perishable:
        rule_checks.append(('mfg_date', 'MISSING_MFG_DATE', 'CRITICAL', 'Month & Year of Manufacture or Packing is missing.'))
        rule_checks.append(('expiry_date', 'MISSING_EXPIRY_DATE', 'CRITICAL', 'Expiry or Best Before Date is missing.'))

    # Dynamic rules for food products requiring FSSAI license
    if requires_fssai:
        rule_checks.append(('fssai_number', 'MISSING_FSSAI_NUMBER', 'CRITICAL', 'Valid 14-digit FSSAI License Number is missing.'))

    for field_key, rule_code, severity, msg in rule_checks:
        field_info = extracted_fields.get(field_key, {})
        
        if isinstance(field_info, dict):
            val = field_info.get('value')
            found = field_info.get('found', False)
        else:
            val = field_info
            found = bool(field_info)

        if not found or val is None or str(val).strip() == "" or str(val).lower() == "not found":
            violations.append({
                "rule_code": rule_code,
                "severity": severity,
                "field_name": field_key,
                "message": msg
            })

    # ==========================================
    # 2. BARCODE & GTIN ORIGIN MISMATCH CHECK
    # ==========================================
    if barcode_analysis:
        is_indian_gs1 = barcode_analysis.get("is_indian_gs1", False)
        country_field = extracted_fields.get("country_of_origin", {})
        country_str = str(
            country_field.get("value", "") if isinstance(country_field, dict) else country_field
        ).lower()

        # Flag mismatch if label explicitly claims "India" but GS1 barcode prefix belongs to another country
        if "india" in country_str and not is_indian_gs1 and barcode_analysis.get("gs1_prefix"):
            violations.append({
                "rule_code": "BARCODE_ORIGIN_MISMATCH",
                "severity": "CRITICAL",
                "field_name": "barcode",
                "message": (
                    f"Label declares 'Made in India', but EAN Barcode Prefix '{barcode_analysis.get('gs1_prefix')}' "
                    f"registers to {barcode_analysis.get('gs1_country')}."
                )
            })

    # ==========================================
    # 3. RULE 7 FONT SIZE & READABILITY CHECK
    # ==========================================
    if is_offline:
        # In provisional offline mode, spatial font measurements require bounding boxes and are deferred
        logger.info("Skipping Rule 7 spatial font height verification in provisional offline mode.")
    elif readability_data:
        font_size_compliant = readability_data.get('font_size_compliant', True)
        contrast_compliant = readability_data.get('contrast_compliant', True)

        if not font_size_compliant:
            min_req = readability_data.get('min_required_font_mm', 1.5)
            actual_est = readability_data.get('estimated_actual_font_mm', 1.0)
            violations.append({
                "rule_code": "NON_COMPLIANT_FONT_SIZE",
                "severity": "CRITICAL",
                "field_name": "readability_analysis",
                "message": f"Mandatory declaration font height ({actual_est}mm) is smaller than Rule 7 statutory requirement ({min_req}mm)."
            })

        if not contrast_compliant:
            violations.append({
                "rule_code": "POOR_LABEL_CONTRAST",
                "severity": "WARNING",
                "field_name": "readability_analysis",
                "message": "Poor color contrast detected between printed text and background substrate (Rule 9(1))."
            })

    # ==========================================
    # 4. SCORING & SECTION 36 PENALTY ESTIMATION
    # ==========================================
    total_evaluated_rules = len(rule_checks) + (0 if is_offline else 1)  # Base checks + Readability check (if online)
    critical_count = sum(1 for v in violations if v['severity'] == 'CRITICAL')
    warning_count = sum(1 for v in violations if v['severity'] == 'WARNING')

    score = max(0.0, round(((total_evaluated_rules - len(violations)) / total_evaluated_rules) * 100, 1)) if total_evaluated_rules > 0 else 100.0
    is_compliant = (len(violations) == 0)

    # Statutory Fine Calculation based on Section 36(1) of the Legal Metrology Act, 2009
    if is_compliant:
        estimated_penalty_inr = 0
    else:
        base_fine = 25000
        additional_fine = max(0, len(violations) - 1) * 5000
        estimated_penalty_inr = base_fine + additional_fine

    return {
        "compliance_score": score,
        "is_compliant": is_compliant,
        "total_violations": len(violations),
        "critical_count": critical_count,
        "warning_count": warning_count,
        "estimated_penalty_inr": estimated_penalty_inr,
        "statutory_reference": "Section 36(1), Legal Metrology Act, 2009",
        "violations": violations
    }