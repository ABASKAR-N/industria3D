"""
camera_service.py - Real-time USB & Mobile Camera Streaming and Capture Service
Supports:
1. Direct USB cameras / Webcams via OpenCV index (0, 1, ...)
2. USB tethered mobile streams (DroidCam, IP Webcam, etc. via HTTP/RTSP URLs)
3. MJPEG live video streaming for browser display
4. High-resolution snapshot capture for inspection & 3D reconstruction
"""

import cv2
import time
import logging
from typing import Generator, Optional, Tuple, Dict, Any
from pathlib import Path

logger = logging.getLogger("industria3d.camera")


class CameraService:
    def __init__(self):
        self._current_source = None
        self._cap: Optional[cv2.VideoCapture] = None

    def get_available_devices(self) -> list:
        """Probe available local video capture indices (USB / webcams)."""
        devices = []
        for idx in range(4):
            try:
                cap = cv2.VideoCapture(idx)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        h, w = frame.shape[:2]
                        devices.append({
                            "id": str(idx),
                            "name": f"USB / Local Video Device #{idx} ({w}x{h})",
                            "width": w,
                            "height": h,
                            "is_usb": True,
                        })
                    cap.release()
            except Exception as e:
                logger.debug(f"Device index {idx} error: {e}")
        return devices

    def check_usb_mobile(self) -> Dict[str, Any]:
        """Check for connected USB mobile devices via Windows PnP."""
        import subprocess
        import json
        try:
            ps_script = (
                "Get-PnpDevice -Class Camera,WPD -Status OK -ErrorAction SilentlyContinue | "
                "Select-Object FriendlyName, Class, InstanceId | ConvertTo-Json"
            )
            res = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                capture_output=True,
                text=True,
                timeout=4,
            )
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                if isinstance(data, dict):
                    data = [data]

                phone = None
                for d in data:
                    name = (d.get("FriendlyName") or "").lower()
                    if any(k in name for k in ["realme", "android", "phone", "oppo", "samsung", "xiaomi", "pixel"]):
                        phone = d
                        break

                is_webcam_mode = False
                if phone:
                    is_webcam_mode = (phone.get("Class") == "Camera")

                return {
                    "connected": phone is not None,
                    "phone_name": phone.get("FriendlyName") if phone else None,
                    "class": phone.get("Class") if phone else None,
                    "is_webcam_mode": is_webcam_mode,
                    "devices": data,
                }
        except Exception as e:
            logger.debug(f"USB mobile check error: {e}")
        return {"connected": False, "is_webcam_mode": False, "devices": []}

    def capture_frame(self, source: str = "0") -> Tuple[bool, Optional[bytes], Optional[str]]:
        """
        Capture a single frame from USB device index or stream URL.
        Returns (success, jpeg_bytes, error_message).
        """
        src = int(source) if source.isdigit() else source
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            return False, None, f"Could not connect to camera source: {source}"

        # Warm up sensor with a couple of reads
        for _ in range(3):
            cap.read()

        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return False, None, "Failed to read image frame from camera device"

        success, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        if not success:
            return False, None, "JPEG compression failed"

        return True, buffer.tobytes(), None

    def generate_mjpeg_stream(self, source: str = "0", fps: int = 25) -> Generator[bytes, None, None]:
        """
        Stream MJPEG multipart chunks for live browser playback.
        """
        src = int(source) if source.isdigit() else source
        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            logger.error(f"Cannot open camera source: {source}")
            return

        interval = 1.0 / max(1, fps)
        try:
            while True:
                start_time = time.time()
                ret, frame = cap.read()
                if not ret or frame is None:
                    time.sleep(interval)
                    continue

                # Encode to JPEG
                ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ret:
                    continue

                frame_bytes = buffer.tobytes()
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )

                elapsed = time.time() - start_time
                if elapsed < interval:
                    time.sleep(interval - elapsed)
        finally:
            cap.release()


camera_service = CameraService()
