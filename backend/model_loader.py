"""
model_loader.py - Clean AI interface for INDUSTRIA 3D

This module provides a unified interface for defect detection.
- If YOLO weights exist at the configured path, they are loaded for real inference.
- If not, a DEMO mode with clearly labelled simulated detections is used.

To swap in a real trained model: just replace the weights file. No code changes needed.
"""

import os
import random
import logging
from typing import List, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)

# Supported defect classes — add new ones here without changing model architecture
DEFECT_CLASSES = ["crack", "corrosion", "scratch", "surface_damage"]

SEVERITY_MAP = {
    "crack": "high",
    "corrosion": "medium",
    "scratch": "low",
    "surface_damage": "medium",
}

_model = None
_demo_mode = True


def load_model(weights_path: str, force_demo: bool = False) -> bool:
    """
    Load YOLO model from weights_path.
    Returns True if real model loaded, False if demo mode.
    """
    global _model, _demo_mode

    if force_demo:
        logger.warning("DEMO MODE forced by configuration.")
        _demo_mode = True
        return False

    weights = Path(weights_path)
    if not weights.exists():
        logger.warning(
            f"YOLO weights not found at '{weights_path}'. "
            "Falling back to DEMO mode — detections will be simulated."
        )
        _demo_mode = True
        return False

    try:
        from ultralytics import YOLO
        _model = YOLO(str(weights))
        _demo_mode = False
        logger.info(f"YOLO model loaded from {weights_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to load YOLO model: {e}. Falling back to DEMO mode.")
        _demo_mode = True
        return False


def is_demo_mode() -> bool:
    return _demo_mode


def predict(image_path: str) -> Dict[str, Any]:
    """
    Run defect detection on an image.

    Returns:
        {
            "demo_mode": bool,
            "defects": [
                {
                    "type": str,
                    "confidence": float,
                    "bounding_box": [x1, y1, x2, y2],
                    "severity": str,
                    "defect_size_mm": float,
                    "description": str,
                    # Approximate 3D position for digital twin marker (normalized -1 to 1)
                    "x3d": float, "y3d": float, "z3d": float,
                }
            ]
        }
    """
    if _demo_mode:
        return _demo_predict(image_path)
    else:
        return _real_predict(image_path)


# ─── Real Inference ────────────────────────────────────────────────────────────

def _real_predict(image_path: str) -> Dict[str, Any]:
    """Run real YOLO inference."""
    import cv2
    import numpy as np

    try:
        results = _model.predict(image_path, conf=0.25, verbose=False)
        defects = []

        img = cv2.imread(image_path)
        h, w = img.shape[:2] if img is not None else (640, 640)

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue

            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # Map class id to name (use model class names if available)
                if hasattr(_model, "names") and cls_id in _model.names:
                    defect_type = _model.names[cls_id]
                else:
                    defect_type = DEFECT_CLASSES[cls_id % len(DEFECT_CLASSES)]

                size_px = ((x2 - x1) * (y2 - y1)) ** 0.5
                size_mm = round(size_px * 0.05, 1)  # rough pixel-to-mm

                severity = _severity_from_conf(conf, defect_type)

                # Approximate 3D position from 2D bbox center (normalized)
                cx = ((x1 + x2) / 2) / w
                cy = ((y1 + y2) / 2) / h
                x3d = round((cx - 0.5) * 2.0, 3)
                y3d = round((0.5 - cy) * 2.0, 3)
                z3d = round(random.uniform(0.8, 1.2), 3)

                defects.append({
                    "type": defect_type,
                    "confidence": round(conf, 3),
                    "bounding_box": [round(x1), round(y1), round(x2), round(y2)],
                    "image_width": w,
                    "image_height": h,
                    "severity": severity,
                    "defect_size_mm": size_mm,
                    "description": _description(defect_type, severity),
                    "x3d": x3d,
                    "y3d": y3d,
                    "z3d": z3d,
                })

        return {"demo_mode": False, "defects": defects}

    except Exception as e:
        logger.error(f"Real prediction failed: {e}. Falling back to demo.")
        return _demo_predict(image_path)


# ─── Demo / Fallback Mode ──────────────────────────────────────────────────────

def _demo_predict(image_path: str) -> Dict[str, Any]:
    """
    Simulated detection results for demonstration.
    Clearly labelled as DEMO — never misrepresented as real AI output.
    """
    random.seed(hash(image_path) % 10000)

    # Try to get actual image dimensions, fall back to defaults
    img_w, img_h = 640, 480
    try:
        import cv2
        img = cv2.imread(image_path)
        if img is not None:
            img_h, img_w = img.shape[:2]
    except Exception:
        pass

    num_defects = random.randint(1, 4)
    defects = []

    for _ in range(num_defects):
        defect_type = random.choice(DEFECT_CLASSES)
        conf = round(random.uniform(0.62, 0.97), 3)
        severity = _severity_from_conf(conf, defect_type)

        x1 = random.randint(int(img_w * 0.05), int(img_w * 0.55))
        y1 = random.randint(int(img_h * 0.05), int(img_h * 0.55))
        x2 = x1 + random.randint(int(img_w * 0.05), int(img_w * 0.22))
        y2 = y1 + random.randint(int(img_h * 0.05), int(img_h * 0.22))
        x2 = min(x2, img_w - 1)
        y2 = min(y2, img_h - 1)
        size_mm = round(random.uniform(2.0, 15.0), 1)

        x3d = round(random.uniform(-1.0, 1.0), 3)
        y3d = round(random.uniform(-0.8, 0.8), 3)
        z3d = round(random.uniform(0.5, 1.5), 3)

        defects.append({
            "type": defect_type,
            "confidence": conf,
            "bounding_box": [x1, y1, x2, y2],
            "image_width": img_w,
            "image_height": img_h,
            "severity": severity,
            "defect_size_mm": size_mm,
            "description": f"[DEMO] {_description(defect_type, severity)}",
            "x3d": x3d,
            "y3d": y3d,
            "z3d": z3d,
        })

    return {"demo_mode": True, "defects": defects}


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _severity_from_conf(conf: float, defect_type: str) -> str:
    base = SEVERITY_MAP.get(defect_type, "medium")
    if conf > 0.85:
        return "high" if base != "low" else "medium"
    elif conf > 0.65:
        return base
    else:
        return "low"


def _description(defect_type: str, severity: str) -> str:
    descriptions = {
        "crack": "Structural crack detected. Monitor for propagation.",
        "corrosion": "Surface corrosion indicating material degradation.",
        "scratch": "Surface scratch, monitor for depth increase.",
        "surface_damage": "General surface damage affecting structural integrity.",
    }
    return descriptions.get(defect_type, "Unclassified surface defect detected.")
