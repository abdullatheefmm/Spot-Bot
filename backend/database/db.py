import pymysql
import pymysql.cursors
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 3306)),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "spotbot"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
    "autocommit": False
}

def get_conn():
    return pymysql.connect(**DB_CONFIG)

def init_db():
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS scans (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    timestamp DATETIME NOT NULL,
                    image_path TEXT,
                    annotated_path TEXT,
                    heatmap_path TEXT,
                    blueprint_path TEXT,
                    wireframe_path TEXT,
                    defects LONGTEXT,
                    defect_count INT DEFAULT 0,
                    severity VARCHAR(20) DEFAULT 'None',
                    board_status VARCHAR(20) DEFAULT 'OK',
                    scan_type VARCHAR(20) DEFAULT 'upload',
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_board_status (board_status),
                    INDEX idx_severity (severity)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            # Add columns if upgrading from old schema
            for col, defn in [
                ("annotated_path", "TEXT"),
                ("heatmap_path",   "TEXT"),
                ("blueprint_path", "TEXT"),
                ("wireframe_path", "TEXT"),
            ]:
                try:
                    c.execute(f"ALTER TABLE scans ADD COLUMN {col} {defn}")
                except Exception:
                    pass  # column already exists
        conn.commit()
        print("✅ MySQL table 'scans' ready!")
    finally:
        conn.close()

BASE_URL = "http://localhost:8000"

def _path_to_url(path):
    """Convert absolute file path to a /uploads/ URL."""
    if not path:
        return None
    fname = os.path.basename(path)
    return f"{BASE_URL}/uploads/{fname}" if os.path.exists(path) else None

def save_scan(image_path, defects, defect_count, severity, board_status,
             scan_type="upload", annotated_path=None, heatmap_path=None,
             blueprint_path=None, wireframe_path=None):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("""
                INSERT INTO scans
                    (timestamp, image_path, annotated_path, heatmap_path,
                     blueprint_path, wireframe_path,
                     defects, defect_count, severity, board_status, scan_type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                image_path, annotated_path, heatmap_path,
                blueprint_path, wireframe_path,
                json.dumps(defects),
                defect_count, severity, board_status, scan_type
            ))
            scan_id = c.lastrowid
        conn.commit()
        return scan_id
    finally:
        conn.close()

def get_all_scans():
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("SELECT * FROM scans ORDER BY timestamp DESC")
            rows = c.fetchall()
        result = []
        for row in rows:
            row['defects'] = json.loads(row['defects']) if row['defects'] else []
            if hasattr(row['timestamp'], 'isoformat'):
                row['timestamp'] = row['timestamp'].isoformat()
            # Add image URLs for frontend display
            row['image_url']     = _path_to_url(row.get('image_path'))
            row['annotated_url'] = _path_to_url(row.get('annotated_path'))
            row['heatmap_url']   = _path_to_url(row.get('heatmap_path'))
            row['blueprint_url'] = _path_to_url(row.get('blueprint_path'))
            row['wireframe_url'] = _path_to_url(row.get('wireframe_path'))
            # Remove internal paths
            row.pop('image_path', None)
            row.pop('annotated_path', None)
            row.pop('heatmap_path', None)
            row.pop('blueprint_path', None)
            row.pop('wireframe_path', None)
            result.append(row)
        return result
    finally:
        conn.close()

def get_scan_by_id(scan_id):
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("SELECT * FROM scans WHERE id = %s", (scan_id,))
            row = c.fetchone()
        if row:
            row['defects'] = json.loads(row['defects']) if row['defects'] else []
            if hasattr(row['timestamp'], 'isoformat'):
                row['timestamp'] = row['timestamp'].isoformat()
            row['image_url']     = _path_to_url(row.get('image_path'))
            row['annotated_url'] = _path_to_url(row.get('annotated_path'))
            row['heatmap_url']   = _path_to_url(row.get('heatmap_path'))
            row['blueprint_url'] = _path_to_url(row.get('blueprint_path'))
            row['wireframe_url'] = _path_to_url(row.get('wireframe_path'))
        return row
    finally:
        conn.close()

def delete_scan(scan_id):
    """Delete a scan record and its associated image files."""
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("SELECT image_path, annotated_path, heatmap_path, blueprint_path, wireframe_path FROM scans WHERE id = %s", (scan_id,))
            row = c.fetchone()
            if not row:
                return False
            # Delete image files from disk
            for path_key in ('image_path', 'annotated_path', 'heatmap_path', 'blueprint_path', 'wireframe_path'):
                fpath = row.get(path_key)
                if fpath and os.path.exists(fpath):
                    try:
                        os.remove(fpath)
                    except Exception:
                        pass
            c.execute("DELETE FROM scans WHERE id = %s", (scan_id,))
        conn.commit()
        return True
    finally:
        conn.close()



def get_stats():
    conn = get_conn()
    try:
        with conn.cursor() as c:
            c.execute("SELECT COUNT(*) as total FROM scans")
            total = c.fetchone()['total']

            c.execute("SELECT COUNT(*) as faulty FROM scans WHERE board_status = 'FAULTY'")
            faulty = c.fetchone()['faulty']

            c.execute("SELECT severity, COUNT(*) as count FROM scans GROUP BY severity")
            severity_rows = c.fetchall()

            c.execute("SELECT defects FROM scans")
            all_defects = c.fetchall()

        defect_type_counts = {}
        for row in all_defects:
            defects = json.loads(row['defects']) if row['defects'] else []
            for d in defects:
                dtype = d.get('type', 'Unknown')
                defect_type_counts[dtype] = defect_type_counts.get(dtype, 0) + 1

        return {
            "total_scans": total,
            "faulty_boards": faulty,
            "ok_boards": total - faulty,
            "severity_distribution": {row['severity']: row['count'] for row in severity_rows},
            "defect_type_distribution": defect_type_counts,
            "defect_rate": round((faulty / total * 100), 1) if total > 0 else 0
        }
    finally:
        conn.close()
