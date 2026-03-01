# FormKit Optimizer — Technical Q&A Defense Guide

## Anticipated Questions & Prepared Responses

This document prepares the team for technical cross-examination by senior civil engineers, ERP owners, construction planners, and optimization specialists during internal review.

---

## DOMAIN QUESTIONS (Civil Engineers / Construction Planners)

### Q1: "You assume 12-hour strip cycles for M40 concrete. On my project, we can't strip for 24 hours. How does your system handle this?"

**Response:** Strip cycle is a per-pour input parameter, not a system-wide constant. The planner enters strip cycle hours for each pour zone during project setup. The optimizer reads this directly — Pour Z1 might have 12h (M40, warm climate), Pour Z2 might have 24h (M50, winter conditions). This is configurable per pour, per floor, per zone. The optimizer respects whatever value is entered as a hard constraint — it will never schedule reuse that violates the strip timing.

If a planner is uncertain, we recommend entering the conservative (longer) value. The optimizer works with what it's given — garbage in, garbage out. But even with conservative estimates, optimization across 200 pours still yields significant savings over manual planning.

---

### Q2: "Your panel layout engine does bin-packing for walls. But real walls have openings, blockouts, kickers, and corbels. How do you handle irregular geometry?"

**Response:** Version 1.0 does NOT attempt geometric modeling. The system takes **net surface area** as input — which the planner already calculates by deducting openings from gross wall area. The panel layout engine works with this net area to determine panel counts.

For walls with complex geometry (large openings, varying heights), the planner can:
1. Override the auto-generated kit configuration
2. Manually specify panel quantities for that specific pour
3. Lock the manual kit so the optimizer doesn't overwrite it

The optimization value is not in panel layout (which is a geometric problem) — it's in the **multi-period reuse sequencing** (which panels to reuse from which prior pour). Even if the planner manually defines every kit, the optimizer still adds value by determining the optimal procurement quantity, reuse sequence, and number of formwork sets.

BIM-based geometric layout is a Phase 2 feature, contingent on project BIM adoption.

---

### Q3: "You mention PERI TRIO and Doka Frami. But we use hybrid systems — PERI for walls, Doka for slabs, and local aluminum for columns. Can your system handle this?"

**Response:** Yes, this is a core design principle. Each pour zone is assigned a specific formwork system independently. Tower T1, Floor 3, Zone Z1 (walls) can use PERI TRIO while Zone S1 (slab) uses Doka Dokaflex and Column pours use aluminum forms. The optimizer treats each system's components separately — it will never mix PERI panels with Doka walers thanks to the compatibility rules engine.

Cross-system components (e.g., props that work with multiple slab systems) are modeled as belonging to the more generic system with appropriate compatibility rules.

---

### Q4: "Concrete pour pressure affects formwork design — you need to verify that your panel configuration can withstand the hydrostatic pressure. Where is the structural check?"

**Response:** The formwork system table stores `max_pour_pressure_kpa` for each system. The pour table stores `pour_height_mm` and `pour_rate_m_per_hour`. We compute the maximum lateral pressure using the standard formula:

$P_{max} = \min(\rho g H, \rho g R \cdot t_{set})$

where $\rho$ = concrete density, $g$ = gravity, $H$ = pour height, $R$ = pour rate, $t_{set}$ = setting time.

If the computed pressure exceeds the system's rated capacity, the kit configuration is flagged as "STRUCTURAL_CHECK_REQUIRED" and the planner must confirm. The optimizer does not replace structural engineering judgment — it flags potential issues for review.

For typical residential projects (3m walls, M40 concrete, ≤1.5 m/hr pour rate), PERI TRIO's 80 kPa rating is never exceeded. This check becomes critical for deep transfer beams or retaining walls.

---

## ERP / DATA QUESTIONS (SAP Owners / Data Engineers)

### Q5: "How do you handle the fact that SAP doesn't track formwork at the individual unit level? There's no serial number for each panel."

**Response:** Correct — SAP tracks quantities at the material code level, not individual units. FKO maintains its own instance registry (`component_instance` table) that is initialized from SAP quantities at project onboarding:

- If SAP says 20 units of PERI TRIO WDP 2400 exist on the project, FKO creates 20 instance records with default remaining-cycle estimates.
- From that point, FKO tracks each instance through deployment/strip cycles within its own system.
- The linkage to SAP is maintained at the material-code aggregate level for BoQ reconciliation.

For pilot, we do NOT require physical tagging of every panel. Instance-level tracking is useful for reuse cycle counting and damage tracking, but the optimizer works at the component-type level (aggregate quantities). Instance-level granularity is a progressive enhancement.

---

### Q6: "SAP material descriptions are a disaster across projects. 'PERI Panel 2400' vs 'TRIO WDP-2400x2700' vs 'WALL PANEL PERI 2.4M'. How do you normalize this?"

**Response:** We built a Material Normalization Engine specifically for this. It uses:

1. **Regex pattern matching** for known vendor naming conventions (PERI, Doka, MEVA have recognizable patterns)
2. **Dimension extraction** from various formats (2400x2700, 240/270, 2400MM, WDP 2400)
3. **Vendor + system detection** from keywords (TRIO → PERI_TRIO, FRAMI → DOKA_FRAMI)

But — and this is critical — **the system does NOT auto-map and run.** Every regex match goes through a planner confirmation step during project onboarding. The planner reviews the mapping: "SAP says 'PERI Panel WDP 2400 Steel Frame' → we mapped to PERI TRIO Wall Panel 2400x2700. Confirm? [Yes/No/Correct]"

Once confirmed for one project, the mapping is stored and reused enterprise-wide. After 3-4 projects, the lookup table covers 95%+ of material codes, and new projects require minimal manual mapping.

---

### Q7: "What about goods movements that don't follow the standard 261/262 pattern? Some sites use 201/202 for cost center movements instead of project movements."

**Response:** The goods movement parser is configurable for which movement types to include. The default is 261/262 (project stock issues/returns), but it supports 201/202 (cost center), 311/312 (transfer postings), and others. During project onboarding, we identify which movement types the specific SAP plant uses for formwork tracking and configure accordingly.

The key requirement is that we can pair an "issue" event with a "return" event for the same material + WBS/cost center. The movement type codes are configurable — the logic is the same. We document expected movement type patterns during the data gathering phase (Month 1).

---

## OPTIMIZATION QUESTIONS (OR Specialists / Technical Reviewers)

### Q8: "Your MIP has 10,000 integer variables and 50,000 constraints. How do you know it won't take hours to solve?"

**Response:** 

First, the problem structure is favorable for CP-SAT:
- The kit configuration selection is a set of independent one-of-n choices (highly parallelizable)
- Inventory balance constraints are flow-conservation equations (well-structured)
- Compatibility constraints are pre-filtered at the kit configuration generation stage

Second, we've sized this based on published benchmarks for CP-SAT on similar combinatorial problems. A 10K-variable MIP with flow structure typically solves in under 5 minutes on a 4-core machine.

Third, we have a fallback: the **Rolling-Horizon Solver** that breaks the problem into 4-week windows, solving each exactly and using LP relaxation for the remaining horizon. This guarantees sub-60-second solve for any project size.

Finally, we set a 2% optimality gap target — the solver can return a proven-good solution quickly without proving absolute optimality. For a construction planning problem, 2% gap (which might be ₹50,000 on a ₹25L formwork budget) is well within noise.

---

### Q9: "You claim greedy heuristics fail. But construction planners have been doing this manually for decades. Are you saying they're doing it wrong?"

**Response:** Planners are doing it *well* given the tools they have. The point is not that planners make bad decisions — it's that the combinatorial space is too large for any human to explore exhaustively.

A planner currently optimizes pour-by-pour: "What's available? Assign it." This is a greedy strategy that works reasonably well. But it cannot:

1. Look ahead 20 pours to determine that reserving a panel for a later pour yields higher total reuse
2. Compute the exact optimal number of formwork sets (2.0 vs. 2.3 vs. 2.5) given the schedule timing
3. Determine when to switch from procurement to rental as the project approaches completion

These are decisions that require solving across all pours simultaneously. The planner's experience gives a good heuristic (typically within 15-25% of optimal). The optimizer closes that gap.

Critically, FKO does NOT remove the planner. It recommends, explains, and lets the planner override. The planner's judgment on special situations (problematic pours, crane access issues, weather delays) is irreplaceable. FKO handles the computational optimization; the planner handles the situational reality.

---

### Q10: "What happens when the model is infeasible? E.g., not enough inventory to cover all pours even with perfect reuse."

**Response:** Infeasibility means the optimization detected that the project cannot be executed with the current inventory and schedule — which is actually valuable information. The solver response includes:

1. **Infeasibility diagnosis**: Which constraint(s) are violated (e.g., "Pour T1-F5-Z1 requires 12 WDP-2400 panels but only 8 are available after stripping all prior pours")
2. **Recommendation**: "Procure 4 additional WDP-2400 panels by Day 28" or "Delay Pour T1-F5-Z1 by 2 days to allow stripping from T1-F4-Z2"

We also add slack variables to critical constraints so the solver always finds a solution, but reports the slack as "shortfall". This way, the planner sees exactly where the inventory is tight and can take action (procure more, rent, or adjust schedule).

---

### Q11: "The loss rate and damage rate parameters — where do these numbers come from? If they're wrong, your optimization is wrong."

**Response:** Absolutely correct — parameter quality is critical. Our approach:

1. **Initialization**: We use manufacturer-specified rates as starting defaults (PERI publishes expected panel life as 300 cycles with typical 0.1-0.3% loss per cycle for steel-frame panels)
2. **Calibration from SAP data**: From historical issue/return logs, we compute actual loss rates (issued qty - returned qty) / issued qty per material code. This is done automatically during the back-testing phase.
3. **Bayesian updating during pilot**: As the system tracks actual deployments and returns, observed rates are compared against assumed rates. If actual loss is 0.5% per cycle vs. assumed 0.2%, the system alerts the planner and recommends parameter adjustment.

The optimizer is not brittle to parameter uncertainty. A 2x error in loss rate (0.2% vs. 0.4%) changes total cost by ~1-2% because loss is a small component of total cost. The dominant cost drivers are procurement quantity and idle inventory — which are determined by the reuse sequencing, not the loss rate.

---

## COMMERCIAL / BUSINESS QUESTIONS

### Q12: "₹5-8 Cr savings per tower sounds too good. Walk me through the math."

**Response:**

Typical 25-floor residential tower:
- Formwork budget: ₹35-50 Cr (7-10% of ₹500 Cr construction cost)
- Breakdown:
  - Procurement (owned): ₹20-30 Cr
  - Rental: ₹5-10 Cr
  - Handling/labor: ₹5-8 Cr
  - Loss/damage: ₹1-2 Cr

FKO's impact:
- **Procurement reduction of 15-20%**: Current approach provisions 2.5 sets "to be safe." FKO determines 2.0 sets suffice with proper sequencing. 0.5 fewer sets × ₹10-12 Cr per set = **₹5-6 Cr savings** on procurement alone.
- **Rental reduction of 30-50%**: By better predicting when owned inventory is available, peak rental periods are shorter. Saves **₹1.5-3 Cr**.
- **Handling cost stays similar** (same number of strip-redeploy cycles, just better sequenced).
- **Loss reduction of 10-20%**: Better tracking, earlier condemn detection. Saves **₹0.2-0.4 Cr**.

Conservative total: **₹5-8 Cr per tower**, or 10-15% of formwork budget. This is consistent with published operations research results on reusable resource optimization in construction.

---

### Q13: "Why 6 months? Can't we just buy a tool off the shelf?"

**Response:** No off-the-shelf tool exists that does multi-period formwork reuse optimization with SAP integration. The vendor tools (PERI CAD, Doka Tipos) do static panel layout — they don't solve the temporal optimization problem. No construction software vendor sells this capability.

6 months is aggressive but achievable because:
- Month 0-2 is data work (parsers + normalization) — standard engineering, low risk
- Month 3-4 is the optimizer — the mathematical formulation is defined, implementation is coding work
- Month 5-6 is pilot — parallel run alongside existing process, low risk

The critical dependency is SAP data access (typically 2-4 weeks to get approvals). We mitigate by starting the request immediately and developing against mock data.

---

*End of Q&A Defense Guide*
