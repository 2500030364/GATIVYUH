from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base

class DatasetAudit(Base):
    __tablename__ = "dataset_audits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    dataset_name = Column(String(64), nullable=False, unique=True, index=True)
    source_type = Column(String(64), nullable=False)  # DOWNLOADED_REAL, SYNTHETIC_SIMULATION, USER_CSV_IMPORT
    record_count = Column(Integer, default=0)
    file_path = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    status = Column(String(32), default="VALID")  # VALID, WARNING, ERROR, NOT_LOADED
    metadata_json = Column(Text, nullable=True)
    last_validated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
