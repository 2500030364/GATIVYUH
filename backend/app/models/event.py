from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class LogisticsEvent(Base):
    __tablename__ = "logistics_events"

    id = Column(String(64), primary_key=True, index=True)
    event_type = Column(String(32), nullable=False, index=True)  # RECEIPT, CONSUMPTION, DISPATCH, DELIVERY, DELAY
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    destination_id = Column(String(64), ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    status = Column(String(32), nullable=False, default="COMPLETED", index=True)  # COMPLETED, IN_TRANSIT, DELAYED, CANCELLED
    reference_code = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    source_location = relationship("Location", foreign_keys=[location_id], back_populates="outbound_events")
    destination_location = relationship("Location", foreign_keys=[destination_id], back_populates="inbound_events")
