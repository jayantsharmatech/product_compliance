import os
import json
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("uvicorn")

def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return None
    
    try:
        # Strip any existing query parameters to avoid duplication conflicts
        if "?" in database_url:
            base_url = database_url.split("?")[0]
        else:
            base_url = database_url
            
        # Explicitly enforce sslmode='require' to satisfy AWS RDS security requirements
        conn = psycopg2.connect(
            base_url, 
            sslmode='require',
            cursor_factory=RealDictCursor
        )
        return conn
    except Exception as e:
        logger.error(f"PostgreSQL Connection Error: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        logger.warning("Skipping DB init: DATABASE_URL not available or connection failed.")
        return
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS scans (
                        scan_id VARCHAR(255) PRIMARY KEY,
                        timestamp VARCHAR(255),
                        product_name TEXT,
                        brand_name TEXT,
                        product_category TEXT,
                        compliance_score FLOAT,
                        is_compliant BOOLEAN,
                        violations JSONB,
                        compounding_fine_inr INT,
                        location_name TEXT,
                        raw_data JSONB
                    );
                """)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    finally:
        conn.close()

def save_scan(scan_record: dict, image_paths: list = None):
    conn = get_db_connection()
    if not conn:
        logger.warning("Database connection unavailable; scan record not persisted to DB.")
        return
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO scans (
                        scan_id, timestamp, product_name, brand_name, product_category, 
                        compliance_score, is_compliant, violations, compounding_fine_inr, 
                        location_name, raw_data
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (scan_id) DO UPDATE SET
                        compliance_score = EXCLUDED.compliance_score,
                        is_compliant = EXCLUDED.is_compliant,
                        violations = EXCLUDED.violations,
                        raw_data = EXCLUDED.raw_data;
                """, (
                    scan_record.get("scan_id"),
                    scan_record.get("timestamp"),
                    scan_record.get("product_name"),
                    scan_record.get("brand_name"),
                    scan_record.get("product_category"),
                    scan_record.get("compliance_score"),
                    scan_record.get("is_compliant"),
                    json.dumps(scan_record.get("violations", [])),
                    scan_record.get("compounding_fine_inr", 0),
                    scan_record.get("location_name"),
                    json.dumps(scan_record)
                ))
    except Exception as e:
        logger.error(f"Failed to save scan to DB: {e}")
    finally:
        conn.close()

def get_all_scans():
    conn = get_db_connection()
    if not conn:
        return []
    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT raw_data FROM scans ORDER BY timestamp DESC;")
                rows = cursor.fetchall()
                return [row["raw_data"] for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch scans from DB: {e}")
        return []

def get_pending_scans():
    return []

def mark_scan_synced(scan_id: str, raw_data: dict):
    pass