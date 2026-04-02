from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
import os
import sys
import csv
import io

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database.db import get_all_scans, get_scan_by_id, get_stats, delete_scan
from utils.pdf_report import generate_pdf_report

router = APIRouter()

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

@router.get("/")
def list_scans():
    return get_all_scans()

@router.get("/stats")
def scan_stats():
    return get_stats()

@router.get("/export/csv")
def export_csv():
    """Download all scan history as a CSV file."""
    scans = get_all_scans()
    output = io.StringIO()
    writer = csv.writer(output)
    # Header
    writer.writerow([
        "Scan ID", "Timestamp", "Board Status", "Severity",
        "Defect Count", "Defect Types", "Scan Type"
    ])
    for s in scans:
        defect_types = ", ".join(set(d.get("type","?") for d in (s.get("defects") or [])))
        writer.writerow([
            s.get("id"), s.get("timestamp"),
            s.get("board_status"), s.get("severity"),
            s.get("defect_count"), defect_types,
            s.get("scan_type")
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=SpotBot_History.csv"}
    )

@router.get("/{scan_id}")
def get_scan(scan_id: int):
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan

@router.delete("/{scan_id}")
def remove_scan(scan_id: int):
    """Delete a scan record and its image files."""
    ok = delete_scan(scan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"deleted": scan_id}

@router.get("/{scan_id}/report")
def download_report(scan_id: int):
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    report_path = os.path.join(REPORTS_DIR, f"report_{scan_id}.pdf")
    generate_pdf_report(scan, report_path)
    return FileResponse(
        path=report_path,
        media_type="application/pdf",
        filename=f"SpotBot_Report_{scan_id}.pdf"
    )
