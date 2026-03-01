"""
Pydantic schemas for API request/response validation.
"""

from __future__ import annotations
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Project ──────────────────────────────────────────────────
class ProjectCreate(BaseModel):
    project_code: str
    project_name: str
    location: str = ""
    sap_wbs_root: str = ""
    start_date: date
    planned_end: date

class ProjectOut(BaseModel):
    id: str
    project_code: str
    project_name: str
    location: str
    start_date: date
    planned_end: date
    total_pours: int = 0
    total_floors: int = 0
    optimization_runs: int = 0
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


# ── Component ────────────────────────────────────────────────
class ComponentOut(BaseModel):
    id: str
    component_code: str
    system_code: str
    component_type: str
    description: str
    width_mm: int | None = None
    height_mm: int | None = None
    weight_kg: float
    unit_cost_buy: float
    unit_cost_rent_per_day: float
    loss_rate_per_cycle: float
    rated_reuse_cycles: int
    model_config = {"from_attributes": True}


# ── Pour ─────────────────────────────────────────────────────
class PourCreate(BaseModel):
    tower_code: str = "T1"
    floor_number: int
    zone_code: str
    pour_type: str                  # WALL | SLAB | COLUMN | BEAM | SHEAR_WALL
    planned_date: date
    net_surface_area_m2: float
    concrete_grade: str = "M40"
    strip_cycle_hours: int = 12
    assigned_system: str = "PERI_TRIO"

class PourOut(BaseModel):
    id: str
    pour_code: str
    tower_code: str
    floor_number: int
    zone_code: str
    pour_type: str
    planned_date: date
    actual_date: date | None = None
    net_surface_area_m2: float
    concrete_grade: str
    strip_cycle_hours: int
    assigned_system: str
    status: str
    kit_status: str | None = None
    kit_cost: float | None = None
    model_config = {"from_attributes": True}


# ── Kit ──────────────────────────────────────────────────────
class KitLineItemOut(BaseModel):
    id: str
    component_code: str = ""
    component_type: str = ""
    description: str = ""
    quantity: int
    source: str
    cost_contribution: float
    model_config = {"from_attributes": True}

class KitOut(BaseModel):
    id: str
    pour_id: str
    pour_code: str = ""
    config_name: str
    config_strategy: str
    status: str
    total_panel_area_m2: float
    coverage_ratio: float
    total_cost: float
    planner_approved: bool
    explanation: str
    line_items: list[KitLineItemOut] = []
    model_config = {"from_attributes": True}


# ── Inventory ────────────────────────────────────────────────
class InventoryAdjust(BaseModel):
    component_id: str
    qty_available: int
    qty_deployed: int = 0
    qty_under_repair: int = 0

class InventoryOut(BaseModel):
    id: str
    component_code: str = ""
    component_type: str = ""
    description: str = ""
    system_code: str = ""
    qty_available: int
    qty_deployed: int
    qty_under_repair: int
    qty_total: int = 0
    avg_remaining_cycles: float
    utilization_pct: float = 0
    model_config = {"from_attributes": True}


# ── Optimization ─────────────────────────────────────────────
class OptimizationRequest(BaseModel):
    project_id: str
    objective: str = "MIN_COST"
    max_solve_time_seconds: int = Field(60, ge=10, le=600)

class OptimizationRunOut(BaseModel):
    id: str
    project_id: str
    status: str
    objective: str
    objective_value: float
    solve_time_seconds: float
    optimality_gap: float
    pours_optimized: int
    kits_generated: int
    procurement_actions: int
    cost_breakdown: dict = {}
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


# ── Analytics ────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_pours: int = 0
    pours_completed: int = 0
    pours_planned: int = 0
    total_kits: int = 0
    total_cost: float = 0
    avg_coverage: float = 0
    avg_reuse_factor: float = 0
    total_components: int = 0
    inventory_utilization: float = 0
    optimization_runs: int = 0
    cost_savings_pct: float = 0
    schedule_adherence: float = 0

class CostTimeSeriesPoint(BaseModel):
    date: str
    cumulative_cost: float
    optimized_cost: float
    traditional_cost: float

class FloorCostPoint(BaseModel):
    floor: int
    wall_cost: float
    slab_cost: float
    total_cost: float
    reuse_pct: float

class ComponentUsagePoint(BaseModel):
    component: str
    used: int
    available: int
    utilization: float

class PourTimelinePoint(BaseModel):
    pour_code: str
    floor: int
    zone: str
    pour_type: str
    planned_date: str
    status: str
    cost: float | None = None

class ActivityLogOut(BaseModel):
    id: str
    action: str
    description: str
    created_at: datetime | None = None
    model_config = {"from_attributes": True}
