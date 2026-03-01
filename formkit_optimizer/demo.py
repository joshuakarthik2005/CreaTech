"""
FormKit Optimizer — Demo / Smoke Test
======================================

Demonstrates the end-to-end flow on synthetic data:
1. Create components and compatibility rules
2. Generate a pour schedule for a 10-floor tower
3. Generate kit configurations via Panel Layout Engine
4. Run the multi-period optimizer
5. Display results

Run: python -m demo
"""

from datetime import date, timedelta
from engine.optimizer import (
    Component,
    ComponentType,
    CompatibilityRule,
    DeployedAllocation,
    FormworkOptimizer,
    InventoryPosition,
    PanelLayoutEngine,
    Pour,
    PourType,
)


def main():
    print("=" * 70)
    print("FORMKIT OPTIMIZER — DEMO RUN")
    print("=" * 70)
    print()

    # ── 1. Define components (PERI TRIO wall system) ─────────────────
    components = [
        Component("WDP-2400", "PERI_TRIO", ComponentType.PANEL,
                  "PERI TRIO Wall Panel 2400x2700",
                  width_mm=2400, height_mm=2700, weight_kg=85,
                  unit_cost_buy=18500, unit_cost_rent_per_day=45,
                  loss_rate_per_cycle=0.001, damage_rate_per_cycle=0.003),
        Component("WDP-1200", "PERI_TRIO", ComponentType.PANEL,
                  "PERI TRIO Wall Panel 1200x2700",
                  width_mm=1200, height_mm=2700, weight_kg=48,
                  unit_cost_buy=12200, unit_cost_rent_per_day=30,
                  loss_rate_per_cycle=0.001, damage_rate_per_cycle=0.003),
        Component("WDP-0900", "PERI_TRIO", ComponentType.PANEL,
                  "PERI TRIO Wall Panel 900x2700",
                  width_mm=900, height_mm=2700, weight_kg=38,
                  unit_cost_buy=9800, unit_cost_rent_per_day=24,
                  loss_rate_per_cycle=0.001, damage_rate_per_cycle=0.004),
        Component("WDP-0600", "PERI_TRIO", ComponentType.PANEL,
                  "PERI TRIO Wall Panel 600x2700",
                  width_mm=600, height_mm=2700, weight_kg=28,
                  unit_cost_buy=7500, unit_cost_rent_per_day=18,
                  loss_rate_per_cycle=0.001, damage_rate_per_cycle=0.004),
        Component("FIL-0150", "PERI_TRIO", ComponentType.FILLER,
                  "PERI TRIO Filler 150x2700",
                  width_mm=150, height_mm=2700, weight_kg=8,
                  unit_cost_buy=1800, unit_cost_rent_per_day=5,
                  loss_rate_per_cycle=0.01, damage_rate_per_cycle=0.02),
        Component("FIL-0100", "PERI_TRIO", ComponentType.FILLER,
                  "PERI TRIO Filler 100x2700",
                  width_mm=100, height_mm=2700, weight_kg=6,
                  unit_cost_buy=1400, unit_cost_rent_per_day=4,
                  loss_rate_per_cycle=0.01, damage_rate_per_cycle=0.02),
        Component("TIE-DW15", "PERI_TRIO", ComponentType.TIE_ROD,
                  "PERI DW15 Tie Rod 250mm",
                  weight_kg=0.8,
                  unit_cost_buy=320, unit_cost_rent_per_day=1,
                  loss_rate_per_cycle=0.005, damage_rate_per_cycle=0.008),
        Component("CONE-DW15", "PERI_TRIO", ComponentType.TIE_CONE,
                  "PERI DW15 Cone (consumable)",
                  weight_kg=0.15,
                  unit_cost_buy=45, unit_cost_rent_per_day=0,
                  loss_rate_per_cycle=1.0),  # consumable
        Component("CLAMP-BFD", "PERI_TRIO", ComponentType.CLAMP,
                  "PERI TRIO BFD Panel Clamp",
                  weight_kg=2.5,
                  unit_cost_buy=850, unit_cost_rent_per_day=2,
                  loss_rate_per_cycle=0.003, damage_rate_per_cycle=0.008),
    ]

    # ── 2. Define compatibility rules ────────────────────────────────
    rules = [
        CompatibilityRule("WDP-2400", "TIE-DW15", 1.33,
                          "1 tie per 0.75m² panel face"),
        CompatibilityRule("WDP-1200", "TIE-DW15", 1.33,
                          "1 tie per 0.75m² panel face"),
        CompatibilityRule("WDP-0900", "TIE-DW15", 1.33,
                          "1 tie per 0.75m² panel face"),
        CompatibilityRule("WDP-0600", "TIE-DW15", 1.33,
                          "1 tie per 0.75m² panel face"),
        CompatibilityRule("TIE-DW15", "CONE-DW15", 2.0,
                          "2 cones per tie rod"),
        CompatibilityRule("WDP-2400", "CLAMP-BFD", 0.8,
                          "BFD clamp at vertical joints"),
        CompatibilityRule("WDP-1200", "CLAMP-BFD", 0.8,
                          "BFD clamp at vertical joints"),
    ]

    # ── 3. Generate pour schedule (5-floor demo) ─────────────────────
    pours = []
    base_date = date(2026, 4, 1)

    for floor in range(1, 6):
        for zone in range(1, 3):  # 2 wall zones per floor
            pour = Pour(
                pour_id=f"POUR-T1-F{floor:02d}-Z{zone}-WALL",
                tower_code="T1",
                floor_number=floor,
                zone_code=f"Z{zone}",
                pour_type=PourType.WALL,
                planned_date=base_date + timedelta(days=(floor - 1) * 10 + (zone - 1) * 3),
                net_surface_area_m2=38.5,  # ~10m wall × 2.7m height × 2 faces, minus openings
                concrete_grade="M40",
                strip_cycle_hours=12,
                assigned_system_code="PERI_TRIO",
            )
            pours.append(pour)

    print(f"Generated {len(pours)} pours across 5 floors")
    for p in pours:
        print(f"  {p.pour_id}: {p.planned_date} | {p.net_surface_area_m2} m² | strip {p.strip_cycle_hours}h")
    print()

    # ── 4. Generate kit configurations ───────────────────────────────
    layout_engine = PanelLayoutEngine(components, rules)

    for pour in pours:
        configs = layout_engine.generate_configs(pour, max_configs=2)
        pour.candidate_configs = configs
        print(f"  {pour.pour_id}: {len(configs)} config(s) generated")
        for cfg in configs:
            total_comps = sum(cfg.component_demands.values())
            print(f"    {cfg.config_id}: {total_comps} components, {cfg.total_panel_area_m2:.1f} m², coverage={cfg.coverage_ratio:.2f}x")

    print()

    # ── 5. Set initial inventory (start with some stock) ─────────────
    initial_inventory = [
        InventoryPosition("WDP-2400", qty_available=8, qty_deployed=0, avg_remaining_cycles=250),
        InventoryPosition("WDP-1200", qty_available=6, qty_deployed=0, avg_remaining_cycles=280),
        InventoryPosition("WDP-0900", qty_available=4, qty_deployed=0, avg_remaining_cycles=200),
        InventoryPosition("WDP-0600", qty_available=4, qty_deployed=0, avg_remaining_cycles=270),
        InventoryPosition("FIL-0150", qty_available=10, qty_deployed=0, avg_remaining_cycles=100),
        InventoryPosition("FIL-0100", qty_available=10, qty_deployed=0, avg_remaining_cycles=100),
        InventoryPosition("TIE-DW15", qty_available=40, qty_deployed=0, avg_remaining_cycles=200),
        InventoryPosition("CONE-DW15", qty_available=100, qty_deployed=0, avg_remaining_cycles=1),
        InventoryPosition("CLAMP-BFD", qty_available=20, qty_deployed=0, avg_remaining_cycles=250),
    ]

    print("Initial inventory:")
    for ip in initial_inventory:
        print(f"  {ip.component_id}: {ip.qty_available} available, {ip.avg_remaining_cycles} cycles remaining")
    print()

    # ── 6. Run optimizer ─────────────────────────────────────────────
    print("Running multi-period optimizer...")
    print("-" * 50)

    optimizer = FormworkOptimizer(
        pours=pours,
        components=components,
        initial_inventory=initial_inventory,
        deployed_allocations=[],
        handling_cost_per_kg=0.5,
        holding_cost_per_unit_per_day=2.0,
        max_solve_time_seconds=60,
    )

    result = optimizer.solve()

    print()
    print(f"Status:          {result.status}")
    print(f"Objective value: ₹{result.objective_value:,.0f}")
    print(f"Solve time:      {result.solve_time_seconds:.1f}s")
    print(f"Optimality gap:  {result.optimality_gap:.2%}")
    print()

    # ── 7. Display kit assignments ───────────────────────────────────
    print("KIT ASSIGNMENTS")
    print("=" * 70)
    for ka in result.kit_assignments:
        print(f"\n{ka.pour_id}")
        print(f"  Config: {ka.selected_config_id}")
        print(f"  Total cost: ₹{ka.total_cost:,.0f}")
        print(f"  {ka.explanation}")
        for ca in ka.component_assignments[:5]:  # Show first 5
            print(f"    {ca.component_id}: qty={ca.quantity}, source={ca.source}, cost=₹{ca.cost:,.0f}")

    # ── 8. Display procurement plan ──────────────────────────────────
    if result.procurement_plan:
        print()
        print("PROCUREMENT PLAN")
        print("=" * 70)
        for pp in result.procurement_plan[:15]:  # Show first 15
            print(f"  {pp.action} {pp.quantity}x {pp.component_id} by {pp.needed_by} — ₹{pp.cost:,.0f}")
            print(f"    {pp.justification}")
    else:
        print("\nNo additional procurement needed — covered by existing inventory + reuse.")

    # ── 9. Summary ───────────────────────────────────────────────────
    print()
    print("COST BREAKDOWN")
    print("=" * 70)
    for cost_type, amount in result.total_cost_breakdown.items():
        print(f"  {cost_type:20s}: ₹{amount:>12,.0f}")

    print()
    print("Demo complete.")


if __name__ == "__main__":
    main()
