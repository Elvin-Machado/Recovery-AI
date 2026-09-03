from fastapi import APIRouter, Query, Body, HTTPException, status

from app.services.dashboard_service import (
    get_dashboard_metrics,
    get_recent_events,
    get_customers_summary,
    get_subscriptions_summary,
    get_data_health,
    get_orphan_details,
    get_integrity_checks,
    verify_metric_consistency,
    verify_orphan_candidates,
    repair_legacy_statuses,
    cleanup_orphans,
)


router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@router.get("/")
def get_dashboard():
    try:
        return get_dashboard_metrics()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load dashboard metrics: {str(e)}",
        )


@router.get("/events")
def get_events(limit: int = Query(default=100, ge=1, le=1000)):
    try:
        return get_recent_events(limit=limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load recent events: {str(e)}",
        )


@router.get("/customers")
def get_customers(limit: int = Query(default=200, ge=1, le=1000)):
    try:
        return get_customers_summary(limit=limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load customer summary: {str(e)}",
        )


@router.get("/subscriptions")
def get_subscriptions(limit: int = Query(default=200, ge=1, le=1000)):
    try:
        return get_subscriptions_summary(limit=limit)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load subscription summary: {str(e)}",
        )


@router.get("/data-health")
def data_health():
    try:
        return get_data_health()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get data health: {str(e)}",
        )


@router.get("/data-health/orphans")
def data_health_orphans():
    try:
        return get_orphan_details()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get orphan details: {str(e)}",
        )


@router.get("/data-health/integrity")
def data_health_integrity():
    try:
        return get_integrity_checks()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get integrity checks: {str(e)}",
        )


@router.get("/data-health/metric-consistency")
def data_health_metric_consistency():
    try:
        return verify_metric_consistency()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify metric consistency: {str(e)}",
        )


@router.get("/data-health/verify-orphans")
def data_health_verify_orphans(
    ids: list[str] = Query(default=[])
):
    try:
        return verify_orphan_candidates(ids)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify orphan candidates: {str(e)}",
        )


@router.post("/data-health/repair-legacy")
def data_health_repair_legacy(
    ids: list[str] = Body(default=[])
):
    try:
        return repair_legacy_statuses(ids)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to repair legacy statuses: {str(e)}",
        )


@router.post("/data-health/cleanup-orphans")
def data_health_cleanup_orphans(
    ids: list[str] = Body(default=[]),
    confirm: bool = Body(default=False)
):
    try:
        return cleanup_orphans(ids, confirm=confirm)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cleanup orphans: {str(e)}",
        )