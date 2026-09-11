import io
import os
import csv
import time
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, List
from urllib.parse import quote

from dotenv import load_dotenv
load_dotenv()  # Load environment variables from .env

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# Internal Module Imports
from extraction import extract_from_image, extract_from_multiple_images
from rule_engine import run_compliance_checks
from pdf_generator import generate_compliance_pdf
from database import init_db, save_scan, get_all_scans, get_pending_scans, mark_scan_synced

# Setup Logger
logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

# Initialize FastAPI App
app = FastAPI(
    title="Legal Metrology Compliance Checking API",
    description="Automated label compliance check engine for Legal Metrology (Packaged Commodities) Rules, 2011",
    version="1.0.0"
)

# Enable CORS for Frontend/Dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Where raw images for PENDING_SYNC scans are kept until they're verified online
IMAGE_STORE_DIR = "queued_scan_images"
os.makedirs(IMAGE_STORE_DIR, exist_ok=True)


def save_images_to_disk(images_bytes_list: list, scan_id: str) -> list:
    """Persist raw image bytes so a provisional scan can be re-processed later."""
    paths = []
    for idx, img_bytes in enumerate(images_bytes_list):
        path = os.path.join(IMAGE_STORE_DIR, f"{scan_id}_{idx}.jpg")
        with open(path, "wb") as f:
            f.write(img_bytes)
        paths.append(path)
    return paths


@app.on_event("startup")
def on_startup():
    """Initialize SQLite database table on application startup."""
    init_db()
    logger.info("SQLite Database initialized (scans_history.db)")


# ==========================================
# 1. PRIMARY SCANNING & INSPECTION ENDPOINTS
# ==========================================

@app.post("/scan")
async def scan_single_image(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_name: Optional[str] = Form("Delhi NCR, India")
):
    """
    Scans a single packaged commodity label image, handles API/Offline cascade,
    runs compliance validation, and saves the record.
    """
    scan_id = f"scan_{int(time.time() * 1000)}"
    timestamp_str = datetime.now().isoformat()

    google_maps_url = ""
    if latitude is not None and longitude is not None:
        google_maps_url = f"https://www.google.com/maps?q={latitude},{longitude}"
    elif location_name:
        google_maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(location_name)}"

    try:
        image_bytes = await file.read()
        extraction_result = extract_from_image(image_bytes)

        if not extraction_result.get("success"):
            error_msg = extraction_result.get("error", "Vision OCR Extraction Failed")
            fallback_record = {
                "scan_id": scan_id,
                "timestamp": timestamp_str,
                "product_name": "Scanned Packaged Commodity",
                "product_category": "General Item",
                "compliance_score": 0.0,
                "is_compliant": False,
                "is_food_or_perishable": False,
                "requires_fssai": False,
                "is_offline": True,
                "source_mode": "PROVISIONAL_OFFLINE",
                "model_used": "System Failure Fallback",
                "location_name": location_name or "Location Unavailable",
                "latitude": latitude,
                "longitude": longitude,
                "google_maps_url": google_maps_url,
                "total_violations": 1,
                "critical_count": 1,
                "warning_count": 0,
                "extracted_fields": {},
                "readability_analysis": {},
                "violations": [
                    {
                        "rule_code": "EXTRACTION_FAILED",
                        "severity": "CRITICAL",
                        "field_name": "ocr",
                        "message": f"Extraction unavailable: {error_msg}"
                    }
                ]
            }
            image_paths = save_images_to_disk([image_bytes], scan_id)
            save_scan(fallback_record, max_records=10, sync_status="PENDING_SYNC", image_paths=image_paths)
            fallback_record["message"] = "Extraction failed both online and offline — queued for retry."
            return fallback_record

        is_offline = extraction_result.get("is_offline", False)
        source_mode = extraction_result.get("source_mode", "ONLINE_API")
        model_used = extraction_result.get("model_used", "Unknown")

        extracted_fields = extraction_result.get("extracted_fields", {})
        readability_data = extraction_result.get("readability_analysis", {})
        is_food_or_perishable = extraction_result.get("is_food_or_perishable", True)
        requires_fssai = extraction_result.get("requires_fssai", False)

        compliance_summary = run_compliance_checks(
            extracted_fields=extracted_fields,
            readability_data=readability_data,
            is_food_or_perishable=is_food_or_perishable,
            requires_fssai=requires_fssai,
            is_offline=is_offline
        )

        full_record = {
            "scan_id": scan_id,
            "timestamp": timestamp_str,
            "location_name": location_name or "Location Unavailable",
            "latitude": latitude,
            "longitude": longitude,
            "google_maps_url": google_maps_url,
            "is_offline": is_offline,
            "source_mode": source_mode,
            "model_used": model_used,
            **extraction_result,
            **compliance_summary
        }

        if source_mode == "PROVISIONAL_OFFLINE":
            image_paths = save_images_to_disk([image_bytes], scan_id)
            save_scan(full_record, max_records=10, sync_status="PENDING_SYNC", image_paths=image_paths)
            full_record["message"] = "Provisional offline result — will auto-verify once online."
        else:
            save_scan(full_record, max_records=10)

        return full_record

    except Exception as e:
        logger.error(f"Error processing single image scan: {e}")
        system_error_record = {
            "scan_id": scan_id,
            "timestamp": timestamp_str,
            "product_name": "Scanned Package",
            "product_category": "Unknown",
            "compliance_score": 0.0,
            "is_compliant": False,
            "is_offline": True,
            "source_mode": "SYSTEM_ERROR",
            "model_used": "None",
            "location_name": location_name or "Location Unavailable",
            "google_maps_url": google_maps_url,
            "violations": [{"rule_code": "SYSTEM_ERROR", "severity": "CRITICAL", "message": str(e)}]
        }
        save_scan(system_error_record, max_records=10)
        return system_error_record


@app.post("/scan-multiple")
async def scan_multiple_images_endpoint(
    files: List[UploadFile] = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_name: Optional[str] = Form("Delhi NCR, India")
):
    """
    Processes multiple image uploads using the API/Offline cascade engine.
    """
    scan_id = f"scan_{int(time.time() * 1000)}"
    timestamp_str = datetime.now().isoformat()

    google_maps_url = ""
    if latitude is not None and longitude is not None:
        google_maps_url = f"https://www.google.com/maps?q={latitude},{longitude}"
    elif location_name:
        google_maps_url = f"https://www.google.com/maps/search/?api=1&query={quote(location_name)}"

    try:
        images_bytes = [await f.read() for f in files]
        extraction_result = extract_from_multiple_images(images_bytes)

        if not extraction_result.get("success"):
            error_msg = extraction_result.get("error", "Multi-image OCR extraction failed")
            fallback_record = {
                "scan_id": scan_id,
                "timestamp": timestamp_str,
                "product_name": "Scanned Packaged Commodity",
                "product_category": "General Item",
                "compliance_score": 0.0,
                "is_compliant": False,
                "is_food_or_perishable": False,
                "requires_fssai": False,
                "is_offline": True,
                "source_mode": "PROVISIONAL_OFFLINE",
                "model_used": "System Failure Fallback",
                "location_name": location_name or "Location Unavailable",
                "latitude": latitude,
                "longitude": longitude,
                "google_maps_url": google_maps_url,
                "total_violations": 1,
                "critical_count": 1,
                "warning_count": 0,
                "extracted_fields": {},
                "readability_analysis": {},
                "violations": [{"rule_code": "EXTRACTION_FAILED", "severity": "CRITICAL", "message": error_msg}]
            }
            image_paths = save_images_to_disk(images_bytes, scan_id)
            save_scan(fallback_record, max_records=10, sync_status="PENDING_SYNC", image_paths=image_paths)
            fallback_record["message"] = "Extraction failed both online and offline — queued for retry."
            return fallback_record

        is_offline = extraction_result.get("is_offline", False)
        source_mode = extraction_result.get("source_mode", "ONLINE_API")
        model_used = extraction_result.get("model_used", "Unknown")

        extracted_fields = extraction_result.get("extracted_fields", {})
        readability_data = extraction_result.get("readability_analysis", {})
        is_food_or_perishable = extraction_result.get("is_food_or_perishable", True)
        requires_fssai = extraction_result.get("requires_fssai", False)

        compliance_summary = run_compliance_checks(
            extracted_fields=extracted_fields,
            readability_data=readability_data,
            is_food_or_perishable=is_food_or_perishable,
            requires_fssai=requires_fssai,
            is_offline=is_offline
        )

        full_record = {
            "scan_id": scan_id,
            "timestamp": timestamp_str,
            "location_name": location_name or "Location Unavailable",
            "latitude": latitude,
            "longitude": longitude,
            "google_maps_url": google_maps_url,
            "is_offline": is_offline,
            "source_mode": source_mode,
            "model_used": model_used,
            **extraction_result,
            **compliance_summary
        }

        if source_mode == "PROVISIONAL_OFFLINE":
            image_paths = save_images_to_disk(images_bytes, scan_id)
            save_scan(full_record, max_records=10, sync_status="PENDING_SYNC", image_paths=image_paths)
            full_record["message"] = "Provisional offline result — will auto-verify once online."
        else:
            save_scan(full_record, max_records=10)

        return full_record

    except Exception as e:
        logger.error(f"Error processing multi-image scan: {e}")
        system_error_record = {
            "scan_id": scan_id,
            "timestamp": timestamp_str,
            "product_name": "Scanned Package",
            "compliance_score": 0.0,
            "is_compliant": False,
            "is_offline": True,
            "source_mode": "SYSTEM_ERROR",
            "location_name": location_name or "Location Unavailable",
            "google_maps_url": google_maps_url,
            "violations": [{"rule_code": "SYSTEM_ERROR", "severity": "CRITICAL", "message": str(e)}]
        }
        save_scan(system_error_record, max_records=10)
        return system_error_record


# ==========================================
# 1B. SYNC ENDPOINTS — reconcile provisional scans once online
# ==========================================

@app.post("/sync")
async def sync_pending_scans():
    pending = get_pending_scans()
    synced, failed = 0, 0
    results = []

    for record in pending:
        scan_id = record["scan_id"]
        image_paths = record["image_paths"]
        old_data = record["raw_data"]

        try:
            images_bytes = []
            for path in image_paths:
                with open(path, "rb") as f:
                    images_bytes.append(f.read())

            if not images_bytes:
                failed += 1
                continue

            extraction_result = (
                extract_from_image(images_bytes[0])
                if len(images_bytes) == 1
                else extract_from_multiple_images(images_bytes)
            )

            if not extraction_result.get("success") or extraction_result.get("source_mode") != "ONLINE_API":
                failed += 1
                continue

            extracted_fields = extraction_result.get("extracted_fields", {})
            readability_data = extraction_result.get("readability_analysis", {})
            is_food_or_perishable = extraction_result.get("is_food_or_perishable", True)
            requires_fssai = extraction_result.get("requires_fssai", False)

            compliance_summary = run_compliance_checks(
                extracted_fields=extracted_fields,
                readability_data=readability_data,
                is_food_or_perishable=is_food_or_perishable,
                requires_fssai=requires_fssai,
                is_offline=False
            )

            verified_record = {
                **old_data,
                "is_offline": False,
                "source_mode": "ONLINE_API",
                "model_used": extraction_result.get("model_used", "Unknown"),
                **extraction_result,
                **compliance_summary
            }

            mark_scan_synced(scan_id, verified_record)

            for path in image_paths:
                if os.path.exists(path):
                    os.remove(path)

            synced += 1
            results.append({"scan_id": scan_id, "status": "synced"})

        except Exception as e:
            logger.warning(f"Sync failed for {scan_id}: {e}")
            failed += 1
            results.append({"scan_id": scan_id, "status": "failed", "error": str(e)})

    return {"synced": synced, "failed": failed, "total": len(pending), "details": results}


@app.get("/sync/pending-count")
async def pending_sync_count():
    return {"pending": len(get_pending_scans())}


# ==========================================
# 2. PDF & REPORT GENERATION ENDPOINTS
# ==========================================

@app.get("/report/{scan_id}")
async def get_pdf_report(scan_id: str):
    all_scans = get_all_scans()
    target_scan = next((s for s in all_scans if s.get("scan_id") == scan_id), None)

    if not target_scan:
        raise HTTPException(status_code=404, detail=f"Scan ID '{scan_id}' not found in inspection repository.")

    is_offline = target_scan.get("is_offline", False)
    model_used = target_scan.get("model_used", "Unknown")

    pdf_bytes = generate_compliance_pdf(target_scan, is_offline=is_offline, model_used=model_used)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Legal_Metrology_Report_{scan_id}.pdf"
        }
    )


# ==========================================
# 3. HISTORY & REPOSITORY ENDPOINTS
# ==========================================

@app.get("/history")
async def get_inspection_history(
    search: Optional[str] = Query(None, description="Search by product name, scan ID, brand, or location"),
    compliance: Optional[str] = Query("all", description="Filter: all | compliant | non_compliant | partially_compliant"),
    category: Optional[str] = Query("all", description="Filter by product category"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Retrieves stored inspection history with robust safety checks against null fields.
    """
    records = get_all_scans()
    filtered_records = []

    for record in records:
        if not isinstance(record, dict):
            continue

        if search:
            query = search.lower()
            p_name = str(record.get("product_name") or "").lower()
            s_id = str(record.get("scan_id") or "").lower()
            loc = str(record.get("location_name") or "").lower()

            extracted = record.get("extracted_fields") or {}
            mfg_info = extracted.get("manufacturer_name") or {}
            mfg_name = str(mfg_info.get("value") if isinstance(mfg_info, dict) else mfg_info).lower()

            if query not in p_name and query not in s_id and query not in mfg_name and query not in loc:
                continue

        is_compliant = record.get("is_compliant", False)
        score = record.get("compliance_score", 0)

        if compliance == "compliant" and not is_compliant:
            continue
        elif compliance == "non_compliant" and (is_compliant or score >= 70):
            continue
        elif compliance == "partially_compliant" and (is_compliant or score < 70):
            continue

        rec_category = str(record.get("product_category") or "Other")
        if category != "all" and rec_category.lower() != category.lower():
            continue

        filtered_records.append(record)

    total_count = len(filtered_records)
    paginated_records = filtered_records[offset: offset + limit]

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "scans": paginated_records
    }


@app.get("/history/{scan_id}")
async def get_scan_by_id(scan_id: str):
    all_scans = get_all_scans()
    target_scan = next((s for s in all_scans if s.get("scan_id") == scan_id), None)

    if not target_scan:
        raise HTTPException(status_code=404, detail=f"Inspection record '{scan_id}' not found.")

    return target_scan


@app.get("/history/export/csv")
async def export_inspection_history_csv():
    scans = get_all_scans()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Scan ID", "Timestamp", "Product Name", "Product Category",
        "Compliance Status", "Compliance Score (%)", "Execution Mode", "Critical Violations",
        "Warning Violations", "Location Name", "Google Maps Link",
        "Manufacturer Name", "MRP", "Net Quantity"
    ])

    for record in scans:
        if not isinstance(record, dict):
            continue
            
        extracted = record.get("extracted_fields") or {}

        mfg_data = extracted.get("manufacturer_name") or {}
        mfg_val = mfg_data.get("value") if isinstance(mfg_data, dict) else str(mfg_data)

        mrp_data = extracted.get("mrp") or {}
        mrp_val = mrp_data.get("value") if isinstance(mrp_data, dict) else str(mrp_data)

        qty_data = extracted.get("net_quantity") or {}
        qty_val = qty_data.get("value") if isinstance(qty_data, dict) else str(qty_data)

        status_str = "COMPLIANT" if record.get("is_compliant") else "NON-COMPLIANT"
        mode_str = record.get("source_mode", "ONLINE_API")

        writer.writerow([
            record.get("scan_id", ""),
            record.get("timestamp", ""),
            record.get("product_name", ""),
            record.get("product_category", ""),
            status_str,
            record.get("compliance_score", 0),
            mode_str,
            record.get("critical_count", 0),
            record.get("warning_count", 0),
            record.get("location_name", "N/A"),
            record.get("google_maps_url", ""),
            mfg_val or "N/A",
            mrp_val or "N/A",
            qty_val or "N/A"
        ])

    output.seek(0)
    filename = f"Legal_Metrology_Inspection_Log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==========================================
# 4. OFFICER ENFORCEMENT DASHBOARD ENDPOINTS
# ==========================================

@app.get("/dashboard/stats")
async def get_officer_dashboard_stats():
    scans = get_all_scans()
    total_inspections = len(scans)

    if total_inspections == 0:
        return {
            "overview": {
                "total_inspections": 0,
                "compliant_count": 0,
                "non_compliant_count": 0,
                "overall_compliance_rate": 100.0,
                "total_violations_detected": 0,
                "critical_violations_total": 0,
                "warning_violations_total": 0
            },
            "category_breakdown": {},
            "top_violations": [],
            "recent_activity": []
        }

    compliant_count = 0
    non_compliant_count = 0
    total_critical = 0
    total_warning = 0

    category_counts = {}
    violation_code_counts = {}

    for record in scans:
        if not isinstance(record, dict):
            continue
            
        is_compliant = record.get("is_compliant", False)
        if is_compliant:
            compliant_count += 1
        else:
            non_compliant_count += 1

        total_critical += record.get("critical_count", 0)
        total_warning += record.get("warning_count", 0)

        category = record.get("product_category", "Uncategorized")
        if category not in category_counts:
            category_counts[category] = {"total": 0, "compliant": 0, "non_compliant": 0}
        category_counts[category]["total"] += 1
        if is_compliant:
            category_counts[category]["compliant"] += 1
        else:
            category_counts[category]["non_compliant"] += 1

        for v in record.get("violations", []):
            if isinstance(v, dict):
                code = v.get("rule_code", "UNKNOWN_VIOLATION")
                violation_code_counts[code] = violation_code_counts.get(code, 0) + 1

    sorted_violations = sorted(
        [{"rule_code": code, "count": count} for code, count in violation_code_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )

    compliance_rate = round((compliant_count / total_inspections) * 100, 1) if total_inspections > 0 else 100.0

    return {
        "overview": {
            "total_inspections": total_inspections,
            "compliant_count": compliant_count,
            "non_compliant_count": non_compliant_count,
            "overall_compliance_rate": compliance_rate,
            "total_violations_detected": total_critical + total_warning,
            "critical_violations_total": total_critical,
            "warning_violations_total": total_warning
        },
        "category_breakdown": category_counts,
        "top_violations": sorted_violations[:10],
        "recent_activity": [
            {
                "scan_id": r.get("scan_id"),
                "timestamp": r.get("timestamp"),
                "product_name": r.get("product_name"),
                "product_category": r.get("product_category"),
                "compliance_score": r.get("compliance_score"),
                "is_compliant": r.get("is_compliant"),
                "is_offline": r.get("is_offline", False),
                "source_mode": r.get("source_mode", "ONLINE_API"),
                "location_name": r.get("location_name"),
                "google_maps_url": r.get("google_maps_url")
            }
            for r in scans[:5] if isinstance(r, dict)
        ]
    }