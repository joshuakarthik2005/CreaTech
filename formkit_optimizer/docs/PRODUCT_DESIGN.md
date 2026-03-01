# FormKit Optimizer — Product Design Document

## Automation of Formwork Kitting & BoQ Optimization Using Data Science

**Version:** 1.0  
**Date:** March 2026  
**Classification:** L&T Internal — Engineering & Construction Division  
**Author:** CreaTech Innovation Cell  

---

## TABLE OF CONTENTS

1. [Product Vision & User Reality](#section-1--product-vision--user-reality)
2. [Data Availability & Ingestion](#section-2--data-availability--ingestion)
3. [Core Data Models](#section-3--core-data-models)
4. [Optimization Formulation](#section-4--optimization-formulation)
5. [System Flow](#section-5--system-flow)
6. [Validation](#section-6--validation)
7. [Implementation Roadmap](#section-7--implementation-roadmap)
8. [Competitive Moat](#section-8--competitive-moat)

---

# SECTION 1 — PRODUCT VISION & USER REALITY

## Product Name

**FormKit Optimizer** (internal codename: **FKO**)

## What It Is

FormKit Optimizer is an internal L&T software system that automates formwork kit assembly, sequences pour-level reuse across floors, and generates an optimized Bill of Quantities that reflects actual site-level repetition — not static worst-case provisioning.

It replaces the current workflow of manual panel takeoff → Excel inventory cross-reference → SAP PS BoQ entry with a data-driven pipeline that reads structural geometry, pour schedules, and live inventory state to produce deployable kitting instructions per pour.

## Who Uses It

| Role | How They Use FKO | Current Pain |
|------|-------------------|--------------|
| **Site Formwork Planner** | Receives kit list per pour, reviews/overrides component selection, confirms strip-and-redeploy sequence | Manually maps panels to pours using area calculations on paper/Excel. No visibility into what's available from the previous strip. |
| **Central Planning Cell** | Sets project-level formwork strategy: number of sets, target repetition factor, vendor system selection | Relies on experience-based heuristics. Over-provisions "2.5 sets" for safety. Cannot quantify cost of extra inventory. |
| **Commercial / Procurement** | Gets optimized BoQ with rental vs. buy recommendations, tracks utilization against plan | BoQ is a static document prepared once, never reconciled against actual reuse. Excess inventory discovered only at project end. |
| **Stores / Yard Manager** | Receives return-inspect-redeploy instructions, damage tracking integration | Manages returns on paper. No system tracks remaining reuse cycles per component. |

## What Pain It Removes That Excel + ERP Cannot

**Excel fails because:**
- Panel-to-pour mapping is combinatorial. A 25-storey tower with 8 pours per floor = 200 pour events. Each pour requires 15–60 distinct formwork components. Excel cannot optimize across 200 × 60 = 12,000 assignment decisions.
- Excel has no concept of time-phased inventory. It cannot model "Panel P-1200×600 is available on Day 14 after stripping from Pour 3A, but only if concrete grade M40 with 12-hour curing is used."
- Strip cycle constraints (minimum days before formwork can be removed) create temporal coupling between pours that spreadsheets cannot represent.

**SAP PS/MM fails because:**
- SAP tracks material movements (issue/return) but has no logic for formwork reuse planning. A panel issued on Day 1 and returned on Day 5 is recorded as two transactions — SAP does not know it was reused and can be reused again.
- SAP BoQ is a procurement document, not an operational plan. It lists total quantities, not pour-sequence allocations.
- No optimization engine exists in SAP for multi-period inventory balancing across pours.

**FormKit Optimizer fills the gap:**
- It models formwork as a reusable resource pool with time-phased availability, degradation tracking, and compatibility constraints.
- It solves the kit-to-pour assignment as a constrained optimization that minimizes total project cost (procurement + rental + handling + loss).
- It provides explainable kit recommendations: "Panel A assigned to Pour 7B because it becomes available after stripping Pour 5A on Day 18, has 48 remaining reuse cycles, and is compatible with the PERI TRIO system specified for this zone."

## Why This Must Exist INSIDE L&T

1. **Cross-project learning**: L&T executes 50+ concurrent high-rise projects. Formwork consumption patterns, damage rates, and reuse factors from completed projects become training data. No vendor tool aggregates across the L&T enterprise.

2. **Vendor neutrality**: PERI CAD and Doka Tipos optimize only for their own systems. L&T projects use mixed vendor systems (PERI walls + Doka slabs + aluminum panels for columns). FKO optimizes across all systems simultaneously.

3. **ERP integration**: FKO reads SAP MM material masters and writes back optimized BoQs and issue plans. This closed loop is impossible with external vendor tools.

4. **Institutional IP**: Formwork planning knowledge currently lives in senior planners' heads. FKO captures this as codified rules + optimization logic, reducing key-person dependency.

---

# SECTION 2 — DATA AVAILABILITY & INGESTION

## What Data Realistically Exists Today

### Source 1: SAP MM — Material Master Records

| Field | Availability | Quality |
|-------|-------------|---------|
| Material code | ✅ Always exists | Clean — SAP-enforced |
| Description (free text) | ✅ Exists | Dirty — inconsistent naming across projects ("PERI Panel 1200x600" vs "TRIO WDP 120/60") |
| Material group | ✅ Exists | Usable — maps to formwork system at group level |
| UoM | ✅ Exists | Clean |
| Plant / storage location | ✅ Exists | Clean |
| Batch number | ⚠️ Sometimes | Only if project uses batch management for formwork |
| Reuse cycle count | ❌ Does not exist in SAP | Must be derived or initialized |
| Damage status | ❌ Does not exist in SAP | Must come from inspection process |

### Source 2: SAP MM — Goods Movement Logs (MIGO / MB51)

| Field | Availability | Quality |
|-------|-------------|---------|
| Movement type (101/261/262/122) | ✅ Always | Clean |
| Material code | ✅ Always | Clean |
| Quantity | ✅ Always | Clean |
| Posting date | ✅ Always | Clean |
| Cost center / WBS element | ✅ Always | Maps to project zone |
| Reference document | ⚠️ Sometimes | Can link to pour if coded correctly |

**Key insight**: Goods Issue (mvt 261) to a WBS element = formwork deployed to a pour zone. Goods Return (mvt 262) = formwork stripped and returned. The time gap between 261 and 262 for the same material + WBS = actual cycle time. This is gold for reuse modeling.

### Source 3: Pour Schedule (Primavera P6 / MS Project Exports)

| Field | Availability | Quality |
|-------|-------------|---------|
| Activity ID | ✅ Always | Clean |
| Activity name | ✅ Always | Semi-structured — "POUR-T1-F03-Z2-SLAB" parseable with regex |
| Start / Finish date | ✅ Always | Clean (but schedule changes frequently) |
| Duration | ✅ Always | Derived |
| Predecessors | ✅ Always | Critical for sequencing |
| WBS code | ✅ Always | Links to SAP WBS |

**Key insight**: Pour activity naming conventions at L&T typically follow `POUR-{Tower}-{Floor}-{Zone}-{Type}`. This can be parsed to extract structural element type (slab/column/beam/wall), floor, and zone — which directly maps to formwork demand.

### Source 4: Structural Drawings / BIM (When Available)

| Field | Availability | Quality |
|-------|-------------|---------|
| Element dimensions | ⚠️ If BIM exists | High quality from Revit/Tekla |
| Pour boundaries | ⚠️ If pour plans exist | Usually available as 2D PDF markup |
| Surface area per pour | ❌ Not digitized | Currently hand-calculated |

**Minimum Viable Data Strategy**: FKO v1.0 does NOT require BIM. It uses manual surface area input per pour (which planners already calculate) plus SAP data + schedule exports. BIM integration is a v2.0 enhancement.

## Minimum Viable Data Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                   DATA INGESTION LAYER                   │
├──────────────┬───────────────┬───────────────────────────┤
│  SAP Extract │  Schedule     │  Manual Input             │
│  (CSV/XLSX)  │  Export (XML/ │  (Surface areas,          │
│              │   CSV from P6)│   system assignments)     │
├──────────────┴───────────────┴───────────────────────────┤
│                  NORMALIZATION ENGINE                     │
│  • Material code → FormworkComponent mapping             │
│  • Free-text description → (System, Type, Dimensions)    │
│  • Activity name → (Tower, Floor, Zone, ElementType)     │
│  • Goods movements → ReuseCycle records                  │
├──────────────────────────────────────────────────────────┤
│                  VALIDATION LAYER                         │
│  • Orphan detection (material with no system mapping)    │
│  • Schedule-inventory cross-check                        │
│  • Duplicate / conflicting record resolution             │
├──────────────────────────────────────────────────────────┤
│                  NORMALIZED DATA STORE                    │
│  PostgreSQL — schemas defined in Section 3               │
└──────────────────────────────────────────────────────────┘
```

### File Format Handling

| Source | Format | Parser |
|--------|--------|--------|
| SAP material master | CSV (SE16N export of MARA/MARC) | Python pandas — column mapping config |
| SAP goods movements | CSV (MB51 export) | Python pandas — movement type filter |
| Schedule | .XML (P6 XER) or .CSV (MS Project) | Custom XER parser / csv reader |
| Surface areas | XLSX template provided by FKO | Validated pandas read with schema check |

### How Dirty / Missing Data Is Handled

**Problem 1: Inconsistent material descriptions**
- Solution: Build a material normalization lookup table. Initial seeding by regex pattern matching on known vendor naming conventions. Planners confirm/correct via UI during onboarding. Once confirmed, mapping is reused across projects.
- Example: "PERI TRIO Panel WDP 240" → System: PERI TRIO, Type: Wall Panel, Width: 2400mm, Height: 2700mm (default)

**Problem 2: Missing reuse cycle counts**
- Solution: Initialize all existing inventory at a configurable default (e.g., "50% of rated life" for items already in use, "100% of rated life" for new procurement). Planners override per batch if known. System tracks forward from initialization.

**Problem 3: Missing surface area per pour**
- Solution: Required manual input during project onboarding. Provided as a simple table: (Pour ID, Element Type, Gross Surface Area m², Openings/Deductions m²). This is data the planner already has.

**Problem 4: Schedule changes mid-project**
- Solution: FKO supports schedule re-import. Optimizer re-runs with updated dates, preserving all already-executed pours as fixed. Only future pours are re-optimized. Diff report shows impact of schedule change on kit assignments and BoQ.

**Problem 5: No batch-level tracking in SAP**
- Solution: FKO maintains its own component instance registry. Each physical formwork panel gets an FKO ID (e.g., FKO-PERI-WDP240-00147). Initial population from SAP quantities; subsequent tracking within FKO. Linkage to SAP maintained at material-code level for BoQ reconciliation.

---

# SECTION 3 — CORE DATA MODELS

## Entity Relationship Overview

```
FormworkSystem ──┐
                 ├── FormworkComponent ──┬── CompatibilityRule
                 │                       ├── ComponentInstance
                 │                       │      └── ReuseCycle
                 │                       └── KitLineItem
                 │                              └── Kit
Project ────┬── Tower                                │
            │    └── Floor                           │
            │         └── PourZone ──── Pour ────────┘
            │                            └── PourSchedule
            └── InventoryState
                  └── InventoryTransaction
```

## Schema Definitions

### FormworkSystem
Represents a vendor formwork product family (e.g., PERI TRIO, Doka Frami Xlife, MEVA StarTec).

| Column | Type | Description |
|--------|------|-------------|
| system_id | UUID PK | Internal identifier |
| system_code | VARCHAR(50) UNIQUE | e.g., "PERI_TRIO" |
| vendor | VARCHAR(100) | e.g., "PERI GmbH" |
| system_type | ENUM | WALL, SLAB, COLUMN, CLIMBING |
| rated_reuse_cycles | INT | Manufacturer-rated max cycles (e.g., 300 for steel-frame panels) |
| panel_height_options_mm | INT[] | e.g., [2700, 3300, 3600] |
| panel_width_options_mm | INT[] | e.g., [240, 300, 450, 600, 900, 1200, 2400] |
| min_tie_spacing_mm | INT | Minimum horizontal tie rod spacing |
| max_pour_pressure_kpa | DECIMAL | Max fresh concrete pressure the system tolerates |

### FormworkComponent
A catalog-level component (not a physical instance — a type).

| Column | Type | Description |
|--------|------|-------------|
| component_id | UUID PK | Internal identifier |
| system_id | UUID FK → FormworkSystem | Which system this belongs to |
| sap_material_code | VARCHAR(40) | SAP material master linkage |
| component_type | ENUM | PANEL, FILLER, TIE_ROD, TIE_CONE, WALER, PROP, CLAMP, WEDGE, CORNER, ACCESSORY |
| width_mm | INT NULL | For panels/fillers |
| height_mm | INT NULL | For panels |
| length_mm | INT NULL | For walers/ties |
| weight_kg | DECIMAL | Per unit weight |
| face_type | ENUM NULL | STEEL, PLYWOOD, ALUMINUM, PLASTIC (for panels) |
| transport_unit | ENUM | INDIVIDUAL, BUNDLE_10, BUNDLE_20, PALLET, CONTAINER |
| unit_cost_buy | DECIMAL | Purchase cost per unit |
| unit_cost_rent_per_day | DECIMAL | Rental rate per unit per day |
| loss_rate_per_cycle | DECIMAL | Expected loss fraction per use (e.g., 0.002 = 0.2%) |
| damage_rate_per_cycle | DECIMAL | Expected damage fraction per use requiring repair |

### ComponentInstance
A physical, trackable unit of formwork on the project.

| Column | Type | Description |
|--------|------|-------------|
| instance_id | UUID PK | FKO tracking ID |
| component_id | UUID FK → FormworkComponent | What type this is |
| project_id | UUID FK → Project | Which project holds it |
| serial_tag | VARCHAR(100) NULL | Physical tag / barcode if exists |
| procurement_type | ENUM | OWNED, RENTED, TRANSFERRED |
| date_inducted | DATE | When this unit entered the project |
| total_cycles_used | INT DEFAULT 0 | Cumulative reuse count |
| current_status | ENUM | AVAILABLE, DEPLOYED, IN_TRANSIT, UNDER_REPAIR, CONDEMNED, RETURNED_TO_VENDOR |
| current_location | VARCHAR(200) | Storage yard / floor / pour zone |
| last_inspection_date | DATE NULL | |
| condition_grade | ENUM | A (good), B (minor wear), C (needs repair), D (condemned) |

### CompatibilityRule
Defines which components can be used together in a kit.

| Column | Type | Description |
|--------|------|-------------|
| rule_id | UUID PK | |
| system_id | UUID FK → FormworkSystem | |
| rule_type | ENUM | REQUIRES, EXCLUDES, REPLACES, QUANTITY_RATIO |
| source_component_id | UUID FK → FormworkComponent | |
| target_component_id | UUID FK → FormworkComponent | |
| condition | JSONB | e.g., {"when_height_exceeds_mm": 3000} |
| quantity_ratio | DECIMAL NULL | e.g., 1 panel requires 2 tie rods → ratio = 2.0 |
| notes | TEXT | Human-readable explanation |

**Example compatibility rules:**
- PERI TRIO panel (any width) REQUIRES DW15 tie rod. Quantity ratio: 1 tie per 0.75m² of panel face area.
- PERI TRIO panel width 2400mm REQUIRES BFD alignment coupler at every vertical joint.
- PERI TRIO panel EXCLUDES Doka Frami panel (cannot mix systems on same pour face).
- PERI TRIO filler 100mm REPLACES PERI TRIO filler 50mm × 2 (substitution rule).

### Kit
A pour-specific assembly of formwork components.

| Column | Type | Description |
|--------|------|-------------|
| kit_id | UUID PK | |
| pour_id | UUID FK → Pour | Which pour this kit serves |
| kit_type | ENUM | WALL, SLAB, COLUMN, BEAM, SHEAR_WALL |
| status | ENUM | PLANNED, CONFIRMED, DEPLOYED, STRIPPED, VERIFIED |
| generation_method | ENUM | OPTIMIZER, MANUAL, HYBRID |
| total_panel_area_m2 | DECIMAL | Computed from line items |
| coverage_ratio | DECIMAL | kit area / required area (target ≥ 1.0) |
| estimated_assemble_hours | DECIMAL | Labor estimate |
| estimated_strip_hours | DECIMAL | |
| optimizer_score | DECIMAL | Objective function value for this kit |
| planner_approved | BOOLEAN DEFAULT FALSE | |
| planner_notes | TEXT NULL | |

### KitLineItem
Individual component allocation within a kit.

| Column | Type | Description |
|--------|------|-------------|
| line_id | UUID PK | |
| kit_id | UUID FK → Kit | |
| component_id | UUID FK → FormworkComponent | Component type |
| instance_id | UUID FK → ComponentInstance NULL | Specific unit (NULL if not instance-tracked) |
| quantity | INT | Number of this component in kit |
| assignment_reason | TEXT | Explainability: why this component was chosen |
| source_pour_id | UUID FK → Pour NULL | If reused, which previous pour it came from |
| available_from_date | DATE | When this component becomes available for this kit |
| reuse_cycle_number | INT | Which reuse cycle this represents for this specific unit |

### Pour
A single concrete pour event.

| Column | Type | Description |
|--------|------|-------------|
| pour_id | UUID PK | |
| project_id | UUID FK → Project | |
| tower_id | UUID FK → Tower | |
| floor_number | INT | |
| zone_code | VARCHAR(20) | e.g., "Z1", "Z2" |
| pour_type | ENUM | SLAB, COLUMN, BEAM, WALL, SHEAR_WALL, COMBINED |
| planned_date | DATE | From schedule |
| actual_date | DATE NULL | Filled after execution |
| gross_surface_area_m2 | DECIMAL | Total formwork contact area |
| net_surface_area_m2 | DECIMAL | After deducting openings |
| concrete_grade | VARCHAR(20) | e.g., "M40", "M50" |
| concrete_volume_m3 | DECIMAL | |
| pour_height_mm | INT | For walls/columns — affects pressure calc |
| pour_rate_m_per_hour | DECIMAL NULL | Concrete placement rate — affects pressure |
| strip_cycle_hours | INT | Minimum hours before formwork removal |
| schedule_activity_id | VARCHAR(50) | Linkage to Primavera/MSP activity |
| status | ENUM | SCHEDULED, FORMWORK_DEPLOYED, POURED, CURING, STRIPPED, COMPLETED |
| predecessor_pour_ids | UUID[] | Pours that must complete (strip) before this one can start formwork |

### ReuseCycle
Tracks each deployment-strip cycle of a component instance.

| Column | Type | Description |
|--------|------|-------------|
| cycle_id | UUID PK | |
| instance_id | UUID FK → ComponentInstance | |
| pour_id | UUID FK → Pour | |
| kit_id | UUID FK → Kit | |
| deployed_date | DATE | |
| stripped_date | DATE NULL | |
| cycle_number | INT | Nth use of this instance |
| condition_before | ENUM | A, B, C, D |
| condition_after | ENUM NULL | A, B, C, D |
| cleaning_hours | DECIMAL NULL | |
| repair_required | BOOLEAN | |
| notes | TEXT NULL | |

### InventoryState
Time-phased snapshot of inventory availability.

| Column | Type | Description |
|--------|------|-------------|
| snapshot_id | UUID PK | |
| project_id | UUID FK → Project | |
| snapshot_date | DATE | |
| component_id | UUID FK → FormworkComponent | |
| qty_total | INT | Total on project |
| qty_deployed | INT | Currently on active pours |
| qty_available | INT | In yard, ready to deploy |
| qty_in_transit | INT | Being moved between locations |
| qty_under_repair | INT | |
| qty_condemned | INT | Beyond reuse |
| avg_remaining_cycles | DECIMAL | Average remaining rated cycles |

### InventoryTransaction
Every movement event.

| Column | Type | Description |
|--------|------|-------------|
| txn_id | UUID PK | |
| project_id | UUID FK → Project | |
| component_id | UUID FK → FormworkComponent | |
| instance_id | UUID FK → ComponentInstance NULL | |
| txn_type | ENUM | PROCURE, ISSUE_TO_POUR, RETURN_FROM_POUR, TRANSFER_IN, TRANSFER_OUT, CONDEMN, REPAIR_SEND, REPAIR_RECEIVE |
| quantity | INT | |
| txn_date | DATE | |
| pour_id | UUID FK → Pour NULL | |
| sap_document_number | VARCHAR(30) NULL | Linkage to SAP MIGO doc |
| notes | TEXT NULL | |

---

# SECTION 4 — OPTIMIZATION FORMULATION

## Problem Classification

This is a **multi-period, multi-resource assignment and inventory balancing problem** with:
- Deterministic demand (pour schedule is known)
- Reusable resources (formwork components, not consumables)
- Temporal coupling (strip cycle constraints link consecutive pours)
- Compatibility constraints (vendor system rules)
- Multiple cost components (procurement, rental, handling, loss, idle holding)

It is formally a variant of the **Resource-Constrained Project Scheduling Problem (RCPSP)** crossed with a **multi-period lot-sizing / inventory optimization** problem.

## Index Sets

| Symbol | Definition |
|--------|-----------|
| $p \in P$ | Set of pours, ordered by planned date |
| $t \in T$ | Set of time periods (days), $t = 1, \ldots, T_{max}$ |
| $c \in C$ | Set of formwork component types |
| $s \in S$ | Set of formwork systems |
| $k \in K_p$ | Set of candidate kit configurations for pour $p$ |

## Parameters

| Symbol | Definition | Source |
|--------|-----------|--------|
| $d_{p,c}$ | Demand — quantity of component type $c$ required by pour $p$ (depends on kit config chosen) | Computed from surface area + panel layout |
| $\tau_p^{start}$ | Planned start date of formwork erection for pour $p$ | Schedule |
| $\tau_p^{strip}$ | Earliest strip date for pour $p$ = pour date + strip cycle hours | Schedule + concrete grade |
| $\tau_p^{avail}$ | Date components from pour $p$ become available after stripping + cleaning = $\tau_p^{strip} + \delta_{clean}$ | Computed |
| $R_c$ | Maximum rated reuse cycles for component type $c$ | Manufacturer spec |
| $\bar{r}_{c,i}$ | Remaining reuse cycles for instance $i$ of component $c$ | Tracked in system |
| $\alpha_c$ | Loss rate per cycle for component $c$ | Historical data / default |
| $\beta_c$ | Damage rate per cycle for component $c$ | Historical data / default |
| $C_c^{buy}$ | Unit purchase cost of component $c$ | SAP material master |
| $C_c^{rent}$ | Unit rental cost per day of component $c$ | Vendor contract |
| $C_c^{handle}$ | Handling cost per deployment (transport, erect, strip) | Site estimate |
| $C_c^{hold}$ | Holding/carrying cost per unit per day (idle inventory) | Finance input |
| $\text{Compat}(c_1, c_2)$ | Binary: 1 if components $c_1$ and $c_2$ can be used together | Compatibility rules |

## Decision Variables

| Variable | Type | Definition |
|----------|------|-----------|
| $x_{p,c}$ | Integer ≥ 0 | Quantity of component type $c$ assigned to pour $p$ |
| $y_{p,q,c}$ | Integer ≥ 0 | Quantity of component $c$ reused from pour $q$ to pour $p$ (where $q$ strips before $p$ starts) |
| $b_{c,t}$ | Integer ≥ 0 | New procurement of component $c$ arriving at time $t$ |
| $r_{c,t}$ | Integer ≥ 0 | Rental quantity of component $c$ active at time $t$ |
| $I_{c,t}$ | Integer ≥ 0 | Idle inventory of component $c$ at time $t$ |
| $z_p^k$ | Binary | 1 if kit configuration $k$ is selected for pour $p$ |

## Objective Function

Minimize total project formwork cost:

$$
\min Z = \underbrace{\sum_{c} \sum_{t} C_c^{buy} \cdot b_{c,t}}_{\text{Procurement Cost}}
+ \underbrace{\sum_{c} \sum_{t} C_c^{rent} \cdot r_{c,t}}_{\text{Rental Cost}}
+ \underbrace{\sum_{p} \sum_{c} C_c^{handle} \cdot x_{p,c}}_{\text{Handling Cost}}
+ \underbrace{\sum_{c} \sum_{t} C_c^{hold} \cdot I_{c,t}}_{\text{Holding Cost}}
+ \underbrace{\sum_{p} \sum_{c} \alpha_c \cdot C_c^{buy} \cdot x_{p,c}}_{\text{Expected Loss Cost}}
$$

## Constraints

### C1: Coverage Constraint (Every pour must be fully covered)

$$
x_{p,c} \geq d_{p,c} \cdot z_p^k \quad \forall p \in P, \; c \in C, \; k \in K_p
$$

Every pour $p$ must receive at least the demanded quantity of each component type for the chosen kit configuration.

### C2: Kit Configuration Selection (Exactly one config per pour)

$$
\sum_{k \in K_p} z_p^k = 1 \quad \forall p \in P
$$

### C3: Inventory Balance (Time-phased availability)

$$
I_{c,t} = I_{c,t-1} + b_{c,t} + r_{c,t}^{start} + \sum_{p: \tau_p^{avail} = t} x_{p,c} \cdot (1 - \alpha_c) - \sum_{p: \tau_p^{start} = t} x_{p,c} - r_{c,t}^{end}
$$

This is the **core multi-period constraint**. Inventory at end of day $t$ equals:
- Previous day's inventory
- Plus new purchases arriving
- Plus new rentals starting
- Plus components returned from pours that complete stripping on day $t$ (minus loss factor)
- Minus components deployed to pours starting on day $t$
- Minus rentals ending

### C4: Reuse Feasibility (Strip-before-deploy timing)

$$
y_{p,q,c} > 0 \implies \tau_q^{avail} \leq \tau_p^{start}
$$

Components can only be reused from pour $q$ to pour $p$ if pour $q$'s strip + cleaning completion date is on or before pour $p$'s erection start date.

**Linearization**: Implement as:

$$
y_{p,q,c} \leq M \cdot \mathbb{1}[\tau_q^{avail} \leq \tau_p^{start}] \quad \forall p, q, c
$$

where the indicator is a pre-computed binary parameter (not a variable), since the schedule is known.

### C5: Reuse Cycle Limit

$$
\sum_{p} \mathbb{1}[y_{p,q,c} > 0 \text{ chain through instance } i] \leq R_c - \text{cycles\_already\_used}_i
$$

No component instance may exceed its rated reuse cycle count. In practice, this is tracked at the instance level and enforced as a constraint on aggregate reuse flow.

### C6: Compatibility Constraints

$$
x_{p,c_1} > 0 \wedge x_{p,c_2} > 0 \implies \text{Compat}(c_1, c_2) = 1
$$

Implemented as: for each incompatible pair $(c_1, c_2)$:

$$
x_{p,c_1} + x_{p,c_2} \leq M \cdot w_p \quad \text{where } w_p \text{ is bounded to allow at most one}
$$

### C7: Quantity Ratio Constraints (Accessories)

$$
x_{p, \text{tie\_rod}} \geq \gamma \cdot x_{p, \text{panel}} \quad \forall p
$$

Where $\gamma$ is the tie-rod-to-panel ratio from compatibility rules (e.g., 1 tie per 0.75m² of panel face).

### C8: Non-negativity and Integrality

$$
x_{p,c}, \; y_{p,q,c}, \; b_{c,t}, \; r_{c,t}, \; I_{c,t} \in \mathbb{Z}_{\geq 0}
$$

## Why This Is Multi-Period (Not Single-Shot)

A single-period formulation would ask: "What is the total formwork inventory needed for this project?" Answer: max concurrent demand across all pours. This is exactly the current Excel approach and leads to over-provisioning.

The multi-period formulation recognizes that:
1. **Pours are sequential, not simultaneous.** Floor 3 Zone 1 happens before Floor 3 Zone 2. The same panels can serve both.
2. **Strip cycles create temporal buffers.** M40 concrete with 12-hour strip cycle means panels are locked for 12 hours. M50 with 18-hour cycle means 18 hours. The optimizer must respect these buffers when planning reuse.
3. **Repetition across floors is the primary cost lever.** A typical floor has identical geometry. If the optimizer can prove that 2 sets of formwork (instead of 3) can cover all zones with proper sequencing, the savings are 33% of formwork procurement.

## Why Greedy Heuristics Fail

**Greedy approach**: For each pour in sequence, assign the cheapest available components.

**Failure mode 1 — Myopic reuse**: Greedy assigns Panel A to Pour 5 because it's available. But Panel A won't strip in time for Pour 8, which has identical geometry. A global optimizer would assign Panel B (slightly more expensive) to Pour 5 and reserve Panel A for Pour 8, achieving better reuse chain.

**Failure mode 2 — Number of sets**: Greedy cannot determine the optimal number of concurrent formwork sets. It will keep pulling from inventory until depleted, then request procurement. The optimizer determines upfront: "This project needs exactly 2.2 sets — procure 2 sets, rent the 0.2 shortfall for peak periods."

**Failure mode 3 — End-of-project surplus**: Greedy has no termination awareness. It procures components that arrive for the last 5 pours, when renting would be cheaper since there's no future reuse to amortize the purchase.

## Solver Strategy

### Primary: Mixed-Integer Programming (MIP)

- Solver: **Google OR-Tools CP-SAT** or **HiGHS** (open-source, no license cost)
- Problem size for pilot (25-floor tower, 8 pours/floor, 50 component types): ~10,000 integer variables, ~50,000 constraints
- Expected solve time: 2–10 minutes with warm-start from previous solution
- Optimality gap target: ≤ 2%

### Fallback: Rolling-Horizon Heuristic

For very large projects (multiple towers, 500+ pours):
1. Fix decisions for pours already within the 2-week execution window
2. Solve exact MIP for the next 4-week window (typically 15–25 pours)
3. Use LP relaxation for remaining pours to establish inventory trajectory
4. Roll forward weekly

This provides near-optimal solutions in under 60 seconds for any project size.

### Kit Configuration Generation

Before running the optimizer, candidate kit configurations for each pour are pre-generated:

1. **Panel Layout Engine**: Given surface area and dimensions, generate 3–5 feasible panel arrangements using the selected formwork system. Each arrangement trades off between fewer large panels (cheaper handling, less flexibility) vs. more small panels (more flexible reuse, higher handling cost).

2. **Accessory Computation**: For each panel layout, compute required ties, walers, props using compatibility rules and structural requirements (pour height, concrete pressure).

3. **Pruning**: Eliminate configurations that exceed structural limits or use unavailable panel sizes.

This reduces the optimizer's search space from continuous panel selection to discrete configuration choice — a standard technique in practical optimization.

---

# SECTION 5 — SYSTEM FLOW (OPERATOR-REALISTIC)

## End-to-End Workflow

```
PHASE 1: PROJECT SETUP (Once per project)
───────────────────────────────────────────
  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
  │ Import Schedule  │────▶│ Import SAP MM    │────▶│ Manual Inputs   │
  │ (P6/MSP export)  │     │ Material Masters │     │ - Surface areas │
  │                   │     │ + Issue/Return   │     │ - System assign │
  │ Parse activities  │     │ logs             │     │ - Strip cycles  │
  │ to Pour entities  │     │                  │     │                 │
  └─────────────────┘     └──────────────────┘     └─────────────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   ▼
                    ┌──────────────────────────┐
                    │   DATA VALIDATION        │
                    │   - All pours have area   │
                    │   - All components mapped  │
                    │   - Schedule is consistent │
                    │   - Inventory reconciled   │
                    └──────────────────────────┘
                                   │
                                   ▼
PHASE 2: OPTIMIZATION (Run on demand — typically weekly)
────────────────────────────────────────────────────────
                    ┌──────────────────────────┐
                    │  KIT CONFIG GENERATOR     │
                    │  Per pour:                │
                    │  - Generate panel layouts │
                    │  - Compute accessories    │
                    │  - Prune infeasible       │
                    └──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  MULTI-PERIOD OPTIMIZER   │
                    │  - Build MIP model        │
                    │  - Solve (2-10 min)       │
                    │  - Extract kit assignments│
                    │  - Compute BoQ            │
                    └──────────────────────────┘
                                   │
                                   ▼
PHASE 3: PLANNER REVIEW (Human-in-the-loop)
────────────────────────────────────────────
                    ┌──────────────────────────┐
                    │  PLANNER DASHBOARD        │
                    │                           │
                    │  Per pour, show:          │
                    │  ✱ Kit composition         │
                    │  ✱ Component sources       │
                    │    (new / reused / rented) │
                    │  ✱ WHY this assignment     │
                    │  ✱ Alternatives & cost Δ   │
                    │                           │
                    │  Planner can:             │
                    │  ☐ Approve                │
                    │  ☐ Override (swap panels)  │
                    │  ☐ Lock (freeze decision)  │
                    │  ☐ Request re-optimize     │
                    └──────────────────────────┘
                                   │
                                   ▼
PHASE 4: EXECUTION TRACKING (Ongoing)
──────────────────────────────────────
                    ┌──────────────────────────┐
                    │  DEPLOYMENT TRACKER       │
                    │  - Kit issued to pour     │
                    │  - Pour completed         │
                    │  - Strip logged           │
                    │  - Return + inspection    │
                    │  - Condition update       │
                    │  ──────────────────────── │
                    │  Feeds back into:         │
                    │  - InventoryState update  │
                    │  - ReuseCycle recording   │
                    │  - Next optimization run  │
                    └──────────────────────────┘
```

## Detailed Flow: Kit Generation → Planner Review

### Step 1: Pour Selection
Planner selects a time window (e.g., "next 2 weeks"). System identifies all pours in that window.

### Step 2: Kit Generation
For each pour, the system:

1. Retrieves surface area and element type
2. Selects the assigned formwork system
3. Runs the **Panel Layout Engine**:
   - For a wall pour of 24m length × 3.0m height:
     - Config A: 10× TRIO 2400mm panels = exact fit, 0 fillers
     - Config B: 8× TRIO 2400mm + 2× TRIO 1200mm + 0 fillers (if 2400mm panels are in short supply)
     - Config C: 6× TRIO 2400mm + 4× TRIO 900mm + 2× TRIO 300mm fillers (maximum reuse flexibility)
4. For each config, computes accessories: ties (1 per 0.75m²), walers (1 horizontal + 1 vertical per panel stack), corner brackets, alignment couplers
5. Checks compatibility rules

### Step 3: Optimizer Assigns Components to Kits
The MIP solver determines:
- Which kit configuration to use for each pour
- Which specific components (or quantities, if not instance-tracked) to assign
- Whether components are from existing inventory, reused from a prior pour, or newly procured/rented
- The optimal number of formwork sets for the project

### Step 4: Explainability Output

Each kit line item includes an `assignment_reason` field. Examples:

> "PERI TRIO WDP 2400×2700 (qty: 10) — Reused from Pour T1-F2-Z1-WALL (stripped Day 12, cleaned Day 12.5). 47 cycles remaining of 300 rated. **Selected over new procurement because reuse saves ₹18,400 and this unit is available 2 days before pour start.**"

> "PERI DW15 tie rod 600mm (qty: 34) — New procurement. **No reusable units available — all 34 existing units are deployed on Pours T1-F2-Z2 and T1-F2-Z3, which don't strip until Day 16 (2 days after this pour starts).** Rental alternative evaluated: ₹2,100/day vs. purchase ₹890/unit. Purchase selected because these ties will be reused for 14 more pours."

### Step 5: Planner Override Workflow

| Action | What Happens |
|--------|-------------|
| **Approve** | Kit is frozen. Components are reserved in inventory. SAP issue list generated. |
| **Override** | Planner substitutes a component (e.g., swaps 2400mm panel → 2×1200mm panels). System re-validates compatibility, recalculates cost delta, shows impact on future pours. |
| **Lock** | Decision is fixed — optimizer treats this as immutable in future runs. |
| **Reject + Re-optimize** | Planner adds a constraint (e.g., "do not use rented panels for this pour") and triggers re-solve. |

### Step 6: Scenario Comparison

Before approving, planner can request:
- **Scenario A**: Optimize for minimum cost (default)
- **Scenario B**: Optimize for minimum rental dependency
- **Scenario C**: Optimize for maximum reuse (even if handling cost is higher)
- **Scenario D**: "What if schedule shifts by 3 days?"

Each scenario runs the optimizer with modified objective weights or parameters. Results are displayed side-by-side:

| Metric | Scenario A | Scenario B | Scenario C |
|--------|-----------|-----------|-----------|
| Total Cost | ₹42.3L | ₹44.1L | ₹43.8L |
| Rental % | 18% | 5% | 12% |
| Avg Reuse Factor | 4.2 | 3.8 | 5.1 |
| Procurement Qty | 380 | 420 | 395 |

### What Happens When Schedule Slips

This is the most common real-world disruption. FKO handles it as follows:

1. **Import updated schedule** (new P6/MSP export)
2. **Diff engine** identifies changed pours:
   - Pours moved forward: may create inventory conflicts (component committed to Pour A which now overlaps with Pour B)
   - Pours moved backward: may create reuse opportunities previously not available
   - Pours added/deleted: demand changes
3. **Re-optimize** with all already-executed pours and locked decisions as fixed constraints
4. **Impact report** shows:
   - Which kits need reassignment
   - Cost impact of schedule change
   - Whether emergency procurement/rental is needed
   - Recommended planner actions

---

# SECTION 6 — VALIDATION (NO FIELD DEPLOYMENT)

## Validation Strategy

FKO is validated entirely through back-testing against historical project data BEFORE any live deployment. This eliminates risk and builds planner trust.

## Data Required for Back-Testing

| Data | Source | What It Proves |
|------|--------|---------------|
| Historical pour schedule (as-planned AND as-built) | Primavera archives | That the optimizer produces feasible plans under real schedule conditions |
| SAP issue/return logs for formwork materials | SAP MB51 export | That optimizer's reuse recommendations match or improve upon actual reuse patterns |
| Procurement records (material, quantity, date, cost) | SAP MM | That optimizer's BoQ is leaner than what was actually procured |
| Inventory survey at project completion | Site records | That optimizer would have resulted in less end-of-project surplus |

## Back-Testing Methodology

### Test 1: Hindsight Optimization

**Process:**
1. Take a completed 25-floor tower project
2. Input the as-built pour schedule, actual surface areas, and initial inventory
3. Run FKO optimizer as if planning from Day 1
4. Compare FKO's recommended BoQ against actual procurement

**Expected result:** FKO recommends 15–25% fewer formwork components than were actually procured, because it optimizes reuse across the full schedule.

### Test 2: Rolling-Window Simulation

**Process:**
1. Same project, but simulate week-by-week decision-making
2. At each week, FKO only sees the schedule up to that point (including changes that occurred historically)
3. Compare FKO's weekly decisions against what planners actually decided

**Expected result:** FKO achieves within 5% of hindsight optimal (Test 1) even with schedule changes, because the rolling-horizon approach adapts.

### Test 3: Reuse Factor Analysis

**Process:**
1. From SAP issue/return logs, compute actual reuse factor per component type:
   - Reuse Factor = Total deployments / Total unique units procured
2. Compute FKO's recommended reuse factor from the optimization solution

**Expected result:** FKO's reuse factor is 20–40% higher than actual, indicating the system identifies reuse opportunities planners missed.

### Test 4: Idle Inventory Analysis

**Process:**
1. From SAP logs, reconstruct daily inventory state (what was in yard vs. deployed)
2. Compute total idle component-days (units × days sitting unused)
3. Compare against FKO's optimized schedule

**Expected result:** FKO reduces idle component-days by 30–50%.

## Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **BoQ Reduction %** | (Actual procured qty – FKO recommended qty) / Actual qty | ≥ 15% |
| **Reuse Factor Improvement** | FKO reuse factor / Actual reuse factor | ≥ 1.20 |
| **Idle Inventory Reduction %** | (Actual idle-days – FKO idle-days) / Actual idle-days | ≥ 30% |
| **Cost Savings %** | (Actual total formwork cost – FKO total cost) / Actual cost | ≥ 10% |
| **Schedule Feasibility** | % of FKO kit assignments that can be executed within schedule | 100% (hard constraint) |
| **Planner Effort Reduction** | Estimated hours saved per week on manual kitting | ≥ 8 hours/week |

## Failure Modes & Detection

| Failure Mode | Detection Method | Mitigation |
|-------------|-----------------|------------|
| Optimizer recommends infeasible kit (component doesn't fit) | Post-optimization compatibility check + planner review | Tighten compatibility rules; add dimensional validation |
| Strip cycle assumption too aggressive | Compare recommended strip dates against historical actual strip dates | Add 20% buffer to strip cycle estimates; learn from actuals |
| Damage/loss rates underestimated | Compare predicted inventory vs. actual over pilot | Bayesian update of rates using observed data |
| Schedule volatility defeats optimization | Track % of kits requiring reassignment after schedule changes | Increase rolling-horizon buffer; add schedule confidence weighting |
| Solver timeout on large instances | Monitor solve time metrics | Switch to rolling-horizon heuristic automatically if solve > 15 min |
| Data quality degrades (missing SAP entries) | Automated daily data quality dashboard | Alert stores team; pause optimization for affected zones |

---

# SECTION 7 — IMPLEMENTATION ROADMAP

## 6-Month Timeline

### Month 0–2: Data Foundation & Manual Validation

```
Week 1-2:  Project kickoff. Select pilot project (ongoing 25-floor residential tower,
           ideally at Floor 5-8 so sufficient future pours remain).
           Obtain SAP access, schedule exports, meet site planning team.

Week 3-4:  Build data ingestion pipeline:
           - SAP MM material master CSV parser
           - SAP MB51 goods movement CSV parser
           - P6/MSP schedule XML/CSV parser
           - Surface area input template (Excel)

Week 5-6:  Build material normalization engine:
           - Regex-based description parser for PERI/Doka/MEVA naming
           - Planner-validated component catalog for pilot project
           - Compatibility rule database (20-30 rules for primary system)

Week 7-8:  Data validation & back-testing preparation:
           - Load historical data for 5 completed floors of pilot project
           - Reconstruct actual reuse patterns from SAP logs
           - Identify data gaps and fix with planner input
           - Run Test 1 (Hindsight Optimization) on completed floors

DELIVERABLE: Validated data pipeline + historical back-test results
GATE: Back-test shows ≥ 10% BoQ reduction potential → proceed
```

### Month 3–4: Optimizer & UI

```
Week 9-10:  Build kit configuration generator:
            - Panel layout engine for wall/slab/column types
            - Accessory computation from compatibility rules
            - Config pruning and ranking

Week 11-12: Build MIP optimizer:
            - Model formulation in Google OR-Tools / HiGHS
            - Test on pilot project data
            - Implement rolling-horizon fallback
            - Tune solver parameters for <5 min solve target

Week 13-14: Build planner UI (web-based):
            - Pour timeline view with kit status
            - Kit detail view with component list + reasons
            - Override workflow (swap, lock, re-optimize)
            - Scenario comparison view

Week 15-16: Integration testing:
            - End-to-end flow: schedule import → optimize → review → approve
            - Run Test 2 (Rolling-Window Simulation) on historical data
            - Planner UAT with site planning team

DELIVERABLE: Working system with UI, validated against history
GATE: Planners confirm recommendations are "sensible" for ≥ 80% of pours
```

### Month 5–6: Pilot Deployment

```
Week 17-18: Go-live preparation:
            - Load current project state (inventory, schedule, pending pours)
            - Run optimizer for next 4 weeks of pours
            - Planner reviews and provides feedback
            - Calibrate strip cycle estimates, damage rates

Week 19-20: Parallel run:
            - FKO runs alongside existing manual process
            - Planner uses both; compares kit recommendations
            - Track metrics: BoQ delta, reuse factor, planner time

Week 21-22: Monitored autonomy:
            - Planners use FKO as primary planning tool
            - Manual process as backup
            - Weekly retrospective: what worked, what didn't

Week 23-24: Pilot wrap-up:
            - Compile pilot metrics
            - Document lessons learned
            - Prepare scale-out business case
            - Present to management

DELIVERABLE: Pilot results report + scale-out recommendation
GATE: Demonstrated ≥ 10% cost savings on pilot → approve scale-out
```

## Team Composition

| Role | Count | Skills | Months Active |
|------|-------|--------|--------------|
| Technical Lead | 1 | Operations Research / Optimization + Construction domain | 0–6 |
| Backend Developer | 2 | Python, PostgreSQL, REST APIs, data pipelines | 0–6 |
| Frontend Developer | 1 | React/Vue, data visualization, timeline UIs | 2–6 |
| Domain Expert (Formwork Planner) | 1 (part-time, 50%) | 10+ years formwork planning, SAP familiarity | 0–6 |
| Data Engineer | 1 | SAP extraction, data quality, ETL | 0–3 |
| **Total** | **5.5 FTE** | | |

## Key Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| SAP data access delays | High | Schedule slip | Start SAP access request in Week 0. Prepare mock data for development in parallel. |
| Pilot project schedule too volatile | Medium | Optimizer results unreliable | Select project with ≥ 80% schedule adherence. Build robust re-optimization capability. |
| Planners resist adoption | Medium | Pilot fails despite technical success | Involve planner from Day 1. Make overrides easy. Show "why" for every recommendation. Never force — recommend. |
| Solver performance inadequate | Low | Cannot run in practical timeframe | Rolling-horizon fallback handles any project size. Pilot is small enough for exact solve. |
| Formwork system compatibility rules incomplete | Medium | Infeasible kits recommended | Start with one system (primary system on pilot project). Expand progressively. Planner validates every rule. |

---

# SECTION 8 — COMPETITIVE MOAT

## Why Vendor Tools (PERI CAD, Doka Tipos, MEVA Configuration) Fall Short

### 1. Vendor Lock-In
PERI's planning tools optimize PERI products only. On a real L&T project using PERI TRIO for walls and Doka Dokaflex for slabs:
- PERI CAD plans the wall formwork, ignoring slab timing
- Doka Tipos plans the slab formwork, ignoring wall inventory
- Nobody optimizes the combined inventory, reuse across systems, or total project cost

FKO is **system-agnostic**. It treats all vendor systems as data inputs and optimizes across them.

### 2. Single-Project Scope
Vendor tools are designed for individual project planning. They have no concept of:
- Transferring formwork between projects
- Learning damage rates from historical projects
- Benchmarking reuse factors across the enterprise

FKO is an **enterprise system** that accumulates knowledge across all L&T projects.

### 3. No Temporal Optimization
Vendor tools perform static layout: "For this wall, use these panels." They do not solve the multi-period problem: "When should these panels be stripped, cleaned, and redeployed to maximise reuse?"

FKO's **core value proposition is temporal optimization** — the multi-period inventory balancing that determines the optimal number of sets and reuse sequence.

### 4. No Schedule Integration
Vendor tools take geometry as input. They don't read pour schedules, don't know about strip cycles for different concrete grades, and can't react to schedule changes.

FKO is **schedule-native**. The pour schedule is a primary input, and schedule changes trigger automatic re-optimization.

## Why an L&T-Internal System Wins

### 1. Historical Enterprise Data
L&T has completed thousands of high-rise projects. Each project's SAP data contains:
- Actual formwork consumption patterns
- Reuse factors by component type and project type
- Damage and loss rates by vendor system
- Cost benchmarks by project typology

This data is **proprietary and irreplaceable**. No vendor has access to it. After 2–3 projects, FKO's predictions become highly accurate because they're trained on L&T's own operational reality.

### 2. Vendor Neutrality = True Cost Optimization
When FKO recommends "rent 20 PERI panels for the peak month instead of buying" — that recommendation is credible because FKO has no commercial interest in PERI sales. Vendor tools will always bias toward their own product range.

### 3. Cross-Project Optimization (Phase 2)
Once FKO is deployed on multiple concurrent projects, the next optimization frontier is **inter-project formwork transfer**:
- Project A completes walls on Floor 20 and won't need PERI TRIO again
- Project B (30 km away) is starting walls on Floor 1
- FKO recommends: "Transfer 200 PERI TRIO panels from Project A to Project B. Transport cost: ₹85,000. Savings vs. new procurement: ₹12,40,000."

No vendor tool can do this because they don't see across projects.

### 4. Integration with L&T ERP Ecosystem
FKO reads from and writes to SAP PS/MM. Optimized BoQs flow directly into procurement. Issue plans generate SAP reservations. Return logs update FKO inventory. This closed loop exists because FKO is built for L&T's ERP, not as a generic tool.

### 5. Continuous Learning
Every completed pour feeds back into FKO:
- Actual vs. predicted strip cycle times → calibrate curing models
- Actual vs. predicted damage rates → adjust loss parameters
- Planner overrides → learn preference patterns
- Cost actuals → validate optimization accuracy

Over 6–12 months of operation, FKO becomes the **institutional memory** of L&T formwork operations — a strategic asset that compounds in value with every project.

---

# APPENDICES

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Kit** | A complete set of formwork components assembled for a specific pour. Includes panels, fillers, ties, walers, props, and accessories. |
| **Strip** | Removal of formwork after concrete has cured sufficiently. Strip cycle = minimum time before stripping is safe. |
| **Set** | One complete coverage of all pours on a single floor. "2.5 sets" = enough formwork to cover 2.5 floors simultaneously. |
| **Repetition Factor** | Number of times a formwork component is reused across the project. Higher = better ROI. |
| **BoQ (Bill of Quantities)** | Material list specifying all formwork items and quantities required for the project. |
| **Pour Zone** | A subdivision of a floor that is poured in one continuous operation. Typically 4–8 zones per floor. |
| **Filler** | Narrow formwork strip (50–300mm) used to close gaps between standard panel widths. |
| **Tie Rod** | Steel rod passing through the concrete wall to hold opposing formwork panels together against concrete pressure. |
| **Waler** | Horizontal or vertical steel beam that distributes loads across formwork panels. |

## Appendix B: Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | Python 3.11+ | OR-Tools, pandas, rich ecosystem for optimization |
| Optimizer | Google OR-Tools CP-SAT + HiGHS | Open-source, no license cost, proven on similar problems |
| Database | PostgreSQL 15 | Robust, supports JSONB for flexible rules, UUID native |
| API | FastAPI | Async, auto-docs, type-safe |
| Frontend | React + TypeScript | Component-based, rich ecosystem for timelines/charts |
| Timeline visualization | vis-timeline or Gantt library | Pour schedule + kit assignment overlay |
| Deployment | Docker + Docker Compose | Single-command deployment on L&T infrastructure |
| Auth | L&T SSO (SAML/OIDC) | Enterprise authentication |

## Appendix C: Slide Deck Structure (7–8 Slides)

1. **The Problem**: Formwork = 7-10% of construction cost. Current process = Excel + intuition. Over-provisioning is the norm.
2. **The Opportunity**: Multi-period optimization can reduce formwork inventory by 15-25%. For a ₹500 Cr project, that's ₹5-8 Cr savings.
3. **FormKit Optimizer**: Product vision, user roles, key capabilities.
4. **How It Works**: Schedule → Kit Generation → Optimization → Planner Review → Execution. (System flow diagram)
5. **The Math**: Multi-period inventory optimization. Why greedy fails. (Simplified formulation)
6. **Validation**: Back-testing results on historical project. BoQ reduction, reuse improvement metrics.
7. **Roadmap**: 6-month plan. Team. Investment. Expected ROI.
8. **Moat**: Why vendor tools can't do this. Why this must be internal. Enterprise data advantage.

---

*Document End — FormKit Optimizer Product Design v1.0*
