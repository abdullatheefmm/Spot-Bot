from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import base64
import os
import uuid
import sys
import traceback
import cv2
import numpy as np
import urllib.request

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from models.detector import process_image
from database.db import save_scan

router = APIRouter()

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

BASE_URL = "http://localhost:8000"


def _b64_to_img(b64_str):
    """Convert base64 string back to numpy image."""
    if not b64_str:
        return None
    buf = base64.b64decode(b64_str)
    arr = np.frombuffer(buf, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def _save_images(stem, result):
    """Save original, annotated, heatmap images to disk and return their URLs."""
    urls = {}
    for key, suffix in [
        ("original_image",  ""),
        ("annotated_image", "_annotated"),
        ("heatmap_image",   "_heatmap"),
        ("blueprint_image", "_blueprint"),
        ("wireframe_image", "_wireframe"),
    ]:
        b64 = result.get(key)
        if not b64:
            urls[key.replace("_image", "_url")] = None
            continue
        img = _b64_to_img(b64)
        if img is None:
            urls[key.replace("_image", "_url")] = None
            continue
        fname = f"{stem}{suffix}.jpg"
        fpath = os.path.join(UPLOADS_DIR, fname)
        cv2.imwrite(fpath, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        urls[key.replace("_image", "_url")] = f"{BASE_URL}/uploads/{fname}"
    return urls


@router.post("/upload")
async def detect_from_upload(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")
    try:
        result = process_image(image_bytes)

        # Save all 3 images to disk and get URLs
        stem = uuid.uuid4().hex
        urls = _save_images(stem, result)

        # Save original bytes too
        orig_path = os.path.join(UPLOADS_DIR, f"{stem}.jpg")
        with open(orig_path, "wb") as f:
            f.write(image_bytes)

        scan_id = save_scan(
            image_path=orig_path,
            annotated_path=os.path.join(UPLOADS_DIR, f"{stem}_annotated.jpg"),
            heatmap_path=os.path.join(UPLOADS_DIR, f"{stem}_heatmap.jpg") if result.get("heatmap_image") else None,
            blueprint_path=os.path.join(UPLOADS_DIR, f"{stem}_blueprint.jpg") if result.get("blueprint_image") else None,
            wireframe_path=os.path.join(UPLOADS_DIR, f"{stem}_wireframe.jpg") if result.get("wireframe_image") else None,
            defects=result["defects"],
            defect_count=result["defect_count"],
            severity=result["severity"],
            board_status=result["board_status"],
            scan_type="upload"
        )

        # Add URLs to result (frontend can use URL OR base64)
        result.update(urls)
        result["scan_id"] = scan_id
        return JSONResponse(content=result)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")


@router.post("/camera")
async def detect_from_camera(payload: dict):
    try:
        b64_data = payload.get("image", "")
        if "," in b64_data:
            b64_data = b64_data.split(",")[1]
        image_bytes = base64.b64decode(b64_data)
        result = process_image(image_bytes)

        stem = uuid.uuid4().hex
        urls = _save_images(stem, result)

        orig_path = os.path.join(UPLOADS_DIR, f"{stem}.jpg")
        with open(orig_path, "wb") as f:
            f.write(image_bytes)

        scan_id = save_scan(
            image_path=orig_path,
            annotated_path=os.path.join(UPLOADS_DIR, f"{stem}_annotated.jpg"),
            heatmap_path=os.path.join(UPLOADS_DIR, f"{stem}_heatmap.jpg") if result.get("heatmap_image") else None,
            blueprint_path=os.path.join(UPLOADS_DIR, f"{stem}_blueprint.jpg") if result.get("blueprint_image") else None,
            wireframe_path=os.path.join(UPLOADS_DIR, f"{stem}_wireframe.jpg") if result.get("wireframe_image") else None,
            defects=result["defects"],
            defect_count=result["defect_count"],
            severity=result["severity"],
            board_status=result["board_status"],
            scan_type="camera"
        )

        result.update(urls)
        result["scan_id"] = scan_id
        return JSONResponse(content=result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")


@router.post("/url")
async def detect_from_url(payload: dict):
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    try:
        import re
        from urllib.parse import urljoin
        import requests
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            status = getattr(e.response, 'status_code', 'Unknown')
            raise HTTPException(status_code=400, detail=f"Failed to fetch from URL (HTTP {status}): {str(e)}")
            
        content_type = response.headers.get('Content-Type', '')
        image_bytes = response.content
            
        # If the user passed a webpage instead of an image file URL
        if 'text/html' in content_type:
            html = response.text
            # Extract og:image or twitter:image
            match = re.search(r'<meta\s+(?:property|name)=["\'](?:og|twitter):image["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
            
            if match:
                img_url = match.group(1)
                img_url = urljoin(url, img_url) # Handle relative URLs
                
                # Fetch the actual image
                try:
                    img_resp = requests.get(img_url, headers=headers, timeout=10)
                    img_resp.raise_for_status()
                    image_bytes = img_resp.content
                except Exception as img_e:
                    raise HTTPException(status_code=400, detail=f"Found image link but could not download it: {str(img_e)}")
            else:
                # Fallback to the first large image tag if no OG tags exist
                img_match = re.search(r'<img[^>]+src=["\']([^"\']+\.(?:jpg|jpeg|png|webp))["\']', html, re.IGNORECASE)
                if img_match:
                    img_url = urljoin(url, img_match.group(1))
                    try:
                        img_resp = requests.get(img_url, headers=headers, timeout=10)
                        img_resp.raise_for_status()
                        image_bytes = img_resp.content
                    except Exception as img_e:
                        raise ValueError(f"Found image link {img_url} but could not download it: {str(img_e)}")
                else:
                    raise ValueError("Provided URL is a webpage, and no main image could be found. Please provide a direct link to an image file (.jpg, .png).")
                
        result = process_image(image_bytes)

        stem = uuid.uuid4().hex
        urls = _save_images(stem, result)

        orig_path = os.path.join(UPLOADS_DIR, f"{stem}.jpg")
        with open(orig_path, "wb") as f:
            f.write(image_bytes)

        scan_id = save_scan(
            image_path=orig_path,
            annotated_path=os.path.join(UPLOADS_DIR, f"{stem}_annotated.jpg"),
            heatmap_path=os.path.join(UPLOADS_DIR, f"{stem}_heatmap.jpg") if result.get("heatmap_image") else None,
            blueprint_path=os.path.join(UPLOADS_DIR, f"{stem}_blueprint.jpg") if result.get("blueprint_image") else None,
            wireframe_path=os.path.join(UPLOADS_DIR, f"{stem}_wireframe.jpg") if result.get("wireframe_image") else None,
            defects=result["defects"],
            defect_count=result["defect_count"],
            severity=result["severity"],
            board_status=result["board_status"],
            scan_type="url"
        )

        result.update(urls)
        result["scan_id"] = scan_id
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {str(e)}")
