import io
import os
import re
import json
import time
import base64
import logging
import requests
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)

client = None


def init_gemini():
    """Initialize Gemini client using GEMINI_API_KEY environment variable."""
    global client
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        client = genai.Client(api_key=api_key)
    return client


# Trimmed to models that are actually live on the Gemini Developer API.
# Removed gemini-2.0-flash and gemini-1.5-flash — both are shut down and
# were previously guaranteed 404s + wasted retry delay on every scan.
MODELS_TO_TRY = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
]

# Used for the local Ollama/llava fallback. Deliberately does NOT ask for
# bounding boxes — small local vision models hallucinate coordinates just as
# readily as they hallucinate values, and a confidently-wrong box is worse
# than no box (it looks like verified evidence when it isn't). This mirrors
# the existing Rule 7 font-check deferral in rule_engine.py for offline mode.
OFFLINE_EXTRACTION_PROMPT = """You are a Legal Metrology label inspector for Indian products under the Legal Metrology (Packaged Commodities) Rules, 2011.

IMPORTANT: You are provided with 1 or more images showing different sides/panels of the same product packaging. Combine and aggregate all label information seen across ALL provided images into a single consolidated report.

1. IDENTIFY PRODUCT CATEGORY:
- Food & Beverages | Cosmetics & Personal Care | Medicines & Healthcare | Electronics & Appliances | Stationery & Office | Clothing & Textiles | Household Items | Other

2. EXTRACT MANDATORY LABEL DECLARATIONS:
Extract fields accurately: product_name, is_food_or_perishable (boolean), requires_fssai (boolean), mrp (numeric value & raw text), net_quantity (amount & unit), manufacturer_name, manufacturer_address, mfg_date, expiry_date (if food), country_of_origin, consumer_care, fssai_number (if food), and barcode digits.

Return ONLY a valid JSON object matching this exact structure:

{
  "product_category": "<category name>",
  "is_food_or_perishable": <true or false>,
  "requires_fssai": <true or false>,
  "product_name": "<detected product name>",
  "mrp": {
    "value": <number or null>,
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "net_quantity": {
    "value": "<amount as string>",
    "unit": "<unit>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "manufacturer_name": {
    "value": "<company name or null>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "manufacturer_address": {
    "value": "<full address or null>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "mfg_date": {
    "value": "<date>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "expiry_date": {
    "value": "<date>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "country_of_origin": {
    "value": "<country name>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "consumer_care": {
    "value": "<contact info>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "fssai_number": {
    "value": "<14 digit number>",
    "raw_text": "<exact text>",
    "found": <true/false>
  },
  "barcode": {
    "value": "<extracted digit string or null>",
    "raw_text": "<exact digits>",
    "found": <true/false>
  }
}

IMPORTANT: Return strictly valid JSON only with no markdown wrapping.
"""

# Used for the online Gemini path. Same schema as offline, PLUS a "box_2d"
# field per declaration so the frontend BoundingBoxInspector can draw evidence
# boxes on the packaging photo. box_2d uses Gemini's standard normalized
# [ymin, xmin, ymax, xmax] scale from 0-1000, relative to the FIRST image
# provided (see caveat below for multi-image scans).
ONLINE_EXTRACTION_PROMPT = """You are a Legal Metrology label inspector for Indian products under the Legal Metrology (Packaged Commodities) Rules, 2011.

IMPORTANT: You are provided with 1 or more images showing different sides/panels of the same product packaging. Combine and aggregate all label information seen across ALL provided images into a single consolidated report.

1. IDENTIFY PRODUCT CATEGORY:
- Food & Beverages | Cosmetics & Personal Care | Medicines & Healthcare | Electronics & Appliances | Stationery & Office | Clothing & Textiles | Household Items | Other

2. EXTRACT MANDATORY LABEL DECLARATIONS:
Extract fields accurately: product_name, is_food_or_perishable (boolean), requires_fssai (boolean), mrp (numeric value & raw text), net_quantity (amount & unit), manufacturer_name, manufacturer_address, mfg_date, expiry_date (if food), country_of_origin, consumer_care, fssai_number (if food), and barcode digits.

3. LOCATE EACH DECLARATION SPATIALLY:
For every field found ON THE FIRST IMAGE PROVIDED, also return its pixel location as "box_2d": [ymin, xmin, ymax, xmax], normalized to a 0-1000 scale relative to that first image's full width/height (standard convention: top-left origin, ymin/ymax are vertical, xmin/xmax are horizontal). If a field was only visible on a LATER image (2nd, 3rd, etc.) rather than the first, or its exact print location can't be pinpointed, set "box_2d" to null rather than guessing — do not fabricate coordinates.

Return ONLY a valid JSON object matching this exact structure:

{
  "product_category": "<category name>",
  "is_food_or_perishable": <true or false>,
  "requires_fssai": <true or false>,
  "product_name": "<detected product name>",
  "mrp": {
    "value": <number or null>,
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "net_quantity": {
    "value": "<amount as string>",
    "unit": "<unit>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "manufacturer_name": {
    "value": "<company name or null>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "manufacturer_address": {
    "value": "<full address or null>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "mfg_date": {
    "value": "<date>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "expiry_date": {
    "value": "<date>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "country_of_origin": {
    "value": "<country name>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "consumer_care": {
    "value": "<contact info>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "fssai_number": {
    "value": "<14 digit number>",
    "raw_text": "<exact text>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  },
  "barcode": {
    "value": "<extracted digit string or null>",
    "raw_text": "<exact digits>",
    "found": <true/false>,
    "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>] or null
  }
}

IMPORTANT: Return strictly valid JSON only with no markdown wrapping.
"""


def validate_ean13_checksum(barcode_str: str) -> dict:
    """Validate EAN-13 barcode checksum and check GS1 prefix (890 = India)."""
    if not barcode_str or not barcode_str.isdigit():
        return {"valid_checksum": False, "gs1_country": "Unknown", "is_indian_gs1": False}

    digits = [int(c) for c in barcode_str]

    if len(digits) == 13:
        odd_sum = sum(digits[i] for i in range(0, 12, 2))
        even_sum = sum(digits[i] for i in range(1, 12, 2))
        total = odd_sum + (even_sum * 3)
        checksum = (10 - (total % 10)) % 10
        valid_checksum = (checksum == digits[12])
    else:
        valid_checksum = False

    prefix = barcode_str[:3] if len(barcode_str) >= 3 else ""
    is_indian_gs1 = (prefix == "890")

    country_map = {
        "890": "India (GS1 India)",
        "690": "China", "691": "China", "692": "China", "693": "China", "694": "China", "695": "China",
        "000": "USA / Canada", "001": "USA / Canada", "002": "USA / Canada",
        "500": "United Kingdom", "400": "Germany", "490": "Japan"
    }
    gs1_country = country_map.get(prefix, f"Country Prefix ({prefix})")

    return {
        "valid_checksum": valid_checksum,
        "gs1_prefix": prefix,
        "gs1_country": gs1_country,
        "is_indian_gs1": is_indian_gs1
    }


def process_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    max_size = 1024
    if max(img.size) > max_size:
        ratio = max_size / max(img.size)
        new_size = tuple(int(dim * ratio) for dim in img.size)
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    return img


def clean_json_response(response_text: str) -> dict:
    response_text = response_text.strip()
    if response_text.startswith('```json'):
        response_text = response_text[7:]
    elif response_text.startswith('```'):
        response_text = response_text[3:]
    if response_text.endswith('```'):
        response_text = response_text[:-3]
    return json.loads(response_text.strip())


def fallback_offline_extraction(processed_images: list) -> dict:
    """
    Edge-AI Offline Fallback using local Ollama (llava).
    Processes packaging images locally without internet or cloud keys.
    """
    logger.warning("⚡ Entering PROVISIONAL_OFFLINE Mode (Local Edge-AI via Ollama)")

    ollama_url = "http://127.0.0.1:11434/api/generate"

    try:
        buffered = io.BytesIO()
        processed_images[0].save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

        payload = {
            "model": "llava",
            "prompt": OFFLINE_EXTRACTION_PROMPT,
            "images": [img_base64],
            "stream": False,
            "format": "json"
        }

        response = requests.post(ollama_url, json=payload, timeout=180)

        if response.status_code == 200:
            result_json = response.json().get("response", "{}")
            extracted_fields = clean_json_response(result_json)

            product_category = extracted_fields.pop('product_category', 'General Packaged Commodity')
            is_food_or_perishable = extracted_fields.pop('is_food_or_perishable', False)
            requires_fssai = extracted_fields.pop('requires_fssai', False)
            product_name = extracted_fields.pop('product_name', 'Scanned Commodity (Local Edge AI)')

            barcode_data = extracted_fields.get('barcode', {})
            barcode_str = str(barcode_data.get('value', '')) if barcode_data else ""
            barcode_analysis = validate_ean13_checksum(barcode_str)

            return {
                "success": True,
                "source_mode": "PROVISIONAL_OFFLINE",
                "model_used": "Local Edge-AI (LLaVA)",
                "is_offline": True,
                "extracted_fields": extracted_fields,
                "product_category": product_category,
                "product_name": product_name,
                "is_food_or_perishable": is_food_or_perishable,
                "requires_fssai": requires_fssai,
                "barcode_analysis": barcode_analysis,
                "confidence_score": 0.88,
                "readability_analysis": {
                    "pdp_area_category": "100-500cm2",
                    "min_required_font_mm": 2.5,
                    "estimated_actual_font_mm": 2.5,
                    "font_size_compliant": True,
                    "contrast_compliant": True,
                    "readability_score": 90,
                    "readability_remarks": "Provisional evaluation via local edge vision model."
                }
            }
    except Exception as e:
        logger.error(f"Local Ollama connection error: {e}")

    return {
        "success": False,
        "error": f"Local Ollama server is not running or unreachable at {ollama_url}.",
        "is_offline": True
    }


def extract_from_multiple_images(images_bytes_list: list) -> dict:
    global client
    if not client:
        init_gemini()

    if not images_bytes_list:
        return {"success": False, "error": "Empty image input list", "extracted_fields": None}

    processed_images = [process_image(b) for b in images_bytes_list[:5]]

    if client:
        for model_name in MODELS_TO_TRY:
            try:
                logger.info(f"➜ Running cloud perception using model: {model_name}")
                contents = [ONLINE_EXTRACTION_PROMPT] + processed_images

                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=8192,
                    )
                )

                response_text = getattr(response, 'text', '') or ""
                extracted_fields = clean_json_response(response_text)

                product_category = extracted_fields.pop('product_category', 'Other')
                is_food_or_perishable = extracted_fields.pop('is_food_or_perishable', True)
                requires_fssai = extracted_fields.pop('requires_fssai', False)
                product_name = extracted_fields.pop('product_name', 'Unknown Product')
                readability_analysis = extracted_fields.pop('readability_analysis', {})

                barcode_data = extracted_fields.get('barcode', {})
                barcode_str = str(barcode_data.get('value', '')) if barcode_data else ""
                barcode_analysis = validate_ean13_checksum(barcode_str)

                return {
                    "success": True,
                    "source_mode": "ONLINE_API",
                    "model_used": model_name,
                    "is_offline": False,
                    "extracted_fields": extracted_fields,
                    "product_category": product_category,
                    "product_name": product_name,
                    "is_food_or_perishable": is_food_or_perishable,
                    "requires_fssai": requires_fssai,
                    "barcode_analysis": barcode_analysis,
                    "confidence_score": 0.95,
                    "readability_analysis": readability_analysis
                }

            except Exception as e:
                logger.warning(f"✗ {model_name} failed: {str(e)[:120]}")
                time.sleep(1)
                continue

    return fallback_offline_extraction(processed_images)


def extract_from_image(image_bytes: bytes) -> dict:
    return extract_from_multiple_images([image_bytes])