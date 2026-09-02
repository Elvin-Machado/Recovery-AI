from fastapi import APIRouter

from app.models.recovery import RecoveryPredictionRequest
from app.services.ml_service import recovery_ml_service
from app.models.recovery import (
    RecoveryEventRequest,
    CustomerRequest,
)

from app.services.recovery_workflow import (
    process_recovery_event,
)

router = APIRouter(
    prefix="/api/recovery",
    tags=["Recovery"]
)


@router.post("/predict")
def predict_recovery(
    request: RecoveryPredictionRequest
):
    return recovery_ml_service.predict_recovery(
        request.model_dump()
    )

@router.post("/process")
def process_recovery(
    event: RecoveryEventRequest,
    customer: CustomerRequest,
):
    result = process_recovery_event(
        event.model_dump(),
        customer.model_dump(),
    )

    return result