import boto3
from botocore.exceptions import NoCredentialsError
import os
import uuid
import logging

logger = logging.getLogger(__name__)

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME", "legal-metrology-evidence-store")

s3_client = boto3.client('s3', region_name=AWS_REGION)

def upload_bytes_to_s3(file_bytes: bytes, folder: str = "scans", file_ext: str = "jpg", content_type: str = "image/jpeg") -> str:
    """
    Uploads in-memory byte streams directly to AWS S3.
    Returns the public S3 URL of the uploaded object.
    """
    file_key = f"{folder}/{uuid.uuid4()}.{file_ext}"
    try:
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=file_key,
            Body=file_bytes,
            ContentType=content_type
        )
        s3_url = f"https://{BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{file_key}"
        logger.info(f"Successfully uploaded file to S3: {s3_url}")
        return s3_url
    except NoCredentialsError:
        logger.error("AWS credentials not found. Ensure environment variables are set.")
        return None
    except Exception as e:
        logger.error(f"Failed to upload file to S3: {str(e)}")
        return None