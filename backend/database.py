import os
import json
import logging
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("uvicorn")

# Reads AWS RDS PostgreSQL connection string from Vercel Environment Variables
DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection():
    """Establishes connection to AWS RDS PostgreSQL."""
    if not DATABASE_URL:
        logger.warning("DATABASE_URL environment variable is not set.")
        return None
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def init_db():
    """Initializes AWS RDS PostgreSQL table schema."""
    conn = get_db_connection()
    if not conn:
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
        logger.info("✅ AWS RDS PostgreSQL database initialized successfully.")
    except Exception as e:
        logger.error(f"❌ AWS RDS Schema Initialization Error: {e}")


def save_scan(scan_data: dict, max_records: int = 10, sync_status: str = "SYNCED", image_paths: list = None):
    """
    Saves a scan record to AWS RDS PostgreSQL.
    
    Uses PostgreSQL JSONB for flexible raw_data and image_paths storage.
    """
    conn = get_db_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        
        scan_id = scan_data.get("scan_id") or scan_data.get("id") or "scan_unknown"
        
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

        # Auto-trim: keep only the latest max_records SYNCED scans in PostgreSQL
        cursor.execute('''
            DELETE FROM scans
            WHERE sync_status = 'SYNCED'
            AND scan_id NOT IN (
                SELECT scan_id FROM scans
                WHERE sync_status = 'SYNCED'
                ORDER BY timestamp DESC
                LIMIT %s
            );
        ''', (max_records,))

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"❌ Error saving scan to AWS RDS: {e}")


def get_pending_scans() -> list:
    """Returns full rows for scans still awaiting online verification."""
    conn = get_db_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT scan_id, raw_data, image_paths FROM scans
            WHERE sync_status = 'PENDING_SYNC'
            ORDER BY timestamp ASC;
        ''')
        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "scan_id": r["scan_id"],
                "raw_data": r["raw_data"] if isinstance(r["raw_data"], dict) else json.loads(r["raw_data"]),
                "image_paths": r["image_paths"] if isinstance(r["image_paths"], list) else json.loads(r["image_paths"]) if r["image_paths"] else []
            }
            for r in rows
        ]
    except Exception as e:
        logger.error(f"❌ Error fetching pending scans from AWS RDS: {e}")
        return []


def mark_scan_synced(scan_id: str, final_scan_data: dict):
    """
    Overwrites provisional data with verified online result and updates
    status to SYNCED.
    """
    conn = get_db_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE scans
            SET raw_data = %s,
                product_name = %s,
                product_category = %s,
                compliance_score = %s,
                is_compliant = %s,
                sync_status = 'SYNCED'
            WHERE scan_id = %s;
        ''', (
            json.dumps(final_scan_data),
            final_scan_data.get("product_name"),
            final_scan_data.get("product_category"),
            final_scan_data.get("compliance_score"),
            bool(final_scan_data.get("is_compliant")),
            scan_id
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"❌ Error syncing scan on AWS RDS: {e}")


def get_all_scans() -> list:
    """Retrieves all stored scans from AWS RDS ordered by newest first."""
    conn = get_db_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
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