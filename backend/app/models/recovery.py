from typing import Optional

from pydantic import BaseModel, Field


class RecoveryPredictionRequest(BaseModel):
    amount: float = Field(gt=0)
    attempt_count: int = Field(ge=0)
    previous_successful_payments: int = Field(ge=0)
    days_since_last_payment: int = Field(ge=0)
    failure_code: str = Field(min_length=1)

class RecoveryEventRequest(BaseModel):
    event_id: str
    event_type: str = "payment.failed"

    amount: float = Field(gt=0)

    attempt_count: int = Field(default=0, ge=0)

    previous_successful_payments: int = Field(
        default=0,
        ge=0
    )

    days_since_last_payment: int = Field(
        default=0,
        ge=0
    )

    failure_code: Optional[str] = None

    mandate_status: Optional[str] = None


class CustomerRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None