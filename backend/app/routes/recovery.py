from fastapi import APIRouter, HTTPException, status

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
    try:
        return recovery_ml_service.predict_recovery(
            request.model_dump()
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}",
        )


@router.post("/process")
def process_recovery(
    event: RecoveryEventRequest,
    customer: CustomerRequest,
):
    try:
        result = process_recovery_event(
            event.model_dump(),
            customer.model_dump(),
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recovery process failed: {str(e)}",
        )