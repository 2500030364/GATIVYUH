from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Location(Base):
    __tablename__ = "locations"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    location_type = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="STABLE", index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation_m = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="location", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="location", cascade="all, delete-orphan")
    outbound_events = relationship("LogisticsEvent", foreign_keys="LogisticsEvent.location_id", back_populates="source_location")
    inbound_events = relationship("LogisticsEvent", foreign_keys="LogisticsEvent.destination_id", back_populates="destination_location")
