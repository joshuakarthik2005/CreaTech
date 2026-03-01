"""
FormKit Optimizer — Data Ingestion Pipeline
============================================

Parsers for:
1. SAP MM Material Master (CSV export from SE16N/MARA)
2. SAP MB51 Goods Movement logs (CSV export)
3. Primavera P6 Schedule (XER/CSV export)
4. Manual surface area input (Excel template)

All parsers produce normalized records ready for database insertion.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ============================================================
# MATERIAL NORMALIZATION ENGINE
# ============================================================

@dataclass
class NormalizedComponent:
    """A formwork component extracted from SAP free-text description."""
    sap_material_code: str
    sap_description: str
    vendor: Optional[str] = None
    system_code: Optional[str] = None
    component_type: Optional[str] = None
    width_mm: Optional[int] = None
    height_mm: Optional[int] = None
    length_mm: Optional[int] = None
    confidence: float = 0.0  # 0.0 = unmatched, 1.0 = high confidence
    match_method: str = "UNMATCHED"


class MaterialNormalizer:
    """Parses SAP free-text material descriptions into structured component data.
    
    SAP material descriptions are notoriously inconsistent across projects.
    Examples of the same component:
      - "PERI TRIO Panel WDP 2400"
      - "TRIO WDP 240/270"
      - "PERI WDP-2400x2700 TRIO WALL PANEL"
      - "WALL PANEL PERI 2400MM"
    
    This normalizer uses regex patterns for known vendor naming conventions
    and falls back to keyword matching.
    """

    # Vendor detection patterns
    VENDOR_PATTERNS = {
        "PERI": re.compile(r'\bPERI\b', re.IGNORECASE),
        "DOKA": re.compile(r'\bDOKA\b', re.IGNORECASE),
        "MEVA": re.compile(r'\bMEVA\b', re.IGNORECASE),
    }

    # System detection patterns
    SYSTEM_PATTERNS = {
        "PERI_TRIO": re.compile(r'\bTRIO\b', re.IGNORECASE),
        "PERI_GRIDFLEX": re.compile(r'\bGRIDFLEX\b', re.IGNORECASE),
        "PERI_MAXIMO": re.compile(r'\bMAXIMO\b', re.IGNORECASE),
        "DOKA_FRAMI_XLIFE": re.compile(r'\bFRAMI\b.*\bXLIFE\b|\bXLIFE\b.*\bFRAMI\b', re.IGNORECASE),
        "DOKA_FRAMI": re.compile(r'\bFRAMI\b', re.IGNORECASE),
        "DOKA_DOKAFLEX": re.compile(r'\bDOKAFLEX\b', re.IGNORECASE),
        "MEVA_STARTEC": re.compile(r'\bSTARTEC\b', re.IGNORECASE),
    }

    # Component type detection patterns
    TYPE_PATTERNS = {
        "PANEL": re.compile(r'\bPANEL\b|\bWDP\b|\bSDP\b', re.IGNORECASE),
        "FILLER": re.compile(r'\bFILLER\b|\bFILL\b', re.IGNORECASE),
        "TIE_ROD": re.compile(r'\bTIE\s*ROD\b|\bDW\d+\b|\bTIE\b(?!.*CONE)', re.IGNORECASE),
        "TIE_CONE": re.compile(r'\bCONE\b|\bTIE\s*CONE\b', re.IGNORECASE),
        "WALER": re.compile(r'\bWALER\b|\bBFD\b', re.IGNORECASE),
        "PROP": re.compile(r'\bPROP\b|\bSHORE\b|\bJACK\b', re.IGNORECASE),
        "CLAMP": re.compile(r'\bCLAMP\b', re.IGNORECASE),
        "WEDGE": re.compile(r'\bWEDGE\b', re.IGNORECASE),
        "CORNER": re.compile(r'\bCORNER\b|\bIC\s*90\b|\bOC\s*90\b', re.IGNORECASE),
    }

    # Dimension extraction patterns
    DIM_PATTERNS = [
        # "2400x2700" or "2400×2700"
        re.compile(r'(\d{2,4})\s*[x×X]\s*(\d{2,4})'),
        # "WDP 2400" (panel width designation)
        re.compile(r'WDP\s*(\d{2,4})', re.IGNORECASE),
        # "240/270" (compact notation in cm or dm)
        re.compile(r'(\d{2,3})[/](\d{2,3})'),
        # Standalone dimension with MM
        re.compile(r'(\d{3,4})\s*[Mm][Mm]'),
    ]

    def normalize(self, sap_code: str, sap_description: str) -> NormalizedComponent:
        """Parse a SAP material description into structured component data."""
        result = NormalizedComponent(
            sap_material_code=sap_code,
            sap_description=sap_description,
        )

        # Step 1: Detect vendor
        for vendor, pattern in self.VENDOR_PATTERNS.items():
            if pattern.search(sap_description):
                result.vendor = vendor
                result.confidence += 0.2
                break

        # Step 2: Detect system
        for system, pattern in self.SYSTEM_PATTERNS.items():
            if pattern.search(sap_description):
                result.system_code = system
                result.confidence += 0.3
                break

        # Step 3: Detect component type
        for comp_type, pattern in self.TYPE_PATTERNS.items():
            if pattern.search(sap_description):
                result.component_type = comp_type
                result.confidence += 0.2
                break

        # Step 4: Extract dimensions
        for dim_pattern in self.DIM_PATTERNS:
            match = dim_pattern.search(sap_description)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    d1 = int(groups[0])
                    d2 = int(groups[1])
                    # Heuristic: larger dimension is height for panels
                    if d1 < 100:  # Likely in cm/dm, convert
                        d1 *= 10
                    if d2 < 100:
                        d2 *= 10
                    if result.component_type == "PANEL":
                        result.width_mm = min(d1, d2)
                        result.height_mm = max(d1, d2)
                    else:
                        result.width_mm = d1
                        result.height_mm = d2
                elif len(groups) == 1:
                    dim = int(groups[0])
                    if dim < 100:
                        dim *= 10
                    result.width_mm = dim
                result.confidence += 0.2
                break

        # Set match method
        if result.confidence >= 0.7:
            result.match_method = "REGEX_HIGH"
        elif result.confidence >= 0.4:
            result.match_method = "REGEX_PARTIAL"
        else:
            result.match_method = "UNMATCHED"

        return result

    def normalize_batch(self, records: list[tuple[str, str]]) -> list[NormalizedComponent]:
        """Normalize a batch of (sap_code, sap_description) tuples."""
        results = []
        matched = 0
        for code, desc in records:
            norm = self.normalize(code, desc)
            results.append(norm)
            if norm.confidence >= 0.4:
                matched += 1

        logger.info(
            f"Normalized {len(records)} materials: "
            f"{matched} matched ({matched/len(records)*100:.0f}%), "
            f"{len(records) - matched} unmatched (require manual review)"
        )
        return results


# ============================================================
# SAP MM MATERIAL MASTER PARSER
# ============================================================

@dataclass
class SAPMaterialRecord:
    """Parsed record from SAP MM material master export."""
    material_code: str
    description: str
    material_group: str
    uom: str
    plant: str
    storage_location: str
    material_type: str


class SAPMaterialParser:
    """Parses SAP MM material master CSV exports (SE16N on MARA/MARC tables).
    
    Expected columns (configurable):
      MATNR, MAKTX, MATKL, MEINS, WERKS, LGORT, MTART
    """

    DEFAULT_COLUMN_MAP = {
        "material_code": ["MATNR", "Material", "Material Number"],
        "description": ["MAKTX", "Material Description", "Description"],
        "material_group": ["MATKL", "Material Group", "Mat. Group"],
        "uom": ["MEINS", "Base Unit", "UoM"],
        "plant": ["WERKS", "Plant"],
        "storage_location": ["LGORT", "Storage Location", "SLoc"],
        "material_type": ["MTART", "Material Type", "Mat. Type"],
    }

    def __init__(self, column_map: dict | None = None):
        self.column_map = column_map or self.DEFAULT_COLUMN_MAP

    def parse_csv(self, file_path: str | Path) -> list[SAPMaterialRecord]:
        """Parse a SAP material master CSV export."""
        path = Path(file_path)
        records = []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            header_map = self._resolve_columns(reader.fieldnames or [])

            for row in reader:
                try:
                    record = SAPMaterialRecord(
                        material_code=row.get(header_map.get("material_code", ""), "").strip(),
                        description=row.get(header_map.get("description", ""), "").strip(),
                        material_group=row.get(header_map.get("material_group", ""), "").strip(),
                        uom=row.get(header_map.get("uom", ""), "").strip(),
                        plant=row.get(header_map.get("plant", ""), "").strip(),
                        storage_location=row.get(header_map.get("storage_location", ""), "").strip(),
                        material_type=row.get(header_map.get("material_type", ""), "").strip(),
                    )
                    if record.material_code:
                        records.append(record)
                except Exception as e:
                    logger.warning(f"Failed to parse row: {e}")

        logger.info(f"Parsed {len(records)} material records from {path.name}")
        return records

    def _resolve_columns(self, headers: list[str]) -> dict[str, str]:
        """Map logical field names to actual CSV column headers."""
        resolved = {}
        header_lower = {h.strip().lower(): h.strip() for h in headers}

        for field_name, candidates in self.column_map.items():
            for candidate in candidates:
                if candidate.lower() in header_lower:
                    resolved[field_name] = header_lower[candidate.lower()]
                    break

        return resolved


# ============================================================
# SAP MB51 GOODS MOVEMENT PARSER
# ============================================================

@dataclass
class GoodsMovementRecord:
    """Parsed record from SAP MB51 goods movement export."""
    document_number: str
    material_code: str
    movement_type: str  # 261=issue, 262=return, 101=GR, 122=RE return
    quantity: float
    posting_date: date
    plant: str
    storage_location: str
    wbs_element: str
    cost_center: str
    reference: str


class GoodsMovementParser:
    """Parses SAP MB51 goods movement list CSV export.
    
    Filters for formwork-relevant movement types:
      261 = Goods Issue to project (formwork deployed)
      262 = Goods Return from project (formwork stripped/returned)
      101 = Goods Receipt (new procurement arrival)
      122 = Return to vendor
    """

    RELEVANT_MOVEMENT_TYPES = {"261", "262", "101", "122", "201", "202"}

    DEFAULT_COLUMN_MAP = {
        "document_number": ["Material Document", "Mat. Doc.", "MBLNR"],
        "material_code": ["Material", "MATNR"],
        "movement_type": ["MvT", "Movement Type", "BWART"],
        "quantity": ["Quantity", "Qty", "MENGE"],
        "posting_date": ["Posting Date", "Pstng Date", "BUDAT"],
        "plant": ["Plant", "WERKS"],
        "storage_location": ["SLoc", "Storage Location", "LGORT"],
        "wbs_element": ["WBS Element", "WBS", "POSID"],
        "cost_center": ["Cost Center", "Cost Ctr", "KOSTL"],
        "reference": ["Reference", "Ref. Doc.", "XBLNR"],
    }

    def parse_csv(self, file_path: str | Path) -> list[GoodsMovementRecord]:
        """Parse SAP MB51 goods movement CSV export."""
        path = Path(file_path)
        records = []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            header_map = self._resolve_columns(reader.fieldnames or [])

            for row in reader:
                try:
                    mvt = row.get(header_map.get("movement_type", ""), "").strip()
                    if mvt not in self.RELEVANT_MOVEMENT_TYPES:
                        continue

                    date_str = row.get(header_map.get("posting_date", ""), "").strip()
                    posting_date = self._parse_date(date_str)

                    qty_str = row.get(header_map.get("quantity", ""), "0").strip()
                    quantity = float(qty_str.replace(",", ""))

                    record = GoodsMovementRecord(
                        document_number=row.get(header_map.get("document_number", ""), "").strip(),
                        material_code=row.get(header_map.get("material_code", ""), "").strip(),
                        movement_type=mvt,
                        quantity=quantity,
                        posting_date=posting_date,
                        plant=row.get(header_map.get("plant", ""), "").strip(),
                        storage_location=row.get(header_map.get("storage_location", ""), "").strip(),
                        wbs_element=row.get(header_map.get("wbs_element", ""), "").strip(),
                        cost_center=row.get(header_map.get("cost_center", ""), "").strip(),
                        reference=row.get(header_map.get("reference", ""), "").strip(),
                    )
                    if record.material_code:
                        records.append(record)
                except Exception as e:
                    logger.warning(f"Failed to parse MB51 row: {e}")

        logger.info(f"Parsed {len(records)} goods movements from {path.name}")
        return records

    def derive_reuse_cycles(self, records: list[GoodsMovementRecord]) -> dict[str, list[dict]]:
        """Derive formwork reuse cycles from issue/return pairs.
        
        For each material + WBS combination:
        - 261 (issue) = deployment start
        - 262 (return) = deployment end
        - Gap between consecutive 261→262 = one reuse cycle
        
        Returns: {material_code: [{wbs, issue_date, return_date, cycle_days}, ...]}
        """
        # Group by material + WBS
        groups: dict[tuple[str, str], list[GoodsMovementRecord]] = {}
        for rec in records:
            key = (rec.material_code, rec.wbs_element)
            groups.setdefault(key, []).append(rec)

        reuse_data: dict[str, list[dict]] = {}

        for (mat_code, wbs), movements in groups.items():
            sorted_mvts = sorted(movements, key=lambda r: r.posting_date)
            cycles = []
            pending_issue = None

            for mvt in sorted_mvts:
                if mvt.movement_type == "261" and pending_issue is None:
                    pending_issue = mvt
                elif mvt.movement_type == "262" and pending_issue is not None:
                    cycle_days = (mvt.posting_date - pending_issue.posting_date).days
                    cycles.append({
                        "wbs": wbs,
                        "issue_date": pending_issue.posting_date.isoformat(),
                        "return_date": mvt.posting_date.isoformat(),
                        "cycle_days": cycle_days,
                        "quantity": min(pending_issue.quantity, mvt.quantity),
                    })
                    pending_issue = None

            if cycles:
                reuse_data.setdefault(mat_code, []).extend(cycles)

        logger.info(
            f"Derived {sum(len(v) for v in reuse_data.values())} reuse cycles "
            f"for {len(reuse_data)} material codes"
        )
        return reuse_data

    def _resolve_columns(self, headers: list[str]) -> dict[str, str]:
        resolved = {}
        header_lower = {h.strip().lower(): h.strip() for h in headers}
        for field_name, candidates in self.DEFAULT_COLUMN_MAP.items():
            for candidate in candidates:
                if candidate.lower() in header_lower:
                    resolved[field_name] = header_lower[candidate.lower()]
                    break
        return resolved

    @staticmethod
    def _parse_date(date_str: str) -> date:
        """Parse date from common SAP formats."""
        for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {date_str}")


# ============================================================
# SCHEDULE PARSER (Primavera P6 / MS Project CSV exports)
# ============================================================

@dataclass
class ScheduleActivity:
    """Parsed schedule activity representing a pour event."""
    activity_id: str
    activity_name: str
    start_date: date
    finish_date: date
    duration_days: int
    wbs_code: str
    predecessors: list[str]
    # Parsed fields
    tower_code: Optional[str] = None
    floor_number: Optional[int] = None
    zone_code: Optional[str] = None
    pour_type: Optional[str] = None


class ScheduleParser:
    """Parses pour schedule from Primavera P6 or MS Project CSV exports.
    
    Expects L&T naming convention for pour activities:
      POUR-{Tower}-F{Floor}-{Zone}-{Type}
    
    Examples:
      POUR-T1-F03-Z2-WALL
      POUR-T1-F12-S1-SLAB
      POUR-T2-F01-Z1-COLUMN
    """

    # Activity name parsing pattern
    POUR_PATTERN = re.compile(
        r'POUR[-_]'
        r'(?P<tower>[A-Z]\d+)[-_]'
        r'F(?P<floor>\d{1,3})[-_]'
        r'(?P<zone>[A-Z]\d+)[-_]'
        r'(?P<type>WALL|SLAB|COLUMN|BEAM|SHEAR[_\s]?WALL)',
        re.IGNORECASE
    )

    DEFAULT_COLUMN_MAP = {
        "activity_id": ["Activity ID", "Task ID", "ID"],
        "activity_name": ["Activity Name", "Task Name", "Name"],
        "start_date": ["Start", "Start Date", "Planned Start"],
        "finish_date": ["Finish", "Finish Date", "Planned Finish"],
        "duration_days": ["Duration", "Original Duration"],
        "wbs_code": ["WBS", "WBS Code", "Outline Code"],
        "predecessors": ["Predecessors", "Predecessor"],
    }

    def parse_csv(self, file_path: str | Path) -> list[ScheduleActivity]:
        """Parse a schedule CSV export and return pour activities."""
        path = Path(file_path)
        records = []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            header_map = self._resolve_columns(reader.fieldnames or [])

            for row in reader:
                try:
                    name = row.get(header_map.get("activity_name", ""), "").strip()
                    if not self._is_pour_activity(name):
                        continue

                    start_str = row.get(header_map.get("start_date", ""), "").strip()
                    finish_str = row.get(header_map.get("finish_date", ""), "").strip()

                    activity = ScheduleActivity(
                        activity_id=row.get(header_map.get("activity_id", ""), "").strip(),
                        activity_name=name,
                        start_date=self._parse_date(start_str),
                        finish_date=self._parse_date(finish_str),
                        duration_days=int(row.get(header_map.get("duration_days", ""), "1").strip() or "1"),
                        wbs_code=row.get(header_map.get("wbs_code", ""), "").strip(),
                        predecessors=self._parse_predecessors(
                            row.get(header_map.get("predecessors", ""), "")
                        ),
                    )

                    # Parse structured fields from activity name
                    self._parse_pour_name(activity)
                    records.append(activity)

                except Exception as e:
                    logger.warning(f"Failed to parse schedule row: {e}")

        logger.info(f"Parsed {len(records)} pour activities from {path.name}")
        return records

    def _is_pour_activity(self, name: str) -> bool:
        """Check if activity name represents a pour event."""
        return bool(re.search(r'POUR', name, re.IGNORECASE))

    def _parse_pour_name(self, activity: ScheduleActivity):
        """Extract tower, floor, zone, type from activity name."""
        match = self.POUR_PATTERN.search(activity.activity_name)
        if match:
            activity.tower_code = match.group("tower").upper()
            activity.floor_number = int(match.group("floor"))
            activity.zone_code = match.group("zone").upper()
            ptype = match.group("type").upper().replace(" ", "_")
            activity.pour_type = ptype

    def _parse_predecessors(self, pred_str: str) -> list[str]:
        """Parse predecessor list (comma or semicolon separated)."""
        if not pred_str.strip():
            return []
        return [p.strip() for p in re.split(r'[;,]', pred_str) if p.strip()]

    def _resolve_columns(self, headers: list[str]) -> dict[str, str]:
        resolved = {}
        header_lower = {h.strip().lower(): h.strip() for h in headers}
        for field_name, candidates in self.DEFAULT_COLUMN_MAP.items():
            for candidate in candidates:
                if candidate.lower() in header_lower:
                    resolved[field_name] = header_lower[candidate.lower()]
                    break
        return resolved

    @staticmethod
    def _parse_date(date_str: str) -> date:
        for fmt in ("%d-%b-%y", "%d-%b-%Y", "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%d.%m.%Y"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {date_str}")


# ============================================================
# SURFACE AREA INPUT PARSER (Excel template)
# ============================================================

@dataclass
class SurfaceAreaInput:
    """Manual surface area input per pour zone."""
    tower_code: str
    floor_number: int
    zone_code: str
    pour_type: str
    gross_area_m2: float
    net_area_m2: float
    concrete_grade: str
    pour_height_mm: Optional[int]
    strip_cycle_hours: int
    formwork_system: str
    notes: str = ""


class SurfaceAreaParser:
    """Parses the FKO surface area input Excel template.
    
    Template columns:
      Tower | Floor | Zone | Type | Gross Area (m²) | Deductions (m²) |
      Net Area (m²) | Concrete Grade | Pour Height (mm) | Strip Cycle (hrs) |
      Formwork System | Notes
    """

    def parse_csv(self, file_path: str | Path) -> list[SurfaceAreaInput]:
        """Parse surface area CSV (exported from Excel template)."""
        path = Path(file_path)
        records = []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    gross = float(row.get("Gross Area (m²)", row.get("Gross Area", "0")))
                    deductions = float(row.get("Deductions (m²)", row.get("Deductions", "0")))
                    net = float(row.get("Net Area (m²)", row.get("Net Area", str(gross - deductions))))

                    record = SurfaceAreaInput(
                        tower_code=row.get("Tower", "").strip(),
                        floor_number=int(row.get("Floor", "0").strip()),
                        zone_code=row.get("Zone", "").strip(),
                        pour_type=row.get("Type", "").strip().upper(),
                        gross_area_m2=gross,
                        net_area_m2=net,
                        concrete_grade=row.get("Concrete Grade", "M40").strip(),
                        pour_height_mm=int(row["Pour Height (mm)"]) if row.get("Pour Height (mm)") else None,
                        strip_cycle_hours=int(row.get("Strip Cycle (hrs)", "12").strip()),
                        formwork_system=row.get("Formwork System", "").strip(),
                        notes=row.get("Notes", "").strip(),
                    )
                    records.append(record)
                except Exception as e:
                    logger.warning(f"Failed to parse surface area row: {e}")

        logger.info(f"Parsed {len(records)} surface area records from {path.name}")
        return records
