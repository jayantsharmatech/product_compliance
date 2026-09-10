import os
import json
import sqlite3

DB_FILE = "scans_history.db"


def _get_conn():
    return sqlite3.connect(DB_FILE)


def init_db():
    """Initialize SQLite database table and apply any needed migrations."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scans (
            scan_id TEXT PRIMARY KEY,
            timestamp TEXT,
            product_name TEXT,
            product_category TEXT,
            compliance_score REAL,
            is_compliant INTEGER,
            location_name TEXT,
            latitude REAL,
            longitude REAL,
            google_maps_url TEXT,
            raw_data TEXT,
            sync_status TEXT DEFAULT 'SYNCED',
            image_paths TEXT
        )
    ''')

    # Lightweight migration: add the two new columns if this DB predates them
    cursor.execute("PRAGMA table_info(scans)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    if "sync_status" not in existing_cols:
        cursor.execute("ALTER TABLE scans ADD COLUMN sync_status TEXT DEFAULT 'SYNCED'")
    if "image_paths" not in existing_cols:
        cursor.execute("ALTER TABLE scans ADD COLUMN image_paths TEXT")

    conn.commit()
    conn.close()


def save_scan(scan_data: dict, max_records: int = 10, sync_status: str = "SYNCED", image_paths: list = None):
    """
    Saves a scan record.

    sync_status:
        "SYNCED"        -> normal online result, counts toward the max_records trim
        "PENDING_SYNC"  -> offline/provisional result, EXCLUDED from the trim so it
                            can't be deleted before it's verified online

    image_paths: list of file paths to the raw images used for this scan.
                 Required if sync_status="PENDING_SYNC" so it can be re-processed later.
    """
    conn = _get_conn()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO scans (
            scan_id, timestamp, product_name, product_category,
            compliance_score, is_compliant, location_name,
            latitude, longitude, google_maps_url, raw_data,
            sync_status, image_paths
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        scan_data.get("scan_id"),
        scan_data.get("timestamp"),
        scan_data.get("product_name"),
        scan_data.get("product_category"),
        scan_data.get("compliance_score"),
        1 if scan_data.get("is_compliant") else 0,
        scan_data.get("location_name", "Location Unavailable"),
        scan_data.get("latitude"),
        scan_data.get("longitude"),
        scan_data.get("google_maps_url", ""),
        json.dumps(scan_data),
        sync_status,
        json.dumps(image_paths) if image_paths else None
    ))

    # Auto-trim: keep only the latest max_records SYNCED scans.
    # PENDING_SYNC records are never counted/deleted here — they only leave
    # this table once mark_scan_synced() runs and flips them to SYNCED.
    cursor.execute('''
        DELETE FROM scans
        WHERE sync_status = 'SYNCED'
        AND scan_id NOT IN (
            SELECT scan_id FROM scans
            WHERE sync_status = 'SYNCED'
            ORDER BY timestamp DESC LIMIT ?
        )
    ''', (max_records,))

    conn.commit()
    conn.close()


def get_pending_scans() -> list:
    """Returns full rows for scans still awaiting online verification."""
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT scan_id, raw_data, image_paths FROM scans
        WHERE sync_status = 'PENDING_SYNC'
        ORDER BY timestamp ASC
    ''')
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "scan_id": r[0],
            "raw_data": json.loads(r[1]),
            "image_paths": json.loads(r[2]) if r[2] else []
        }
        for r in rows
    ]


def mark_scan_synced(scan_id: str, final_scan_data: dict):
    """
    Called after successfully re-running a PENDING_SYNC scan through the
    online (Gemini) pipeline. Overwrites the provisional data with the
    verified result and flips status to SYNCED — at which point it becomes
    subject to the normal max_records trim again.
    """
    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE scans
        SET raw_data = ?,
            product_name = ?,
            product_category = ?,
            compliance_score = ?,
            is_compliant = ?,
            sync_status = 'SYNCED'
        WHERE scan_id = ?
    ''', (
        json.dumps(final_scan_data),
        final_scan_data.get("product_name"),
        final_scan_data.get("product_category"),
        final_scan_data.get("compliance_score"),
        1 if final_scan_data.get("is_compliant") else 0,
        scan_id
    ))
    conn.commit()
    conn.close()


def get_all_scans():
    """Retrieves all stored scans ordered by newest first."""
    if not os.path.exists(DB_FILE):
        return []

    conn = _get_conn()
    cursor = conn.cursor()
    cursor.execute('SELECT raw_data FROM scans ORDER BY timestamp DESC')
    rows = cursor.fetchall()
    conn.close()

    return [json.loads(row[0]) for row in rows]