from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)  # FOOD_WATER, FUEL, MEDICAL_SUPPLIES, GENERAL_SUPPLIES
    item_name = Column(String(255), nullable=False)
    unit = Column(String(32), nullable=False)  # Liters, Rations, Kits, Tons, Units
    available_stock = Column(Float, nullable=False, default=0.0)
    reserved_stock = Column(Float, nullable=False, default=0.0)
    min_stock = Column(Float, nullable=False, default=0.0)
    max_capacity = Column(Float, nullable=False, default=1000.0)
    replenishment_qty = Column(Float, nullable=False, default=0.0)
    last_replenished_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('location_id', 'category', 'item_name', name='uq_location_item'),
    )

    location = relationship("Location", back_populates="inventory_items")
