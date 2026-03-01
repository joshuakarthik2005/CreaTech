# FormKit Optimizer — System Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            USERS                                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Site Planner  │  │ Central Planning │  │ Commercial / Procurement │   │
│  └──────┬───────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
│         │                   │                          │                  │
│         └───────────────────┼──────────────────────────┘                  │
│                             │                                            │
│                    ┌────────▼─────────┐                                  │
│                    │   React Frontend │                                  │
│                    │   (SPA)          │                                  │
│                    │                  │                                  │
│                    │  • Pour Timeline │                                  │
│                    │  • Kit Review    │                                  │
│                    │  • Override UI   │                                  │
│                    │  • BoQ Report    │                                  │
│                    │  • Inventory     │                                  │
│                    │  • Scenario Comp.│                                  │
│                    └────────┬─────────┘                                  │
│                             │ HTTPS                                      │
│                             │                                            │
├─────────────────────────────┼────────────────────────────────────────────┤
│                     BACKEND │ SERVICES                                   │
│                             │                                            │
│  ┌──────────────────────────▼───────────────────────────────────────┐    │
│  │                    FastAPI Application                            │    │
│  │                    (Python 3.11+)                                 │    │
│  │                                                                   │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │    │
│  │  │ API Layer   │  │ Auth Layer  │  │ Data Import Service      │  │    │
│  │  │ REST + Docs │  │ L&T SSO     │  │ SAP CSV / P6 / Excel    │  │    │
│  │  └──────┬──────┘  └─────────────┘  └───────────┬──────────────┘  │    │
│  │         │                                       │                 │    │
│  │  ┌──────▼──────────────────────────────────────▼──────────────┐  │    │
│  │  │                  SERVICE LAYER                              │  │    │
│  │  │                                                             │  │    │
│  │  │  ┌───────────────────┐  ┌────────────────────────────────┐ │  │    │
│  │  │  │ Panel Layout      │  │ Multi-Period Optimizer          │ │  │    │
│  │  │  │ Engine            │  │ (CP-SAT / HiGHS)               │ │  │    │
│  │  │  │                   │  │                                 │ │  │    │
│  │  │  │ • Wall layout     │  │ • Kit config selection          │ │  │    │
│  │  │  │ • Slab layout     │  │ • Reuse assignment              │ │  │    │
│  │  │  │ • Accessory calc  │  │ • Procurement vs rental         │ │  │    │
│  │  │  │ • Config pruning  │  │ • Inventory balance             │ │  │    │
│  │  │  └───────────────────┘  │ • Rolling horizon fallback      │ │  │    │
│  │  │                         └────────────────────────────────┘ │  │    │
│  │  │                                                             │  │    │
│  │  │  ┌───────────────────┐  ┌────────────────────────────────┐ │  │    │
│  │  │  │ Material          │  │ Explainability Engine           │ │  │    │
│  │  │  │ Normalizer        │  │                                 │ │  │    │
│  │  │  │                   │  │ • Assignment reasoning          │ │  │    │
│  │  │  │ • Regex matching  │  │ • Alternative cost comparison   │ │  │    │
│  │  │  │ • Vendor detection│  │ • Reuse chain tracing           │ │  │    │
│  │  │  │ • Dim extraction  │  │ • Schedule impact analysis      │ │  │    │
│  │  │  └───────────────────┘  └────────────────────────────────┘ │  │    │
│  │  │                                                             │  │    │
│  │  │  ┌───────────────────┐  ┌────────────────────────────────┐ │  │    │
│  │  │  │ Back-Test         │  │ Schedule Diff Engine            │ │  │    │
│  │  │  │ Validator         │  │                                 │ │  │    │
│  │  │  │                   │  │ • Version comparison            │ │  │    │
│  │  │  │ • Hindsight test  │  │ • Impact assessment             │ │  │    │
│  │  │  │ • Rolling sim     │  │ • Re-optimization trigger       │ │  │    │
│  │  │  │ • Metrics compare │  │ • Planner notification          │ │  │    │
│  │  │  └───────────────────┘  └────────────────────────────────┘ │  │    │
│  │  └─────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │                  DATA ACCESS LAYER                          │  │    │
│  │  │  SQLAlchemy ORM + Raw SQL for optimizer reads               │  │    │
│  │  └──────────────────────────┬──────────────────────────────────┘  │    │
│  └─────────────────────────────┼─────────────────────────────────────┘    │
│                                │                                          │
├────────────────────────────────┼──────────────────────────────────────────┤
│                     DATA LAYER │                                          │
│                                │                                          │
│  ┌─────────────────────────────▼──────────────────────────────────────┐   │
│  │                     PostgreSQL 15                                   │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ formwork_    │  │ pour /       │  │ kit /                    │  │   │
│  │  │ system /     │  │ schedule /   │  │ kit_line_item /          │  │   │
│  │  │ component /  │  │ pour_zone    │  │ optimizer_run            │  │   │
│  │  │ compat_rule  │  │              │  │                          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │  │ component_   │  │ inventory_   │  │ material_                │  │   │
│  │  │ instance /   │  │ state /      │  │ normalization            │  │   │
│  │  │ reuse_cycle  │  │ transaction  │  │                          │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                     EXTERNAL│SYSTEMS                                       │
│                                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │ SAP PS / MM     │  │ Primavera P6 /  │  │ L&T SSO / Active          │ │
│  │                 │  │ MS Project      │  │ Directory                  │ │
│  │ Material Master │  │                 │  │                            │ │
│  │ Goods Movement  │  │ Schedule Export │  │ User Authentication        │ │
│  │ BoQ Write-back  │  │ (CSV / XER)    │  │ Role Management            │ │
│  └─────────────────┘  └─────────────────┘  └────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌────────────────────────────────────────────┐
│            Docker Compose Stack             │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  fko-frontend (nginx + React build)  │  │
│  │  Port: 443 (HTTPS)                   │  │
│  └──────────────┬───────────────────────┘  │
│                 │                           │
│  ┌──────────────▼───────────────────────┐  │
│  │  fko-api (FastAPI + Uvicorn)         │  │
│  │  Port: 8000 (internal)               │  │
│  │  Workers: 4                          │  │
│  └──────────────┬───────────────────────┘  │
│                 │                           │
│  ┌──────────────▼───────────────────────┐  │
│  │  fko-db (PostgreSQL 15)              │  │
│  │  Port: 5432 (internal)               │  │
│  │  Volume: /data/fko-pgdata            │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  fko-worker (Background tasks)        │  │
│  │  - Optimizer runs (async)             │  │
│  │  - Data imports                       │  │
│  │  - Scheduled inventory snapshots      │  │
│  └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

## Data Flow Diagram

```
                    ┌──────────────────┐
                    │   SAP MM Extract │
                    │   (CSV weekly)   │
                    └────────┬─────────┘
                             │
              ┌──────────────▼─────────────────┐
              │     Material Normalizer         │
              │  SAP desc → Component mapping   │
              │  Regex + manual confirmation     │
              └──────────────┬─────────────────┘
                             │
                             ▼
     ┌───────────────────────────────────────────────┐
     │              NORMALIZED DATA STORE             │
     │                 (PostgreSQL)                    │
     │                                                │
     │  Components ─── Compatibility Rules            │
     │  Pour Schedule ── Inventory State              │
     │  Reuse Cycles ── Optimizer Runs                │
     └──────────┬──────────────────┬─────────────────┘
                │                  │
                ▼                  ▼
  ┌─────────────────────┐  ┌──────────────────────┐
  │  Panel Layout       │  │  Schedule Import     │
  │  Engine             │  │  (P6/MSP CSV)        │
  │                     │  │                      │
  │  Surface area →     │  │  Activity parsing →  │
  │  Kit configs        │  │  Pour records        │
  └─────────┬───────────┘  └──────────┬───────────┘
            │                         │
            └────────────┬────────────┘
                         │
                         ▼
              ┌─────────────────────────┐
              │   MULTI-PERIOD          │
              │   OPTIMIZER             │
              │                         │
              │   CP-SAT / HiGHS        │
              │   2-10 min solve        │
              │                         │
              │   Inputs:               │
              │   • Pour schedule       │
              │   • Kit configurations  │
              │   • Current inventory   │
              │   • Cost parameters     │
              │                         │
              │   Outputs:              │
              │   • Kit assignments     │
              │   • Procurement plan    │
              │   • Inventory forecast  │
              └─────────┬───────────────┘
                        │
                        ▼
              ┌─────────────────────────┐
              │   PLANNER REVIEW        │
              │                         │
              │   • Approve / Override   │
              │   • Scenario comparison  │
              │   • Explainability       │
              └─────────┬───────────────┘
                        │
              ┌─────────▼───────────────┐
              │   EXECUTION             │
              │                         │
              │   • SAP issue list      │
              │   • Deploy tracking     │
              │   • Strip logging       │
              │   • Inventory update    │
              └─────────────────────────┘
```

## Security & Access Control

| Role | Access Level | Capabilities |
|------|-------------|-------------|
| Site Planner | Project-level | View kits, approve/override, log deployments |
| Central Planning | Multi-project | All planner capabilities + optimizer configuration + cross-project views |
| Commercial | Project-level (read) | View BoQ, procurement plan, cost reports |
| System Admin | Full | User management, system configuration, data import |

## Integration Points

| System | Direction | Method | Frequency |
|--------|-----------|--------|-----------|
| SAP MM Material Master | SAP → FKO | CSV export → parser | Weekly |
| SAP MB51 Goods Movement | SAP → FKO | CSV export → parser | Daily |
| SAP BoQ Write-back | FKO → SAP | Manual (initially) → API (v2) | Per optimization run |
| Primavera P6 | P6 → FKO | XER/CSV export → parser | On schedule update |
| MS Project | MSP → FKO | CSV export → parser | On schedule update |
| L&T SSO | SSO → FKO | SAML 2.0 / OIDC | Per login |
