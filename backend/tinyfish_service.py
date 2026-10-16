import os
import logging
from tinyfish import TinyFish

logger = logging.getLogger(__name__)

# Initializes TinyFish SDK using TINYFISH_API_KEY from environment
TINYFISH_API_KEY = os.getenv("TINYFISH_API_KEY")

def audit_ecommerce_listing(product_url: str) -> dict:
    """
    Uses TinyFish Web Agent to render dynamic JavaScript e-commerce listings
    and extract mandatory packaging declarations.
    """
    if not TINYFISH_API_KEY:
        logger.warning("TINYFISH_API_KEY is not set.")
        return {"success": False, "error": "TinyFish API key missing"}

    try:
        tinyfish_client = TinyFish(api_key=TINYFISH_API_KEY)
        response = tinyfish_client.agent.run(
            url=product_url,
            goal="""
            Extract product title, Maximum Retail Price (MRP), Unit Sale Price (USP),
            net quantity, manufacturer or packer name, address, and country of origin.
            Return extracted declarations as structured JSON fields.
            """
        )
        return {"success": True, "data": response.result}
    except Exception as e:
        logger.error(f"TinyFish e-commerce audit failed for URL {product_url}: {str(e)}")
        return {"success": False, "error": str(e)}