import io
import os
import re
import json
import base64
import requests
import logging
from typing import Dict, Any, List
from PIL import Image as PILImage

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from s3_service import upload_bytes_to_s3

logger = logging.getLogger("uvicorn")


def resolve_image_input(scan_data: Dict[str, Any]) -> str:
    """Extracts valid image string, unpacking JSON arrays or single strings."""
    image_paths = scan_data.get("image_paths") or scan_data.get("images") or []

    if isinstance(image_paths, str):
        try:
            image_paths = json.loads(image_paths)
        except Exception:
            image_paths = [image_paths]

    if isinstance(image_paths, list) and len(image_paths) > 0:
        return str(image_paths[0])

    return str(scan_data.get("image_url") or "")


def fetch_image_flowable(image_input: str, target_width: float = 210, target_height: float = 210):
    """Vercel-compatible image loader supporting Base64 Data URIs, HTTP/S3 URLs, and files."""
    if not image_input or not isinstance(image_input, str):
        return Paragraph("<i>[Product Image Unavailable]</i>", getSampleStyleSheet()['Italic'])

    try:
        # Case 1: Base64 Data URI (Vercel Preferred)
        if image_input.startswith("data:image/"):
            header, encoded = image_input.split(",", 1)
            img_bytes = base64.b64decode(encoded)
            pil_img = PILImage.open(io.BytesIO(img_bytes))
            img_buf = io.BytesIO()
            pil_img.save(img_buf, format='JPEG')
            img_buf.seek(0)
            return RLImage(img_buf, width=target_width, height=target_height)

        # Case 2: Remote S3 / HTTP URL
        elif image_input.startswith("http://") or image_input.startswith("https://"):
            resp = requests.get(image_input, timeout=8)
            if resp.status_code == 200:
                pil_img = PILImage.open(io.BytesIO(resp.content))
                img_buf = io.BytesIO()
                pil_img.save(img_buf, format='JPEG')
                img_buf.seek(0)
                return RLImage(img_buf, width=target_width, height=target_height)

        # Case 3: Local Disk File
        elif os.path.exists(image_input):
            pil_img = PILImage.open(image_input)
            img_buf = io.BytesIO()
            pil_img.save(img_buf, format='JPEG')
            img_buf.seek(0)
            return RLImage(img_buf, width=target_width, height=target_height)

    except Exception as e:
        logger.warning(f"Image load exception: {e}")

    return Paragraph("<i>[Product Image Unavailable]</i>", getSampleStyleSheet()['Italic'])


def generate_compliance_pdf(scan_data: Dict[str, Any]) -> bytes:
    """Generates official Legal Metrology Inspection Challan PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=18, leading=22, textColor=colors.HexColor("#1e293b"), fontName="Helvetica-Bold")
    subtitle_style = ParagraphStyle('DocSubtitle', parent=styles['Normal'], fontSize=9, leading=12, textColor=colors.HexColor("#64748b"))
    section_heading = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontSize=12, leading=15, textColor=colors.HexColor("#0f172a"), fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=6)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontSize=8.5, leading=11, fontName="Helvetica-Bold")
    cell_text = ParagraphStyle('CellText', parent=styles['Normal'], fontSize=8.5, leading=11)
    badge_pass = ParagraphStyle('PassBadge', parent=styles['Normal'], fontSize=8.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#166534"))
    badge_fail = ParagraphStyle('FailBadge', parent=styles['Normal'], fontSize=8.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#991b1b"))
    badge_exempt = ParagraphStyle('ExemptBadge', parent=styles['Normal'], fontSize=8.5, fontName="Helvetica-Bold", textColor=colors.HexColor("#475569"))

    story = []

    # 1. Header Banner
    story.append(Paragraph("LEGAL METROLOGY COMPLIANCE INSPECTION REPORT", title_style))
    story.append(Paragraph("Issued under Legal Metrology (Packaged Commodities) Rules, 2011 & Act, 2009 | Govt. of India", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#cbd5e1"), spaceBefore=6, spaceAfter=10))

    # 2. Metadata & Image Section
    scan_id = scan_data.get("scan_id") or scan_data.get("id") or "N/A"
    timestamp = scan_data.get("timestamp", "N/A")
    compliance_score = scan_data.get("compliance_score", 0)
    overall_status = scan_data.get("overall_status", "NON_COMPLIANT")
    prod_category = scan_data.get("product_category", "General Packaged Commodity")

    primary_image_str = resolve_image_input(scan_data)
    img_flowable = fetch_image_flowable(primary_image_str)

    meta_text = f"""
    <b>Audit Reference ID:</b> {scan_id}<br/>
    <b>Date & Time:</b> {timestamp}<br/>
    <b>Inspection Location:</b> {scan_data.get('location_name', 'Officer Field Inspection')}<br/>
    <b>Product Name:</b> {scan_data.get('product_name', 'Unknown Commodity')}<br/>
    <b>Product Category:</b> <b>{prod_category}</b><br/><br/>
    <b>Weighted Compliance Score:</b> <font color="{ '#166534' if compliance_score >= 80 else '#991b1b' }"><b>{compliance_score}%</b></font><br/>
    <b>Status:</b> <font color="{ '#166534' if overall_status == 'COMPLIANT' else '#991b1b' }"><b>{overall_status}</b></font>
    """

    meta_table = Table([[Paragraph(meta_text, cell_text), img_flowable]], colWidths=[310, 230])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 3. Identified Violations Section
    rules_results = scan_data.get("rules_results", [])
    failed_rules = [r for r in rules_results if not r.get("passed", False)]
    net_fine = scan_data.get("challan_amount") or scan_data.get("estimated_penalty_inr") or 0
    gross_fine = scan_data.get("gross_penalty_sum") or sum(r.get("fine_amount", 2000) for r in failed_rules)
    cap_adjustment = scan_data.get("statutory_cap_adjustment") or max(0, gross_fine - net_fine)

    story.append(Paragraph("IDENTIFIED COMPLIANCE VIOLATIONS & DEFECTS", section_heading))

    if failed_rules:
        issues_table_data = [
            [Paragraph("Rule / Statutory Declaration", cell_bold), Paragraph("Observed Defect", cell_bold), Paragraph("Fine / Penalty", cell_bold)]
        ]
        for rule in failed_rules:
            rule_name = rule.get("rule_name", "General Violation").replace("_", " ").title()
            reason = rule.get("reason", "Statutory requirement missing or incorrect.")
            fine = rule.get("fine_amount", 2000)

            issues_table_data.append([
                Paragraph(f"<font color='#991b1b'><b>{rule_name}</b></font>", cell_text),
                Paragraph(reason, cell_text),
                Paragraph(f"Rs. {fine:,}", cell_bold)
            ])

        # Gross Subtotal Row
        issues_table_data.append([
            Paragraph("<b>Gross Calculated Penalty</b>", cell_bold),
            Paragraph("Sum of statutory defaults across detected rules", cell_text),
            Paragraph(f"Rs. {gross_fine:,}", cell_bold)
        ])

        # Statutory Capping Discount Row (If Cap Applies)
        if cap_adjustment > 0:
            issues_table_data.append([
                Paragraph("<b>Statutory Capping Adjustment</b>", cell_bold),
                Paragraph("<font size='7.5' color='#475569'>1st offense compounding cap under Sec. 36(1) Legal Metrology Act, 2009</font>", cell_text),
                Paragraph(f"<font color='#166534'>- Rs. {cap_adjustment:,}</font>", cell_bold)
            ])

        # Final Net Payable Fine Row
        issues_table_data.append([
            Paragraph("<b>NET PAYABLE COMPOUNDING FINE</b>", cell_bold),
            Paragraph("Final enforceable demand amount payable by violator", cell_text),
            Paragraph(f"<font color='#991b1b'><b>Rs. {net_fine:,}</b></font>", cell_bold)
        ])

        issues_table = Table(issues_table_data, colWidths=[160, 280, 100])
        issues_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#fef2f2")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#991b1b")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#fca5a5")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('BACKGROUND', (0, -3), (-1, -1), colors.HexColor("#fee2e2")),
        ]))
        story.append(issues_table)
    else:
        story.append(Paragraph("<font color='#166534'><b>✓ No Statutory Violations Detected. Packaging label meets mandatory requirements.</b></font>", cell_text))

    story.append(Spacer(1, 10))

    # 4. Statutory Declaration Details Table
    story.append(Paragraph("STATUTORY DECLARATION DETAILS", section_heading))
    extracted = scan_data.get("extracted_fields", {})

    audit_table_data = [
        [Paragraph("Mandatory Declaration", cell_bold), Paragraph("Extracted Value", cell_bold), Paragraph("Compliance Status", cell_bold)]
    ]

    for key, field in extracted.items():
        if not isinstance(field, dict):
            continue
        label = key.replace("_", " ").title()

        val = field.get("value")
        raw = field.get("raw_text")
        found = field.get("found", False)
        is_exempted = field.get("is_exempted", False)

        if is_exempted:
            display_val = f"N/A ({field.get('exemption_reason', 'Not Required')})"
            status_paragraph = Paragraph("EXEMPTED", badge_exempt)
        else:
            display_val = str(val if val is not None and str(val).strip() != "" else (raw or "NOT FOUND"))
            is_missing = (display_val == "NOT FOUND" or not found)
            is_compliant = False if is_missing else field.get("is_compliant", True)
            status_paragraph = Paragraph("COMPLIANT", badge_pass) if is_compliant else Paragraph("NON-COMPLIANT", badge_fail)

        audit_table_data.append([
            Paragraph(label, cell_text),
            Paragraph(display_val, cell_text),
            status_paragraph
        ])

    audit_table = Table(audit_table_data, colWidths=[180, 240, 120])
    audit_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(audit_table)

    doc.build(story)
    return buffer.getvalue()


def generate_and_upload_compliance_pdf(scan_data: Dict[str, Any]) -> str:
    pdf_bytes = generate_compliance_pdf(scan_data)
    scan_id = scan_data.get("scan_id", "audit_report")
    filename = f"reports/Challan_{scan_id}.pdf"
    s3_url = upload_bytes_to_s3(pdf_bytes, filename, content_type="application/pdf")
    return s3_url or ""