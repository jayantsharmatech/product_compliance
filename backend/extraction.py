import io
import os
import re
import json
import time
import logging
from typing import List, Optional
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

client = None


def init_gemini():
    """Initialize Gemini client using GEMINI_API_KEY from backend/.env."""
    global client
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            logger.info("✅ Gemini Client initialized successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Gemini Client: {e}")
            client = None
    else:
        logger.error("❌ GEMINI_API_KEY is missing from backend/.env!")
    return client


MODELS_TO_TRY = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
]

ONLINE_EXTRACTION_PROMPT = """You are an expert Legal Metrology packaging inspector for Indian commodities under the Legal Metrology (Packaged Commodities) Rules, 2011 and FSSAI Act.

First, determine the PRODUCT CATEGORY from the packaging image:
- "Food & Beverages" (e.g., health drinks, snacks, spices, water)
- "Cosmetics & Personal Care" (e.g., soaps, creams, shampoos)
- "Electronics & Electricals" (e.g., cables, chargers, appliances)
- "Apparel & Textiles" (e.g., garments, fabrics)
- "General Packaged Commodity" (e.g., utensils, stationery, hardware)

Set the compliance flags:
- "requires_fssai": true ONLY if category is "Food & Beverages" or consumable food/supplement.
- "requires_expiry": true if the product is food, pharmaceutical, cosmetic, or perishable. False for durable goods like clothes, electronics, utensils, tools.
- "is_imported": true if product is imported into India.

Extract all present statutory label declarations with 2D bounding boxes normalized [ymin, xmin, ymax, xmax] (0 to 1000 scale).

Return ONLY a valid JSON object matching this structure:
{
  "product_name": "<detected product name>",
  "product_category": "<category name>",
  "requires_fssai": true/false,
  "requires_expiry": true/false,
  "is_imported": true/false,
  "mrp": { "value": 185.0, "raw_text": "MRP: ₹ 185.00", "found": true, "box_2d": [780, 250, 830, 550] },
  "unit_sale_price": { "value": "0.37", "raw_text": "UNIT SALE PRICE PER g: ₹ 0.37", "found": true, "box_2d": [835, 250, 880, 550] },
  "net_quantity": { "value": "500 g", "unit": "g", "raw_text": "NET QTY.: 500 g", "found": true, "box_2d": [590, 250, 640, 550] },
  "manufacturer_name": { "value": "<company>", "raw_text": "<text>", "found": true, "box_2d": [100, 200, 180, 800] },
  "manufacturer_address": { "value": "<address>", "raw_text": "<text>", "found": true, "box_2d": [180, 200, 240, 800] },
  "mfg_date": { "value": "04/2026", "raw_text": "MFG. DATE: 04/2026", "found": true, "box_2d": [690, 250, 735, 550] },
  "expiry_date": { "value": "09/2027", "raw_text": "EXPIRY DATE: 09/2027", "found": true, "box_2d": [735, 250, 780, 550] },
  "consumer_care": { "value": "1800 102 7382", "raw_text": "Consumer Care: 1800 102 7382", "found": true, "box_2d": [240, 200, 300, 800] },
  "fssai_number": { "value": "10012022000123", "raw_text": "FSSAI Lic. No. 10012022000123", "found": true, "box_2d": [880, 250, 930, 550] },
  "country_of_origin": { "value": "India", "raw_text": "Made in India", "found": true, "box_2d": null },
  "barcode": { "value": "8901234567890", "raw_text": "8 901234 567890", "found": true, "box_2d": [890, 250, 970, 480] }
}
"""


def process_image_to_part(image_bytes: bytes) -> types.Part:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        max_size = 1024
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = tuple(int(dim * ratio) for dim in img.size)
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=90)
        return types.Part.from_bytes(data=buf.getvalue(), mime_type='image/jpeg')
    except Exception as e:
        logger.warning(f"Image preprocessing note: {e}")
        return types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg')


def clean_json_response(response_text: str) -> dict:
    text = response_text.strip()
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[:-3]
    if text.endswith('```'):
        text = text[:-3]

    json_match = re.search(r'(\{.*\})', text, re.DOTALL)
    if json_match:
        text = json_match.group(1)

    return json.loads(text.strip())


def extract_from_multiple_images(images_bytes_list: list) -> dict:
    global client
    if not client:
        init_gemini()

    if not client:
        return {"success": False, "error": "Gemini API client not initialized.", "extracted_fields": None}

    if not images_bytes_list:
        return {"success": False, "error": "No image bytes provided", "extracted_fields": None}

    image_parts = [process_image_to_part(b) for b in images_bytes_list[:5]]
    last_error = "Unknown API Error"

    for model_name in MODELS_TO_TRY:
        for attempt in range(2):
            try:
                logger.info(f"➜ Running Gemini extraction (attempt {attempt+1}) using model: {model_name}")
                contents = [ONLINE_EXTRACTION_PROMPT] + image_parts

                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=8192,
                        response_mime_type="application/json"
                    )
                )

                response_text = getattr(response, 'text', '') or ""
                extracted_fields = clean_json_response(response_text)

                prod_name = extracted_fields.pop('product_name', 'Scanned Packaging') or 'Scanned Packaging'
                prod_cat = extracted_fields.pop('product_category', 'General Packaged Commodity') or 'General Packaged Commodity'
                req_fssai = bool(extracted_fields.pop('requires_fssai', 'Food' in prod_cat))
                req_expiry = bool(extracted_fields.pop('requires_expiry', 'Food' in prod_cat or 'Cosmetic' in prod_cat))
                is_imported = bool(extracted_fields.pop('is_imported', False))

                logger.info(f"✅ Extracted category [{prod_cat}] (FSSAI={req_fssai}, Expiry={req_expiry}) via [{model_name}]")

                return {
                    "success": True,
                    "source_mode": "LIVE_GEMINI_API",
                    "model_used": model_name,
                    "extracted_fields": extracted_fields,
                    "product_name": prod_name,
                    "product_category": prod_cat,
                    "requires_fssai": req_fssai,
                    "requires_expiry": req_expiry,
                    "is_imported": is_imported,
                    "confidence_score": 0.98
                }

            except Exception as e:
                last_error = str(e)
                if "503" in last_error or "429" in last_error:
                    backoff = (attempt + 1) * 1.5
                    logger.warning(f"⚠️ Model [{model_name}] traffic spike ({last_error[:60]}). Waiting {backoff}s...")
                    time.sleep(backoff)
                else:
                    logger.warning(f"⚠️ Model [{model_name}] skipped: {last_error[:120]}")
                    break

    return {
        "success": False,
        "error": f"Live Gemini API failed across all models. Last error: {last_error}",
        "extracted_fields": None
    }


def extract_from_image(image_bytes: bytes) -> dict:
    return extract_from_multiple_images([image_bytes])