"""
Seed the database with realistic demo data for a 25-floor residential tower.
"""

import uuid
from datetime import date, timedelta, datetime
from backend.database import SessionLocal, init_db
from backend.models import (
    Project, ComponentMaster, Pour, Kit, KitLineItem,
    InventoryItem, OptimizationRun, ActivityLog,
)

import random
random.seed(42)


def gen_id():
    return str(uuid.uuid4())


COMPONENTS = [
    # ── PERI TRIO Wall System ────────────────────────────────
    ("WDP-2400", "PERI_TRIO", "PANEL", "PERI TRIO Wall Panel 2400×2700", 2400, 2700, 85.0, 18500, 45, 0.001, 0.003, 300),
    ("WDP-1200", "PERI_TRIO", "PANEL", "PERI TRIO Wall Panel 1200×2700", 1200, 2700, 48.0, 12200, 30, 0.001, 0.003, 300),
    ("WDP-0900", "PERI_TRIO", "PANEL", "PERI TRIO Wall Panel 900×2700",   900, 2700, 38.0,  9800, 24, 0.001, 0.004, 300),
    ("WDP-0600", "PERI_TRIO", "PANEL", "PERI TRIO Wall Panel 600×2700",   600, 2700, 28.0,  7500, 18, 0.001, 0.004, 300),
    ("FIL-0150", "PERI_TRIO", "FILLER", "PERI TRIO Filler 150×2700",     150, 2700,  8.0,  1800,  5, 0.01,  0.02,  200),
    ("FIL-0100", "PERI_TRIO", "FILLER", "PERI TRIO Filler 100×2700",     100, 2700,  6.0,  1400,  4, 0.01,  0.02,  200),
    ("TIE-DW15", "PERI_TRIO", "TIE_ROD","PERI DW15 Tie Rod 250mm", None, None, 0.8,   320,  1, 0.005, 0.008, 200),
    ("CONE-DW15","PERI_TRIO", "TIE_CONE","PERI DW15 Cone (consumable)", None,None,0.15,  45,  0, 1.0,   0,     1),
    ("CLAMP-BFD","PERI_TRIO", "CLAMP",   "PERI TRIO BFD Panel Clamp", None,None,2.5, 850,  2, 0.003, 0.008, 250),
    # ── PERI GRIDFLEX Slab System ────────────────────────────
    ("GF-PANEL", "PERI_GRIDFLEX", "PANEL", "PERI GRIDFLEX Table 2400×2400", 2400, 2400, 95.0, 22000, 55, 0.001, 0.003, 280),
    ("GF-PROP",  "PERI_GRIDFLEX", "PROP",  "PERI Multiprop MP350",  None, None, 12.5, 4500, 12, 0.002, 0.005, 350),
    ("GF-HEAD",  "PERI_GRIDFLEX", "ACCESSORY", "PERI Prop Head HD200", None, None, 3.2, 1200, 3, 0.003, 0.008, 300),
    # ── Doka Frami Xlife ─────────────────────────────────────
    ("DK-2400",  "DOKA_FRAMI", "PANEL", "Doka Frami Xlife 2400×2700", 2400, 2700, 82.0, 19200, 48, 0.001, 0.003, 350),
    ("DK-1200",  "DOKA_FRAMI", "PANEL", "Doka Frami Xlife 1200×2700", 1200, 2700, 45.0, 12800, 32, 0.001, 0.003, 350),
    ("DK-0900",  "DOKA_FRAMI", "PANEL", "Doka Frami Xlife 900×2700",   900, 2700, 36.0, 10200, 26, 0.001, 0.003, 350),
]


def seed():
    init_db()
    db = SessionLocal()

    # Check if already seeded
    if db.query(Project).count() > 0:
        print("Database already seeded. Skipping.")
        db.close()
        return

    # ── Project ──────────────────────────────────────────────
    project_id = gen_id()
    project = Project(
        id=project_id,
        project_code="PROJ-SH-T1-2026",
        project_name="Serene Heights Tower 1",
        location="Thane, Mumbai",
        sap_wbs_root="WBS-SH-T1",
        start_date=date(2026, 4, 1),
        planned_end=date(2027, 6, 30),
    )
    db.add(project)

    # ── Components ───────────────────────────────────────────
    comp_map = {}  # code -> id
    for row in COMPONENTS:
        cid = gen_id()
        comp_map[row[0]] = cid
        db.add(ComponentMaster(
            id=cid,
            component_code=row[0], system_code=row[1], component_type=row[2],
            description=row[3], width_mm=row[4], height_mm=row[5],
            weight_kg=row[6], unit_cost_buy=row[7], unit_cost_rent_per_day=row[8],
            loss_rate_per_cycle=row[9], damage_rate_per_cycle=row[10],
            rated_reuse_cycles=row[11],
        ))

    # ── Inventory ────────────────────────────────────────────
    inv_seed = {
        "WDP-2400": (12, 4, 0, 250), "WDP-1200": (10, 2, 1, 280),
        "WDP-0900": (8, 2, 0, 200), "WDP-0600": (6, 0, 1, 270),
        "FIL-0150": (20, 5, 0, 100), "FIL-0100": (15, 3, 0, 120),
        "TIE-DW15": (60, 18, 2, 180), "CONE-DW15": (200, 40, 0, 1),
        "CLAMP-BFD": (30, 8, 1, 240),
        "GF-PANEL": (8, 3, 0, 260), "GF-PROP": (40, 15, 2, 330),
        "GF-HEAD": (35, 12, 0, 280),
        "DK-2400": (6, 0, 0, 340), "DK-1200": (4, 0, 0, 340), "DK-0900": (3, 0, 0, 340),
    }
    for code, (avail, deployed, repair, cycles) in inv_seed.items():
        if code in comp_map:
            db.add(InventoryItem(
                id=gen_id(), component_id=comp_map[code], project_id=project_id,
                qty_available=avail, qty_deployed=deployed, qty_under_repair=repair,
                avg_remaining_cycles=cycles,
            ))

    # ── Pours — 25 floors × 4 wall zones + 2 slab zones = 150 pours
    base_date = date(2025, 11, 1)  # Started 4 months ago
    pours_data = []
    pour_id_map = {}

    for floor in range(1, 26):
        floor_offset = (floor - 1) * 7  # 7 days per floor cycle

        for zone in range(1, 5):  # 4 wall zones
            pd = base_date + timedelta(days=floor_offset + (zone - 1))
            pour_id = gen_id()
            pc = f"POUR-T1-F{floor:02d}-Z{zone}-WALL"
            status = "COMPLETED" if pd < date(2026, 3, 1) else ("IN_PROGRESS" if pd <= date(2026, 3, 7) else "PLANNED")
            area = round(random.uniform(32, 48), 1)

            p = Pour(
                id=pour_id, project_id=project_id, pour_code=pc,
                tower_code="T1", floor_number=floor, zone_code=f"Z{zone}",
                pour_type="WALL", planned_date=pd,
                actual_date=pd + timedelta(days=random.randint(-1, 2)) if status == "COMPLETED" else None,
                net_surface_area_m2=area, concrete_grade="M40",
                strip_cycle_hours=12, assigned_system="PERI_TRIO", status=status,
            )
            db.add(p)
            pours_data.append((pour_id, pc, floor, f"Z{zone}", "WALL", pd, area, status))

        for zone in range(1, 3):  # 2 slab zones
            pd = base_date + timedelta(days=floor_offset + 4 + (zone - 1))
            pour_id = gen_id()
            pc = f"POUR-T1-F{floor:02d}-S{zone}-SLAB"
            status = "COMPLETED" if pd < date(2026, 3, 1) else ("IN_PROGRESS" if pd <= date(2026, 3, 7) else "PLANNED")
            area = round(random.uniform(55, 85), 1)

            p = Pour(
                id=pour_id, project_id=project_id, pour_code=pc,
                tower_code="T1", floor_number=floor, zone_code=f"S{zone}",
                pour_type="SLAB", planned_date=pd,
                actual_date=pd + timedelta(days=random.randint(0, 1)) if status == "COMPLETED" else None,
                net_surface_area_m2=area, concrete_grade="M35" if floor < 15 else "M40",
                strip_cycle_hours=72, assigned_system="PERI_GRIDFLEX", status=status,
            )
            db.add(p)
            pours_data.append((pour_id, pc, floor, f"S{zone}", "SLAB", pd, area, status))

    db.flush()

    # ── Kits (for completed & in-progress pours) ─────────────
    wall_kit_template = [
        ("WDP-2400", 4, "INVENTORY"), ("WDP-1200", 2, "INVENTORY"),
        ("WDP-0900", 2, "INVENTORY"), ("FIL-0150", 1, "INVENTORY"),
        ("TIE-DW15", 9, "INVENTORY"), ("CLAMP-BFD", 3, "INVENTORY"),
    ]
    slab_kit_template = [
        ("GF-PANEL", 6, "INVENTORY"), ("GF-PROP", 12, "INVENTORY"),
        ("GF-HEAD", 10, "INVENTORY"),
    ]

    kits_created = 0
    total_kit_cost = 0
    for (pour_id, pc, floor, zone, pt, pd, area, status) in pours_data:
        if status in ("COMPLETED", "IN_PROGRESS"):
            kit_id = gen_id()
            template = wall_kit_template if pt == "WALL" else slab_kit_template
            strategy = "MAX_LARGE" if random.random() < 0.6 else "BALANCED"
            coverage = round(random.uniform(0.94, 0.99), 3)

            kit_cost = 0
            line_items = []
            for (cc, base_qty, src) in template:
                if cc not in comp_map:
                    continue
                qty = base_qty + random.randint(-1, 2)
                qty = max(1, qty)
                comp_data = next((c for c in COMPONENTS if c[0] == cc), None)
                cost = round(qty * (comp_data[7] if comp_data else 0) * (comp_data[9] if comp_data else 0.002) + qty * (comp_data[6] if comp_data else 1) * 0.5, 2)
                kit_cost += cost
                li = KitLineItem(
                    id=gen_id(), kit_id=kit_id, component_id=comp_map[cc],
                    quantity=qty, source=src, cost_contribution=cost,
                )
                line_items.append(li)

            kit = Kit(
                id=kit_id, pour_id=pour_id, config_name=f"{pc}-CFG-A",
                config_strategy=strategy, status="STRIPPED" if status == "COMPLETED" else "DEPLOYED",
                total_panel_area_m2=round(area * coverage, 1),
                coverage_ratio=coverage, total_cost=round(kit_cost, 2),
                planner_approved=status == "COMPLETED",
                explanation=f"Config '{strategy}' optimized. Coverage: {coverage:.1%}.",
            )
            db.add(kit)
            for li in line_items:
                db.add(li)
            kits_created += 1
            total_kit_cost += kit_cost

    # ── Optimization Runs (historical) ───────────────────────
    for i in range(5):
        run_date = datetime(2026, 2, 1 + i * 5, 10, 30, 0)
        sv = round(random.uniform(0.1, 0.4), 2)
        obj_val = round(total_kit_cost * (0.7 + i * 0.05), 0)
        db.add(OptimizationRun(
            id=gen_id(), project_id=project_id, status="OPTIMAL",
            objective="MIN_COST", objective_value=obj_val,
            solve_time_seconds=round(random.uniform(0.2, 12.5), 2),
            optimality_gap=round(random.uniform(0.95, 1.0), 4),
            pours_optimized=25 + i * 5, kits_generated=25 + i * 5,
            procurement_actions=random.randint(0, 8),
            cost_breakdown={
                "procurement": round(obj_val * 0.15, 0),
                "rental": round(obj_val * 0.05, 0),
                "handling": round(obj_val * 0.25, 0),
                "holding": round(obj_val * 0.10, 0),
                "expected_loss": round(obj_val * 0.08, 0),
                "total": obj_val,
            },
            created_at=run_date,
        ))

    # ── Activity Log ─────────────────────────────────────────
    activities = [
        ("PROJECT_CREATED", "Project 'Serene Heights Tower 1' initialized"),
        ("SCHEDULE_IMPORTED", "P6 schedule v3 imported — 150 pours across 25 floors"),
        ("SAP_MATERIALS_SYNCED", "SAP MM material master synced — 15 components mapped"),
        ("OPTIMIZATION_RUN", "Optimization run #5 completed — OPTIMAL in 4.2s"),
        ("KIT_APPROVED", "Planner approved kit for POUR-T1-F08-Z2-WALL"),
        ("INVENTORY_UPDATED", "SAP MB51 goods movement imported — 42 transactions"),
        ("SCHEDULE_UPDATED", "P6 schedule v4 imported — 3 pours rescheduled"),
        ("OPTIMIZATION_RUN", "Re-optimization triggered for floors 9-15"),
        ("KIT_OVERRIDE", "Planner swapped WDP-0900 → WDP-1200 on F10-Z1-WALL"),
        ("BACKTEST_COMPLETE", "Back-test validation: 18.3% BoQ reduction confirmed"),
    ]
    for i, (action, desc) in enumerate(activities):
        db.add(ActivityLog(
            id=gen_id(), project_id=project_id,
            action=action, description=desc,
            created_at=datetime(2026, 2, 1) + timedelta(days=i * 3),
        ))

    db.commit()
    db.close()
    print(f"✓ Seeded: 1 project, {len(COMPONENTS)} components, {len(pours_data)} pours, {kits_created} kits, 5 opt runs, {len(activities)} activity logs")


if __name__ == "__main__":
    seed()
