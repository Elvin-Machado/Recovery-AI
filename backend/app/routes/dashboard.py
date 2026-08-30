from fastapi import APIRouter

from app.services.dashboard_service import get_dashboard_metrics


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@router.get("/")
def get_dashboard():
    return get_dashboard_metrics()