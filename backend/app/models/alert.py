from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=True)
    severity = Column(String(32), nullable=False, default="WATCH", index=True)  # WATCH, AT_RISK, CRITICAL
    current_quantity = Column(Float, nullable=False)
    min_threshold = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    reason = Column(Text, nullable=False)
    is_acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    location = relationship("Location", back_populates="alerts")
