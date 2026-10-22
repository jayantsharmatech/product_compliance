import os
import json
from google import genai
from google.genai import types

# Initialize the Gemini client (automatically reads GEMINI_API_KEY from environment variables)
client = genai.Client()

def extract_label_with_gemini_fallbacks(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """
    Extracts product label details for Legal Metrology compliance using an 
    ordered fallback array to completely bypass peak traffic or rate limits.
    """
    # Ordered fallback priority: Newest primary workhorse down to ultra-stable backups
    fallback_models = [
        "gemini-3.8-flash",       # Primary flagship flash model
        "gemini-3.7-flash",       # High-throughput balancing backup
        "gemini-3.6-flash",       # Stable previous-generation workhorse
        "gemini-3.5-flash-lite"   # Ultra-fast, highly accessible safety fallback
    ]
    
    # Detailed, structured prompt tailored to enforce precise extraction mapping
    detailed_prompt = """
    You are an expert Legal Metrology Inspector and OCR Compliance Assistant for packaged commodities under Indian law.
    Analyze the provided product label image meticulously. Extract the exact compliance attributes 
    and output them strictly as a valid JSON object matching the schema below without markdown wrappers or extra commentary.

    Required JSON Schema:
    {
      "product_name": "Full commercial name of the product",
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
            print(f"[Gemini Extraction] Attempting inference with model: {model_name}")
            
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                    detailed_prompt
                ],
                config=types.GenerateContentConfig(
                    temperature=0.0,  # Zero temperature for maximum deterministic extraction precision
                    response_mime_type="application/json"  # Forces strict structural JSON compliance
                )
            )
            
            if response and response.text:
                print(f"[Gemini Extraction] Successfully processed using {model_name}")
                return response.text
                
        except Exception as e:
            last_exception = e
            print(f"[Gemini Warning] Model {model_name} failed or encountered traffic limits: {str(e)}. Shifting to next fallback...")
            continue

    # If every model in the fallback array encounters issues
    raise RuntimeError(f"All Gemini fallback models exhausted. Critical error: {str(last_exception)}")