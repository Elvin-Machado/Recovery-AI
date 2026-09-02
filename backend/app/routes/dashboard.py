from fastapi import APIRouter, Query, Body

from app.services.dashboard_service import (
    get_dashboard_metrics,
    get_recent_events,
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
    return get_dashboard_metrics()


@router.get("/events")
def get_events():
    return get_recent_events()


@router.get("/data-health")
def data_health():
    return get_data_health()


@router.get("/data-health/orphans")
def data_health_orphans():
    return get_orphan_details()


@router.get("/data-health/integrity")
def data_health_integrity():
    return get_integrity_checks()


@router.get("/data-health/metric-consistency")
def data_health_metric_consistency():
    return verify_metric_consistency()


@router.get("/data-health/verify-orphans")
def data_health_verify_orphans(
    ids: list[str] = Query(default=[
        "12fc6b89-c3d5-4f32-8d23-d02be52a4943",
        "b9f2e9b1-67e3-47de-95f4-8d460ce4a64b",
    ])
):
    return verify_orphan_candidates(ids)


@router.post("/data-health/repair-legacy")
def data_health_repair_legacy(
    ids: list[str] = Body(default=[
        "7cbb137b-7d2b-41d2-a24d-99148b58079e",
        "13d8d2f7-7b88-401d-a66b-2e9b73e01f02",
    ])
):
    return repair_legacy_statuses(ids)


@router.post("/data-health/cleanup-orphans")
def data_health_cleanup_orphans(
    ids: list[str] = Body(default=[
        "12fc6b89-c3d5-4f32-8d23-d02be52a4943",
        "b9f2e9b1-67e3-47de-95f4-8d460ce4a64b",
    ]),
    confirm: bool = Body(default=False)
):
    return cleanup_orphans(ids, confirm=confirm)