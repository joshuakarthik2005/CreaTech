-- ============================================================
-- FormKit Optimizer — Core Database Schema
-- PostgreSQL 15+
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE formwork_system_type AS ENUM (
    'WALL', 'SLAB', 'COLUMN', 'CLIMBING'
);

CREATE TYPE component_type AS ENUM (
    'PANEL', 'FILLER', 'TIE_ROD', 'TIE_CONE', 'WALER',
    'PROP', 'CLAMP', 'WEDGE', 'CORNER', 'ACCESSORY'
);

CREATE TYPE face_type AS ENUM (
    'STEEL', 'PLYWOOD', 'ALUMINUM', 'PLASTIC'
);

CREATE TYPE transport_unit AS ENUM (
    'INDIVIDUAL', 'BUNDLE_10', 'BUNDLE_20', 'PALLET', 'CONTAINER'
);

CREATE TYPE procurement_type AS ENUM (
    'OWNED', 'RENTED', 'TRANSFERRED'
);

CREATE TYPE instance_status AS ENUM (
    'AVAILABLE', 'DEPLOYED', 'IN_TRANSIT',
    'UNDER_REPAIR', 'CONDEMNED', 'RETURNED_TO_VENDOR'
);

CREATE TYPE condition_grade AS ENUM (
    'A', 'B', 'C', 'D'
);

CREATE TYPE kit_status AS ENUM (
    'PLANNED', 'CONFIRMED', 'DEPLOYED', 'STRIPPED', 'VERIFIED'
);

CREATE TYPE kit_generation_method AS ENUM (
    'OPTIMIZER', 'MANUAL', 'HYBRID'
);

CREATE TYPE pour_type AS ENUM (
    'SLAB', 'COLUMN', 'BEAM', 'WALL', 'SHEAR_WALL', 'COMBINED'
);

CREATE TYPE pour_status AS ENUM (
    'SCHEDULED', 'FORMWORK_DEPLOYED', 'POURED',
    'CURING', 'STRIPPED', 'COMPLETED'
);

CREATE TYPE compatibility_rule_type AS ENUM (
    'REQUIRES', 'EXCLUDES', 'REPLACES', 'QUANTITY_RATIO'
);

CREATE TYPE inventory_txn_type AS ENUM (
    'PROCURE', 'ISSUE_TO_POUR', 'RETURN_FROM_POUR',
    'TRANSFER_IN', 'TRANSFER_OUT', 'CONDEMN',
    'REPAIR_SEND', 'REPAIR_RECEIVE'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Project hierarchy
CREATE TABLE project (
    project_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_code    VARCHAR(50) UNIQUE NOT NULL,
    project_name    VARCHAR(200) NOT NULL,
    sap_wbs_root    VARCHAR(50),
    location        VARCHAR(200),
    start_date      DATE,
    planned_end     DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tower (
    tower_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES project(project_id),
    tower_code      VARCHAR(20) NOT NULL,
    total_floors    INT NOT NULL,
    typical_floor_height_mm INT DEFAULT 3000,
    UNIQUE(project_id, tower_code)
);

CREATE TABLE floor (
    floor_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tower_id        UUID NOT NULL REFERENCES tower(tower_id),
    floor_number    INT NOT NULL,
    floor_label     VARCHAR(20), -- e.g., "GF", "1F", "TERRACE"
    slab_area_m2    DECIMAL(10,2),
    perimeter_m     DECIMAL(10,2),
    is_typical       BOOLEAN DEFAULT TRUE,
    UNIQUE(tower_id, floor_number)
);

-- Formwork systems and components
CREATE TABLE formwork_system (
    system_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_code             VARCHAR(50) UNIQUE NOT NULL,
    vendor                  VARCHAR(100) NOT NULL,
    system_type             formwork_system_type NOT NULL,
    rated_reuse_cycles      INT NOT NULL DEFAULT 300,
    panel_height_options_mm INT[] NOT NULL,
    panel_width_options_mm  INT[] NOT NULL,
    min_tie_spacing_mm      INT,
    max_pour_pressure_kpa   DECIMAL(8,2),
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE formwork_component (
    component_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id               UUID NOT NULL REFERENCES formwork_system(system_id),
    sap_material_code       VARCHAR(40),
    component_type          component_type NOT NULL,
    description             VARCHAR(300),
    width_mm                INT,
    height_mm               INT,
    length_mm               INT,
    weight_kg               DECIMAL(8,2),
    face_type               face_type,
    transport_unit          transport_unit DEFAULT 'INDIVIDUAL',
    unit_cost_buy           DECIMAL(12,2) NOT NULL DEFAULT 0,
    unit_cost_rent_per_day  DECIMAL(10,2) NOT NULL DEFAULT 0,
    loss_rate_per_cycle     DECIMAL(6,4) NOT NULL DEFAULT 0.002,
    damage_rate_per_cycle   DECIMAL(6,4) NOT NULL DEFAULT 0.005,
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    -- SAP linkage index
    CONSTRAINT uq_sap_material UNIQUE NULLS NOT DISTINCT (sap_material_code)
);

CREATE INDEX idx_component_system ON formwork_component(system_id);
CREATE INDEX idx_component_type ON formwork_component(component_type);

-- Compatibility rules between components
CREATE TABLE compatibility_rule (
    rule_id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_id               UUID NOT NULL REFERENCES formwork_system(system_id),
    rule_type               compatibility_rule_type NOT NULL,
    source_component_id     UUID NOT NULL REFERENCES formwork_component(component_id),
    target_component_id     UUID NOT NULL REFERENCES formwork_component(component_id),
    condition               JSONB DEFAULT '{}',
    quantity_ratio          DECIMAL(8,4),
    notes                   TEXT,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compat_source ON compatibility_rule(source_component_id);
CREATE INDEX idx_compat_system ON compatibility_rule(system_id);

-- Physical component instances (tracked units)
CREATE TABLE component_instance (
    instance_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id            UUID NOT NULL REFERENCES formwork_component(component_id),
    project_id              UUID NOT NULL REFERENCES project(project_id),
    serial_tag              VARCHAR(100),
    procurement_type        procurement_type NOT NULL DEFAULT 'OWNED',
    date_inducted           DATE NOT NULL DEFAULT CURRENT_DATE,
    total_cycles_used       INT NOT NULL DEFAULT 0,
    current_status          instance_status NOT NULL DEFAULT 'AVAILABLE',
    current_location        VARCHAR(200),
    last_inspection_date    DATE,
    condition_grade         condition_grade DEFAULT 'A',
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_instance_component ON component_instance(component_id);
CREATE INDEX idx_instance_project ON component_instance(project_id);
CREATE INDEX idx_instance_status ON component_instance(current_status);

-- ============================================================
-- POUR PLANNING
-- ============================================================

CREATE TABLE pour_zone (
    zone_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id        UUID NOT NULL REFERENCES floor(floor_id),
    zone_code       VARCHAR(20) NOT NULL,
    zone_type       pour_type NOT NULL,
    gross_area_m2   DECIMAL(10,2) NOT NULL,
    net_area_m2     DECIMAL(10,2) NOT NULL, -- after openings deduction
    perimeter_m     DECIMAL(10,2),
    height_mm       INT, -- for walls/columns
    notes           TEXT,
    UNIQUE(floor_id, zone_code)
);

CREATE TABLE pour (
    pour_id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id              UUID NOT NULL REFERENCES project(project_id),
    tower_id                UUID NOT NULL REFERENCES tower(tower_id),
    floor_number            INT NOT NULL,
    zone_code               VARCHAR(20) NOT NULL,
    pour_type               pour_type NOT NULL,
    planned_date            DATE NOT NULL,
    actual_date             DATE,
    gross_surface_area_m2   DECIMAL(10,2) NOT NULL,
    net_surface_area_m2     DECIMAL(10,2) NOT NULL,
    concrete_grade          VARCHAR(20) NOT NULL DEFAULT 'M40',
    concrete_volume_m3      DECIMAL(10,2),
    pour_height_mm          INT,
    pour_rate_m_per_hour    DECIMAL(6,2),
    strip_cycle_hours       INT NOT NULL DEFAULT 12,
    schedule_activity_id    VARCHAR(50),
    status                  pour_status NOT NULL DEFAULT 'SCHEDULED',
    predecessor_pour_ids    UUID[] DEFAULT '{}',
    assigned_system_id      UUID REFERENCES formwork_system(system_id),
    created_at              TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, tower_id, floor_number, zone_code, pour_type)
);

CREATE INDEX idx_pour_project ON pour(project_id);
CREATE INDEX idx_pour_date ON pour(planned_date);
CREATE INDEX idx_pour_status ON pour(status);

-- Pour schedule (tracks schedule versions)
CREATE TABLE pour_schedule_version (
    version_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES project(project_id),
    version_number  INT NOT NULL,
    import_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_file     VARCHAR(300),
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE(project_id, version_number)
);

CREATE TABLE pour_schedule_entry (
    entry_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id      UUID NOT NULL REFERENCES pour_schedule_version(version_id),
    pour_id         UUID NOT NULL REFERENCES pour(pour_id),
    planned_start   DATE NOT NULL,
    planned_finish  DATE NOT NULL,
    formwork_start  DATE NOT NULL, -- erection start (typically 1-2 days before pour)
    strip_date      DATE NOT NULL, -- earliest strip (pour finish + strip cycle)
    available_date  DATE NOT NULL  -- cleaned and available (strip + cleaning buffer)
);

CREATE INDEX idx_schedule_version ON pour_schedule_entry(version_id);

-- ============================================================
-- KIT MANAGEMENT
-- ============================================================

CREATE TABLE kit (
    kit_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pour_id                 UUID NOT NULL REFERENCES pour(pour_id),
    kit_type                pour_type NOT NULL,
    status                  kit_status NOT NULL DEFAULT 'PLANNED',
    generation_method       kit_generation_method NOT NULL DEFAULT 'OPTIMIZER',
    config_variant          VARCHAR(10) DEFAULT 'A', -- A, B, C for alternatives
    total_panel_area_m2     DECIMAL(10,2),
    coverage_ratio          DECIMAL(6,4), -- >= 1.0
    estimated_assemble_hours DECIMAL(6,2),
    estimated_strip_hours   DECIMAL(6,2),
    optimizer_score         DECIMAL(14,2), -- objective function cost
    optimizer_run_id        UUID,
    planner_approved        BOOLEAN DEFAULT FALSE,
    planner_approved_by     VARCHAR(100),
    planner_approved_at     TIMESTAMPTZ,
    planner_notes           TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kit_pour ON kit(pour_id);
CREATE INDEX idx_kit_status ON kit(status);

CREATE TABLE kit_line_item (
    line_id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kit_id                  UUID NOT NULL REFERENCES kit(kit_id),
    component_id            UUID NOT NULL REFERENCES formwork_component(component_id),
    instance_id             UUID REFERENCES component_instance(instance_id),
    quantity                INT NOT NULL DEFAULT 1,
    assignment_reason       TEXT NOT NULL,
    source_pour_id          UUID REFERENCES pour(pour_id), -- if reused
    available_from_date     DATE,
    reuse_cycle_number      INT,
    cost_contribution       DECIMAL(12,2), -- this line item's cost
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kit_line_kit ON kit_line_item(kit_id);
CREATE INDEX idx_kit_line_component ON kit_line_item(component_id);

-- ============================================================
-- REUSE CYCLE TRACKING
-- ============================================================

CREATE TABLE reuse_cycle (
    cycle_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id         UUID NOT NULL REFERENCES component_instance(instance_id),
    pour_id             UUID NOT NULL REFERENCES pour(pour_id),
    kit_id              UUID NOT NULL REFERENCES kit(kit_id),
    cycle_number        INT NOT NULL,
    deployed_date       DATE NOT NULL,
    stripped_date       DATE,
    condition_before    condition_grade NOT NULL,
    condition_after     condition_grade,
    cleaning_hours      DECIMAL(6,2),
    repair_required     BOOLEAN DEFAULT FALSE,
    repair_hours        DECIMAL(6,2),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(instance_id, cycle_number)
);

CREATE INDEX idx_reuse_instance ON reuse_cycle(instance_id);
CREATE INDEX idx_reuse_pour ON reuse_cycle(pour_id);

-- ============================================================
-- INVENTORY MANAGEMENT
-- ============================================================

CREATE TABLE inventory_state (
    snapshot_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    snapshot_date       DATE NOT NULL,
    component_id        UUID NOT NULL REFERENCES formwork_component(component_id),
    qty_total           INT NOT NULL DEFAULT 0,
    qty_deployed        INT NOT NULL DEFAULT 0,
    qty_available       INT NOT NULL DEFAULT 0,
    qty_in_transit      INT NOT NULL DEFAULT 0,
    qty_under_repair    INT NOT NULL DEFAULT 0,
    qty_condemned        INT NOT NULL DEFAULT 0,
    avg_remaining_cycles DECIMAL(8,2),
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, snapshot_date, component_id)
);

CREATE INDEX idx_inv_state_project_date ON inventory_state(project_id, snapshot_date);

CREATE TABLE inventory_transaction (
    txn_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    component_id        UUID NOT NULL REFERENCES formwork_component(component_id),
    instance_id         UUID REFERENCES component_instance(instance_id),
    txn_type            inventory_txn_type NOT NULL,
    quantity            INT NOT NULL,
    txn_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    pour_id             UUID REFERENCES pour(pour_id),
    sap_document_number VARCHAR(30),
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inv_txn_project ON inventory_transaction(project_id);
CREATE INDEX idx_inv_txn_date ON inventory_transaction(txn_date);
CREATE INDEX idx_inv_txn_component ON inventory_transaction(component_id);
CREATE INDEX idx_inv_txn_sap ON inventory_transaction(sap_document_number);

-- ============================================================
-- OPTIMIZER RUNS (AUDIT TRAIL)
-- ============================================================

CREATE TABLE optimizer_run (
    run_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES project(project_id),
    run_timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    schedule_version_id UUID REFERENCES pour_schedule_version(version_id),
    pour_window_start   DATE NOT NULL,
    pour_window_end     DATE NOT NULL,
    solver_type         VARCHAR(50) NOT NULL, -- 'CP-SAT', 'HiGHS', 'ROLLING_HORIZON'
    objective_value     DECIMAL(14,2),
    solve_time_seconds  DECIMAL(10,2),
    optimality_gap      DECIMAL(6,4),
    status              VARCHAR(20) NOT NULL, -- 'OPTIMAL', 'FEASIBLE', 'INFEASIBLE', 'TIMEOUT'
    num_pours           INT,
    num_variables       INT,
    num_constraints     INT,
    parameters          JSONB DEFAULT '{}', -- solver config
    triggered_by        VARCHAR(100), -- user or 'SCHEDULE_CHANGE'
    notes               TEXT
);

CREATE INDEX idx_opt_run_project ON optimizer_run(project_id);

-- ============================================================
-- MATERIAL NORMALIZATION (SAP mapping)
-- ============================================================

CREATE TABLE material_normalization (
    mapping_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sap_material_code   VARCHAR(40) NOT NULL,
    sap_description     VARCHAR(300),
    component_id        UUID REFERENCES formwork_component(component_id),
    confidence          DECIMAL(4,2) DEFAULT 0.0, -- 0.0 = unmatched, 1.0 = confirmed
    matched_by          VARCHAR(20) DEFAULT 'REGEX', -- 'REGEX', 'MANUAL', 'ML'
    confirmed_by        VARCHAR(100),
    confirmed_at        TIMESTAMPTZ,
    notes               TEXT,
    UNIQUE(sap_material_code)
);

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Current inventory summary per project
CREATE OR REPLACE VIEW v_current_inventory AS
SELECT DISTINCT ON (is2.project_id, is2.component_id)
    is2.project_id,
    p.project_code,
    is2.component_id,
    fc.component_type,
    fc.description,
    fs.system_code,
    is2.qty_total,
    is2.qty_available,
    is2.qty_deployed,
    is2.qty_under_repair,
    is2.qty_condemned,
    is2.avg_remaining_cycles,
    is2.snapshot_date
FROM inventory_state is2
JOIN project p ON p.project_id = is2.project_id
JOIN formwork_component fc ON fc.component_id = is2.component_id
JOIN formwork_system fs ON fs.system_id = fc.system_id
ORDER BY is2.project_id, is2.component_id, is2.snapshot_date DESC;

-- Pour timeline with kit status
CREATE OR REPLACE VIEW v_pour_timeline AS
SELECT
    pr.pour_id,
    pr.project_id,
    t.tower_code,
    pr.floor_number,
    pr.zone_code,
    pr.pour_type,
    pr.planned_date,
    pr.actual_date,
    pr.net_surface_area_m2,
    pr.concrete_grade,
    pr.strip_cycle_hours,
    pr.status AS pour_status,
    k.kit_id,
    k.status AS kit_status,
    k.generation_method,
    k.coverage_ratio,
    k.optimizer_score,
    k.planner_approved,
    fs.system_code AS assigned_system
FROM pour pr
JOIN tower t ON t.tower_id = pr.tower_id
LEFT JOIN kit k ON k.pour_id = pr.pour_id AND k.status != 'PLANNED'
LEFT JOIN formwork_system fs ON fs.system_id = pr.assigned_system_id
ORDER BY pr.planned_date, t.tower_code, pr.floor_number, pr.zone_code;

-- Reuse chain view: for each component instance, show its deployment history
CREATE OR REPLACE VIEW v_reuse_chain AS
SELECT
    ci.instance_id,
    fc.component_type,
    fc.description,
    fs.system_code,
    ci.total_cycles_used,
    (fs.rated_reuse_cycles - ci.total_cycles_used) AS remaining_cycles,
    ci.current_status,
    ci.condition_grade,
    rc.pour_id,
    pr.floor_number,
    pr.zone_code,
    rc.cycle_number,
    rc.deployed_date,
    rc.stripped_date,
    rc.condition_after
FROM component_instance ci
JOIN formwork_component fc ON fc.component_id = ci.component_id
JOIN formwork_system fs ON fs.system_id = fc.system_id
LEFT JOIN reuse_cycle rc ON rc.instance_id = ci.instance_id
LEFT JOIN pour pr ON pr.pour_id = rc.pour_id
ORDER BY ci.instance_id, rc.cycle_number;
