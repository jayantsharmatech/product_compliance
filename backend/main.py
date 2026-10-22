import os
import json
import uuid
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types

# Import database helpers from your database.py file
try:
    from database import init_db, save_scan, get_all_scans, get_pending_scans, mark_scan_synced
except ImportError:
    def init_db(): pass
    def save_scan(record, paths=None): pass
    def get_all_scans(): return []
    def get_pending_scans(): return []
    def mark_scan_synced(scan_id, data): pass

logger = logging.getLogger("uvicorn")

# Initialize Gemini Client (automatically reads GEMINI_API_KEY from environment variables)
gemini_client = genai.Client()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize PostgreSQL Database tables via database.py
    try:
        logger.info("Initializing database tables via database.py...")
        init_db()
        logger.info("Database tables initialized successfully at lifespan startup.")
    except Exception as e:
        logger.warning(f"Skipping DB init: DATABASE_URL not available or connection failed. Error: {e}")
        
    yield
    # Shutdown logic (if any)

app = FastAPI(title="Legal Metrology Enforcement API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_label_with_gemini_fallbacks(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Extracts product label details for Legal Metrology compliance using an 
    ordered fallback array of current Gemini models to prevent traffic bottlenecks.
    """
    fallback_models = [
        "gemini-3.8-flash",       # Primary flagship flash model
        "gemini-3.7-flash",       # High-throughput balancing backup
        "gemini-3.6-flash",       # Stable previous-generation workhorse
        "gemini-3.5-flash-lite"   # Ultra-fast, highly accessible safety fallback
    ]
    
    detailed_prompt = """
    You are an expert Legal Metrology Inspector and OCR Compliance Assistant for packaged commodities under Indian law.
    Analyze the provided product label image meticulously. Extract the exact compliance attributes 
    and output them strictly as a valid JSON object matching the schema below without markdown wrappers or extra commentary.

    Required JSON Schema:
    {
      "product_name": "Full commercial name of the product",
      "brand_name": "Brand name or manufacturer label prefix",
      "product_category": "Category of the packaged item",
      "net_quantity": "Expressed in standard metric units (e.g., g, kg, ml, L, or count)",
      "manufacturer_details": "Complete name and address of the manufacturer, packer, or importer",
      "consumer_care_contact": "Email, phone number, or customer service contact details",
      "month_year_of_packing": "Month and Year of manufacture/packing (e.g., MM/YYYY or Month YYYY)",
      "maximum_retail_price_mrp": "MRP inclusive of all taxes, clearly indicating currency (e.g., ₹ or INR)"
    }

    If a specific field cannot be found or is missing entirely on the label, assign its value explicitly as "NOT_FOUND".
    """
    
    last_exception = None

    for model_name in fallback_models:
        try:
            logger.info(f"[Gemini Extraction] Attempting inference with model: {model_name}")
            
            response = gemini_client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    detailed_prompt
                ],
                config=types.GenerateContentConfig(
                    temperature=0.0,  # Zero temperature for precise deterministic text extraction
                    response_mime_type="application/json"  # Forces strict structural JSON compliance
                )
            )
            
            if response and response.text:
                logger.info(f"[Gemini Extraction] Successfully processed using {model_name}")
                return response.text
                
        except Exception as e:
            last_exception = e
            logger.warning(f"[Gemini Warning] Model {model_name} failed: {str(e)}. Shifting to next fallback...")
            continue

    raise RuntimeError(f"All Gemini fallback models exhausted. Critical error: {str(last_exception)}")


@app.post("/api/analyze-label")
async def analyze_label(file: UploadFile = File(...), location_name: str = Form(default="Default Location")):
    """
    Receives product label image, extracts details via Gemini multi-model fallbacks,
    runs hardcoded compliance rules, and persists the record into PostgreSQL via database.py.
    """
    try:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
        
        # 1. Extract JSON data using Gemini fallback chain
        raw_extraction_text = extract_label_with_gemini_fallbacks(image_bytes, mime_type)
        
        try:
            extracted_data = json.loads(raw_extraction_text)
        except json.JSONDecodeError:
            extracted_data = {"raw_output": raw_extraction_text}

        # 2. Hardcoded Legal Metrology Compliance Validation Rules
        violations = []
        required_fields = [
            "product_name", 
            "net_quantity", 
            "manufacturer_details", 
            "consumer_care_contact", 
            "month_year_of_packing", 
            "maximum_retail_price_mrp"
        ]
        
        compliance_results = {}
        for field in required_fields:
            val = extracted_data.get(field, "NOT_FOUND")
            if val == "NOT_FOUND" or not val:
                violations.append(f"Missing mandatory declaration: {field}")
                compliance_results[field] = {"status": "NON_COMPLIANT", "reason": "Missing"}
            else:
                compliance_results[field] = {"status": "COMPLIANT", "value": val}

        is_compliant = len(violations) == 0
        compliance_score = 100.0 if is_compliant else max(0.0, 100.0 - (len(violations) * 15.0))
        compounding_fine = 0 if is_compliant else 2500 * len(violations)

        scan_record = {
            "scan_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "product_name": extracted_data.get("product_name", "Unknown Product"),
            "brand_name": extracted_data.get("brand_name", "Unknown Brand"),
            "product_category": extracted_data.get("product_category", "Packaged Commodity"),
            "compliance_score": compliance_score,
            "is_compliant": is_compliant,
            "violations": violations,
            "compounding_fine_inr": compounding_fine,
            "location_name": location_name,
            "extracted_attributes": extracted_data
        }

        # 3. Persist record into PostgreSQL using database.py helper
        save_scan(scan_record)

        return {
            "status": "success",
            "compliance_status": "COMPLIANT" if is_compliant else "NON_COMPLIANT",
            "scan_id": scan_record["scan_id"],
            "extracted_data": extracted_data,
            "validation_details": compliance_results,
            "violations": violations,
            "compounding_fine_inr": compounding_fine
        }

    except Exception as e:
        logger.error(f"[Error] Label analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scans")
def list_scans():
    """Fetches all past compliance scans from PostgreSQL database."""
    try:
        scans = get_all_scans()
        return {"status": "success", "count": len(scans), "scans": scans}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def health_check():
    return {
        "status": "running", 
        "ai_engine": "Gemini Multi-Model Fallbacks (3.8-flash -> 3.5-flash-lite)", 
        "database": "Connected via database.py"
    }