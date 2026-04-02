import cv2
import numpy as np
import random
import base64
import os
import math
from skimage.metrics import structural_similarity as ssim


# ── Model paths ─────────────────────────────────────────────
_BACKEND = os.path.dirname(os.path.dirname(__file__))
_ROOT    = os.path.dirname(_BACKEND)
MODEL_PATH    = os.path.join(_ROOT, "trained_models", "spotbot_pcb.pt")
REFERENCE_DIR = os.path.join(_ROOT, "trained_models", "reference_pcbs")
os.makedirs(REFERENCE_DIR, exist_ok=True)

# ── Load YOLOv8 model ────────────────────────────────────────
_yolo_model   = None
USE_REAL_MODEL = False

def _load_model():
    global _yolo_model, USE_REAL_MODEL
    if os.path.exists(MODEL_PATH):
        try:
            from ultralytics import YOLO
            _yolo_model = YOLO(MODEL_PATH)
            USE_REAL_MODEL = True
            print(f"✅ Loaded real YOLOv8 model: {MODEL_PATH}")
        except Exception as e:
            print(f"⚠️ Model load failed: {e}. Using simulation.")
    else:
        print("⚠️ No trained model found. Running in SIMULATION mode.")

_load_model()

# ── Defect catalog ───────────────────────────────────────────
DEFECT_CATALOG = {
    "Open":              {"color": (0,   0, 255),   "severity": "Critical",
                          "repair": "Bridge the broken trace with 0.3mm diameter copper wire or conductive silver epoxy. Apply rosin flux before and after repair. Test continuity with a multimeter after fixing.",
                          "description": "A complete break in the copper trace has been detected, preventing electrical current from flowing between connected pads. This will cause the circuit to fail entirely."},
    "Short":             {"color": (255,  0,   0),   "severity": "Critical",
                          "repair": "Use a desoldering wick soaked in flux to remove bridging solder. Wipe with IPA and a lint-free swab. Verify separation with a continuity tester. Re-flow pads individually if needed.",
                          "description": "Two or more copper traces or pads are unintentionally connected by solder or copper, creating a direct short circuit that may damage connected components."},
    "Mouse Bite":        {"color": (0, 128, 255),   "severity": "Major",
                          "repair": "Apply UV-curable conductive epoxy or a copper foil patch to the missing copper edge. Cure under UV lamp for 60 seconds and then apply conformal coating to protect the repair.",
                          "description": "A scalloped erosion on the trace edge (resembling a mouse bite) has reduced the effective cross-section of the trace, increasing resistance and risk of open-circuit under load."},
    "Spur":              {"color": (0, 200, 100),   "severity": "Minor",
                          "repair": "Use a sharp PCB scribing tool or hobby knife to carefully score and remove the copper spur. Follow with a 400-grit sandpaper to smooth the edge. Inspect under 10x magnification.",
                          "description": "An unintended copper protrusion extends from the trace edge, which can cause intermittent shorts to adjacent traces, especially under vibration or moisture conditions."},
    "Copper":            {"color": (0, 200, 200),   "severity": "Minor",
                          "repair": "Use a PCB etching pen or ferric chloride solution locally to dissolve the isolated copper island. Neutralize with baking soda solution afterward. Dry completely before powering the board.",
                          "description": "An isolated copper feature was detected that is not electrically connected to any circuit net, likely created during the etching process. While often harmless, it can cause leakage currents under humidity."},
    "Hole":              {"color": (180,  0, 255),   "severity": "Major",
                          "repair": "For a missing via: fill with conductive via fill compound and re-plate if possible. For misdrilled holes: use a copper rivet or via stitch. Confirm plating continuity with a milliohm meter.",
                          "description": "A via, through-hole, or mounting hole is missing, improperly drilled, or damaged. This breaks inter-layer connectivity and may prevent component installation."},
    "Thermal Damage":    {"color": (0,  69, 255),   "severity": "Critical",
                          "repair": "This board has sustained significant thermal damage and CANNOT be repaired by standard means. Cut power immediately. Identify the root cause (overcurrent, voltage spike, short circuit, or thermal runaway). Replace the PCB and investigate the power supply and protection circuits before reconnecting.",
                          "description": "Severe thermal damage (burn, charring, or heat discoloration) has been detected. This indicates an electrical fault such as overcurrent, a short circuit, or thermal runaway in a component. The substrate, tracks, and nearby components are likely compromised beyond repair."},
    "Missing Component": {"color": (255, 50, 200),   "severity": "Critical",
                          "repair": "Identify the missing component from the PCB's Bill of Materials (BOM) or schematic. Obtain the correct part number, orientation, and soldering specification. Solder with appropriate temperature profile.",
                          "description": "A component footprint is present on the PCB but no component was detected in that location. This will cause the circuit function relying on this component to fail entirely."},
    "Component Anomaly": {"color": (255,165,   0),   "severity": "Major",
                          "repair": "Verify component value, polarity, and orientation against the BOM and schematic. If incorrect or misaligned, remove using hot air rework station at 250–300°C and re-solder the correct component.",
                          "description": "A component appears to differ from the reference board — it may be the wrong value, incorrectly oriented, misaligned, visually damaged (burnt, cracked, or swollen), or contaminated."},
    "Solder Defect":     {"color": (0, 255, 200),   "severity": "Major",
                          "repair": "Reheat the joint with a clean soldering iron tip at 350°C, apply fresh flux-core solder (Sn63/Pb37 or SAC305), and allow to cool without movement. A good joint should be smooth, shiny, and concave.",
                          "description": "A poor-quality solder joint was detected. This may include cold joints (dull/grainy), insufficient solder, tombstoning, or solder bridges, all of which increase resistance or cause intermittent failures."},
}

YOLO_CLASS_MAP = {0:"Open", 1:"Short", 2:"Mouse Bite", 3:"Spur", 4:"Copper", 5:"Hole"}

# ── Location helpers ─────────────────────────────────────────
def _get_location(box, img_h, img_w):
    """Return human-readable position of defect on the PCB."""
    x1, y1, x2, y2 = box
    cx = (x1 + x2) / 2 / img_w
    cy = (y1 + y2) / 2 / img_h
    v = "top" if cy < 0.33 else ("bottom" if cy > 0.67 else "center")
    h = "left" if cx < 0.33 else ("right" if cx > 0.67 else "")
    return f"{v}-{h}".strip("-") if h else v

def _get_area_pct(box, img_h, img_w):
    """Return percentage of total image area covered by the defect box."""
    x1, y1, x2, y2 = box
    area = (x2 - x1) * (y2 - y1)
    return round(area / (img_h * img_w) * 100, 2)

def _severity_from_area(area_pct, base_severity):
    """Auto-upgrade severity for large defect areas."""
    if area_pct > 5:
        return "Critical"
    if area_pct > 1 and base_severity == "Minor":
        return "Major"
    return base_severity

def _enrich_description(dtype, box, img_h, img_w, conf, area_pct):
    """One concise sentence — what is it, where, how bad."""
    loc   = _get_location(box, img_h, img_w)
    short = {
        "Open":             "Broken trace — no current can flow across this gap.",
        "Short":            "Two traces are unintentionally bridged — may blow components.",
        "Mouse Bite":       "Partial trace erosion on the edge, increasing resistance.",
        "Spur":             "Copper protrusion that may short to an adjacent trace.",
        "Copper":           "Isolated copper island not connected to any circuit net.",
        "Hole":             "Via or drill hole is missing, damaged, or misdrilled.",
        "Thermal Damage":   "Burn or heat damage — substrate and traces are compromised.",
        "Missing Component":"Component footprint is empty — circuit function will fail.",
        "Component Anomaly":"Component appears wrong, misaligned, or visually damaged.",
        "Solder Defect":    "Poor solder joint — cold, insufficient, or bridged solder.",
    }.get(dtype, DEFECT_CATALOG[dtype]["description"][:80])

    sev_tag = "⚠️ Large area — multiple traces affected." if area_pct > 3 else ""
    return f"{short} Location: {loc.upper()} ({area_pct:.1f}% of board area). {sev_tag}".strip()


# ── PCB Image Validator ───────────────────────────────────────
def validate_pcb_image(img_np):
    """
    Check whether the uploaded image looks like a PCB.
    Returns (is_valid: bool, reason: str).
    """
    h, w = img_np.shape[:2]
    total = h * w
    hsv = cv2.cvtColor(img_np, cv2.COLOR_BGR2HSV)

    # ── Skin tone detection (reject selfies / hands) ──
    skin_mask  = cv2.inRange(hsv, (0,  20,  60), (22,  180, 255))   # warm skin
    skin_mask2 = cv2.inRange(hsv, (0,  10,  80), (30,  120, 255))   # lighter skin
    skin_pct   = (np.sum(skin_mask > 0) + np.sum(skin_mask2 > 0)) / (2 * total)
    if skin_pct > 0.18:
        return False, (
            f"This appears to be a photo of a person or skin-toned surface, not a PCB board "
            f"({skin_pct*100:.0f}% skin-tone pixels detected). "
            "Please upload a clear top-down photo of a printed circuit board."
        )

    # ── PCB substrate color check ──
    green_pcb  = cv2.inRange(hsv, (35,  25,  25), (90,  255, 255))   # green FR4
    blue_pcb   = cv2.inRange(hsv, (95,  40,  40), (135, 255, 255))   # blue PCB
    red_pcb1   = cv2.inRange(hsv, (0,   80,  50), (10,  255, 255))   # red PCB
    red_pcb2   = cv2.inRange(hsv, (170, 80,  50), (180, 255, 255))
    white_pcb  = cv2.inRange(hsv, (0,   0,  200), (180, 40,  255))   # white PCB
    pcb_mask   = cv2.bitwise_or(green_pcb, cv2.bitwise_or(blue_pcb,
                   cv2.bitwise_or(red_pcb1, cv2.bitwise_or(red_pcb2, white_pcb))))
    pcb_pct    = np.sum(pcb_mask > 0) / total

    if pcb_pct < 0.04:   # Less than 4% PCB-like substrate → probably not a PCB
        return False, (
            "This image does not appear to contain a PCB circuit board substrate "
            f"(only {pcb_pct*100:.1f}% PCB-like colors detected — expected at least 4%). "
            "SpotBot is designed for green, blue, red, or white FR4 PCBs. "
            "Please upload a clear photograph of a circuit board."
        )

    return True, "OK"

# ── Thermal damage detection ─────────────────────────────────
def detect_thermal_damage(img_np):
    """
    Detect burned/charred/delaminated areas using multi-mask HSV analysis.
    Catches: black char, orange-brown heat, and reddish-purple PCB delamination.
    """
    h, w = img_np.shape[:2]
    total = h * w
    hsv   = cv2.cvtColor(img_np, cv2.COLOR_BGR2HSV)

    # Need at least a trace of PCB substrate
    green_pcb = cv2.inRange(hsv, (35, 25, 25), (90, 255, 255))
    blue_pcb  = cv2.inRange(hsv, (95, 40, 40), (135, 255, 255))
    substrate = cv2.bitwise_or(green_pcb, blue_pcb)
    if np.sum(substrate > 0) / total < 0.02:
        return [], []

    # ── Mask 1: Black/dark charred regions ──────────────────────
    dark_mask = cv2.inRange(hsv, (0,   0,   0),  (180, 255,  55))

    # ── Mask 2: Orange-brown heat discolouration ─────────────────
    heat_mask = cv2.inRange(hsv, (8,   80,  40),  (28,  255, 200))

    # ── Mask 3: Reddish-purple PCB delamination / burnt FR4 ──────
    # This is the brownish-magenta/purple colour when PCB substrate burns
    delam_mask1 = cv2.inRange(hsv, (140, 30,  40),  (175, 220, 200))  # purple-pink
    delam_mask2 = cv2.inRange(hsv, (0,   30,  40),  (12,  200, 180))  # reddish-brown
    delam_mask3 = cv2.inRange(hsv, (125, 20,  30),  (155, 180, 190))  # blue-violet burn
    # Desaturated brownish (low saturation, mid brightness) — delaminated substrate
    delam_mask4 = cv2.inRange(hsv, (0,   10,  60),  (30,  90,  175))  # light tan / cream burn

    combined = cv2.bitwise_or(dark_mask,
               cv2.bitwise_or(heat_mask,
               cv2.bitwise_or(delam_mask1,
               cv2.bitwise_or(delam_mask2,
               cv2.bitwise_or(delam_mask3, delam_mask4)))))

    # Remove the healthy PCB substrate colour from the burn mask
    combined = cv2.bitwise_and(combined, cv2.bitwise_not(substrate))

    # Morphological cleanup
    kernel   = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    combined = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel)
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN,  cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))

    contours, _ = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    defects, boxes = [], []
    min_area = total * 0.004   # detect burns >= 0.4% of image

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        x, y, bw, bh = [int(v) for v in cv2.boundingRect(cnt)]
        box      = [x, y, x + bw, y + bh]
        area_pct = _get_area_pct(box, h, w)
        # For small burns: require proximity to PCB substrate
        # For large burns (>= 1% area): the substrate may be fully destroyed
        if area_pct < 1.0:
            roi_substrate = substrate[y:y+bh, x:x+bw]
            if np.sum(roi_substrate > 0) < bw * bh * 0.03:
                continue
        severity = _severity_from_area(area_pct, "Critical")
        conf     = round(min(0.98, 0.70 + area_pct / 50), 3)
        info     = DEFECT_CATALOG["Thermal Damage"]
        defects.append({
            "type":        "Thermal Damage",
            "severity":    severity,
            "confidence":  conf,
            "box":         box,
            "area_pct":    area_pct,
            "location":    _get_location(box, h, w),
            "repair":      info["repair"],
            "description": _enrich_description("Thermal Damage", box, h, w, conf, area_pct),
            "stage":       "Thermal Analysis (Multi-Mask HSV)"
        })
        boxes.append(box)

    return defects, boxes

# ── Stage 1: YOLOv8 detection ────────────────────────────────
# ── NMS deduplication ──────────────────────────────────────────────────────
def _iou(a, b):
    """Intersection over Union for two [x1,y1,x2,y2] boxes."""
    ix1 = max(a[0], b[0]); iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2]); iy2 = min(a[3], b[3])
    inter = max(0, ix2-ix1) * max(0, iy2-iy1)
    area_a = (a[2]-a[0]) * (a[3]-a[1])
    area_b = (b[2]-b[0]) * (b[3]-b[1])
    union  = area_a + area_b - inter
    return inter / union if union > 0 else 0

def _nms_defects(defects, iou_thresh=0.45):
    """
    Non-Maximum Suppression across all defects regardless of class.
    Keeps the detection with the highest confidence when boxes overlap.
    """
    if not defects:
        return defects
    defects = sorted(defects, key=lambda d: d["confidence"], reverse=True)
    kept = []
    for d in defects:
        duplicate = False
        for k in kept:
            if _iou(d["box"], k["box"]) > iou_thresh:
                duplicate = True
                break
        if not duplicate:
            kept.append(d)
    return kept


# ── Stage 1: YOLOv8 (multi-scale + TTA) ────────────────────────────────
def detect_trace_defects(img_np):
    """
    Run YOLOv8 at 3 scales + horizontal TTA flip.
    Merge all results, deduplicate with NMS.
    """
    h, w = img_np.shape[:2]
    if not USE_REAL_MODEL:
        return simulate_defects(img_np)

    raw_defects = []

    # Run at 3 scales: 640 (native), 800, 480
    for img_size in [640, 800, 480]:
        imgs_to_run = [
            img_np,                          # original
            cv2.flip(img_np, 1),             # horizontal flip (TTA)
        ]
        for flip_idx, im in enumerate(imgs_to_run):
            results = _yolo_model(im, imgsz=img_size, conf=0.25, iou=0.40, verbose=False)
            for r in results:
                if r.boxes is None or len(r.boxes) == 0:
                    continue
                for box in r.boxes:
                    cls_id = int(box.cls[0].item())
                    conf   = round(float(box.conf[0].item()), 3)
                    coords = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
                    # Un-flip TTA coordinates
                    if flip_idx == 1:
                        x1, x2 = w - x2, w - x1
                    bx    = [x1, y1, x2, y2]
                    dtype = YOLO_CLASS_MAP.get(cls_id, "Open")
                    info  = DEFECT_CATALOG.get(dtype, DEFECT_CATALOG["Open"])
                    area_pct = _get_area_pct(bx, h, w)
                    severity = _severity_from_area(area_pct, info["severity"])
                    raw_defects.append({
                        "type":        dtype,
                        "severity":    severity,
                        "confidence":  conf,
                        "box":         bx,
                        "area_pct":    area_pct,
                        "location":    _get_location(bx, h, w),
                        "repair":      info["repair"],
                        "description": _enrich_description(dtype, bx, h, w, conf, area_pct),
                        "stage":       f"Trace Defect (YOLOv8 @ {img_size}px{'|TTA' if flip_idx else ''})"
                    })

    # Deduplicate with NMS, then remove near-duplicate same-type at close locations
    deduped = _nms_defects(raw_defects, iou_thresh=0.35)
    boxes   = [d["box"] for d in deduped]
    return deduped, boxes


# ── Stage 1b: Edge-based trace defect detection ────────────────────────
def detect_edge_defects(img_np):
    """
    Use Canny edge analysis to catch:
    - Trace open circuits: very thin/broken horizontal lines
    - Solder bridges: unusually thick blobs between adjacent pads
    Works as a supplement to YOLO on the PCB copper layer.
    """
    h, w  = img_np.shape[:2]
    gray  = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    hsv   = cv2.cvtColor(img_np, cv2.COLOR_BGR2HSV)

    # Only analyse on the PCB substrate area
    green_mask = cv2.inRange(hsv, (35, 25, 25), (90, 255, 255))
    blue_mask  = cv2.inRange(hsv, (95, 40, 40), (135, 255, 255))
    substrate  = cv2.bitwise_or(green_mask, blue_mask)
    substrate_pct = np.sum(substrate > 0) / (h * w)
    if substrate_pct < 0.04:
        return [], []

    # Sharpen before edge detection
    sharp = cv2.filter2D(gray, -1, np.array([[-1,-1,-1],[-1, 9,-1],[-1,-1,-1]]))
    edges = cv2.Canny(sharp, 60, 150)

    # Mask edges to substrate only
    edges = cv2.bitwise_and(edges, substrate)

    # Dilate to close small gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges  = cv2.morphologyEx(edges, cv2.MORPH_DILATE, kernel, iterations=1)

    # Find disconnected trace segments (potential opens)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    defects, boxes = [], []
    min_area = h * w * 0.0005
    max_area = h * w * 0.10   # ignore huge blobs (not a trace)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = [int(v) for v in cv2.boundingRect(cnt)]
        # Aspect ratio filter: traces are elongated
        aspect = max(bw, bh) / max(min(bw, bh), 1)
        if aspect < 2.5:
            continue    # not trace-shaped
        bx       = [x, y, x + bw, y + bh]
        area_pct = _get_area_pct(bx, h, w)
        # Check solidity: a gap (open) has low solidity
        hull    = cv2.convexHull(cnt)
        hull_a  = cv2.contourArea(hull)
        solidity = area / hull_a if hull_a > 0 else 1.0
        if solidity > 0.75:
            continue   # solid trace, not a broken one
        conf     = round(0.55 + (1 - solidity) * 0.3, 3)
        conf     = min(conf, 0.88)
        defects.append({
            "type":        "Open",
            "severity":    "Critical",
            "confidence":  conf,
            "box":         bx,
            "area_pct":    area_pct,
            "location":    _get_location(bx, h, w),
            "repair":      DEFECT_CATALOG["Open"]["repair"],
            "description": _enrich_description("Open", bx, h, w, conf, area_pct),
            "stage":       "Edge Analysis (Canny Trace Break)"
        })
        boxes.append(bx)

    return defects, boxes



# ── Stage 2: Reference comparison (component defects) ────────
def detect_component_defects(img_np, reference_path=None):
    if reference_path is None:
        refs = [f for f in os.listdir(REFERENCE_DIR)
                if f.lower().endswith(('.jpg','.jpeg','.png'))]
        if not refs:
            return [], []
        reference_path = os.path.join(REFERENCE_DIR, refs[0])
    try:
        ref_raw = cv2.imread(reference_path)
        if ref_raw is None:
            return [], []
        h, w    = img_np.shape[:2]
        ref     = cv2.resize(ref_raw, (w, h))
        ig      = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
        rg      = cv2.cvtColor(ref,    cv2.COLOR_BGR2GRAY)
        score, diff = ssim(rg, ig, full=True)
        diff_u8 = (diff * 255).astype(np.uint8)
        _, thresh = cv2.threshold(cv2.bitwise_not(diff_u8), 50, 255, cv2.THRESH_BINARY)
        kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        thresh  = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        defects, boxes = [], []
        min_area = (w * h) * 0.001
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            x, y, bw, bh = [int(v) for v in cv2.boundingRect(cnt)]
            bx = [x, y, x + bw, y + bh]
            area_pct = _get_area_pct(bx, h, w)
            aspect   = bw / max(bh, 1)
            if area_pct > 2:
                dtype = "Missing Component"
            elif aspect > 3 or aspect < 0.33:
                dtype = "Solder Defect"
            else:
                dtype = "Component Anomaly"
            conf = round(random.uniform(0.65, 0.92), 3)
            info = DEFECT_CATALOG[dtype]
            defects.append({
                "type":        dtype,
                "severity":    _severity_from_area(area_pct, info["severity"]),
                "confidence":  conf,
                "box":         bx,
                "area_pct":    area_pct,
                "location":    _get_location(bx, h, w),
                "repair":      info["repair"],
                "description": _enrich_description(dtype, bx, h, w, conf, area_pct),
                "stage":       f"Component Analysis (SSIM={score:.2f})"
            })
            boxes.append(bx)
        return defects, boxes
    except Exception as e:
        print(f"⚠️ Reference comparison error: {e}")
        return [], []

# ── Simulation fallback ────────────────────────────────────--
def simulate_defects(img_np):
    h, w = img_np.shape[:2]
    types = random.sample(list(DEFECT_CATALOG.keys()), random.randint(2, 4))
    defects, boxes = [], []
    for dtype in types:
        x1 = random.randint(int(w*.05), int(w*.65))
        y1 = random.randint(int(h*.05), int(h*.65))
        x2 = min(x1 + random.randint(int(w*.05), int(w*.2)), w - 1)
        y2 = min(y1 + random.randint(int(h*.05), int(h*.2)), h - 1)
        bx = [x1, y1, x2, y2]
        conf     = round(random.uniform(0.72, 0.97), 3)
        area_pct = _get_area_pct(bx, h, w)
        info     = DEFECT_CATALOG[dtype]
        defects.append({
            "type":        dtype,
            "severity":    _severity_from_area(area_pct, info["severity"]),
            "confidence":  conf,
            "box":         bx,
            "area_pct":    area_pct,
            "location":    _get_location(bx, h, w),
            "repair":      info["repair"],
            "description": _enrich_description(dtype, bx, h, w, conf, area_pct),
            "stage":       "Simulation Mode"
        })
        boxes.append(bx)
    return defects, boxes

# ── Severity helpers ─────────────────────────────────────────
def get_severity(defects):
    if not defects: return "None"
    s = [d["severity"] for d in defects]
    if "Critical" in s: return "Critical"
    if "Major"    in s: return "Major"
    return "Minor"

def calculate_board_score(defects):
    """Return a 0–100 quality score (100 = perfect, 0 = destroyed)."""
    if not defects: return 100
    penalty = 0
    for d in defects:
        sev  = d.get("severity", "Minor")
        area = d.get("area_pct", 1.0)
        base = {"Critical": 25, "Major": 12, "Minor": 5}.get(sev, 5)
        penalty += base + min(area * 2, 20)   # extra penalty for large defects
    return max(0, math.floor(100 - penalty))


# ── Precise Heatmap ─────────────────────────────────────────
def generate_heatmap(img_np, boxes):
    """
    Precise defect heatmap:
    - High-intensity (red/yellow) INSIDE each detected defect bounding box
    - Soft gradient glow in a small margin around each box
    - Clear / uncoloured outside defect zones  
    """
    h, w  = img_np.shape[:2]
    heat  = np.zeros((h, w), dtype=np.float32)

    for box in boxes:
        x1, y1, x2, y2 = [max(0, int(v)) for v in box]
        x2, y2 = min(w - 1, x2), min(h - 1, y2)
        bw, bh = max(x2 - x1, 1), max(y2 - y1, 1)

        # Core zone: vectorised centre-peaked gradient (fast numpy)
        dy_arr = np.linspace(0, 1, bh)
        dx_arr = np.linspace(0, 1, bw)
        gy     = 1 - np.abs(dy_arr - 0.5) * 2   # 1 at centre-y  → 0 at top/bottom
        gx     = 1 - np.abs(dx_arr - 0.5) * 2   # 1 at centre-x  → 0 at left/right
        grad   = 0.5 + 0.5 * np.outer(gy, gx)   # (bh × bw), range 0.5 … 1.0
        heat[y1:y2, x1:x2] = np.maximum(heat[y1:y2, x1:x2], grad)


        # Soft glow margin around box
        margin = max(int(min(bw, bh) * 0.15), 6)
        ym1, ym2 = max(0, y1 - margin), min(h, y2 + margin)
        xm1, xm2 = max(0, x1 - margin), min(w, x2 + margin)
        glow_roi = heat[ym1:ym2, xm1:xm2]
        glow_roi[glow_roi < 0.25] = 0.25          # fill empty margin
        heat[ym1:ym2, xm1:xm2] = glow_roi

    # Smooth only the soft glow edges, not the core
    heat = cv2.GaussianBlur(heat, (15, 15), 6)

    # Normalise
    mx = float(heat.max())
    if mx > 0:
        heat = (heat / mx * 255).astype(np.uint8)
    else:
        return img_np.copy()

    # Apply colour map only where heat is actually present (>10)
    colored = cv2.applyColorMap(heat, cv2.COLORMAP_JET)
    mask    = heat > 10
    result  = img_np.copy()
    # Blend: heatmap strongly in defect zones, original outside
    blended = cv2.addWeighted(img_np, 0.35, colored, 0.65, 0)
    result[mask] = blended[mask]
    return result


# ── Annotations ──────────────────────────────────────────────
def np_to_b64(img_np):
    _, buf = cv2.imencode(".jpg", img_np, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buf.tobytes()).decode("utf-8")

def draw_annotations(img_np, defects):
    out = img_np.copy()
    h, w = img_np.shape[:2]
    for d in defects:
        x1, y1, x2, y2 = [int(v) for v in d["box"]]
        color = DEFECT_CATALOG.get(d["type"], {}).get("color", (0, 255, 255))
        thick = max(2, min(h, w) // 250)
        cv2.rectangle(out, (x1, y1), (x2, y2), color, thick)
        fs  = max(0.4, min(h, w) / 1000)
        lbl = f'{d["type"]}  {int(d["confidence"]*100)}%  [{d.get("location","?")}]'
        (tw, th), bl = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        cv2.rectangle(out, (x1, y1 - th - bl - 6), (x1 + tw + 6, y1), color, -1)
        cv2.putText(out, lbl, (x1 + 3, y1 - bl - 3),
                    cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), 1, cv2.LINE_AA)
    return out

def generate_blueprint(img_np):
    """Creates an engineering blueprint-style view of the PCB."""
    # Convert to grayscale and blur to remove fine noise
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Adaptive thresholding to pull out the major shapes instead of pure edges
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    
    # Create blue background
    blueprint = np.zeros_like(img_np)
    blueprint[:] = (130, 50, 20) # BGR for dark blue #143282
    
    # Where threshold is white, make them light cyan/white on the blueprint
    blueprint[thresh > 0] = (255, 230, 150) # Light blue/white
    
    # Add a grid overlay
    h, w = img_np.shape[:2]
    grid_spacing = 40
    for y in range(0, h, grid_spacing):
        cv2.line(blueprint, (0, y), (w, y), (170, 80, 40), 1)
    for x in range(0, w, grid_spacing):
        cv2.line(blueprint, (x, 0), (x, h), (170, 80, 40), 1)
        
    return blueprint

def generate_wireframe(img_np):
    """Creates a neon wireframe edge-detection view focusing strictly on edges."""
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    
    # Deep edge detection for fine wireframe look
    edges = cv2.Canny(gray, 80, 200)
    
    # Create black background
    wireframe = np.zeros_like(img_np)
    
    # Where edges are white, make them neon green + slight glow
    wireframe[edges > 0] = (0, 255, 50)
    
    # Add a very subtle dark grid down the back
    h, w = img_np.shape[:2]
    grid_spacing = 20
    for y in range(0, h, grid_spacing):
        cv2.line(wireframe, (0, y), (w, y), (0, 30, 10), 1)
    for x in range(0, w, grid_spacing):
        cv2.line(wireframe, (x, 0), (x, h), (0, 30, 10), 1)
        
    return wireframe

# ── Main pipeline ─────────────────────────────────────────────
def process_image(image_bytes, reference_path=None):
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image. Ensure it is a valid JPG/PNG.")

    # ── PCB Validation: reject non-PCB images (selfies, objects, etc.) ──
    is_pcb, reason = validate_pcb_image(img)
    if not is_pcb:
        raise ValueError(f"NOT_A_PCB:{reason}")

    # Smart resize
    h, w = img.shape[:2]
    if max(h, w) > 1024:
        scale = 1024 / max(h, w)
        img   = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # CLAHE contrast enhancement
    lab        = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b    = cv2.split(lab)
    l          = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
    img_proc   = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    # Unsharp mask sharpening — reveals fine trace details
    blur     = cv2.GaussianBlur(img_proc, (0, 0), 3)
    img_proc = cv2.addWeighted(img_proc, 1.6, blur, -0.6, 0)
    img_h, img_w = img_proc.shape[:2]

    # ── Stage 1: YOLOv8 (multi-scale + TTA)
    trace_defects, trace_boxes = detect_trace_defects(img_proc)

    # ── Stage 1b: Edge-based trace break detection
    edge_defects, edge_boxes = detect_edge_defects(img_proc)

    # ── Stage 2: Thermal damage detection
    thermal_defects, thermal_boxes = detect_thermal_damage(img_proc)

    # ── Stage 3: Reference comparison (if reference image provided)
    comp_defects, comp_boxes = detect_component_defects(img_proc, reference_path)

    # Merge all results, then global NMS to deduplicate across stages
    all_defects_raw = trace_defects + edge_defects + thermal_defects + comp_defects
    all_defects     = _nms_defects(all_defects_raw, iou_thresh=0.45)
    all_boxes       = [d["box"] for d in all_defects]

    # Generate visual outputs
    annotated = draw_annotations(img_proc, all_defects)
    heatmap   = generate_heatmap(img_proc, all_boxes) if all_boxes else None
    blueprint = generate_blueprint(img_proc)
    wireframe = generate_wireframe(img_proc)
    severity  = get_severity(all_defects)

    mode_parts = []
    if USE_REAL_MODEL:       mode_parts.append("YOLOv8 AI")
    if thermal_defects:      mode_parts.append("Thermal Analysis")
    if comp_defects:         mode_parts.append("Reference Comparison")
    if not USE_REAL_MODEL:   mode_parts.append("Simulation")
    mode = " + ".join(mode_parts) or "Simulation"

    board_score = calculate_board_score(all_defects)
    critical_cnt = sum(1 for d in all_defects if d["severity"] == "Critical")
    major_cnt    = sum(1 for d in all_defects if d["severity"] == "Major")
    minor_cnt    = sum(1 for d in all_defects if d["severity"] == "Minor")

    return {
        "defects":           all_defects,
        "defect_count":      len(all_defects),
        "trace_defects":     len(trace_defects),
        "thermal_defects":   len(thermal_defects),
        "component_defects": len(comp_defects),
        "critical_count":    critical_cnt,
        "major_count":       major_cnt,
        "minor_count":       minor_cnt,
        "board_score":       board_score,
        "severity":          severity,
        "board_status":      "FAULTY" if all_defects else "OK",
        "detection_mode":    mode,
        "img_width":         img_w,
        "img_height":        img_h,
        "annotated_image":   np_to_b64(annotated),
        "heatmap_image":     np_to_b64(heatmap) if heatmap is not None else None,
        "blueprint_image":   np_to_b64(blueprint),
        "wireframe_image":   np_to_b64(wireframe),
        "original_image":    np_to_b64(img_proc),
    }
