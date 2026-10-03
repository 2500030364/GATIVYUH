from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.alert import Alert

class InventoryService:
    @staticmethod
    def calculate_stock_status(available: float, min_stock: float) -> str:
        if min_stock <= 0:
            return "STABLE"
        if available <= (min_stock * 0.25):
            return "CRITICAL"
        if available <= min_stock:
            return "AT_RISK"
        if available <= (min_stock * 1.25):
            return "WATCH"
        return "STABLE"

    @classmethod
    def sync_alerts_for_item(cls, db: Session, item: InventoryItem):
        """Creates or updates threshold alerts based on current inventory."""
        status = cls.calculate_stock_status(item.available_stock, item.min_stock)
        
        # Look for existing unacknowledged alert for this location and category
        existing_alert = db.query(Alert).filter(
            Alert.location_id == item.location_id,
            Alert.category == item.category,
            Alert.is_acknowledged == False
        ).first()

        if status in ("CRITICAL", "AT_RISK", "WATCH"):
            reason_map = {
                "CRITICAL": f"Severe deficit: Available {item.item_name} ({item.available_stock} {item.unit}) is below 25% of minimum requirement ({item.min_stock} {item.unit}).",
                "AT_RISK": f"Deficit warning: Available {item.item_name} ({item.available_stock} {item.unit}) has breached minimum safety buffer ({item.min_stock} {item.unit}).",
                "WATCH": f"Buffer advisory: Available {item.item_name} ({item.available_stock} {item.unit}) is nearing minimum threshold ({item.min_stock} {item.unit})."
            }
            if existing_alert:
                existing_alert.severity = status
                existing_alert.current_quantity = item.available_stock
                existing_alert.min_threshold = item.min_stock
                existing_alert.reason = reason_map[status]
            else:
                new_alert = Alert(
                    location_id=item.location_id,
                    category=item.category,
                    item_name=item.item_name,
                    severity=status,
                    current_quantity=item.available_stock,
                    min_threshold=item.min_stock,
                    unit=item.unit,
                    reason=reason_map[status],
                    is_acknowledged=False
                )
                db.add(new_alert)
        else:
            # If stock is now STABLE, clear active unacknowledged alert
            if existing_alert:
                db.delete(existing_alert)

    @classmethod
    def update_location_status(cls, db: Session, location_id: str):
        """Updates overall location status based on worst item status."""
        loc = db.query(Location).filter(Location.id == location_id).first()
        if not loc or not loc.is_active:
            return

        items = db.query(InventoryItem).filter(InventoryItem.location_id == location_id).all()
        if not items:
            loc.status = "STABLE"
            return

        statuses = [cls.calculate_stock_status(it.available_stock, it.min_stock) for it in items]
        if "CRITICAL" in statuses:
            loc.status = "CRITICAL"
        elif "AT_RISK" in statuses:
            loc.status = "AT_RISK"
        elif "WATCH" in statuses:
            loc.status = "WATCH"
        else:
            loc.status = "STABLE"

    @classmethod
    def record_receipt(cls, db: Session, location_id: str, category: str, item_name: str,
                       quantity: float, unit: str, ref_code: Optional[str] = None, notes: Optional[str] = None) -> LogisticsEvent:
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Receipt quantity must be strictly positive.")

        loc = db.query(Location).filter(Location.id == location_id).first()
        if not loc:
            raise HTTPException(status_code=404, detail=f"Location {location_id} not found.")

        item = db.query(InventoryItem).filter(
            InventoryItem.location_id == location_id,
            InventoryItem.category == category,
            InventoryItem.item_name == item_name
        ).first()

        if not item:
            item = InventoryItem(
                location_id=location_id,
                category=category,
                item_name=item_name,
                unit=unit,
                available_stock=quantity,
                reserved_stock=0.0,
                min_stock=max(10.0, quantity * 0.2),
                max_capacity=max(1000.0, quantity * 2.0),
                replenishment_qty=quantity,
                last_replenished_at=datetime.utcnow()
            )
            db.add(item)
        else:
            # Capacity check
            if item.available_stock + item.reserved_stock + quantity > item.max_capacity:
                # Expand capacity or warn
                item.max_capacity = item.available_stock + item.reserved_stock + quantity + 100.0
            item.available_stock += quantity
            item.last_replenished_at = datetime.utcnow()

        event_id = f"EVT-REC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{int(quantity)}"
        event = LogisticsEvent(
            id=event_id,
            event_type="RECEIPT",
            location_id=location_id,
            destination_id=None,
            category=category,
            item_name=item_name,
            quantity=quantity,
            unit=unit,
            status="COMPLETED",
            reference_code=ref_code,
            notes=notes or f"Stock receipt of {quantity} {unit}",
            is_synthetic=loc.is_synthetic
        )
        db.add(event)
        cls.sync_alerts_for_item(db, item)
        cls.update_location_status(db, location_id)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def record_consumption(cls, db: Session, location_id: str, category: str, item_name: str,
                           quantity: float, unit: str, ref_code: Optional[str] = None, notes: Optional[str] = None) -> LogisticsEvent:
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Consumption quantity must be strictly positive.")

        item = db.query(InventoryItem).filter(
            InventoryItem.location_id == location_id,
            InventoryItem.category == category,
            InventoryItem.item_name == item_name
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail=f"No stock record found for {item_name} at location {location_id}.")

        if item.available_stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient available stock: Requested {quantity} {unit}, but only {item.available_stock} {unit} available at {location_id}."
            )

        item.available_stock -= quantity
        event_id = f"EVT-CON-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{int(quantity)}"
        event = LogisticsEvent(
            id=event_id,
            event_type="CONSUMPTION",
            location_id=location_id,
            destination_id=None,
            category=category,
            item_name=item_name,
            quantity=quantity,
            unit=unit,
            status="COMPLETED",
            reference_code=ref_code,
            notes=notes or f"Daily operational consumption of {quantity} {unit}",
            is_synthetic=item.location.is_synthetic if item.location else True
        )
        db.add(event)
        cls.sync_alerts_for_item(db, item)
        cls.update_location_status(db, location_id)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def record_dispatch(cls, db: Session, source_id: str, dest_id: str, category: str, item_name: str,
                        quantity: float, unit: str, ref_code: Optional[str] = None, notes: Optional[str] = None) -> LogisticsEvent:
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Dispatch quantity must be strictly positive.")
        if source_id == dest_id:
            raise HTTPException(status_code=400, detail="Source and destination locations cannot be identical.")

        dest = db.query(Location).filter(Location.id == dest_id).first()
        if not dest:
            raise HTTPException(status_code=404, detail=f"Destination location {dest_id} does not exist.")

        item = db.query(InventoryItem).filter(
            InventoryItem.location_id == source_id,
            InventoryItem.category == category,
            InventoryItem.item_name == item_name
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_name} not found at source {source_id}.")

        if item.available_stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot dispatch: Available stock ({item.available_stock} {unit}) is lower than requested dispatch quantity ({quantity} {unit})."
            )

        # Move from available to reserved stock at source while in-transit
        item.available_stock -= quantity
        item.reserved_stock += quantity

        event_id = f"EVT-DIS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{int(quantity)}"
        event = LogisticsEvent(
            id=event_id,
            event_type="DISPATCH",
            location_id=source_id,
            destination_id=dest_id,
            category=category,
            item_name=item_name,
            quantity=quantity,
            unit=unit,
            status="IN_TRANSIT",
            reference_code=ref_code,
            notes=notes or f"Convoy dispatched from {source_id} to {dest_id}",
            is_synthetic=dest.is_synthetic
        )
        db.add(event)
        cls.sync_alerts_for_item(db, item)
        cls.update_location_status(db, source_id)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def record_delivery(cls, db: Session, event_id: str, notes: Optional[str] = None) -> LogisticsEvent:
        event = db.query(LogisticsEvent).filter(LogisticsEvent.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail=f"Logistics event {event_id} not found.")

        if event.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Event has already been delivered and completed.")

        if not event.destination_id:
            raise HTTPException(status_code=400, detail="Cannot complete delivery: event has no destination.")

        # Source location: release reserved stock
        source_item = db.query(InventoryItem).filter(
            InventoryItem.location_id == event.location_id,
            InventoryItem.category == event.category,
            InventoryItem.item_name == event.item_name
        ).first()
        if source_item:
            source_item.reserved_stock = max(0.0, source_item.reserved_stock - event.quantity)

        # Destination location: add to available stock
        dest_item = db.query(InventoryItem).filter(
            InventoryItem.location_id == event.destination_id,
            InventoryItem.category == event.category,
            InventoryItem.item_name == event.item_name
        ).first()

        if not dest_item:
            dest_item = InventoryItem(
                location_id=event.destination_id,
                category=event.category,
                item_name=event.item_name,
                unit=event.unit,
                available_stock=event.quantity,
                reserved_stock=0.0,
                min_stock=max(10.0, event.quantity * 0.25),
                max_capacity=max(1000.0, event.quantity * 2.0),
                replenishment_qty=event.quantity,
                last_replenished_at=datetime.utcnow()
            )
            db.add(dest_item)
        else:
            dest_item.available_stock += event.quantity
            dest_item.last_replenished_at = datetime.utcnow()

        event.status = "COMPLETED"
        if notes:
            event.notes = f"{event.notes} | Delivered: {notes}"

        if source_item:
            cls.sync_alerts_for_item(db, source_item)
            cls.update_location_status(db, event.location_id)
        if dest_item:
            cls.sync_alerts_for_item(db, dest_item)
            cls.update_location_status(db, event.destination_id)

        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def record_delay(cls, db: Session, event_id: str, delay_reason: str) -> LogisticsEvent:
        event = db.query(LogisticsEvent).filter(LogisticsEvent.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail=f"Logistics event {event_id} not found.")

        if event.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Cannot flag delay on an already completed event.")

        event.status = "DELAYED"
        event.notes = f"{event.notes} [DELAY REPORTED: {delay_reason}]"
        db.commit()
        db.refresh(event)
        return event

inventory_service = InventoryService()
