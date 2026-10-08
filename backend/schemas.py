"""
schemas.py - Pydantic schemas for request/response validation
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


# ─── Defect ───────────────────────────────────────────────────────────────────

class DefectBase(BaseModel):
    type: str
    confidence: float
    severity: str
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    section_name: Optional[str] = None
    bbox_3d: Optional[Dict[str, Any]] = None  # {center: [x,y,z], size: [dx,dy,dz]}
    defect_size: Optional[float] = None
    description: Optional[str] = None
    bounding_box: Optional[List[float]] = None   # [x1, y1, x2, y2] pixels
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    is_demo: bool = False


class DefectCreate(DefectBase):
    pass


class DefectOut(DefectBase):
    id: int
    inspection_id: int

    class Config:
        from_attributes = True


# ─── 3D Model ─────────────────────────────────────────────────────────────────

class Model3DOut(BaseModel):
    id: int
    component_id: int
    name: str
    file_path: str
    file_size: Optional[int] = None
    source: str
    image_count: int = 0
    is_active: bool = False
    section_bounds: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Inspection ───────────────────────────────────────────────────────────────

class InspectionOut(BaseModel):
    id: int
    component_id: int
    timestamp: datetime
    health_score: float
    image_path: Optional[str] = None
    model_path: Optional[str] = None
    is_demo: bool
    notes: Optional[str] = None
    defects: List[DefectOut] = []

    class Config:
        from_attributes = True


# ─── Component ────────────────────────────────────────────────────────────────

class ComponentBase(BaseModel):
    name: str
    type: str
    health_score: float = 100.0
    status: str = "operational"
    model_path: Optional[str] = None


class ComponentCreate(ComponentBase):
    pass


class ComponentOut(ComponentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ComponentDetail(ComponentOut):
    inspections: List[InspectionOut] = []
    models: List[Model3DOut] = []


# ─── Prediction & Maintenance ─────────────────────────────────────────────────

class PredictionPoint(BaseModel):
    date: str
    health_score: float
    risk_score: float
    risk_level: str
    recommendation: str
    is_forecast: bool = False


class SectionWearDetail(BaseModel):
    section_name: str
    wear_level: float       # percentage 0-100
    defect_count: int
    highest_severity: str
    bbox_3d: Optional[Dict[str, Any]] = None


class WhatIfRequest(BaseModel):
    load_factor: float = 1.0              # 0.5 to 2.0 (1.0 = 100% nominal)
    temperature_offset_c: float = 0.0     # -20.0 to 50.0 °C
    vibration_factor: float = 1.0         # 0.5 to 3.0
    cooler_efficiency_pct: float = 100.0  # 10.0 to 100.0%
    valve_lag_pct: float = 0.0            # 0.0 to 60.0%
    maintenance_delay_days: int = 0       # 0 to 45 days
    lubrication_quality: float = 1.0      # 0.2 to 1.0
    scenario_name: Optional[str] = "Custom Scenario"


class WhatIfComparisonPoint(BaseModel):
    date: str
    baseline_health: float
    simulated_health: float
    baseline_risk: float
    simulated_risk: float
    simulated_risk_level: str
    is_forecast: bool = True


class WhatIfSectionImpact(BaseModel):
    section_name: str
    baseline_wear: float
    simulated_wear: float
    wear_delta: float
    risk_status: str


class WhatIfResponse(BaseModel):
    component_id: int
    component_name: str
    scenario_name: str
    stress_multiplier: float
    # Baseline summary
    baseline_health: float
    baseline_rul_days: int
    baseline_failure_prob_pct: float
    baseline_risk_level: str
    # Simulated summary
    simulated_health_day7: float
    simulated_health_day14: float
    simulated_rul_days: int
    simulated_rul_hours: int
    simulated_failure_prob_pct: float
    simulated_risk_level: str
    simulated_action_priority: str
    # Deltas
    rul_delta_days: int
    failure_prob_delta_pct: float
    health_delta_pct: float
    # Trajectory comparison
    trajectory: List[WhatIfComparisonPoint]
    sections_impact: List[WhatIfSectionImpact]
    recommendations: List[str]
    operational_warnings: List[str]



class PredictiveMaintenanceResponse(BaseModel):
    component_id: int
    component_name: str
    current_health: float
    current_risk_level: str
    rul_days: int                   # Remaining Useful Life in days
    rul_operating_hours: int        # Estimated operating hours until maintenance
    failure_probability_pct: float  # Failure probability within 14 days
    critical_defects_count: int
    trend: str
    forecast: List[PredictionPoint]
    recommendation: str
    maintenance_window: str         # e.g. "Scheduled Window: 3-5 Days"
    action_priority: str            # "Urgent", "Medium", "Routine"
    sections_wear: List[SectionWearDetail] = []
    is_demo_data: bool = False


class PredictionResponse(BaseModel):
    component_id: int
    component_name: str
    current_health: float
    current_risk_level: str
    trend: str
    forecast: List[PredictionPoint]
    recommendation: str
    is_demo_data: bool = False


# ─── Upload ───────────────────────────────────────────────────────────────────

class ImageResult(BaseModel):
    """Per-image analysis result within a batch inspection."""
    filename: str
    image_path: str
    defects: List[DefectOut] = []
    defects_detected: int = 0
    health_score: float = 100.0


class UploadResponse(BaseModel):
    success: bool
    inspection_id: int
    component_name: str
    health_score: float
    defects_detected: int
    demo_mode: bool
    defects: List[DefectOut]
    images: List[ImageResult] = []
    message: str


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    database: str
    ai_model: str
    demo_mode: bool
    version: str = "1.0.0"
