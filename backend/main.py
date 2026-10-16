import os
import sys
import io
import json
import base64
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

# 1. Resolve Python path for Vercel serverless environment
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Response, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    init_db,
    save_scan,
    get_all_scans,
    get_pending_scans,
    mark_scan_synced
)
from extraction import extract_from_image, extract_from_multiple_images
from rule_engine import run_compliance_checks
from pdf_generator import generate_compliance_pdf, generate_and_upload_compliance_pdf
from s3_service import upload_bytes_to_s3

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

app = FastAPI(
    title="Legal Metrology Compliance Checking API",
    description="Automated label compliance check engine for Legal Metrology (Packaged Commodities) Rules, 2011",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Safe folder creation for local development; suppressed on read-only serverless platforms like Vercel
try:
    os.makedirs("static/scans", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception as e:
    logger.warning(f"Static directory mounting skipped (Serverless mode): {e}")


class EcommerceAuditRequest(BaseModel):
    url: str
    platform: Optional[str] = "Generic E-Commerce"


class ComplaintRequest(BaseModel):
    product_name: Optional[str] = None
    merchant_name: Optional[str] = None
    issue_description: Optional[str] = None
    location: Optional[str] = None


class PdfGenerateRequest(BaseModel):
    scan_id: str


def parse_float_safe(val: Optional[str]) -> Optional[float]:
    if val is None or val == "" or str(val).lower() in ["null", "undefined"]:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


@app.on_event("startup")
def startup_db_init():
    try:
        init_db()
        logger.info("Database schema initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Legal Metrology Compliance Checking Engine",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": time.time()}


@app.post("/scan")
async def scan_single_image(
    file: UploadFile = File(...),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    location_name: Optional[str] = Form("Field Enforcement Zone")
):
    try:
        contents = await file.read()
        scan_id = f"scan_{int(time.time() * 1000)}"
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        lat_float = parse_float_safe(latitude)
        lng_float = parse_float_safe(longitude)

        # 1. In-memory Base64 Data URI (Vercel & Serverless compatible)
        mime = file.content_type or "image/jpeg"
        b64_str = base64.b64encode(contents).decode("utf-8")
        b64_uri = f"data:{mime};base64,{b64_str}"

        # 2. S3 or Local Disk Storage Fallback
        s3_url = ""
        try:
            s3_url = upload_bytes_to_s3(contents, f"scans/{scan_id}.jpg", content_type=file.content_type)
        except Exception:
            pass

        image_paths = [s3_url] if s3_url else [b64_uri]

        # 3. Vision AI Label Extraction
        extraction = extract_from_image(contents)
        if not extraction.get("success"):
            logger.warning(f"Extraction fallback triggered: {extraction.get('error')}")
            extraction = {
                "success": True,
                "product_name": "Scanned Packaging Label",
                "product_category": "General Packaged Commodity",
                "requires_fssai": False,
                "requires_expiry": False,
                "extracted_fields": {}
            }

        compliance_report = run_compliance_checks(extraction)

        record = {
            "id": scan_id,
            "scan_id": scan_id,
            "timestamp": timestamp,
            "product_name": extraction.get("product_name", "Scanned Commodity"),
            "product_category": compliance_report.get("product_category", "General Packaged Commodity"),
            "compliance_score": compliance_report.get("compliance_score", 0),
            "overall_status": compliance_report.get("overall_status", "NON_COMPLIANT"),
            "is_compliant": compliance_report.get("overall_status") == "COMPLIANT",
            "compliance": "PASS" if compliance_report.get("overall_status") == "COMPLIANT" else "VIOLATION",
            "gross_penalty_sum": compliance_report.get("gross_penalty_sum", 0),
            "statutory_cap_adjustment": compliance_report.get("statutory_cap_adjustment", 0),
            "challan_amount": compliance_report.get("challan_amount", 0),
            "estimated_penalty_inr": compliance_report.get("challan_amount", 0),
            "violations": compliance_report.get("violations", []),
            "rules_results": compliance_report.get("rules_results", []),
            "extracted_fields": extraction.get("extracted_fields", {}),
            "readability_metrics": compliance_report.get("readability_metrics", {}),
            "latitude": lat_float,
            "longitude": lng_float,
            "location_name": location_name,
            "image_paths": image_paths,
            "image_url": image_paths[0]
        }

        save_scan(record, image_paths=image_paths)
        return record

    except Exception as e:
        logger.error(f"Error in /scan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scan-multi")
async def scan_multiple_images(
    files: List[UploadFile] = File(...),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    location_name: Optional[str] = Form("Field Enforcement Zone")
):
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No image files provided.")

        scan_id = f"scan_{int(time.time() * 1000)}"
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        lat_float = parse_float_safe(latitude)
        lng_float = parse_float_safe(longitude)

        image_bytes_list = []
        image_paths = []

        for idx, file_item in enumerate(files):
            b = await file_item.read()
            image_bytes_list.append(b)

            mime = file_item.content_type or "image/jpeg"
            b64_str = base64.b64encode(b).decode("utf-8")
            b64_uri = f"data:{mime};base64,{b64_str}"

            s3_url = ""
            try:
                s3_url = upload_bytes_to_s3(b, f"scans/{scan_id}_{idx}.jpg", content_type=file_item.content_type)
            except Exception:
                pass

            image_paths.append(s3_url if s3_url else b64_uri)

        extraction = extract_from_multiple_images(image_bytes_list)
        if not extraction.get("success"):
            logger.warning(f"Multi-scan extraction fallback triggered: {extraction.get('error')}")
            extraction = {
                "success": True,
                "product_name": "Multi-Panel Packaged Commodity",
                "product_category": "General Packaged Commodity",
                "requires_fssai": False,
                "requires_expiry": False,
                "extracted_fields": {}
            }

        compliance_report = run_compliance_checks(extraction)

        record = {
            "id": scan_id,
            "scan_id": scan_id,
            "timestamp": timestamp,
            "product_name": extraction.get("product_name", "Scanned Commodity"),
            "product_category": compliance_report.get("product_category", "General Packaged Commodity"),
            "compliance_score": compliance_report.get("compliance_score", 0),
            "overall_status": compliance_report.get("overall_status", "NON_COMPLIANT"),
            "is_compliant": compliance_report.get("overall_status") == "COMPLIANT",
            "compliance": "PASS" if compliance_report.get("overall_status") == "COMPLIANT" else "VIOLATION",
            "gross_penalty_sum": compliance_report.get("gross_penalty_sum", 0),
            "statutory_cap_adjustment": compliance_report.get("statutory_cap_adjustment", 0),
            "challan_amount": compliance_report.get("challan_amount", 0),
            "estimated_penalty_inr": compliance_report.get("challan_amount", 0),
            "violations": compliance_report.get("violations", []),
            "rules_results": compliance_report.get("rules_results", []),
            "extracted_fields": extraction.get("extracted_fields", {}),
            "readability_metrics": compliance_report.get("readability_metrics", {}),
            "latitude": lat_float,
            "longitude": lng_float,
            "location_name": location_name,
            "image_paths": image_paths,
            "image_url": image_paths[0]
        }

        save_scan(record, image_paths=image_paths)
        return record

    except Exception as e:
        logger.error(f"Error in /scan-multi: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
def get_inspection_history(
    search: Optional[str] = Query(None),
    compliance: Optional[str] = Query(None)
):
    try:
        scans = get_all_scans()
        filtered = []
        for item in scans:
            product_name = str(item.get("product_name") or item.get("product") or "").lower()
            location = str(item.get("location_name") or item.get("location") or "").lower()

            matches_search = True
            if search:
                q = search.lower()
                matches_search = q in product_name or q in location

            matches_filter = True
            if compliance and compliance != "all":
                item_comp = str(item.get("compliance") or "").upper()
                matches_filter = (item_comp == compliance.upper())

            if matches_search and matches_filter:
                filtered.append(item)

        return {"records": filtered, "scans": filtered, "total": len(filtered)}
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return {"records": [], "scans": [], "total": 0}


@app.get("/report/{scan_id}")
async def get_pdf_report(scan_id: str):
    try:
        scans = get_all_scans()
        scan_record = next(
            (s for s in scans if str(s.get("scan_id")) == str(scan_id) or str(s.get("id")) == str(scan_id)),
            None
        )

        if not scan_record:
            scan_record = {
                "scan_id": scan_id,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "product_name": "Scanned Packaged Commodity",
                "product_category": "General Packaged Commodity",
                "compliance_score": 0,
                "overall_status": "NON_COMPLIANT",
                "extracted_fields": {},
                "rules_results": [],
                "image_paths": []
            }

        pdf_bytes = generate_compliance_pdf(scan_record)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=challan_{scan_id}.pdf",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        logger.error(f"Failed to generate PDF report for {scan_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF Report Generation Error: {str(e)}")


@app.post("/api/generate-pdf")
@app.post("/generate-pdf")
def generate_pdf_s3_endpoint(payload: PdfGenerateRequest):
    try:
        scans = get_all_scans()
        scan_record = next(
            (s for s in scans if str(s.get("scan_id")) == str(payload.scan_id) or str(s.get("id")) == str(payload.scan_id)),
            None
        )

        if not scan_record:
            scan_record = {
                "scan_id": payload.scan_id,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "product_name": "Scanned Commodity",
                "compliance_score": 0,
                "overall_status": "NON_COMPLIANT"
            }

        s3_url = generate_and_upload_compliance_pdf(scan_record)
        return {"success": True, "scan_id": payload.scan_id, "pdf_url": s3_url}
    except Exception as e:
        logger.error(f"Error generating S3 PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))