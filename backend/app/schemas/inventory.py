from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class InventoryItemBase(BaseModel):
    location_id: str
    category: str = Field(..., description="FOOD_WATER, FUEL, MEDICAL_SUPPLIES, GENERAL_SUPPLIES")
    item_name: str = Field(..., min_length=1, max_length=255)
    unit: str = Field(default="Units", min_length=1, max_length=32)
    available_stock: float = Field(default=0.0, ge=0.0)
    reserved_stock: float = Field(default=0.0, ge=0.0)
    min_stock: float = Field(default=0.0, ge=0.0)
    max_capacity: float = Field(default=1000.0, gt=0.0)
    replenishment_qty: float = Field(default=0.0, ge=0.0)

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid_cats = {"FOOD_WATER", "FUEL", "MEDICAL_SUPPLIES", "GENERAL_SUPPLIES"}
        norm = v.upper().strip().replace(" ", "_").replace("/", "_")
        if norm not in valid_cats:
            # Map common variations
            mapping = {
                "FOOD": "FOOD_WATER",
                "WATER": "FOOD_WATER",
                "FOOD_AND_WATER": "FOOD_WATER",
                "MEDICAL": "MEDICAL_SUPPLIES",
                "GENERAL": "GENERAL_SUPPLIES"
            }
            if norm in mapping:
                return mapping[norm]
            raise ValueError(f"Category must be one of {valid_cats}")
        return norm

class InventoryItemCreate(InventoryItemBase):
    pass

class InventoryItemUpdate(BaseModel):
    available_stock: Optional[float] = Field(default=None, ge=0.0)
    reserved_stock: Optional[float] = Field(default=None, ge=0.0)
    min_stock: Optional[float] = Field(default=None, ge=0.0)
    max_capacity: Optional[float] = Field(default=None, gt=0.0)
    replenishment_qty: Optional[float] = Field(default=None, ge=0.0)

class InventoryStockAdjustment(BaseModel):
    action: str = Field(..., description="RECEIPT, CONSUMPTION, RESERVE, RELEASE")
    quantity: float = Field(..., gt=0.0)
    reference_code: Optional[str] = None
    notes: Optional[str] = None

class InventoryItemResponse(InventoryItemBase):
    id: int
    last_replenished_at: Optional[datetime] = None
    updated_at: datetime
    location_name: Optional[str] = None
    stock_status: Optional[str] = None  # CRITICAL, AT_RISK, WATCH, STABLE

    model_config = {"from_attributes": True}
