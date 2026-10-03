from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.optimization import TransportResource
from app.models.location import Location
from app.schemas.optimization import TransportResourceCreate, TransportResourceUpdate

class TransportResourceService:

    def list_resources(
        self,
        db: Session,
        status: Optional[str] = None,
        vehicle_type: Optional[str] = None,
        location_id: Optional[str] = None
    ) -> List[TransportResource]:
        query = db.query(TransportResource)
        if status and status != "ALL":
            query = query.filter(TransportResource.status == status)
        if vehicle_type and vehicle_type != "ALL":
            query = query.filter(TransportResource.vehicle_type == vehicle_type)
        if location_id and location_id != "ALL":
            query = query.filter(
                or_(
                    TransportResource.current_location_id == location_id,
                    TransportResource.destination_location_id == location_id
                )
            )
        return query.order_by(TransportResource.id).all()

    def get_resource(self, db: Session, resource_id: str) -> Optional[TransportResource]:
        return db.query(TransportResource).filter(TransportResource.id == resource_id).first()

    def create_resource(self, db: Session, data: TransportResourceCreate) -> TransportResource:
        existing = self.get_resource(db, data.id)
        if existing:
            raise ValueError(f"Transport resource with ID '{data.id}' already exists.")

        loc = db.query(Location).filter(Location.id == data.current_location_id).first()
        if not loc:
            raise ValueError(f"Current location '{data.current_location_id}' does not exist.")

        resource = TransportResource(
            id=data.id,
            name=data.name,
            vehicle_type=data.vehicle_type,
            capacity_weight_kg=data.capacity_weight_kg,
            capacity_volume_m3=data.capacity_volume_m3,
            current_load_kg=0.0,
            fuel_efficiency_km_l=data.fuel_efficiency_km_l,
            speed_empty_kmh=data.speed_empty_kmh,
            speed_loaded_kmh=data.speed_loaded_kmh,
            cost_per_km=data.cost_per_km,
            status=data.status,
            current_location_id=data.current_location_id,
            destination_location_id=data.destination_location_id,
            operational_restrictions=data.operational_restrictions or {},
            maintenance_status=data.maintenance_status,
            available_from=data.available_from,
            available_to=data.available_to,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(resource)
        db.commit()
        db.refresh(resource)
        return resource

    def update_resource(self, db: Session, resource_id: str, data: TransportResourceUpdate) -> TransportResource:
        resource = self.get_resource(db, resource_id)
        if not resource:
            raise ValueError(f"Transport resource '{resource_id}' not found.")

        if data.name is not None:
            resource.name = data.name
        if data.status is not None:
            resource.status = data.status
        if data.current_load_kg is not None:
            if data.current_load_kg > resource.capacity_weight_kg:
                raise ValueError(f"Current load ({data.current_load_kg} kg) exceeds maximum payload capacity ({resource.capacity_weight_kg} kg).")
            resource.current_load_kg = data.current_load_kg
        if data.current_location_id is not None:
            resource.current_location_id = data.current_location_id
        if data.destination_location_id is not None:
            resource.destination_location_id = data.destination_location_id
        if data.maintenance_status is not None:
            resource.maintenance_status = data.maintenance_status
        if data.operational_restrictions is not None:
            resource.operational_restrictions = data.operational_restrictions

        resource.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(resource)
        return resource

    def seed_initial_fleet(self, db: Session) -> int:
        """Seeds realistic transport resource inventory across corridor nodes."""
        count = db.query(TransportResource).count()
        if count > 0:
            return count

        initial_fleet = [
            # Heavy Cargo Transporters
            {
                "id": "TR-HCV-01",
                "name": "Tata Signa 4825.T Heavy Freight Transporter",
                "vehicle_type": "HEAVY_TRUCK",
                "capacity_weight_kg": 14000.0,
                "capacity_volume_m3": 36.0,
                "fuel_efficiency_km_l": 3.2,
                "speed_empty_kmh": 60.0,
                "speed_loaded_kmh": 45.0,
                "cost_per_km": 18.5,
                "status": "AVAILABLE",
                "current_location_id": "LOC-PUN-01",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"max_gradient_pct": 14.0, "mountain_pass_certified": True}
            },
            {
                "id": "TR-HCV-02",
                "name": "Ashok Leyland 4220 Multiaxle Freight Hauler",
                "vehicle_type": "HEAVY_TRUCK",
                "capacity_weight_kg": 13500.0,
                "capacity_volume_m3": 34.0,
                "fuel_efficiency_km_l": 3.4,
                "speed_empty_kmh": 60.0,
                "speed_loaded_kmh": 45.0,
                "cost_per_km": 17.8,
                "status": "AVAILABLE",
                "current_location_id": "LOC-TAL-02",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"max_gradient_pct": 14.0, "mountain_pass_certified": True}
            },
            # Fuel Tankers
            {
                "id": "TR-TNK-01",
                "name": "Heavy Fuel Bowzer (12,000L Petroleum Tanker)",
                "vehicle_type": "FUEL_TANKER",
                "capacity_weight_kg": 10500.0,
                "capacity_volume_m3": 12.0,
                "fuel_efficiency_km_l": 2.9,
                "speed_empty_kmh": 50.0,
                "speed_loaded_kmh": 38.0,
                "cost_per_km": 24.0,
                "status": "AVAILABLE",
                "current_location_id": "LOC-CHA-08",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"hazardous_materials": True, "max_speed_kmh": 50.0, "ghat_night_restricted": True}
            },
            {
                "id": "TR-TNK-02",
                "name": "Tactical Field Fuel Carrier (8,000L Bowzer)",
                "vehicle_type": "FUEL_TANKER",
                "capacity_weight_kg": 7200.0,
                "capacity_volume_m3": 8.0,
                "fuel_efficiency_km_l": 3.6,
                "speed_empty_kmh": 55.0,
                "speed_loaded_kmh": 42.0,
                "cost_per_km": 20.0,
                "status": "AVAILABLE",
                "current_location_id": "LOC-PUN-01",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"hazardous_materials": True, "all_terrain": True}
            },
            # Medium Trucks
            {
                "id": "TR-MCV-01",
                "name": "Eicher Pro 3019 Medium Tactical Carrier",
                "vehicle_type": "MEDIUM_TRUCK",
                "capacity_weight_kg": 7500.0,
                "capacity_volume_m3": 22.0,
                "fuel_efficiency_km_l": 4.5,
                "speed_empty_kmh": 65.0,
                "speed_loaded_kmh": 50.0,
                "cost_per_km": 13.5,
                "status": "AVAILABLE",
                "current_location_id": "LOC-LON-03",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"max_gradient_pct": 18.0}
            },
            {
                "id": "TR-MCV-02",
                "name": "BharatBenz 1617R All-Weather Logistics Truck",
                "vehicle_type": "MEDIUM_TRUCK",
                "capacity_weight_kg": 7000.0,
                "capacity_volume_m3": 20.0,
                "fuel_efficiency_km_l": 4.8,
                "speed_empty_kmh": 65.0,
                "speed_loaded_kmh": 50.0,
                "cost_per_km": 13.0,
                "status": "IN_TRANSIT",
                "current_location_id": "LOC-TAL-02",
                "destination_location_id": "LOC-LON-03",
                "current_load_kg": 4500.0,
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"max_gradient_pct": 18.0}
            },
            # Refrigerated Medical Vans
            {
                "id": "TR-MED-01",
                "name": "Cold-Chain Thermal Medical Van Alpha",
                "vehicle_type": "REFRIGERATED_VAN",
                "capacity_weight_kg": 3800.0,
                "capacity_volume_m3": 14.0,
                "fuel_efficiency_km_l": 6.2,
                "speed_empty_kmh": 75.0,
                "speed_loaded_kmh": 60.0,
                "cost_per_km": 15.0,
                "status": "AVAILABLE",
                "current_location_id": "LOC-PUN-01",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"temperature_controlled": True, "temp_range_c": [-20, 8]}
            },
            {
                "id": "TR-MED-02",
                "name": "Rapid Response Medical Evacuation & Supply Van",
                "vehicle_type": "REFRIGERATED_VAN",
                "capacity_weight_kg": 3200.0,
                "capacity_volume_m3": 12.0,
                "fuel_efficiency_km_l": 6.5,
                "speed_empty_kmh": 80.0,
                "speed_loaded_kmh": 65.0,
                "cost_per_km": 14.5,
                "status": "AVAILABLE",
                "current_location_id": "LOC-KAM-04",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"temperature_controlled": True, "priority_passage": True}
            },
            # Light Tactical All-Terrain Utility Vehicles
            {
                "id": "TR-LUV-01",
                "name": "Mahindra Bolero 4x4 High-Clearance Tactical Utility",
                "vehicle_type": "LIGHT_UTILITY",
                "capacity_weight_kg": 1800.0,
                "capacity_volume_m3": 6.5,
                "fuel_efficiency_km_l": 8.5,
                "speed_empty_kmh": 80.0,
                "speed_loaded_kmh": 65.0,
                "cost_per_km": 8.5,
                "status": "AVAILABLE",
                "current_location_id": "LOC-MUL-05",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"4x4_drive": True, "ghat_unpaved_capable": True}
            },
            {
                "id": "TR-LUV-02",
                "name": "Force Gurkha 4x4 Mountain Corridor Courier",
                "vehicle_type": "LIGHT_UTILITY",
                "capacity_weight_kg": 1600.0,
                "capacity_volume_m3": 6.0,
                "fuel_efficiency_km_l": 8.2,
                "speed_empty_kmh": 80.0,
                "speed_loaded_kmh": 65.0,
                "cost_per_km": 8.8,
                "status": "AVAILABLE",
                "current_location_id": "LOC-PAW-07",
                "maintenance_status": "OPERATIONAL",
                "operational_restrictions": {"4x4_drive": True, "ghat_unpaved_capable": True}
            }
        ]

        for item in initial_fleet:
            res = TransportResource(
                id=item["id"],
                name=item["name"],
                vehicle_type=item["vehicle_type"],
                capacity_weight_kg=item["capacity_weight_kg"],
                capacity_volume_m3=item["capacity_volume_m3"],
                current_load_kg=item.get("current_load_kg", 0.0),
                fuel_efficiency_km_l=item["fuel_efficiency_km_l"],
                speed_empty_kmh=item["speed_empty_kmh"],
                speed_loaded_kmh=item["speed_loaded_kmh"],
                cost_per_km=item["cost_per_km"],
                status=item["status"],
                current_location_id=item["current_location_id"],
                destination_location_id=item.get("destination_location_id"),
                operational_restrictions=item["operational_restrictions"],
                maintenance_status=item["maintenance_status"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(res)

        db.commit()
        return len(initial_fleet)

transport_resource_service = TransportResourceService()
