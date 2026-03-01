# FormKit Optimizer

**Automation of Formwork Kitting & BoQ Optimization Using Data Science**

An internal L&T software system that automates formwork kit assembly, sequences pour-level reuse across floors, and generates an optimized Bill of Quantities based on actual site-level repetition — replacing manual panel takeoff, Excel inventory planning, and static BoQ provisioning.

---

## Project Structure

```
formkit-optimizer/
├── docs/
│   ├── PRODUCT_DESIGN.md          # Complete product design (8 sections)
│   ├── ARCHITECTURE.md            # System architecture & deployment
│   ├── SLIDE_DECK_SCRIPT.md       # 7-slide presentation script
│   └── QA_DEFENSE_GUIDE.md        # Technical cross-examination prep
├── schemas/
│   ├── 001_core_schema.sql        # PostgreSQL database schema
│   └── 002_seed_data.sql          # Seed data (PERI TRIO, Doka, pilot project)
├── engine/
│   ├── __init__.py
│   ├── optimizer.py               # Multi-period MIP optimizer (CP-SAT)
│   └── validation.py              # Back-testing & validation engine
├── data_pipeline/
│   ├── __init__.py
│   └── ingestion.py               # SAP, schedule, surface area parsers
├── api/
│   └── main.py                    # FastAPI REST API (full endpoint spec)
├── demo.py                        # End-to-end demo on synthetic data
├── pyproject.toml                 # Python project config & dependencies
└── README.md                      # This file
```

## Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [PRODUCT_DESIGN.md](docs/PRODUCT_DESIGN.md) | Complete product design across all 8 sections | All reviewers |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, deployment, data flow | Technical team |
| [SLIDE_DECK_SCRIPT.md](docs/SLIDE_DECK_SCRIPT.md) | 7-slide presentation content | Presenters |
| [QA_DEFENSE_GUIDE.md](docs/QA_DEFENSE_GUIDE.md) | Technical Q&A preparation | Defense team |

## Quick Start (Development)

```bash
# Install dependencies
pip install -e ".[dev]"

# Run demo
python demo.py

# Start API server
uvicorn api.main:app --reload --port 8000

# Run tests
pytest
```

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy
- **Optimizer**: Google OR-Tools CP-SAT, HiGHS
- **Database**: PostgreSQL 15
- **Frontend**: React + TypeScript (separate repo, not included)
- **Deployment**: Docker Compose

## Core Capabilities

1. **Automated Kit Generation** — Panel layout engine produces component-level kits per pour
2. **Multi-Period Optimization** — MIP solver determines optimal reuse sequence across full schedule
3. **Optimized BoQ** — Time-phased procurement plan replacing static provisioning
4. **Planner-in-the-Loop** — Override, scenario comparison, full explainability
5. **Vendor-Neutral** — Optimizes across PERI, Doka, MEVA, aluminum systems
6. **SAP Integration** — Reads material masters and goods movements, writes back BoQ
7. **Back-Test Validation** — Validates against historical data before live deployment
