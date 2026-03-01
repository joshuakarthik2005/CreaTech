"""
SQLAlchemy ORM models for FormKit Optimizer.
"""

from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, Float, String, Boolean, Date, DateTime, Text,
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from backend.database import Base
import enum
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class PourType(str, enum.Enum):
    WALL = "WALL"
    SLAB = "SLAB"
    COLUMN = "COLUMN"
    BEAM = "BEAM"
    SHEAR_WALL = "SHEAR_WALL"


class ComponentTypeEnum(str, enum.Enum):
    PANEL = "PANEL"
    FILLER = "FILLER"
    TIE_ROD = "TIE_ROD"
    TIE_CONE = "TIE_CONE"
    WALER = "WALER"
    PROP = "PROP"
    CLAMP = "CLAMP"
    WEDGE = "WEDGE"
    CORNER = "CORNER"
    ACCESSORY = "ACCESSORY"


class KitStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    CONFIRMED = "CONFIRMED"
    DEPLOYED = "DEPLOYED"
    STRIPPED = "STRIPPED"


# ── Project ──────────────────────────────────────────────────
class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_code = Column(String(50), unique=True, nullable=False)
    project_name = Column(String(200), nullable=False)
    location = Column(String(200), default="")
    sap_wbs_root = Column(String(50), default="")
    start_date = Column(Date, nullable=False)
    planned_end = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    pours = relationship("Pour", back_populates="project", cascade="all, delete-orphan")
    optimization_runs = relationship("OptimizationRun", back_populates="project", cascade="all, delete-orphan")


# ── Component (master data) ─────────────────────────────────
class ComponentMaster(Base):
    __tablename__ = "component_masters"
    id = Column(String, primary_key=True, default=gen_uuid)
    component_code = Column(String(50), unique=True, nullable=False)
    system_code = Column(String(50), nullable=False)
    component_type = Column(String(20), nullable=False)
    description = Column(String(300), nullable=False)
    width_mm = Column(Integer, nullable=True)
    height_mm = Column(Integer, nullable=True)
    weight_kg = Column(Float, default=0)
    unit_cost_buy = Column(Float, default=0)
    unit_cost_rent_per_day = Column(Float, default=0)
    loss_rate_per_cycle = Column(Float, default=0.002)
    damage_rate_per_cycle = Column(Float, default=0.005)
    rated_reuse_cycles = Column(Integer, default=300)


# ── Inventory ────────────────────────────────────────────────
class InventoryItem(Base):
    __tablename__ = "inventory"
    id = Column(String, primary_key=True, default=gen_uuid)
    component_id = Column(String, ForeignKey("component_masters.id"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    qty_available = Column(Integer, default=0)
    qty_deployed = Column(Integer, default=0)
    qty_under_repair = Column(Integer, default=0)
    avg_remaining_cycles = Column(Float, default=300)
    last_updated = Column(DateTime, default=datetime.utcnow)

    component = relationship("ComponentMaster")


# ── Pour ─────────────────────────────────────────────────────
class Pour(Base):
    __tablename__ = "pours"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    pour_code = Column(String(80), nullable=False)
    tower_code = Column(String(20), nullable=False)
    floor_number = Column(Integer, nullable=False)
    zone_code = Column(String(20), nullable=False)
    pour_type = Column(String(20), nullable=False)
    planned_date = Column(Date, nullable=False)
    actual_date = Column(Date, nullable=True)
    net_surface_area_m2 = Column(Float, nullable=False)
    concrete_grade = Column(String(20), default="M40")
    strip_cycle_hours = Column(Integer, default=12)
    assigned_system = Column(String(50), default="PERI_TRIO")
    status = Column(String(20), default="PLANNED")  # PLANNED, IN_PROGRESS, COMPLETED

    project = relationship("Project", back_populates="pours")
    kit = relationship("Kit", back_populates="pour", uselist=False, cascade="all, delete-orphan")


# ── Kit ──────────────────────────────────────────────────────
class Kit(Base):
    __tablename__ = "kits"
    id = Column(String, primary_key=True, default=gen_uuid)
    pour_id = Column(String, ForeignKey("pours.id"), nullable=False, unique=True)
    config_name = Column(String(100), default="")
    config_strategy = Column(String(50), default="MAX_LARGE")
    status = Column(String(20), default="PLANNED")
    total_panel_area_m2 = Column(Float, default=0)
    coverage_ratio = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    optimizer_score = Column(Float, nullable=True)
    planner_approved = Column(Boolean, default=False)
    explanation = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    pour = relationship("Pour", back_populates="kit")
    line_items = relationship("KitLineItem", back_populates="kit", cascade="all, delete-orphan")


# ── Kit Line Item ────────────────────────────────────────────
class KitLineItem(Base):
    __tablename__ = "kit_line_items"
    id = Column(String, primary_key=True, default=gen_uuid)
    kit_id = Column(String, ForeignKey("kits.id"), nullable=False)
    component_id = Column(String, ForeignKey("component_masters.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    source = Column(String(30), default="INVENTORY")  # INVENTORY, PROCURE, RENT, REUSE
    cost_contribution = Column(Float, default=0)

    kit = relationship("Kit", back_populates="line_items")
    component = relationship("ComponentMaster")


# ── Optimization Run ─────────────────────────────────────────
class OptimizationRun(Base):
    __tablename__ = "optimization_runs"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    status = Column(String(20), default="RUNNING")
    objective = Column(String(20), default="MIN_COST")
    objective_value = Column(Float, default=0)
    solve_time_seconds = Column(Float, default=0)
    optimality_gap = Column(Float, default=0)
    pours_optimized = Column(Integer, default=0)
    kits_generated = Column(Integer, default=0)
    procurement_actions = Column(Integer, default=0)
    cost_breakdown = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="optimization_runs")


# ── Procurement Plan ─────────────────────────────────────────
class ProcurementItem(Base):
    __tablename__ = "procurement_items"
    id = Column(String, primary_key=True, default=gen_uuid)
    run_id = Column(String, ForeignKey("optimization_runs.id"), nullable=False)
    component_id = Column(String, ForeignKey("component_masters.id"), nullable=False)
    action = Column(String(10), default="BUY")
    quantity = Column(Integer, default=0)
    needed_by = Column(Date, nullable=False)
    cost = Column(Float, default=0)
    justification = Column(Text, default="")

    component = relationship("ComponentMaster")


# ── Activity Log ─────────────────────────────────────────────
class ActivityLog(Base):
    __tablename__ = "activity_log"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    action = Column(String(50), nullable=False)
    description = Column(Text, default="")
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
