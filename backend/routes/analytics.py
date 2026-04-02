"""
SpotBot Analytics Routes
========================
Feature 1: Gemini Vision AI — expert PCB analysis
Feature 2: DBSCAN Spatial Clustering — find systemic production hotspots
Feature 3: SPC Control Charts — statistical process control data
Feature 4: Autoencoder Anomaly Score — novelty detection without labels
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import json, os, sys, base64, uuid
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from database.db import get_all_scans, get_scan_by_id, get_conn

router = APIRouter()

# ─── Gemini setup ────────────────────────────────────────────────────────────
_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
_gemini_model = None

def _get_gemini():
    global _gemini_model
    if _gemini_model:
        return _gemini_model
    if not _GEMINI_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=_GEMINI_KEY)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        return _gemini_model
    except Exception as e:
        print(f"⚠️ Gemini init failed: {e}")
        return None


# ─── Feature 1: Gemini Vision AI Analysis ───────────────────────────────────
class GeminiRequest(BaseModel):
    scan_id: Optional[int] = None
    image_b64: Optional[str] = None   # raw base64 if no scan_id
    defects: Optional[list] = []

@router.post("/gemini-analysis")
def gemini_analysis(req: GeminiRequest):
    """
    Send a PCB image + detected defects to Gemini 1.5 Flash.
    Returns expert narrative analysis, root cause hypothesis,
    and prioritised repair recommendations.
    """
    model = _get_gemini()

    # ── Build defect summary text ──────────────────────────────────────────
    defect_list = req.defects or []
    if req.scan_id and not defect_list:
        scan = get_scan_by_id(req.scan_id)
        if scan:
            defect_list = scan.get("defects", [])

    defect_text = ""
    defect_types = []
    for i, d in enumerate(defect_list, 1):
        defect_type = d.get('type','?')
        defect_types.append(defect_type)
        defect_text += (
            f"\n{i}. {defect_type} | Severity: {d.get('severity','?')} "
            f"| Confidence: {int(d.get('confidence',0)*100)}% "
            f"| Location: {d.get('location','?')} "
            f"| Area: {d.get('area_pct',0):.1f}%"
        )
        
    # --- RAG Retrieval Step ---
    from models.rag_knowledge import retrieve_ipc_context
    retrieved_context = retrieve_ipc_context(defect_types)

    prompt = f"""You are a senior PCB quality engineer with 15 years of experience in electronics manufacturing.

A PCB board has been scanned by an automated inspection system. Here are the detected defects:{defect_text if defect_text else " NO DEFECTS DETECTED"}

[IPC-A-610 KNOWLEDGE BASE CONTEXT]
The following engineering standards were automatically retrieved from the manufacturing database regarding these defects:
{retrieved_context}

Please provide a professional inspection report with these sections:
1. **Executive Summary** (2-3 sentences on overall board health)
2. **Critical Issues** (if any — what needs immediate attention)
3. **Root Cause Analysis** (what likely caused these specific defects — manufacturing, design, or handling?)
4. **Repair Priority Queue** (ordered list of what to fix first and why)
5. **Pass/Fail Recommendation** with confidence level
6. **Preventive Actions** (how to avoid recurrence in future boards)

REQUIREMENT: You must explicitly quote or reference the provided IPC standards in your Root Cause and Preventive Actions.
Be specific and technical. Use plain text, no markdown."""

    # ── If we have an image, add it ────────────────────────────────────────
    image_part = None
    if req.image_b64:
        try:
            import google.generativeai as genai
            img_bytes = base64.b64decode(req.image_b64)
            image_part = {"mime_type": "image/jpeg", "data": img_bytes}
        except Exception:
            pass

    if not model:
        # Fallback: intelligent rule-based analysis if no Gemini key
        return _rule_based_analysis(defect_list)

    try:
        import google.generativeai as genai
        content = [prompt]
        if image_part:
            content = [
                genai.protos.Part(
                    inline_data=genai.protos.Blob(mime_type=image_part["mime_type"], data=image_part["data"])
                ),
                prompt
            ]
        response = model.generate_content(content)
        return {
            "source": "gemini-1.5-flash",
            "analysis": response.text,
            "defect_count": len(defect_list)
        }
    except Exception as e:
        return _rule_based_analysis(defect_list)


def _rule_based_analysis(defects: list) -> dict:
    """High-quality fallback when no Gemini API key is configured."""
    if not defects:
        return {
            "source": "rule-based",
            "analysis": (
                "Executive Summary:\n"
                "This PCB has passed automated inspection with no defects detected. "
                "The board appears structurally sound with no visible trace breaks, "
                "solder issues, or thermal damage.\n\n"
                "Pass/Fail Recommendation:\n"
                "PASS — Board is cleared for use. Recommend standard functional testing "
                "before deployment per IPC-A-610 Class 2 requirements.\n\n"
                "Preventive Actions:\n"
                "Maintain current manufacturing process parameters. Schedule re-inspection "
                "after any process change or new supplier introduction."
            ),
            "defect_count": 0
        }

    critical = [d for d in defects if d.get("severity") == "Critical"]
    major    = [d for d in defects if d.get("severity") == "Major"]
    minor    = [d for d in defects if d.get("severity") == "Minor"]

    thermal  = [d for d in defects if d.get("type") == "Thermal Damage"]
    opens    = [d for d in defects if d.get("type") == "Open"]
    shorts   = [d for d in defects if d.get("type") == "Short"]

    lines = []

    # Executive Summary
    lines.append("Executive Summary:")
    if critical:
        lines.append(
            f"This PCB has {len(defects)} defect(s) detected, including {len(critical)} Critical issue(s) "
            f"that require immediate action before the board can be used. "
            f"The board is currently classified as FAULTY."
        )
    else:
        lines.append(
            f"This PCB has {len(defects)} minor defect(s) detected. "
            f"No critical issues were found, but repair is recommended to ensure long-term reliability."
        )

    # Critical Issues
    if critical:
        lines.append("\nCritical Issues:")
        for d in critical:
            lines.append(
                f"• {d['type']} at {d.get('location','?')} "
                f"(confidence: {int(d.get('confidence',0)*100)}%, "
                f"area: {d.get('area_pct',0):.1f}% of board)"
            )

    # Root Cause
    lines.append("\nRoot Cause Analysis:")
    if thermal:
        lines.append(
            "Thermal damage indicates an electrical overcurrent event, voltage spike, "
            "or component thermal runaway. This is consistent with an undersized trace "
            "carrying excessive current, or a failed protection component (fuse, TVS diode). "
            "Inspect the power supply chain and verify trace width against IPC-2221A current capacity tables."
        )
    if opens:
        lines.append(
            "Open circuit traces typically result from mechanical stress (PCB flexing), "
            "incomplete etching, or handling damage. Per IPC-A-610, open traces on signal "
            "layers are a Class 2 defect and require repair before functional testing."
        )
    if shorts:
        lines.append(
            "Solder bridges are most commonly caused by excessive solder paste, "
            "misaligned stencil apertures, or component tombstoning during reflow. "
            "Review paste volume and stencil registration for this board revision."
        )
    if not thermal and not opens and not shorts:
        lines.append(
            "Defects detected suggest minor manufacturing process variations. "
            "Review incoming material quality and process parameters."
        )

    # Repair Priority Queue
    lines.append("\nRepair Priority Queue:")
    priority = sorted(defects, key=lambda d: {"Critical": 0, "Major": 1, "Minor": 2}.get(d.get("severity","Minor"), 2))
    for i, d in enumerate(priority[:5], 1):
        lines.append(f"{i}. [{d.get('severity')}] {d.get('type')} — {d.get('repair','Consult datasheet.')[:120]}")

    # Pass/Fail
    lines.append("\nPass/Fail Recommendation:")
    if critical:
        lines.append("FAIL — Board must NOT be used. Critical defects present. Repair or scrap required.")
    elif major:
        lines.append("CONDITIONAL PASS — Board requires rework before deployment. Major defects present.")
    else:
        lines.append("PASS WITH OBSERVATION — Minor defects only. Functional testing recommended.")

    # Preventive
    lines.append("\nPreventive Actions:")
    lines.append(
        "1. Implement SPC monitoring on defect rate to catch process drift early.\n"
        "2. Review last 10 boards from the same batch for similar defect patterns.\n"
        "3. Verify incoming PCB substrate quality if thermal or open defects persist.\n"
        "4. Update inspection checklist to include this defect type in pre-SMT visual inspection."
    )

    return {
        "source": "rule-based",
        "analysis": "\n".join(lines),
        "defect_count": len(defects)
    }


# ─── Feature 2: DBSCAN Spatial Clustering ────────────────────────────────────
@router.get("/defect-clusters")
def defect_clusters():
    """
    Run DBSCAN on all defect centroids across all scans.
    Returns cluster locations, sizes, and dominant defect types.
    Used for the spatial heatmap on the Dashboard.
    """
    try:
        from sklearn.cluster import DBSCAN
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        raise HTTPException(status_code=503, detail="scikit-learn not installed")

    scans = get_all_scans()

    # Collect all defect centroid points with metadata
    points, meta = [], []
    for scan in scans:
        for d in (scan.get("defects") or []):
            box = d.get("box")
            if box and len(box) == 4:
                cx = (box[0] + box[2]) / 2
                cy = (box[1] + box[3]) / 2
                # Normalise to 0-1 range (assume PCB fits in ~640x480)
                points.append([cx / 640.0, cy / 480.0])
                meta.append({
                    "type":     d.get("type", "Unknown"),
                    "severity": d.get("severity", "Minor"),
                    "scan_id":  scan.get("id"),
                    "cx": cx, "cy": cy
                })

    if len(points) < 3:
        return {"clusters": [], "total_points": len(points), "message": "Not enough defect data yet. Run more scans."}

    X = np.array(points)
    # DBSCAN: eps controls cluster radius, min_samples = minimum cluster size
    db = DBSCAN(eps=0.12, min_samples=3).fit(X)
    labels = db.labels_

    clusters = []
    unique_labels = set(labels) - {-1}  # -1 = noise

    for lbl in unique_labels:
        mask = labels == lbl
        cluster_points = X[mask]
        cluster_meta   = [meta[i] for i, m in enumerate(mask) if m]

        # Dominant defect type in this cluster
        type_counts = {}
        for m in cluster_meta:
            t = m["type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        dominant_type = max(type_counts, key=type_counts.get)

        # Severity distribution
        sev_counts = {}
        for m in cluster_meta:
            s = m["severity"]
            sev_counts[s] = sev_counts.get(s, 0) + 1

        # Cluster centre (normalised 0-1)
        centre = cluster_points.mean(axis=0).tolist()

        clusters.append({
            "cluster_id":       int(lbl),
            "centre_x":         round(centre[0], 4),
            "centre_y":         round(centre[1], 4),
            "point_count":      int(mask.sum()),
            "dominant_type":    dominant_type,
            "type_breakdown":   type_counts,
            "severity_breakdown": sev_counts,
            "scan_ids":         list(set(m["scan_id"] for m in cluster_meta))
        })

    # Sort by size (largest cluster first)
    clusters.sort(key=lambda c: c["point_count"], reverse=True)

    noise_count = int(np.sum(labels == -1))

    return {
        "clusters":      clusters,
        "total_points":  len(points),
        "noise_points":  noise_count,
        "interpretation": _interpret_clusters(clusters)
    }


def _interpret_clusters(clusters):
    if not clusters:
        return "No significant defect clusters detected. Defects appear randomly distributed."
    top = clusters[0]
    zone = _normalised_to_zone(top["centre_x"], top["centre_y"])
    return (
        f"Largest cluster: {top['point_count']} '{top['dominant_type']}' defects "
        f"concentrated in the {zone} region. "
        f"This pattern suggests a systematic production issue (e.g., stencil misalignment, "
        f"thermal profile, or fixture positioning) rather than random variation."
    )


def _normalised_to_zone(x, y):
    col = "left" if x < 0.33 else ("right" if x > 0.66 else "centre")
    row = "top"  if y < 0.33 else ("bottom" if y > 0.66 else "middle")
    return f"{row}-{col}"


# ─── Feature 3: SPC Control Chart Data ──────────────────────────────────────
@router.get("/spc-data")
def spc_data():
    """
    Return daily defect rate with SPC control limits.
    Uses ±3σ (3-sigma) Shewhart control chart limits.
    Also detects Western Electric rules violations (process out of control).
    """
    import json
    from collections import defaultdict

    scans = get_all_scans()
    if not scans:
        return {"points": [], "mean": 0, "UCL": 0, "LCL": 0, "violations": []}

    # Group by date
    daily_total  = defaultdict(int)
    daily_faulty = defaultdict(int)

    for s in scans:
        date = str(s.get("timestamp", ""))[:10]
        if not date or date == "None":
            continue
        daily_total[date]  += 1
        if s.get("board_status") == "FAULTY":
            daily_faulty[date] += 1

    if not daily_total:
        return {"points": [], "mean": 0, "UCL": 0, "LCL": 0, "violations": []}

    dates  = sorted(daily_total.keys())
    rates  = []
    points = []

    for d in dates:
        total  = daily_total[d]
        faulty = daily_faulty[d]
        rate   = round(faulty / total * 100, 2) if total > 0 else 0
        rates.append(rate)
        points.append({
            "date":        d,
            "rate":        rate,
            "total_boards": total,
            "faulty_boards": faulty
        })

    # 3-sigma Shewhart control limits
    arr  = np.array(rates)
    mean = float(np.mean(arr))
    std  = float(np.std(arr))
    UCL  = round(min(100, mean + 3 * std), 2)
    LCL  = round(max(0,   mean - 3 * std), 2)

    # Detect violations
    violations = []
    for i, (pt, rate) in enumerate(zip(points, rates)):
        if rate > UCL:
            violations.append({
                "date": pt["date"],
                "rule": "Rule 1: Point above UCL",
                "rate": rate,
                "severity": "critical"
            })
        elif rate < LCL and LCL > 0:
            violations.append({
                "date": pt["date"],
                "rule": "Rule 1: Point below LCL",
                "rate": rate,
                "severity": "warning"
            })

    # Western Electric Rule 2: 8 consecutive points on same side of mean
    if len(rates) >= 8:
        for i in range(len(rates) - 7):
            window = rates[i:i+8]
            if all(r > mean for r in window) or all(r < mean for r in window):
                violations.append({
                    "date": dates[i + 7],
                    "rule": "Rule 2: 8 consecutive points on same side of mean (drift detected)",
                    "severity": "warning"
                })
                break

    # Trend rule: 6 consecutive increasing or decreasing points
    if len(rates) >= 6:
        for i in range(len(rates) - 5):
            window = rates[i:i+6]
            if all(window[j] < window[j+1] for j in range(5)):
                violations.append({
                    "date": dates[i + 5],
                    "rule": "Rule 3: 6 consecutive increasing points (upward trend)",
                    "severity": "warning"
                })
                break
            elif all(window[j] > window[j+1] for j in range(5)):
                violations.append({
                    "date": dates[i + 5],
                    "rule": "Rule 3: 6 consecutive decreasing points (improving trend)",
                    "severity": "info"
                })
                break

    return {
        "points":     points,
        "mean":       round(mean, 2),
        "UCL":        UCL,
        "LCL":        LCL,
        "std":        round(std, 2),
        "violations": violations,
        "process_stable": len([v for v in violations if v["severity"] != "info"]) == 0
    }


# ─── Feature 4: Anomaly Score (Tile-based Reconstruction) ───────────────────
@router.post("/anomaly-score")
async def anomaly_score(file: UploadFile = File(...)):
    """
    Compute a patch-based anomaly score for an uploaded PCB image.
    Uses MAD (Median Absolute Deviation) of local tile statistics
    as a proxy for autoencoder reconstruction error.
    Flags regions that deviate significantly from typical PCB texture.
    """
    import cv2

    img_bytes = await file.read()
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    h, w = img.shape[:2]
    img  = cv2.resize(img, (320, 240))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Split into 8×6 = 48 tiles
    tile_h, tile_w = gray.shape[0] // 6, gray.shape[1] // 8
    tile_stats = []
    anomaly_tiles = []

    for row in range(6):
        for col in range(8):
            y0, y1 = row * tile_h, (row + 1) * tile_h
            x0, x1 = col * tile_w, (col + 1) * tile_w
            tile = gray[y0:y1, x0:x1]

            # Feature: mean, std, entropy proxy (local range)
            mean_ = float(np.mean(tile))
            std_  = float(np.std(tile))
            rng   = float(np.max(tile) - np.min(tile))
            tile_stats.append([mean_, std_, rng])

    tile_arr = np.array(tile_stats)

    # MAD-based anomaly score per tile
    tile_medians = np.median(tile_arr, axis=0)
    tile_mads    = np.median(np.abs(tile_arr - tile_medians), axis=0)

    modified_z_scores = []
    for stat in tile_arr:
        z = np.abs(stat - tile_medians) / (tile_mads + 1e-6)
        modified_z_scores.append(float(np.max(z)))

    threshold = 3.5   # MAD z-score threshold for anomaly
    overall_score = float(np.mean(modified_z_scores))
    max_score     = float(np.max(modified_z_scores))

    for idx, (row, col) in enumerate(
        [(r, c) for r in range(6) for c in range(8)]
    ):
        z = modified_z_scores[idx]
        if z > threshold:
            cx = (col * tile_w + tile_w // 2) / w
            cy = (row * tile_h + tile_h // 2) / h
            anomaly_tiles.append({
                "row": row, "col": col,
                "centre_x": round(cx, 3),
                "centre_y": round(cy, 3),
                "anomaly_score": round(z, 2),
                "pixel_x": col * tile_w,
                "pixel_y": row * tile_h,
                "pixel_w": tile_w,
                "pixel_h": tile_h
            })

    # Overall board anomaly rating
    if max_score > 8:
        rating = "HIGH — Likely contains novel defect types"
    elif max_score > 5:
        rating = "MEDIUM — Unusual texture regions detected"
    elif max_score > 3.5:
        rating = "LOW — Minor anomalies, possibly false positives"
    else:
        rating = "NORMAL — Board texture consistent with healthy PCB"

    return {
        "overall_score":   round(overall_score, 3),
        "max_score":       round(max_score, 3),
        "anomaly_rating":  rating,
        "anomaly_tiles":   sorted(anomaly_tiles, key=lambda t: -t["anomaly_score"]),
        "total_tiles":     48,
        "anomalous_tiles": len(anomaly_tiles),
        "method":          "Patch-MAD (tile statistical deviation from board median)"
    }


# ─── Feature 5: Defect Trend Data for SPC + Forecasting ─────────────────────
@router.get("/trend-data")
def trend_data():
    """
    Returns weekly defect counts by type — used for trend charts.
    Also computes a simple linear forecast for next 4 weeks.
    """
    from collections import defaultdict

    scans = get_all_scans()
    weekly = defaultdict(lambda: defaultdict(int))

    for s in scans:
        ts = str(s.get("timestamp", ""))[:10]
        if not ts or ts == "None":
            continue
        try:
            from datetime import date, timedelta
            d = date.fromisoformat(ts)
            # ISO week
            week_key = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"
        except Exception:
            continue
        for defect in (s.get("defects") or []):
            dtype = defect.get("type", "Unknown")
            weekly[week_key][dtype] += 1

    weeks   = sorted(weekly.keys())
    series  = {}

    all_types = set()
    for w in weeks:
        all_types.update(weekly[w].keys())

    for dtype in all_types:
        series[dtype] = [weekly[w].get(dtype, 0) for w in weeks]

    # Linear forecast (last 4 weeks → next 2 weeks)
    forecast = {}
    if len(weeks) >= 4:
        for dtype, counts in series.items():
            last4 = np.array(counts[-4:], dtype=float)
            x = np.arange(4)
            if np.std(last4) > 0:
                slope = np.polyfit(x, last4, 1)[0]
            else:
                slope = 0
            next_val = max(0, counts[-1] + slope)
            forecast[dtype] = round(next_val, 1)

    return {
        "weeks":    weeks,
        "series":   series,
        "forecast": forecast,
        "all_types": sorted(all_types)
    }

# ─── Feature 6: Deep Learning Vision Toolkit ────────────────────────────────
@router.post("/dl-analysis")
async def dl_analysis(req: GeminiRequest):
    """
    Advanced DL Computer Vision Features via PyTorch:
    1. Explainable AI (ResNet Grad-CAM Attention)
    2. Deep Feature Embeddings (Siamese matching)
    3. Pixel-perfect defect segmentation (via GrabCut)
    """
    import cv2
    from models.dl_vision import generate_gradcam, get_deep_embeddings, segment_defects, TORCH_AVAILABLE
    
    # 1. Image
    if not req.image_b64 and req.scan_id:
        scan = get_scan_by_id(req.scan_id)
        image_b64 = scan.get("image") if scan else None
    else:
        image_b64 = req.image_b64
        
    if not image_b64:
        raise HTTPException(status_code=400, detail="Image required")
        
    try:
        img_bytes = base64.b64decode(image_b64.split(",")[1] if "," in image_b64 else image_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image")
        
    # Get boxes
    defect_list = req.defects or []
    if req.scan_id and not defect_list:
        scan = get_scan_by_id(req.scan_id)
        defect_list = scan.get("defects", []) if scan else []
        
    boxes = [d.get("box") for d in defect_list if "box" in d]
    
    # Run algorithms
    gradcam_img = generate_gradcam(img.copy())
    _, gc_buf = cv2.imencode(".jpg", gradcam_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    gc_b64 = base64.b64encode(gc_buf.tobytes()).decode("utf-8")
    
    segmented = segment_defects(img.copy(), boxes)
    embeddings = get_deep_embeddings(img.copy())
    
    return {
        "pytorch_active": TORCH_AVAILABLE,
        "gradcam_image": gc_b64,
        "segmented_polygons": segmented,
        "siamese_embeddings": embeddings,
        "message": "Pure Deep Learning pipeline executed successfully." if TORCH_AVAILABLE else "Simulation Mode active (PyTorch not found)."
    }

# ─── Feature 7: Depth Estimation, OCR, and MLOps ────────────────────────────
@router.post("/perception")
async def advanced_perception(req: GeminiRequest):
    """
    3D Depth topological mapping and Text OCR.
    """
    import cv2
    from models.perception import generate_pseudo_depth_map, extract_pcb_text
    
    # 1. Image
    if not req.image_b64 and req.scan_id:
        scan = get_scan_by_id(req.scan_id)
        image_b64 = scan.get("image") if scan else None
    else:
        image_b64 = req.image_b64
        
    if not image_b64:
        raise HTTPException(status_code=400, detail="Image required")
        
    try:
        img_bytes = base64.b64decode(image_b64.split(",")[1] if "," in image_b64 else image_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image")
        
    # Execute SFS Depth
    depth_b64 = generate_pseudo_depth_map(img.copy())
    
    # Execute OCR
    ocr_results = extract_pcb_text(img.copy())
    
    return {
        "depth_map": depth_b64,
        "ocr": ocr_results
    }
    
class HitlFeedback(BaseModel):
    scan_id: int
    defect_index: int
    is_false_positive: bool
    correct_class: Optional[str] = None
    
@router.post("/hitl-feedback")
def submit_hitl_feedback(feedback: HitlFeedback):
    """
    Human-in-the-Loop Active Learning.
    Saves user corrections to the training queue for next YOLO finetune.
    """
    queue_dir = "training_queue"
    os.makedirs(queue_dir, exist_ok=True)
    
    record = feedback.model_dump()
    uid = str(uuid.uuid4())[:8]
    
    with open(os.path.join(queue_dir, f"correction_{uid}.json"), "w") as f:
        json.dump(record, f, indent=4)
        
    return {"status": "success", "message": "Correction logged for next YOLO training epoch."}
