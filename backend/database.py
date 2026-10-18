import os
import json
import logging
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("uvicorn")

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        return None
    try:
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    except Exception as e:
        logger.error(f"PostgreSQL Connection Error: {e}")
        return None

def init_db():
    conn = get_db_connection()
    if not conn:
        logger.warning("Skipping DB init: DATABASE_URL not available.")
        return

    try:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scans (
                scan_id VARCHAR(255) PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                product_name VARCHAR(255),
                product_category VARCHAR(255),
                compliance_score REAL,
                is_compliant BOOLEAN,
                location_name VARCHAR(255),
                latitude REAL,
                longitude REAL,
                google_maps_url TEXT,
                raw_data JSONB NOT NULL,
                sync_status VARCHAR(50) DEFAULT 'SYNCED',
                image_paths JSONB
            );
        ''')
        conn.commit()
        conn.close()
        logger.info("✅ AWS RDS PostgreSQL table verified/created successfully.")
    except Exception as e:
        logger.error(f"❌ AWS RDS Schema Initialization Error: {e}")

def save_scan(scan_data: dict, max_records: int = 10, sync_status: str = "SYNCED", image_paths: list = None):
    conn = get_db_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        scan_id = scan_data.get("scan_id") or scan_data.get("id") or f"scan_{int(os.urandom(4).hex(), 16)}"
        
        cursor.execute('''
            INSERT INTO scans (
                scan_id, product_name, product_category,
                compliance_score, is_compliant, location_name,
                latitude, longitude, google_maps_url, raw_data,
                sync_status, image_paths
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (scan_id) DO UPDATE SET
                product_name = EXCLUDED.product_name,
                product_category = EXCLUDED.product_category,
                compliance_score = EXCLUDED.compliance_score,
                is_compliant = EXCLUDED.is_compliant,
                location_name = EXCLUDED.location_name,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                google_maps_url = EXCLUDED.google_maps_url,
                raw_data = EXCLUDED.raw_data,
                sync_status = EXCLUDED.sync_status,
                image_paths = EXCLUDED.image_paths;
        ''', (
            scan_id,
            scan_data.get("product_name"),
            scan_data.get("product_category"),
            scan_data.get("compliance_score"),
            bool(scan_data.get("is_compliant")),
            scan_data.get("location_name", "Location Unavailable"),
            scan_data.get("latitude"),
            scan_data.get("longitude"),
            scan_data.get("google_maps_url", ""),
            json.dumps(scan_data),
            sync_status,
            json.dumps(image_paths) if image_paths else None
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"❌ Error saving scan to AWS RDS: {e}")

def get_all_scans() -> list:
    conn = get_db_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        # Safe check if table exists before querying
        cursor.execute("SELECT TO_REGCLASS('public.scans');")
        table_exists = cursor.fetchone()
        
        if not table_exists or not table_exists.get("to_regclass"):
            init_db()
            return []

        cursor.execute('SELECT raw_data FROM scans ORDER BY timestamp DESC;')
        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            record = row["raw_data"]
            if isinstance(record, str):
                record = json.loads(record)
            results.append(record)
        return results
    except Exception as e:
        logger.error(f"❌ Error reading scans from AWS RDS: {e}")
        return []

def get_pending_scans() -> list:
    return []

def mark_scan_synced(scan_id: str, final_scan_data: dict):
    pass