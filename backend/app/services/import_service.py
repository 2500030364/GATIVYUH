import io
import csv
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.schemas.data_manager import CSVImportResult, CSVImportRowError
from app.services.inventory_service import inventory_service

class ImportService:
    @staticmethod
    def get_sample_template(dataset_type: str) -> str:
        dataset_type = dataset_type.upper().strip()
        if dataset_type == "LOCATIONS":
            return (
                "id,name,location_type,latitude,longitude,elevation_m,status,description\n"
                "LOC-DEMO-01,Wakad Transit Post,TRANSIT_NODE,18.5980,73.7630,575.0,STABLE,Secondary convoy staging area\n"
                "LOC-DEMO-02,Dehu Road Fuel Depot,FUEL_DEPOT,18.7180,73.7250,590.0,STABLE,Ordnance and tactical fuel depot\n"
            )
        elif dataset_type == "INVENTORY":
            return (
                "location_id,category,item_name,unit,available_stock,reserved_stock,min_stock,max_capacity,replenishment_qty\n"
                "LOC-PUN-01,FUEL,High-Speed Diesel (HSD),Liters,8500.0,400.0,3000.0,20000.0,5000.0\n"
                "LOC-PUN-01,FOOD_WATER,Emergency MRE Rations,Rations,4500.0,200.0,1200.0,8000.0,2000.0\n"
            )
        elif dataset_type == "EVENTS":
            return (
                "event_type,location_id,destination_id,category,item_name,quantity,unit,reference_code,notes\n"
                "RECEIPT,LOC-PUN-01,,FUEL,High-Speed Diesel (HSD),5000,Liters,PO-9912,Direct supply from depot pipeline\n"
                "DISPATCH,LOC-PUN-01,LOC-LON-03,FOOD_WATER,Emergency MRE Rations,500,Rations,CONVOY-08,Urgent mountain outpost delivery\n"
            )
        raise ValueError(f"Unknown dataset template type: {dataset_type}")

    @staticmethod
    def import_locations(db: Session, content_str: str) -> CSVImportResult:
        reader = csv.DictReader(io.StringIO(content_str))
        rows = list(reader)
        errors: List[CSVImportRowError] = []
        valid_items: List[Location] = []
        seen_ids = set()

        for idx, row in enumerate(rows, start=2):  # 1-indexed, line 1 is header
            loc_id = row.get("id", "").strip().upper()
            name = row.get("name", "").strip()
            loc_type = row.get("location_type", "").strip().upper()
            lat_str = row.get("latitude", "").strip()
            lon_str = row.get("longitude", "").strip()

            if not loc_id:
                errors.append(CSVImportRowError(row_number=idx, field="id", message="Location ID cannot be empty", raw_data=row))
                continue
            if not name:
                errors.append(CSVImportRowError(row_number=idx, field="name", message="Location name cannot be empty", raw_data=row))
                continue

            if loc_id in seen_ids:
                errors.append(CSVImportRowError(row_number=idx, field="id", message=f"Duplicate location ID '{loc_id}' in CSV", raw_data=row))
                continue

            existing_db = db.query(Location).filter(Location.id == loc_id).first()
            if existing_db:
                errors.append(CSVImportRowError(row_number=idx, field="id", message=f"Location ID '{loc_id}' already exists in database", raw_data=row))
                continue

            try:
                lat = float(lat_str)
                if not (-90.0 <= lat <= 90.0):
                    raise ValueError()
            except Exception:
                errors.append(CSVImportRowError(row_number=idx, field="latitude", message=f"Invalid latitude '{lat_str}'. Must be float between -90 and 90.", raw_data=row))
                continue

            try:
                lon = float(lon_str)
                if not (-180.0 <= lon <= 180.0):
                    raise ValueError()
            except Exception:
                errors.append(CSVImportRowError(row_number=idx, field="longitude", message=f"Invalid longitude '{lon_str}'. Must be float between -180 and 180.", raw_data=row))
                continue

            elev = None
            if row.get("elevation_m"):
                try:
                    elev = float(row.get("elevation_m"))
                except Exception:
                    pass

            status = row.get("status", "STABLE").strip().upper()
            if status not in {"STABLE", "WATCH", "AT_RISK", "CRITICAL", "INACTIVE"}:
                status = "STABLE"

            valid_types = {"HUB", "FORWARD_DEPOT", "FIELD_HOSPITAL", "FUEL_DEPOT", "TRANSIT_NODE", "DISTRIBUTION_CENTER"}
            if loc_type not in valid_types:
                loc_type = "FORWARD_DEPOT"

            seen_ids.add(loc_id)
            valid_items.append(Location(
                id=loc_id,
                name=name,
                location_type=loc_type,
                status=status,
                latitude=lat,
                longitude=lon,
                elevation_m=elev,
                description=row.get("description", "").strip(),
                is_synthetic=False,  # Imported by user
                is_active=True
            ))

        if errors:
            return CSVImportResult(
                dataset_type="LOCATIONS",
                total_rows=len(rows),
                imported_rows=0,
                failed_rows=len(errors),
                success=False,
                errors=errors,
                message=f"Validation failed with {len(errors)} error(s). No records were imported."
            )

        for item in valid_items:
            db.add(item)
        db.commit()

        return CSVImportResult(
            dataset_type="LOCATIONS",
            total_rows=len(rows),
            imported_rows=len(valid_items),
            failed_rows=0,
            success=True,
            errors=[],
            message=f"Successfully validated and imported {len(valid_items)} location records."
        )

    @staticmethod
    def import_inventory(db: Session, content_str: str) -> CSVImportResult:
        reader = csv.DictReader(io.StringIO(content_str))
        rows = list(reader)
        errors: List[CSVImportRowError] = []
        valid_items = []

        valid_categories = {"FOOD_WATER", "FUEL", "MEDICAL_SUPPLIES", "GENERAL_SUPPLIES"}

        for idx, row in enumerate(rows, start=2):
            loc_id = row.get("location_id", "").strip().upper()
            cat = row.get("category", "").strip().upper().replace(" ", "_").replace("/", "_")
            item_name = row.get("item_name", "").strip()
            unit = row.get("unit", "Units").strip()

            if not loc_id:
                errors.append(CSVImportRowError(row_number=idx, field="location_id", message="location_id is required", raw_data=row))
                continue

            loc = db.query(Location).filter(Location.id == loc_id).first()
            if not loc:
                errors.append(CSVImportRowError(row_number=idx, field="location_id", message=f"Referenced location '{loc_id}' does not exist", raw_data=row))
                continue

            if cat not in valid_categories:
                # Try soft mapping
                if "FOOD" in cat or "WATER" in cat:
                    cat = "FOOD_WATER"
                elif "MED" in cat:
                    cat = "MEDICAL_SUPPLIES"
                elif "GEN" in cat:
                    cat = "GENERAL_SUPPLIES"
                else:
                    errors.append(CSVImportRowError(row_number=idx, field="category", message=f"Invalid category '{cat}'. Valid categories: {valid_categories}", raw_data=row))
                    continue

            if not item_name:
                errors.append(CSVImportRowError(row_number=idx, field="item_name", message="item_name is required", raw_data=row))
                continue

            try:
                avail = float(row.get("available_stock", 0.0))
                if avail < 0:
                    raise ValueError()
            except Exception:
                errors.append(CSVImportRowError(row_number=idx, field="available_stock", message="available_stock must be a non-negative number", raw_data=row))
                continue

            try:
                min_st = float(row.get("min_stock", 0.0))
                if min_st < 0:
                    raise ValueError()
            except Exception:
                errors.append(CSVImportRowError(row_number=idx, field="min_stock", message="min_stock must be a non-negative number", raw_data=row))
                continue

            reserved = float(row.get("reserved_stock", 0.0) or 0.0)
            max_cap = float(row.get("max_capacity", 1000.0) or 1000.0)
            replenish = float(row.get("replenishment_qty", 0.0) or 0.0)

            valid_items.append({
                "location_id": loc_id,
                "category": cat,
                "item_name": item_name,
                "unit": unit,
                "available_stock": avail,
                "reserved_stock": reserved,
                "min_stock": min_st,
                "max_capacity": max_cap,
                "replenishment_qty": replenish
            })

        if errors:
            return CSVImportResult(
                dataset_type="INVENTORY",
                total_rows=len(rows),
                imported_rows=0,
                failed_rows=len(errors),
                success=False,
                errors=errors,
                message=f"Validation failed with {len(errors)} error(s). No records were imported."
            )

        # Upsert valid items
        for item_data in valid_items:
            existing = db.query(InventoryItem).filter(
                InventoryItem.location_id == item_data["location_id"],
                InventoryItem.category == item_data["category"],
                InventoryItem.item_name == item_data["item_name"]
            ).first()

            if existing:
                existing.available_stock = item_data["available_stock"]
                existing.reserved_stock = item_data["reserved_stock"]
                existing.min_stock = item_data["min_stock"]
                existing.max_capacity = item_data["max_capacity"]
                existing.replenishment_qty = item_data["replenishment_qty"]
                item_obj = existing
            else:
                item_obj = InventoryItem(**item_data)
                db.add(item_obj)
            
            db.flush()
            inventory_service.sync_alerts_for_item(db, item_obj)
            inventory_service.update_location_status(db, item_data["location_id"])

        db.commit()

        return CSVImportResult(
            dataset_type="INVENTORY",
            total_rows=len(rows),
            imported_rows=len(valid_items),
            failed_rows=0,
            success=True,
            errors=[],
            message=f"Successfully imported {len(valid_items)} inventory records."
        )

import_service = ImportService()
