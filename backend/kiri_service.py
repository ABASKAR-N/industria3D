"""
kiri_service.py - Integration with KIRI Engine 3D Photogrammetry API
Transforms real-time inspection photos into interactive 3D GLB Digital Twins.
"""

import io
import os
import zipfile
import logging
import asyncio
import threading
import time
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

import requests
from config import settings

logger = logging.getLogger("industria3d.kiri")

# Task status code definitions from official KIRI Engine documentation
KIRI_STATUS_MAP = {
    -1: "Uploading",
    0: "Processing",
    1: "Failed",
    2: "Successful",
    3: "Queuing",
    4: "Expired",
}

# Local in-memory task tracker
_active_tasks: Dict[str, Dict[str, Any]] = {}


def _get_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.KIRI_API_KEY.strip()}"
    }


def get_balance() -> Dict[str, Any]:
    """
    Check remaining account credits on KIRI Engine API.
    """
    url = f"{settings.KIRI_BASE_URL}/balance"
    try:
        resp = requests.get(url, headers=_get_headers(), timeout=10)
        data = resp.json()
        if resp.status_code == 200 and data.get("ok"):
            balance = data.get("data", {}).get("balance", 0)
            return {
                "success": True,
                "balance": balance,
                "api_key_valid": True,
                "raw": data,
            }
        else:
            return {
                "success": False,
                "balance": 0,
                "api_key_valid": False,
                "error": data.get("msg", "Unknown error"),
            }
    except Exception as e:
        logger.error(f"Failed to check KIRI balance: {e}")
        return {
            "success": False,
            "balance": 0,
            "api_key_valid": False,
            "error": str(e),
        }


def create_3d_scan_task(
    image_paths: List[Path],
    component_name: str,
    file_format: str = "glb",
    model_quality: int = 1,
    texture_quality: int = 1,
) -> Dict[str, Any]:
    """
    Upload real-time inspection images to KIRI Engine to start 3D reconstruction.
    Returns task information including serialize ID.
    """
    url = f"{settings.KIRI_BASE_URL}/photo/image"

    if not image_paths:
        raise ValueError("At least one image is required for 3D reconstruction.")

    files_to_send = []
    opened_files = []

    try:
        for idx, p in enumerate(image_paths):
            f = open(p, "rb")
            opened_files.append(f)
            mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
            files_to_send.append(("imagesFiles", (p.name, f, mime)))

        payload = {
            "fileFormat": file_format.upper(),
            "modelQuality": str(model_quality),
            "textureQuality": str(texture_quality),
            "isMask": "1",
            "textureSmoothing": "1",
        }

        logger.info(
            f"Submitting {len(image_paths)} images to KIRI Engine for {component_name}..."
        )
        resp = requests.post(
            url,
            headers=_get_headers(),
            data=payload,
            files=files_to_send,
            timeout=90,
        )

        data = resp.json()
        logger.info(f"KIRI Engine response ({resp.status_code}): {data}")

        if data.get("ok") and data.get("data"):
            serialize = data["data"].get("serialize")
            task_info = {
                "serialize": serialize,
                "component_name": component_name,
                "status_code": 3,  # Queuing
                "status_text": "Queuing",
                "image_count": len(image_paths),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "model_url": None,
                "local_glb_path": None,
                "error": None,
            }
            _active_tasks[serialize] = task_info
            return {"success": True, "task": task_info}
        else:
            err_msg = data.get("msg", f"HTTP {resp.status_code}")
            return {"success": False, "error": err_msg, "raw": data}

    except Exception as e:
        logger.error(f"KIRI upload error: {e}")
        return {"success": False, "error": str(e)}
    finally:
        for f in opened_files:
            try:
                f.close()
            except Exception:
                pass


def get_task_status(serialize: str) -> Dict[str, Any]:
    """
    Check the current processing status of a 3D reconstruction task.
    """
    url = f"{settings.KIRI_BASE_URL}/model/getStatus"
    try:
        resp = requests.get(
            url,
            headers=_get_headers(),
            params={"serialize": serialize},
            timeout=10,
        )
        data = resp.json()
        if data.get("ok") and data.get("data"):
            status_code = data["data"].get("status")
            status_text = KIRI_STATUS_MAP.get(status_code, f"Status {status_code}")

            if serialize in _active_tasks:
                _active_tasks[serialize]["status_code"] = status_code
                _active_tasks[serialize]["status_text"] = status_text

            return {
                "success": True,
                "serialize": serialize,
                "status_code": status_code,
                "status_text": status_text,
                "is_completed": status_code == 2,
                "is_failed": status_code in (1, 4),
            }
        else:
            return {
                "success": False,
                "serialize": serialize,
                "error": data.get("msg", "Failed to retrieve status"),
            }
    except Exception as e:
        return {"success": False, "serialize": serialize, "error": str(e)}


def download_and_save_glb(serialize: str, component_name: str) -> Dict[str, Any]:
    """
    Once status is Successful (2), obtain the download URL, download the zipped 3D model,
    extract the GLB file, and save it to the models directory.
    """
    url = f"{settings.KIRI_BASE_URL}/model/getModelZip"
    try:
        resp = requests.get(
            url,
            headers=_get_headers(),
            params={"serialize": serialize},
            timeout=15,
        )
        data = resp.json()
        if not (data.get("ok") and data.get("data")):
            return {"success": False, "error": data.get("msg", "Could not get download URL")}

        model_download_url = data["data"].get("modelUrl")
        if not model_download_url:
            return {"success": False, "error": "No modelUrl in response"}

        logger.info(f"Downloading completed 3D model from: {model_download_url}")
        zip_resp = requests.get(model_download_url, timeout=120)
        if zip_resp.status_code != 200:
            return {"success": False, "error": f"Failed to download zip (HTTP {zip_resp.status_code})"}

        # Extract .glb from the downloaded zip
        models_dir = Path(settings.MODELS_DIR)
        models_dir.mkdir(parents=True, exist_ok=True)

        clean_name = component_name.lower().replace("-", "_").replace(" ", "_")
        target_glb_filename = f"{clean_name}.glb"
        target_glb_path = models_dir / target_glb_filename

        extracted_glb = False
        with zipfile.ZipFile(io.BytesIO(zip_resp.content)) as z:
            for zip_item in z.namelist():
                if zip_item.lower().endswith(".glb"):
                    with open(target_glb_path, "wb") as out_f:
                        out_f.write(z.read(zip_item))
                    extracted_glb = True
                    logger.info(f"Extracted {zip_item} -> {target_glb_path}")
                    break

        if not extracted_glb:
            # If no .glb was found, look for any file or fallback to raw content
            for zip_item in z.namelist():
                if zip_item.lower().endswith((".gltf", ".obj")):
                    with open(models_dir / zip_item, "wb") as out_f:
                        out_f.write(z.read(zip_item))

            return {
                "success": False,
                "error": "Archive did not contain a .glb file. Downloaded other formats.",
            }

        relative_web_path = f"/3d_models/{target_glb_filename}"

        if serialize in _active_tasks:
            _active_tasks[serialize]["local_glb_path"] = relative_web_path
            _active_tasks[serialize]["status_text"] = "Downloaded & Ready"

        return {
            "success": True,
            "serialize": serialize,
            "local_path": str(target_glb_path),
            "web_path": relative_web_path,
        }

    except Exception as e:
        logger.error(f"Error downloading/saving KIRI model: {e}")
        return {"success": False, "error": str(e)}


def list_active_tasks() -> List[Dict[str, Any]]:
    """
    Return all tracked 3D reconstruction tasks.
    """
    return list(_active_tasks.values())


def get_single_task(serialize: str) -> Optional[Dict[str, Any]]:
    return _active_tasks.get(serialize)


def start_background_task_poller(serialize: str, component_id: int, component_name: str, db_factory):
    """
    Spawns a background thread that polls KIRI until complete, downloads the GLB,
    and updates the database component model_path automatically.
    """
    def _poll_worker():
        logger.info(f"Started background poller for task {serialize} ({component_name})")
        max_attempts = 120  # up to ~20 minutes
        attempt = 0

        while attempt < max_attempts:
            time.sleep(10)
            attempt += 1

            status_res = get_task_status(serialize)
            if not status_res.get("success"):
                continue

            status_code = status_res.get("status_code")
            logger.info(f"Task {serialize} status: {status_code} ({status_res.get('status_text')})")

            if status_code == 2:  # Successful!
                # Download model
                dl_res = download_and_save_glb(serialize, component_name)
                if dl_res.get("success"):
                    web_path = dl_res.get("web_path")
                    # Update database component
                    db = db_factory()
                    try:
                        from database import Component
                        comp = db.query(Component).filter(Component.id == component_id).first()
                        if comp:
                            comp.model_path = web_path
                            db.commit()
                            logger.info(f"Updated component {component_name} model_path to {web_path}")
                    except Exception as db_err:
                        logger.error(f"Database update failed after KIRI download: {db_err}")
                        db.rollback()
                    finally:
                        db.close()
                break

            elif status_code in (1, 4):  # Failed or Expired
                logger.warning(f"KIRI reconstruction task {serialize} failed with status {status_code}")
                if serialize in _active_tasks:
                    _active_tasks[serialize]["error"] = f"Generation failed: {status_res.get('status_text')}"
                break

    t = threading.Thread(target=_poll_worker, daemon=True)
    t.start()
    return t
