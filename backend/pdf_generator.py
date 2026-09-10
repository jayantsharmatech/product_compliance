import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable


def generate_compliance_pdf(scan_data: dict, is_offline: bool = False, model_used: str = "Unknown") -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    # Colors
    PRIMARY_COLOR = colors.HexColor('#0F172A')
    SECONDARY_COLOR = colors.HexColor('#475569')
    BORDER_COLOR = colors.HexColor('#E2E8F0')
    BG_LIGHT = colors.HexColor('#F8FAFC')
    GREEN_TEXT = colors.HexColor('#166534')
    RED_TEXT = colors.HexColor('#991B1B')
    AMBER_TEXT = colors.HexColor('#9A3412')

    # Typography
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=18,
        leading=22,
        textColor=PRIMARY_COLOR,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=13,
        textColor=SECONDARY_COLOR,
        spaceAfter=10
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=12,
        leading=16,
        textColor=PRIMARY_COLOR,
        fontName='Helvetica-Bold',
        spaceBefore=12,
        spaceAfter=6
    )

    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    # Category checks
    is_food = scan_data.get('requires_fssai', False)
    is_perishable = scan_data.get('is_food_or_perishable', True)

    # 1. Header Title
    story.append(Paragraph("Legal Metrology Compliance Report", title_style))
    story.append(Paragraph("Analysis based on Legal Metrology (Packaged Commodities) Rules, 2011", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_COLOR, spaceAfter=12))

    # 2. Executive Summary Card with Location & Google Maps Link
    scan_id = scan_data.get('scan_id', 'N/A')
    timestamp_raw = scan_data.get('timestamp', datetime.now().isoformat())
    try:
        dt = datetime.fromisoformat(timestamp_raw.replace('Z', ''))
        formatted_date = dt.strftime("%d %B %Y, %H:%M")
    except Exception:
        formatted_date = timestamp_raw[:19].replace('T', ' ')

    product_name = scan_data.get('product_name', 'Scanned Package Image')
    category_name = scan_data.get('product_category', 'General Packaged Commodity')
    score = scan_data.get('compliance_score', 0)
    is_compliant = scan_data.get('is_compliant', False)

    # Location & Google Maps Link Formatting
    location_name = scan_data.get('location_name', 'Delhi NCR, India')
    google_maps_url = scan_data.get('google_maps_url', '')

    if google_maps_url:
        maps_html = f"<a href='{google_maps_url}' color='#1D4ED8'><u>Open Google Maps ↗</u></a>"
    else:
        maps_html = "<font color='#64748B'>Location Map Unavailable</font>"

    maps_link_paragraph = Paragraph(maps_html, cell_style)
    loc_paragraph = Paragraph(str(location_name), cell_style)

    if is_compliant:
        status_str = "COMPLIANT"
        status_color = GREEN_TEXT
    elif score >= 70:
        status_str = "PARTIALLY COMPLIANT"
        status_color = AMBER_TEXT
    else:
        status_str = "NON-COMPLIANT"
        status_color = RED_TEXT

    status_style = ParagraphStyle('StatusStyle', parent=cell_bold, textColor=status_color, fontSize=10)

    meta_table_data = [
        [
            Paragraph("<b>Report ID:</b>", cell_style), Paragraph(str(scan_id), cell_style),
            Paragraph("<b>COMPLIANCE STATUS:</b>", cell_style), Paragraph(status_str, status_style)
        ],
        [
            Paragraph("<b>Generated:</b>", cell_style), Paragraph(formatted_date, cell_style),
            Paragraph("<b>CATEGORY SCORE:</b>", cell_style), Paragraph(f"<b>{score}%</b>", cell_style)
        ],
        [
            Paragraph("<b>Category:</b>", cell_style), Paragraph(str(category_name), cell_style),
            Paragraph("<b>Product Name:</b>", cell_style), Paragraph(str(product_name), cell_style)
        ],
        [
            Paragraph("<b>Audit Location:</b>", cell_style), loc_paragraph,
            Paragraph("<b>GPS Mapping:</b>", cell_style), maps_link_paragraph
        ]
    ]

    meta_table = Table(meta_table_data, colWidths=[90, 180, 110, 160])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 3. Mandatory Declarations Analysis Table
    story.append(Paragraph("Mandatory Declarations Analysis", section_heading))

    declarations_data = [[
        Paragraph("Declaration Field", cell_bold),
        Paragraph("Value Found", cell_bold),
        Paragraph("Status", cell_bold)
    ]]

    extracted = scan_data.get('extracted_fields', {})

    mandatory_fields_map = [
        ('mrp', 'Maximum Retail Price (MRP)'),
        ('net_quantity', 'Net Quantity'),
        ('manufacturer_name', 'Manufacturer / Packer Name'),
        ('manufacturer_address', 'Manufacturer / Packer Address'),
        ('consumer_care', 'Consumer Care Details'),
        ('country_of_origin', 'Country of Origin')
    ]

    if is_perishable:
        mandatory_fields_map.append(('mfg_date', 'Month & Year of Manufacture'))
        mandatory_fields_map.append(('expiry_date', 'Expiry / Best Before Date'))

    if is_food:
        mandatory_fields_map.append(('fssai_number', 'FSSAI License Number'))

    for field_key, field_label in mandatory_fields_map:
        field_info = extracted.get(field_key, {})

        if isinstance(field_info, dict):
            val = field_info.get('value') or field_info.get('raw_text') or 'Not found'
            found = field_info.get('found', False)
        else:
            val = str(field_info) if field_info else 'Not found'
            found = bool(field_info)

        if found and val != 'Not found':
            status_text = "<font color='#166534'><b>✓ Found</b></font>"
        else:
            status_text = "<font color='#991B1B'><b>✗ Missing</b></font>"

        declarations_data.append([
            Paragraph(field_label, cell_style),
            Paragraph(str(val), cell_style),
            Paragraph(status_text, cell_style)
        ])

    dec_table = Table(declarations_data, colWidths=[180, 260, 100])
    dec_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    story.append(dec_table)
    story.append(Spacer(1, 14))

    # 4. Font Height & Readability Analysis (Rule 7)
    readability = scan_data.get('readability_analysis', {})
    if is_offline:
        story.append(Paragraph("Font Height & Readability Analysis (Rule 7)", section_heading))
        offline_notice_data = [
            [Paragraph("<b>Status:</b>", cell_style), Paragraph("<font color='#9A3412'><b>DEFERRED (Provisional Offline Mode)</b></font>", cell_style)],
            [Paragraph("<b>Remarks:</b>", cell_style), Paragraph("Spatial 2D coordinate measurement requires online vision model processing. Verification skipped.", cell_style)]
        ]
        off_table = Table(offline_notice_data, colWidths=[110, 430])
        off_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(off_table)
        story.append(Spacer(1, 12))
    elif readability:
        story.append(Paragraph("Font Height & Readability Analysis (Rule 7)", section_heading))

        font_status = "<font color='#166534'><b>PASS</b></font>" if readability.get('font_size_compliant', True) else "<font color='#991B1B'><b>FAIL</b></font>"
        contrast_status = "<font color='#166534'><b>PASS</b></font>" if readability.get('contrast_compliant', True) else "<font color='#991B1B'><b>FAIL</b></font>"

        read_table_data = [
            [
                Paragraph("<b>PDP Area Category:</b>", cell_style), Paragraph(str(readability.get('pdp_area_category', 'N/A')), cell_style),
                Paragraph("<b>Min Required Font:</b>", cell_style), Paragraph(f"{readability.get('min_required_font_mm', 1.5)} mm", cell_style)
            ],
            [
                Paragraph("<b>Est. Text Height:</b>", cell_style), Paragraph(f"{readability.get('estimated_actual_font_mm', 1.5)} mm", cell_style),
                Paragraph("<b>Font Height Status:</b>", cell_style), Paragraph(font_status, cell_style)
            ],
            [
                Paragraph("<b>Color Contrast:</b>", cell_style), Paragraph(contrast_status, cell_style),
                Paragraph("<b>Legibility Score:</b>", cell_style), Paragraph(f"<b>{readability.get('readability_score', 100)} / 100</b>", cell_style)
            ]
        ]

        read_table = Table(read_table_data, colWidths=[110, 160, 130, 140])
        read_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('PADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        story.append(read_table)
        story.append(Spacer(1, 12))

    # 5. Violations Found Section
    violations = scan_data.get('violations', [])

    filtered_violations = []
    for v in violations:
        rule_code = v.get('rule_code', '')
        if not is_food and 'FSSAI' in rule_code:
            continue
        if not is_perishable and ('EXPIRY' in rule_code or 'MFG' in rule_code):
            continue
        filtered_violations.append(v)

    story.append(Paragraph(f"Violations Found ({len(filtered_violations)})", section_heading))

    if filtered_violations:
        rule_citations = {
            'MISSING_MRP': ('Rule 6(1)(e)', 'Ensure MRP inclusive of all taxes is marked clearly on package panel.'),
            'MISSING_NET_QUANTITY': ('Rule 6(1)(c)', 'Mandatory net quantity declaration must be clearly visible.'),
            'MISSING_MANUFACTURER_NAME': ('Rule 6(1)(a)', 'Manufacturer or packer name must be printed on principal display panel.'),
            'MISSING_MANUFACTURER_ADDRESS': ('Rule 6(1)(a)', 'Complete address of manufacturer/packer must be provided.'),
            'MISSING_CONSUMER_CARE': ('Rule 6(1)(B)', 'Name, address, phone number, and email of consumer care executive is mandatory.'),
            'MISSING_COUNTRY_OF_ORIGIN': ('Rule 6(1)(n)', 'Country of origin is mandatory for imported products.'),
            'MISSING_MFG_DATE': ('Rule 6(1)(g)', 'Ensure month and year of manufacture/packing is clearly printed.'),
            'MISSING_EXPIRY_DATE': ('Rule 6(1)(g)', 'Provide valid Expiry or Best Before date.'),
            'MISSING_FSSAI_NUMBER': ('FSSAI Act Sec 31', 'Food products must display a valid 14-digit FSSAI License Number.'),
            'NON_COMPLIANT_FONT_SIZE': ('Rule 7 Table-I/II', 'Increase letter/numeral font height on principal display panel to meet minimum mm specification.'),
            'POOR_LABEL_CONTRAST': ('Rule 9(1)', 'Ensure background and text colors contrast sharply to maintain legibility.')
        }

        for idx, v in enumerate(filtered_violations, start=1):
            code = v.get('rule_code', 'GENERAL_VIOLATION')
            severity = v.get('severity', 'CRITICAL')
            message = v.get('message', 'Violation of packaged commodity rules.')

            rule_ref, remedy = rule_citations.get(code, ('Rule 6(1)', 'Ensure compliance with statutory labeling requirements.'))

            v_title = f"{idx}. {code.replace('MISSING_', '').replace('_', ' ').title()} [{severity}]"
            v_body = f"<b>Details:</b> {message}<br/><b>Statutory Rule:</b> {rule_ref}<br/><b>→ Action Required:</b> {remedy}"

            v_data = [
                [Paragraph(f"<b>{v_title}</b>", cell_bold)],
                [Paragraph(v_body, cell_style)]
            ]

            v_table = Table(v_data, colWidths=[540])
            v_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FEF2F2') if severity == 'CRITICAL' else BG_LIGHT),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#FCA5A5') if severity == 'CRITICAL' else BORDER_COLOR),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))

            story.append(v_table)
            story.append(Spacer(1, 6))
    else:
        story.append(Paragraph("<font color='#166534'><b>✓ All mandatory declarations and font height requirements are fully compliant.</b></font>", cell_style))

    # Canvas callback for watermarking and footers if offline
    def draw_background_watermark(canvas, doc_template):
        if is_offline:
            canvas.saveState()
            canvas.setFont("Helvetica-Bold", 36)
            canvas.setFillColor(colors.HexColor('#FCA5A5'), alpha=0.18)
            canvas.translate(300, 420)
            canvas.rotate(45)
            canvas.drawCentredString(0, 0, "PROVISIONAL - OFFLINE AUDIT")
            canvas.restoreState()

        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor('#64748B'))
        canvas.drawString(36, 20, f"Audit Engine Model: {model_used} | System Status: {'Offline Provisional' if is_offline else 'Online Verified'}")
        canvas.drawRightString(612 - 36, 20, f"Page {doc_template.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_background_watermark, onLaterPages=draw_background_watermark)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes