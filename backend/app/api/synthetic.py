from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.synthetic_service import synthetic_service

router = APIRouter(prefix="/synthetic", tags=["Synthetic Demo Data"])

class SyntheticGenRequest(BaseModel):
    seed: int = Field(default=42, description="Random seed for reproducible demonstration data generation")
    reset_existing: bool = Field(default=True, description="Whether to replace prior synthetic records")

@router.post("/generate")
def generate_synthetic_data(payload: SyntheticGenRequest = SyntheticGenRequest(), db: Session = Depends(get_db)):
    result = synthetic_service.generate_demo_dataset(db, seed=payload.seed, reset_existing=payload.reset_existing)
    return result
