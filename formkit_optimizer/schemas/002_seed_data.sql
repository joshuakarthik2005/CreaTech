-- ============================================================
-- FormKit Optimizer — Seed Data for Pilot Project
-- Realistic PERI TRIO + Doka Dokaflex system data
-- ============================================================

-- ============================================================
-- FORMWORK SYSTEMS
-- ============================================================

INSERT INTO formwork_system (system_id, system_code, vendor, system_type,
    rated_reuse_cycles, panel_height_options_mm, panel_width_options_mm,
    min_tie_spacing_mm, max_pour_pressure_kpa, notes)
VALUES
    -- PERI TRIO wall formwork
    (uuid_generate_v4(), 'PERI_TRIO', 'PERI GmbH', 'WALL',
     300, ARRAY[2700, 3300, 3600], ARRAY[240, 330, 450, 600, 720, 900, 1200, 2400, 2700],
     750, 80, 'Steel-frame wall formwork. Standard for high-rise residential walls.'),

    -- PERI GRIDFLEX slab formwork
    (uuid_generate_v4(), 'PERI_GRIDFLEX', 'PERI GmbH', 'SLAB',
     200, ARRAY[2400], ARRAY[600, 900, 1200, 1500, 1800],
     NULL, NULL, 'Panelized slab formwork with drophead for early striking.'),

    -- Doka Frami Xlife wall formwork
    (uuid_generate_v4(), 'DOKA_FRAMI_XLIFE', 'Doka GmbH', 'WALL',
     350, ARRAY[1200, 1500, 2700, 3000, 3300], ARRAY[300, 450, 600, 750, 900],
     800, 80, 'Steel-frame wall formwork with extended service life.'),

    -- Doka Dokaflex slab formwork
    (uuid_generate_v4(), 'DOKA_DOKAFLEX', 'Doka GmbH', 'SLAB',
     150, ARRAY[2000, 2500, 2700], ARRAY[500],
     NULL, NULL, 'Flexible slab formwork system with H20 timber beams.'),

    -- Aluminum column formwork
    (uuid_generate_v4(), 'ALU_COLUMN', 'Local Fabricator', 'COLUMN',
     250, ARRAY[3000, 3300, 3600], ARRAY[200, 250, 300, 350, 400, 450, 500, 600],
     NULL, 60, 'Custom aluminum column forms. Sized per column schedule.');

-- ============================================================
-- SAMPLE COMPONENTS (PERI TRIO)
-- Inserting a representative set for the PERI_TRIO system
-- ============================================================

-- We need to reference system_id; using a CTE pattern
DO $$
DECLARE
    v_trio_id UUID;
    v_gridflex_id UUID;
BEGIN
    SELECT system_id INTO v_trio_id FROM formwork_system WHERE system_code = 'PERI_TRIO';
    SELECT system_id INTO v_gridflex_id FROM formwork_system WHERE system_code = 'PERI_GRIDFLEX';

    -- PERI TRIO Panels (Wall)
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, width_mm, height_mm, weight_kg, face_type, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-WDP-2400', 'PANEL', 'PERI TRIO Wall Panel WDP 2400x2700',
         2400, 2700, 85.0, 'STEEL', 'INDIVIDUAL', 18500, 45, 0.001, 0.003),
        (v_trio_id, 'FW-TRIO-WDP-1200', 'PANEL', 'PERI TRIO Wall Panel WDP 1200x2700',
         1200, 2700, 48.0, 'STEEL', 'INDIVIDUAL', 12200, 30, 0.001, 0.003),
        (v_trio_id, 'FW-TRIO-WDP-0900', 'PANEL', 'PERI TRIO Wall Panel WDP 900x2700',
         900, 2700, 38.0, 'STEEL', 'INDIVIDUAL', 9800, 24, 0.001, 0.004),
        (v_trio_id, 'FW-TRIO-WDP-0600', 'PANEL', 'PERI TRIO Wall Panel WDP 600x2700',
         600, 2700, 28.0, 'STEEL', 'INDIVIDUAL', 7500, 18, 0.001, 0.004),
        (v_trio_id, 'FW-TRIO-WDP-0450', 'PANEL', 'PERI TRIO Wall Panel WDP 450x2700',
         450, 2700, 22.0, 'STEEL', 'INDIVIDUAL', 6200, 15, 0.001, 0.005),
        (v_trio_id, 'FW-TRIO-WDP-0330', 'PANEL', 'PERI TRIO Wall Panel WDP 330x2700',
         330, 2700, 18.0, 'STEEL', 'INDIVIDUAL', 5100, 12, 0.002, 0.005),
        (v_trio_id, 'FW-TRIO-WDP-0240', 'PANEL', 'PERI TRIO Wall Panel WDP 240x2700',
         240, 2700, 15.0, 'STEEL', 'INDIVIDUAL', 4300, 10, 0.002, 0.005);

    -- PERI TRIO Fillers
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, width_mm, height_mm, weight_kg, face_type, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-FIL-0150', 'FILLER', 'PERI TRIO Filler Strip 150x2700',
         150, 2700, 8.0, 'PLYWOOD', 'BUNDLE_10', 1800, 5, 0.010, 0.020),
        (v_trio_id, 'FW-TRIO-FIL-0100', 'FILLER', 'PERI TRIO Filler Strip 100x2700',
         100, 2700, 6.0, 'PLYWOOD', 'BUNDLE_10', 1400, 4, 0.010, 0.020),
        (v_trio_id, 'FW-TRIO-FIL-0050', 'FILLER', 'PERI TRIO Filler Strip 50x2700',
         50, 2700, 4.0, 'PLYWOOD', 'BUNDLE_10', 1000, 3, 0.015, 0.025);

    -- PERI TRIO Tie Rods
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, length_mm, weight_kg, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-DW15-250', 'TIE_ROD', 'PERI DW15 Tie Rod 250mm (wall 200mm)',
         250, 0.8, 'BUNDLE_20', 320, 1.0, 0.005, 0.008),
        (v_trio_id, 'FW-TRIO-DW15-350', 'TIE_ROD', 'PERI DW15 Tie Rod 350mm (wall 300mm)',
         350, 1.0, 'BUNDLE_20', 380, 1.2, 0.005, 0.008),
        (v_trio_id, 'FW-TRIO-DW15-450', 'TIE_ROD', 'PERI DW15 Tie Rod 450mm (wall 400mm)',
         450, 1.2, 'BUNDLE_20', 440, 1.4, 0.005, 0.008);

    -- PERI TRIO Tie Cones
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, weight_kg, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-CONE-DW15', 'TIE_CONE', 'PERI DW15 Tie Cone (consumable)',
         0.15, 'BUNDLE_20', 45, 0, 1.0, 0); -- Loss rate 1.0 = consumable, lost every cycle

    -- PERI TRIO Walers
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, length_mm, weight_kg, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-WAL-2700', 'WALER', 'PERI TRIO BFD Waler 2700mm',
         2700, 18.0, 'BUNDLE_10', 4200, 10, 0.002, 0.005),
        (v_trio_id, 'FW-TRIO-WAL-1350', 'WALER', 'PERI TRIO BFD Waler 1350mm',
         1350, 10.0, 'BUNDLE_10', 2800, 7, 0.002, 0.005);

    -- PERI TRIO Clamps and Accessories
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, weight_kg, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_trio_id, 'FW-TRIO-BFD-CLAMP', 'CLAMP', 'PERI TRIO BFD Panel Clamp',
         2.5, 'BUNDLE_20', 850, 2, 0.003, 0.008),
        (v_trio_id, 'FW-TRIO-WEDGE-BFD', 'WEDGE', 'PERI TRIO BFD Wedge Clamp',
         1.2, 'BUNDLE_20', 420, 1, 0.005, 0.010),
        (v_trio_id, 'FW-TRIO-CORNER-IC', 'CORNER', 'PERI TRIO Inside Corner IC 90',
         12.0, 'INDIVIDUAL', 6800, 16, 0.002, 0.005),
        (v_trio_id, 'FW-TRIO-CORNER-OC', 'CORNER', 'PERI TRIO Outside Corner OC 90',
         14.0, 'INDIVIDUAL', 7200, 18, 0.002, 0.005);

    -- PERI GRIDFLEX slab panels
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, width_mm, height_mm, weight_kg, face_type, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_gridflex_id, 'FW-GF-PANEL-1500', 'PANEL', 'PERI GRIDFLEX Slab Panel 1500x600',
         1500, 600, 24.0, 'STEEL', 'PALLET', 8200, 20, 0.002, 0.004),
        (v_gridflex_id, 'FW-GF-PANEL-1200', 'PANEL', 'PERI GRIDFLEX Slab Panel 1200x600',
         1200, 600, 20.0, 'STEEL', 'PALLET', 6800, 16, 0.002, 0.004),
        (v_gridflex_id, 'FW-GF-PANEL-0900', 'PANEL', 'PERI GRIDFLEX Slab Panel 900x600',
         900, 600, 16.0, 'STEEL', 'PALLET', 5400, 14, 0.002, 0.004);

    -- PERI GRIDFLEX Props
    INSERT INTO formwork_component (system_id, sap_material_code, component_type,
        description, length_mm, weight_kg, transport_unit,
        unit_cost_buy, unit_cost_rent_per_day, loss_rate_per_cycle, damage_rate_per_cycle)
    VALUES
        (v_gridflex_id, 'FW-GF-PROP-350', 'PROP', 'PERI PEP Ergo Prop 350 (2.5-3.5m)',
         3500, 18.0, 'BUNDLE_10', 4800, 12, 0.002, 0.005),
        (v_gridflex_id, 'FW-GF-PROP-300', 'PROP', 'PERI PEP Ergo Prop 300 (2.0-3.0m)',
         3000, 15.0, 'BUNDLE_10', 4200, 10, 0.002, 0.005);

    -- ============================================================
    -- SAMPLE COMPATIBILITY RULES (PERI TRIO)
    -- ============================================================
    
    -- Every TRIO panel REQUIRES DW15 tie rods
    INSERT INTO compatibility_rule (system_id, rule_type,
        source_component_id, target_component_id, quantity_ratio, notes)
    SELECT v_trio_id, 'QUANTITY_RATIO',
        fc_panel.component_id, fc_tie.component_id,
        1.33, -- ~1 tie per 0.75 m² of panel face
        'Each panel requires tie rods at 750mm horizontal spacing. 1 tie per 0.75 m² of face area.'
    FROM formwork_component fc_panel, formwork_component fc_tie
    WHERE fc_panel.system_id = v_trio_id AND fc_panel.component_type = 'PANEL'
      AND fc_tie.sap_material_code = 'FW-TRIO-DW15-250'
    LIMIT 1; -- one representative rule

    -- Each tie rod requires 2 tie cones (one each side)
    INSERT INTO compatibility_rule (system_id, rule_type,
        source_component_id, target_component_id, quantity_ratio, notes)
    SELECT v_trio_id, 'QUANTITY_RATIO',
        fc_tie.component_id, fc_cone.component_id,
        2.0,
        'Each tie rod requires 2 cones (one per face). Cones are consumable.'
    FROM formwork_component fc_tie, formwork_component fc_cone
    WHERE fc_tie.sap_material_code = 'FW-TRIO-DW15-250'
      AND fc_cone.sap_material_code = 'FW-TRIO-CONE-DW15';

    -- Panel clamp required at every panel-to-panel vertical joint
    INSERT INTO compatibility_rule (system_id, rule_type,
        source_component_id, target_component_id, quantity_ratio, notes)
    SELECT v_trio_id, 'QUANTITY_RATIO',
        fc_panel.component_id, fc_clamp.component_id,
        0.8, -- ~1 clamp per panel minus 1 (n-1 joints for n panels), approx as ratio
        'BFD clamps at every vertical joint between adjacent panels. ~0.8 per panel.'
    FROM formwork_component fc_panel, formwork_component fc_clamp
    WHERE fc_panel.system_id = v_trio_id AND fc_panel.component_type = 'PANEL'
      AND fc_clamp.sap_material_code = 'FW-TRIO-BFD-CLAMP'
    LIMIT 1;

END $$;

-- ============================================================
-- SAMPLE PROJECT (Pilot: 25-floor residential tower)
-- ============================================================

INSERT INTO project (project_code, project_name, sap_wbs_root, location, start_date, planned_end)
VALUES ('PROJ-RES-T1-2026', 'Serene Heights Tower 1 — Pilot', 'WBS-SH-T1', 'Thane, Mumbai', '2026-01-15', '2027-06-30');

DO $$
DECLARE
    v_proj_id UUID;
    v_tower_id UUID;
    v_floor_id UUID;
    v_trio_id UUID;
    i INT;
    z INT;
    pour_date DATE;
BEGIN
    SELECT project_id INTO v_proj_id FROM project WHERE project_code = 'PROJ-RES-T1-2026';
    SELECT system_id INTO v_trio_id FROM formwork_system WHERE system_code = 'PERI_TRIO';

    -- Create tower
    INSERT INTO tower (project_id, tower_code, total_floors, typical_floor_height_mm)
    VALUES (v_proj_id, 'T1', 25, 3000)
    RETURNING tower_id INTO v_tower_id;

    -- Create floors and pours (simplified: 4 wall zones + 2 slab zones per floor)
    pour_date := '2026-03-01'::DATE; -- Starting from Floor 1

    FOR i IN 1..25 LOOP
        INSERT INTO floor (tower_id, floor_number, floor_label, slab_area_m2, perimeter_m, is_typical)
        VALUES (v_tower_id, i, i || 'F', 280.0, 72.0, i >= 3 AND i <= 23) -- Floors 3-23 are typical
        RETURNING floor_id INTO v_floor_id;

        -- 4 wall pour zones per floor
        FOR z IN 1..4 LOOP
            INSERT INTO pour (project_id, tower_id, floor_number, zone_code, pour_type,
                planned_date, gross_surface_area_m2, net_surface_area_m2,
                concrete_grade, pour_height_mm, strip_cycle_hours,
                schedule_activity_id, assigned_system_id)
            VALUES (v_proj_id, v_tower_id, i, 'Z' || z, 'WALL',
                pour_date + ((z-1) * 2), -- 2-day gap between zones
                42.0, 38.5, -- ~10m length x 3m height each side, minus openings
                'M40', 3000, 12,
                'POUR-T1-F' || LPAD(i::TEXT, 2, '0') || '-Z' || z || '-WALL',
                v_trio_id);
        END LOOP;

        -- 2 slab pour zones per floor (after walls)
        FOR z IN 1..2 LOOP
            INSERT INTO pour (project_id, tower_id, floor_number, zone_code, pour_type,
                planned_date, gross_surface_area_m2, net_surface_area_m2,
                concrete_grade, strip_cycle_hours,
                schedule_activity_id)
            VALUES (v_proj_id, v_tower_id, i, 'S' || z, 'SLAB',
                pour_date + 8 + ((z-1) * 3), -- slabs start after walls, 3-day gap
                140.0, 135.0, -- half the floor per zone
                'M40', 14, -- 14 hours strip for slab
                'POUR-T1-F' || LPAD(i::TEXT, 2, '0') || '-S' || z || '-SLAB');
        END LOOP;

        -- Next floor starts ~14 days after this floor
        pour_date := pour_date + 14;
    END LOOP;
END $$;
