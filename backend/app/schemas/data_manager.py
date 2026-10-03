from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class CSVImportRowError(BaseModel):
    row_number: int
    field: Optional[str] = None
    message: str
    raw_data: Optional[Dict[str, Any]] = None

class CSVImportResult(BaseModel):
    dataset_type: str
    total_rows: int
    imported_rows: int
    failed_rows: int
    success: bool
    errors: List[CSVImportRowError] = []
    message: str

class DatasetStatusItem(BaseModel):
    name: str
    category: str  # GEOGRAPHIC, LOGISTICS_LEDGER, TERRAIN
    source_type: str  # DOWNLOADED_REAL, SYNTHETIC_DEMO, USER_CSV_IMPORT
    status: str  # VALID, ACTIVE, EMPTY, WARNING, ERROR
    record_count: int
    last_update: Optional[datetime] = None
    file_info: Optional[str] = None
    description: str

class DatasetManagementOverview(BaseModel):
    datasets: List[DatasetStatusItem]
    geographic_mode: str
    logistics_mode: str
