"""
database.py - SQLAlchemy models and session management
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    ForeignKey, Text, Boolean, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── ORM Models ───────────────────────────────────────────────────────────────

class Component(Base):
    __tablename__ = "components"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    type = Column(String(100), nullable=False)
    health_score = Column(Float, default=100.0)
    status = Column(String(50), default="operational")
    model_path = Column(String(255), nullable=True)  # path to GLB/GLTF currently active
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspections = relationship("Inspection", back_populates="component", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="component", cascade="all, delete-orphan")
    models = relationship("Model3D", back_populates="component", cascade="all, delete-orphan", order_by="desc(Model3D.created_at)")


class Model3D(Base):
    """
    Stores all 3D model versions, reconstructions, and CAD models created for each component.
    """
    __tablename__ = "models_3d"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    name = Column(String(200), nullable=False)
    file_path = Column(String(255), nullable=False)   # e.g. /3d_models/pump_scan_v2.glb
    file_size = Column(Integer, nullable=True)        # size in bytes
    source = Column(String(100), default="photogrammetry") # photogrammetry, kiri, manual_upload, synthetic
    image_count = Column(Integer, default=0)          # number of captured photos used
    is_active = Column(Boolean, default=False)
    section_bounds = Column(JSON, nullable=True)      # predefined component sections
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    component = relationship("Component", back_populates="models")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    health_score = Column(Float, nullable=False)
    image_path = Column(String(255), nullable=True)
    model_path = Column(String(255), nullable=True)
    is_demo = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    component = relationship("Component", back_populates="inspections")
    defects = relationship("Defect", back_populates="inspection", cascade="all, delete-orphan")


class Defect(Base):
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    type = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)
    severity = Column(String(50), nullable=False)  # low / medium / high / critical
    x = Column(Float, nullable=True)   # 3D position on digital twin
    y = Column(Float, nullable=True)
    z = Column(Float, nullable=True)
    section_name = Column(String(100), nullable=True) # e.g. Impeller Casing, Drive Shaft, Flange
    bbox_3d = Column(JSON, nullable=True)             # 3D bounding box coordinates: {center: [x,y,z], size: [dx,dy,dz]}
    defect_size = Column(Float, nullable=True)  # mm
    description = Column(Text, nullable=True)
    bounding_box = Column(JSON, nullable=True)   # 2D [x1, y1, x2, y2] in pixels
    image_width = Column(Integer, nullable=True)  # original image width
    image_height = Column(Integer, nullable=True) # original image height
    is_demo = Column(Boolean, default=False)

    inspection = relationship("Inspection", back_populates="defects")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    forecast_date = Column(DateTime(timezone=True), nullable=False)
    health_score = Column(Float, nullable=False)
    risk_score = Column(Float, nullable=False)
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    component = relationship("Component", back_populates="predictions")


# ─── DB Dependency ─────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
