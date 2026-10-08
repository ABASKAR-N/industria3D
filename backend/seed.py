"""
seed.py — Seed INDUSTRIA 3D demo data directly via SQLAlchemy
Run: python seed.py  (from the backend/ directory)

This is an alternative to running schema.sql manually.
It creates the tables and inserts demo data.
All demo data is clearly labelled is_demo=True.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone, timedelta
from database import create_tables, SessionLocal, Component, Inspection, Defect


def seed():
    print("Creating tables...")
    create_tables()

    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Component).filter(Component.name == "PUMP-001").first():
            print("[INFO] Demo data already exists. Skipping seed.")
            return

        print("Seeding demo data...")

        # ─── Components ───────────────────────────────────────────
        components_data = [
            {"name": "PUMP-001", "type": "Centrifugal Pump",      "health_score": 72.0, "status": "warning",     "model_path": "/3d_models/pump.glb"},
            {"name": "COMP-002", "type": "Air Compressor",         "health_score": 85.5, "status": "operational", "model_path": None},
            {"name": "VALVE-003","type": "Pressure Relief Valve",  "health_score": 45.0, "status": "critical",    "model_path": None},
            {"name": "MOTOR-004","type": "Electric Motor",         "health_score": 91.2, "status": "operational", "model_path": None},
        ]
        comps = {}
        for cd in components_data:
            c = Component(**cd)
            db.add(c)
            db.flush()
            comps[cd["name"]] = c
        db.commit()

        now = datetime.now(timezone.utc)

        # ─── PUMP-001 Inspections (14-day degradation story) ──────
        pump = comps["PUMP-001"]
        pump_inspections = [
            {
                "days_ago": 14, "health_score": 95.0,
                "defects": [
                    {"type": "scratch", "confidence": 0.71, "severity": "low", "x": 0.30, "y": 0.50, "z": 1.00, "defect_size": 3.2, "description": "[DEMO] Minor surface scratch detected"},
                ],
            },
            {
                "days_ago": 10, "health_score": 88.0,
                "defects": [
                    {"type": "scratch",   "confidence": 0.75, "severity": "low",    "x": 0.30, "y": 0.50, "z": 1.00, "defect_size": 3.5, "description": "[DEMO] Surface scratch — slightly larger"},
                    {"type": "corrosion", "confidence": 0.68, "severity": "medium", "x": -0.50, "y": 0.20, "z": 0.80, "defect_size": 5.1, "description": "[DEMO] Early corrosion detected"},
                ],
            },
            {
                "days_ago": 6, "health_score": 80.0,
                "defects": [
                    {"type": "scratch",   "confidence": 0.78, "severity": "low",    "x": 0.30,  "y": 0.50,  "z": 1.00, "defect_size": 4.0, "description": "[DEMO] Scratch progressing"},
                    {"type": "corrosion", "confidence": 0.82, "severity": "medium", "x": -0.50, "y": 0.20,  "z": 0.80, "defect_size": 6.8, "description": "[DEMO] Corrosion spreading"},
                    {"type": "crack",     "confidence": 0.65, "severity": "high",   "x": 0.10,  "y": -0.30, "z": 1.20, "defect_size": 2.1, "description": "[DEMO] Small crack initiated"},
                ],
            },
            {
                "days_ago": 2, "health_score": 72.0,
                "defects": [
                    {"type": "scratch",        "confidence": 0.81, "severity": "medium", "x": 0.30,  "y": 0.50,  "z": 1.00, "defect_size": 5.2, "description": "[DEMO] Scratch deepening"},
                    {"type": "corrosion",      "confidence": 0.89, "severity": "high",   "x": -0.50, "y": 0.20,  "z": 0.80, "defect_size": 8.4, "description": "[DEMO] Significant corrosion — HIGH RISK"},
                    {"type": "crack",          "confidence": 0.94, "severity": "high",   "x": 0.10,  "y": -0.30, "z": 1.20, "defect_size": 4.7, "description": "[DEMO] Crack propagating — HIGH RISK"},
                    {"type": "surface_damage", "confidence": 0.72, "severity": "medium", "x": -0.20, "y": 0.80,  "z": 0.50, "defect_size": 6.0, "description": "[DEMO] Surface damage from vibration"},
                ],
            },
        ]

        for insp_data in pump_inspections:
            ts = now - timedelta(days=insp_data["days_ago"])
            insp = Inspection(
                component_id=pump.id,
                timestamp=ts,
                health_score=insp_data["health_score"],
                is_demo=True,
                notes="Demo inspection — automated seed",
            )
            db.add(insp)
            db.flush()
            for d in insp_data["defects"]:
                db.add(Defect(inspection_id=insp.id, is_demo=True, **d))

        # ─── COMP-002 ─────────────────────────────────────────────
        comp = comps["COMP-002"]
        for days, health, defects in [
            (5, 87.0, [{"type": "scratch", "confidence": 0.68, "severity": "low", "x": 0.6, "y": -0.4, "z": 0.9, "defect_size": 2.8, "description": "[DEMO] Minor surface scratch"}]),
            (1, 85.5, [{"type": "scratch", "confidence": 0.72, "severity": "low", "x": 0.6, "y": -0.4, "z": 0.9, "defect_size": 3.1, "description": "[DEMO] Scratch slightly larger"}]),
        ]:
            insp = Inspection(component_id=comp.id, timestamp=now - timedelta(days=days), health_score=health, is_demo=True, notes="Demo inspection — automated seed")
            db.add(insp)
            db.flush()
            for d in defects:
                db.add(Defect(inspection_id=insp.id, is_demo=True, **d))

        # ─── VALVE-003 ────────────────────────────────────────────
        valve = comps["VALVE-003"]
        for days, health, defects in [
            (7, 65.0, [
                {"type": "crack",     "confidence": 0.91, "severity": "high", "x": 0.0, "y": 0.0, "z": 1.0, "defect_size": 7.2, "description": "[DEMO] Critical structural crack"},
                {"type": "corrosion", "confidence": 0.85, "severity": "high", "x": 0.4, "y": 0.3, "z": 0.8, "defect_size": 9.5, "description": "[DEMO] Severe corrosion"},
            ]),
            (1, 45.0, [
                {"type": "crack",          "confidence": 0.96, "severity": "high",   "x": 0.0,  "y": 0.0,  "z": 1.0, "defect_size": 11.3, "description": "[DEMO] Crack critical — immediate action"},
                {"type": "corrosion",      "confidence": 0.91, "severity": "high",   "x": 0.4,  "y": 0.3,  "z": 0.8, "defect_size": 12.1, "description": "[DEMO] Severe corrosion spreading"},
                {"type": "surface_damage", "confidence": 0.88, "severity": "medium", "x": -0.3, "y": -0.5, "z": 0.6, "defect_size": 8.7,  "description": "[DEMO] Extensive surface damage"},
            ]),
        ]:
            insp = Inspection(component_id=valve.id, timestamp=now - timedelta(days=days), health_score=health, is_demo=True, notes="Demo inspection — automated seed")
            db.add(insp)
            db.flush()
            for d in defects:
                db.add(Defect(inspection_id=insp.id, is_demo=True, **d))

        db.commit()
        print("[OK] Demo data seeded successfully!")
        print("   Components: PUMP-001, COMP-002, VALVE-003, MOTOR-004")
        print("   All data labelled is_demo=True -- not real AI output.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
