from fastapi import APIRouter, HTTPException, status

from app.services.analytics_service import (
    compute_summary,
    compute_category_breakdown,
    get_model_benchmark,
)
from app.services.batch_service import run_batch

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"],
)


@router.get("/summary")
def get_summary():
    try:
        return compute_summary()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analytics computation failed: {str(e)}",
        )


@router.get("/categories")
def get_categories():
    try:
        return compute_category_breakdown()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Category breakdown failed: {str(e)}",
        )


@router.get("/model-benchmark")
def get_benchmark():
    return get_model_benchmark()


@router.post("/batch")
def execute_batch():
    try:
        return run_batch()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch execution failed: {str(e)}",
        )
