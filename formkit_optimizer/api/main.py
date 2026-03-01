"""
FormKit Optimizer — FastAPI Application
========================================

REST API for the FormKit Optimizer system.
Provides endpoints for:
- Project setup and data import
- Pour schedule management
- Kit generation and optimization
- Planner review and override
- Inventory tracking
- Back-test validation
"""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

app = FastAPI(
    title="FormKit Optimizer API",
    description="Formwork Kitting & BoQ Optimization System — L&T Internal",
    version="1.0.0",
)


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class PourTypeEnum(str, Enum):
    WALL = "WALL"
    SLAB = "SLAB"
    COLUMN = "COLUMN"
    BEAM = "BEAM"
    SHEAR_WALL = "SHEAR_WALL"


class KitStatusEnum(str, Enum):
    PLANNED = "PLANNED"
    CONFIRMED = "CONFIRMED"
    DEPLOYED = "DEPLOYED"
    STRIPPED = "STRIPPED"


class ProjectCreate(BaseModel):
    project_code: str = Field(..., example="PROJ-RES-T1-2026")
    project_name: str = Field(..., example="Serene Heights Tower 1")
    sap_wbs_root: str = Field(..., example="WBS-SH-T1")
    location: str = Field(..., example="Thane, Mumbai")
    start_date: date
    planned_end: date


class ProjectResponse(BaseModel):
    project_id: UUID
    project_code: str
    project_name: str
    total_pours: int = 0
    total_floors: int = 0
    optimization_runs: int = 0


class PourResponse(BaseModel):
    pour_id: UUID
    tower_code: str
    floor_number: int
    zone_code: str
    pour_type: PourTypeEnum
    planned_date: date
    net_surface_area_m2: float
    concrete_grade: str
    strip_cycle_hours: int
    status: str
    kit_status: Optional[str] = None
    assigned_system: Optional[str] = None


class KitResponse(BaseModel):
    kit_id: UUID
    pour_id: UUID
    kit_type: PourTypeEnum
    status: KitStatusEnum
    generation_method: str
    total_panel_area_m2: float
    coverage_ratio: float
    optimizer_score: Optional[float] = None
    planner_approved: bool
    components: list["KitLineItemResponse"]


class KitLineItemResponse(BaseModel):
    component_id: UUID
    component_type: str
    description: str
    quantity: int
    assignment_reason: str
    source: str  # "INVENTORY", "REUSE", "PROCURE", "RENT"
    reuse_cycle_number: Optional[int] = None
    cost_contribution: float


class OptimizationRequest(BaseModel):
    project_id: UUID
    window_start: date
    window_end: date
    objective: str = Field("MIN_COST", description="MIN_COST | MIN_RENTAL | MAX_REUSE")
    max_solve_time_seconds: int = Field(300, ge=10, le=1800)


class OptimizationResponse(BaseModel):
    run_id: UUID
    status: str
    objective_value: float
    solve_time_seconds: float
    optimality_gap: float
    pours_optimized: int
    kits_generated: int
    procurement_actions: int
    cost_breakdown: dict[str, float]


class OverrideRequest(BaseModel):
    kit_id: UUID
    action: str = Field(..., description="APPROVE | LOCK | REJECT")
    swap_component_id: Optional[UUID] = None
    swap_quantity: Optional[int] = None
    replacement_component_id: Optional[UUID] = None
    planner_notes: str = ""


class ScenarioComparisonResponse(BaseModel):
    scenarios: list["ScenarioResult"]


class ScenarioResult(BaseModel):
    scenario_name: str
    objective: str
    total_cost: float
    rental_percentage: float
    avg_reuse_factor: float
    procurement_qty: int
    kits: list[KitResponse]


class InventorySnapshotResponse(BaseModel):
    snapshot_date: date
    components: list["InventoryComponentResponse"]


class InventoryComponentResponse(BaseModel):
    component_id: UUID
    component_type: str
    system_code: str
    description: str
    qty_total: int
    qty_available: int
    qty_deployed: int
    qty_under_repair: int
    avg_remaining_cycles: float


class ScheduleImportRequest(BaseModel):
    project_id: UUID
    source_type: str = Field(..., description="P6_CSV | P6_XER | MSP_CSV")
    file_path: str


class ScheduleImportResponse(BaseModel):
    version_number: int
    pours_imported: int
    pours_changed: int
    pours_added: int
    pours_removed: int
    schedule_diff: list[str]  # human-readable change descriptions


class ValidationReportResponse(BaseModel):
    boq_reduction_pct: float
    reuse_improvement_pct: float
    idle_reduction_pct: float
    cost_savings_pct: float
    schedule_feasibility_pct: float
    overall_verdict: str
    detailed_report: str


# ============================================================
# API ENDPOINTS
# ============================================================

# --- Project Management ---

@app.post("/api/v1/projects", response_model=ProjectResponse, tags=["Projects"])
async def create_project(project: ProjectCreate):
    """Create a new project and initialize data structures."""
    # Implementation: Insert into project table, return created project
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/projects/{project_id}", response_model=ProjectResponse, tags=["Projects"])
async def get_project(project_id: UUID):
    """Get project summary with pour/optimization statistics."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Schedule Management ---

@app.post("/api/v1/schedules/import", response_model=ScheduleImportResponse, tags=["Schedule"])
async def import_schedule(request: ScheduleImportRequest):
    """Import or update pour schedule from P6/MSP export.
    
    Creates a new schedule version. Computes diff against previous version.
    Identifies added/changed/removed pours and triggers re-optimization
    recommendation if significant changes detected.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/projects/{project_id}/pours", response_model=list[PourResponse], tags=["Schedule"])
async def list_pours(
    project_id: UUID,
    floor_from: Optional[int] = None,
    floor_to: Optional[int] = None,
    pour_type: Optional[PourTypeEnum] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
):
    """List pours with filtering. Used by planner to review upcoming work."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Optimization ---

@app.post("/api/v1/optimize", response_model=OptimizationResponse, tags=["Optimization"])
async def run_optimization(request: OptimizationRequest):
    """Run the multi-period formwork optimizer for a date window.
    
    Steps:
    1. Load pours in the window + lookahead buffer
    2. Generate candidate kit configurations per pour
    3. Build and solve the MIP model
    4. Store results (kits, assignments, procurement plan)
    5. Return summary with cost breakdown
    
    Typical solve time: 2-10 minutes for a 25-floor tower.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/optimize/{run_id}/results", response_model=OptimizationResponse, tags=["Optimization"])
async def get_optimization_results(run_id: UUID):
    """Retrieve results of a previous optimization run."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.post(
    "/api/v1/optimize/scenarios",
    response_model=ScenarioComparisonResponse,
    tags=["Optimization"],
)
async def compare_scenarios(
    project_id: UUID,
    window_start: date,
    window_end: date,
):
    """Run multiple optimization scenarios for side-by-side comparison.
    
    Runs three scenarios:
    - MIN_COST: Minimize total formwork cost (default)
    - MIN_RENTAL: Minimize rental dependency
    - MAX_REUSE: Maximize component reuse even at higher handling cost
    
    Returns all three for planner comparison.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Kit Management ---

@app.get("/api/v1/kits/{kit_id}", response_model=KitResponse, tags=["Kits"])
async def get_kit(kit_id: UUID):
    """Get full kit details including component list with reasons."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/pours/{pour_id}/kit", response_model=KitResponse, tags=["Kits"])
async def get_kit_for_pour(pour_id: UUID):
    """Get the active kit for a specific pour."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.post("/api/v1/kits/override", tags=["Kits"])
async def override_kit(request: OverrideRequest):
    """Planner override: approve, lock, or modify a kit.
    
    Actions:
    - APPROVE: Freeze kit. Reserve components. Generate SAP issue list.
    - LOCK: Mark kit as immutable for future optimization runs.
    - REJECT: Planner modifies components, system re-validates compatibility
              and shows cost impact of the change on this pour and future pours.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/kits/{kit_id}/explain", tags=["Kits"])
async def explain_kit(kit_id: UUID):
    """Get detailed explainability for every component in a kit.
    
    Returns per-component:
    - Why this component was chosen
    - What alternatives were considered and why they were not selected
    - Cost impact of alternative choices
    - Reuse chain (which pour this component came from, where it goes next)
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Inventory ---

@app.get(
    "/api/v1/projects/{project_id}/inventory",
    response_model=InventorySnapshotResponse,
    tags=["Inventory"],
)
async def get_inventory(project_id: UUID, snapshot_date: Optional[date] = None):
    """Get current or historical inventory snapshot."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/projects/{project_id}/inventory/trajectory", tags=["Inventory"])
async def get_inventory_trajectory(
    project_id: UUID,
    component_id: Optional[UUID] = None,
):
    """Get time-series inventory trajectory (planned vs. actual).
    
    Shows for each component type:
    - Planned inventory over time (from optimizer)
    - Actual inventory (from SAP movements)
    - Divergence / alerts
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Procurement / BoQ ---

@app.get("/api/v1/projects/{project_id}/boq", tags=["BoQ"])
async def get_optimized_boq(project_id: UUID):
    """Get optimized Bill of Quantities for the project.
    
    Returns per component type:
    - Recommended procurement quantity
    - Recommended rental quantity and periods
    - Comparison against static (traditional) BoQ
    - Savings breakdown
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.get("/api/v1/projects/{project_id}/procurement-plan", tags=["BoQ"])
async def get_procurement_plan(project_id: UUID):
    """Get time-phased procurement plan.
    
    Lists:
    - What to procure and when
    - What to rent and for which periods
    - Lead time warnings
    - SAP reservation recommendations
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Validation ---

@app.post(
    "/api/v1/projects/{project_id}/validate",
    response_model=ValidationReportResponse,
    tags=["Validation"],
)
async def run_backtest(project_id: UUID):
    """Run back-test validation against historical data.
    
    Requires:
    - Historical pour schedule (as-built dates)
    - SAP issue/return logs for formwork materials
    - Procurement records
    
    Returns comparison metrics and validation report.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Data Import ---

@app.post("/api/v1/import/sap-materials", tags=["Data Import"])
async def import_sap_materials(project_id: UUID, file_path: str):
    """Import SAP MM material master CSV export.
    
    Runs material normalization engine to map SAP descriptions
    to structured component data. Returns match statistics and
    unmatched materials requiring manual review.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.post("/api/v1/import/sap-movements", tags=["Data Import"])
async def import_sap_movements(project_id: UUID, file_path: str):
    """Import SAP MB51 goods movement CSV export.
    
    Extracts formwork issue/return events, derives reuse cycles,
    and updates inventory state.
    """
    raise HTTPException(501, "Connect to database to enable this endpoint")


@app.post("/api/v1/import/surface-areas", tags=["Data Import"])
async def import_surface_areas(project_id: UUID, file_path: str):
    """Import manual surface area Excel/CSV for all pour zones."""
    raise HTTPException(501, "Connect to database to enable this endpoint")


# --- Health ---

@app.get("/api/v1/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "1.0.0", "system": "FormKit Optimizer"}


# ============================================================
# APPLICATION ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
