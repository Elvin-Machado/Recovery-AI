from datetime import date, datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional

from app.services.promise_service import (
    promise_service,
    MAX_PROMISE_ESCALATION,
)
from app.services.persistence_service import persistence_service

router = APIRouter(
    prefix="/api/promises",
    tags=["Promises"]
)


def _audit(promise_ref, action, status_, details=None):
    """
    Promise events are audited through the existing audit_logs table.
    The promise_ref is used as a stable event identifier for traceability.
    """
    try:
        persistence_service.create_audit_log(
            revenue_event_id=promise_ref,
            action=action,
            actor_type="promise_tracker",
            details=details or {},
        )
    except Exception:
        pass


class CreatePromiseRequest(BaseModel):
    promise_ref: str = Field(min_length=1)
    invoice_ref: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = None
    promised_amount: float = Field(gt=0)
    promise_date: str  # ISO date string YYYY-MM-DD


class PromisePaymentRequest(BaseModel):
    promise_ref: str = Field(min_length=1)
    payment_amount: float = Field(gt=0)


class PromiseActionRequest(BaseModel):
    promise_ref: str = Field(min_length=1)
    payment_amount: Optional[float] = None


@router.post("/create")
def create_promise(req: CreatePromiseRequest):
    try:
        date.fromisoformat(req.promise_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid promise_date. Use YYYY-MM-DD."
        )

    try:
        promise = promise_service.create(
            req.promise_ref,
            req.invoice_ref,
            req.customer_name,
            req.customer_email,
            req.promised_amount,
            req.promise_date,
        )
        _audit(
            req.promise_ref,
            "promise_created",
            "success",
            {
                "invoice_ref": req.invoice_ref,
                "promised_amount": req.promised_amount,
                "promise_date": req.promise_date,
                "created_at": datetime.now().isoformat(),
            },
        )
        return promise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/payment")
def record_payment(req: PromisePaymentRequest):
    try:
        promise = promise_service.record_payment(
            req.promise_ref, req.payment_amount
        )
        _audit(
            req.promise_ref,
            "promise_payment",
            promise["status"],
            {
                "payment_amount": req.payment_amount,
                "paid": promise.get("amount_paid", 0),
                "remaining": float(promise["promised_amount"]) - float(promise.get("amount_paid", 0)),
                "new_status": promise["status"],
            },
        )
        return promise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/break")
def break_promise(req: PromiseActionRequest):
    try:
        promise = promise_service.mark_broken(req.promise_ref)
        _audit(
            req.promise_ref,
            "promise_broken",
            "BROKEN",
            {
                "promise_date": promise.get("promise_date"),
                "paid": promise.get("amount_paid", 0),
                "remaining": float(promise["promised_amount"]) - float(promise.get("amount_paid", 0)),
                "stop_reason": "Promise date reached with required payment not received",
            },
        )
        return promise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/escalate")
def escalate_promise(req: PromiseActionRequest):
    try:
        promise = promise_service.escalate(req.promise_ref)
        stage = int(promise.get("escalation_stage", 0))
        _audit(
            req.promise_ref,
            "promise_escalation",
            promise["status"],
            {
                "escalation_stage": stage,
                "stop_reason": "Maximum promise escalation reached. Stopped."
                if stage >= MAX_PROMISE_ESCALATION
                else None,
            },
        )
        return promise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/cancel")
def cancel_promise(req: PromiseActionRequest):
    try:
        promise = promise_service.mark_cancelled(req.promise_ref)
        _audit(req.promise_ref, "promise_cancelled", "CANCELLED", {})
        return promise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{promise_ref}")
@router.post("/delete")
def delete_promise(promise_ref: Optional[str] = None, req: Optional[PromiseActionRequest] = None):
    ref = req.promise_ref if (req and req.promise_ref) else promise_ref
    if not ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="promise_ref is required",
        )
    try:
        deleted_promise = promise_service.delete(ref)
        _audit(
            ref,
            "promise_deleted",
            "DELETED",
            {
                "deleted_at": datetime.now().isoformat(),
                "status_at_deletion": deleted_promise.get("status"),
                "promised_amount": deleted_promise.get("promised_amount"),
                "amount_paid": deleted_promise.get("amount_paid"),
            },
        )
        return {
            "status": "success",
            "message": f"Promise {ref} deleted successfully",
            "promise": deleted_promise,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/list")
def list_promises():
    return promise_service.get_all()


@router.get("/active")
def list_active():
    return promise_service.get_active()


@router.get("/by-invoice/{invoice_ref}")
def get_by_invoice(invoice_ref: str):
    promise = promise_service.get_by_invoice(invoice_ref)
    return promise or {}