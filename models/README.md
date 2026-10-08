This directory is for YOLO model weights files.

Place your trained YOLO weights file here as:
  best.pt

The application will auto-detect it at startup.
If the file is missing, the app runs in DEMO mode (simulated detections).

Supported formats:
- YOLOv8 / YOLO11 .pt files trained on defect classes:
  crack, corrosion, scratch, surface_damage

To train your own model:
  pip install ultralytics
  yolo train data=your_data.yaml model=yolo11s.pt epochs=100
