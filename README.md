# INDUSTRIA 3D — AI-Powered Industrial Digital Twin Platform

> Predictive maintenance through mobile inspection → YOLO defect detection → 3D Digital Twin visualization.

![INDUSTRIA 3D](https://img.shields.io/badge/Version-1.0.0-38bdf8) ![License](https://img.shields.io/badge/License-MIT-22c55e) ![Demo Mode](https://img.shields.io/badge/Demo_Mode-Ready-eab308)

---

## Overview

**INDUSTRIA 3D** turns mobile inspection images of industrial components into an interactive 3D Digital Twin. It detects surface defects using YOLO, places them as 3D markers on the twin, tracks degradation history in PostgreSQL, and forecasts 7-day maintenance risk.

### Core Features
| Feature | Description |
|---|---|
| 🔷 **3D Digital Twin** | Interactive Three.js model with defect markers |
| 🤖 **YOLO Defect Detection** | Real AI or demo fallback mode |
| 📱 **Mobile Inspection** | Camera capture → Wi-Fi → FastAPI |
| 📊 **7-Day Forecast** | Trend-based health degradation prediction |
| 🗄️ **PostgreSQL History** | Full inspection + defect tracking |
| ⚠️ **Transparent Demo Mode** | All simulated data clearly labelled |

---

## Project Structure

```
INDUSTRIA 3D/
├── frontend/           # React + Vite + Tailwind + Three.js
│   └── src/
│       ├── components/ # DigitalTwinViewer, Sidebar, Charts, Header
│       └── pages/      # Dashboard, MobileInspect
├── backend/            # Python FastAPI
│   ├── main.py         # API routes
│   ├── model_loader.py # YOLO interface (swap weights here)
│   ├── prediction_engine.py # 7-day forecast
│   ├── database.py     # SQLAlchemy ORM
│   ├── schemas.py      # Pydantic models
│   ├── seed.py         # Demo data seed
│   └── config.py       # Settings
├── models/             # Put your YOLO weights here (best.pt)
├── uploads/            # Uploaded inspection images
├── 3d_models/          # GLB/GLTF files (pump.glb placeholder)
└── database/
    └── schema.sql      # PostgreSQL schema + seed SQL
```

---

## Prerequisites

- **Node.js** 18+ (`node --version`)
- **Python** 3.10+ (`python --version`)
- **PostgreSQL** 14+ running locally

---

## Setup — Windows Commands

### 1. PostgreSQL Setup

```powershell
# Open PostgreSQL shell (psql) or pgAdmin and run:
psql -U postgres

# Inside psql:
CREATE USER industria WITH PASSWORD 'industria123';
CREATE DATABASE industria_db OWNER industria;
GRANT ALL PRIVILEGES ON DATABASE industria_db TO industria;
\q
```

### 2. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Seed demo data (creates tables + inserts demo data)
python seed.py

# Start backend (stays running)
python main.py
```

Backend runs at: **http://localhost:8000**
API docs: **http://localhost:8000/docs**

### 3. Frontend Setup

```powershell
# Open a NEW terminal window
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

### 4. Mobile Inspection (same Wi-Fi)

1. Find your laptop IP: `ipconfig` → look for IPv4 Address (e.g. `192.168.1.10`)
2. On your phone browser, open: `http://192.168.1.10:5173/mobile`
3. Update `frontend/.env`:
   ```
   VITE_API_URL=http://192.168.1.10:8000
   ```
4. Restart the frontend dev server

---

## Environment Variables

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://industria:industria123@localhost:5432/industria_db
HOST=0.0.0.0
PORT=8000
YOLO_WEIGHTS_PATH=../models/best.pt
UPLOAD_DIR=../uploads
MODELS_DIR=../3d_models
FORCE_DEMO_MODE=False
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
```

---

## AI Model — Replacing YOLO Weights

1. Place your trained YOLO weights at `models/best.pt`
2. No code changes required — `model_loader.py` auto-detects the file
3. If missing, the app runs in **DEMO mode** with clearly labelled simulated detections

> **DEMO MODE**: All simulated detections are labelled `[DEMO]` in descriptions and `is_demo: true` in the database. They are never presented as real AI output.

---

## 3D Model — Replacing the GLB

1. Export your component GLB from KIRI Engine or any 3D tool
2. Place it in `3d_models/pump.glb` (or any filename)
3. Update the component's `model_path` in PostgreSQL:
   ```sql
   UPDATE components SET model_path = '/3d_models/your_model.glb' WHERE name = 'PUMP-001';
   ```
4. Or upload via API:
   ```
   POST /api/upload  (multipart: component_id, model_file)
   ```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server, DB, AI status |
| `GET` | `/api/components` | List all components |
| `GET` | `/api/components/{id}` | Component + inspections |
| `GET` | `/api/components/{id}/history` | Inspection history |
| `GET` | `/api/components/{id}/prediction` | 7-day forecast |
| `POST` | `/api/inspect` | Upload image → run detection |
| `POST` | `/api/upload` | Upload GLB/GLTF model |

### Sample API Responses

**GET /api/health**
```json
{
  "status": "ok",
  "database": "ok",
  "ai_model": "demo",
  "demo_mode": true,
  "version": "1.0.0"
}
```

**POST /api/inspect** (multipart: component_id, file)
```json
{
  "success": true,
  "inspection_id": 5,
  "component_name": "PUMP-001",
  "health_score": 72.4,
  "defects_detected": 3,
  "demo_mode": true,
  "defects": [
    {
      "id": 12,
      "inspection_id": 5,
      "type": "crack",
      "confidence": 0.94,
      "severity": "high",
      "x": 0.1, "y": -0.3, "z": 1.2,
      "defect_size": 4.7,
      "description": "[DEMO] Crack propagating",
      "is_demo": true
    }
  ],
  "message": "Inspection complete. 3 defect(s) detected. [DEMO — simulated detections]"
}
```

**GET /api/components/1/prediction**
```json
{
  "component_id": 1,
  "component_name": "PUMP-001",
  "current_health": 72.0,
  "current_risk_level": "MEDIUM",
  "trend": "degrading",
  "forecast": [
    {"date": "2026-10-08", "health_score": 72.0, "risk_score": 40.0, "risk_level": "MEDIUM", "is_forecast": false},
    {"date": "2026-10-09", "health_score": 71.1, "risk_score": 40.0, "risk_level": "MEDIUM", "is_forecast": true},
    ...
  ],
  "recommendation": "Schedule inspection within the next 7 days.",
  "is_demo_data": true
}
```

---

## Demo Flow (Hackathon)

1. Open dashboard → Select **PUMP-001**
2. See 3D pump model with **4 defect markers** (colour-coded by severity)
3. Click a red marker → defect detail panel opens
4. Bottom charts show **14-day degradation history** + **7-day forecast**
5. Open `/mobile` on phone → capture component photo → upload
6. New inspection appears on dashboard in real-time

---

## Risk Levels

| Health Score | Risk Level | Action |
|---|---|---|
| 80 – 100% | 🟢 LOW | Continue monitoring |
| 60 – 80%  | 🟡 MEDIUM | Schedule inspection within 7 days |
| 40 – 60%  | 🟠 HIGH | Inspect within 3 days |
| 0 – 40%   | 🔴 CRITICAL | Immediate maintenance required |

---

## Architecture Notes

- **No authentication** — MVP-only, add before production
- **No LSTM** — simple linear trend-based forecasting
- **3D positioning** — manually configured for MVP, architecture ready for automatic 2D→3D camera registration
- **Model swap** — replace `models/best.pt` with any YOLO-format weights file

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Backend won't start | Check PostgreSQL is running: `pg_isready` |
| No 3D model shows | Place `pump.glb` in `3d_models/` or use placeholder |
| Mobile can't connect | Check `VITE_API_URL` uses laptop's LAN IP, not localhost |
| YOLO import error | `pip install ultralytics` in virtual env |
| CORS error | Add mobile IP to `CORS_ORIGINS` in backend `.env` |
