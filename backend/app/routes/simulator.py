from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional

from app.services.recovery_workflow import process_recovery_event

router = APIRouter(
    prefix="/api/simulator",
    tags=["Simulator"]
)


class SimulatorTransactionRequest(BaseModel):
    transaction_id: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = None
    amount: float = Field(gt=0, description="Transaction amount")
    payment_method: str = Field(min_length=1)
    outcome: str = Field(pattern="^(success|failed)$")
    failure_code: Optional[str] = None
    attempt_count: int = Field(default=0, ge=0)
    mandate_status: Optional[str] = None
    previous_successful_payments: int = Field(default=5, ge=0)
    days_since_last_payment: int = Field(default=15, ge=0)


class SimulatorCheckoutRequest(BaseModel):
    checkout_id: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = None
    amount: float = Field(gt=0, description="Transaction amount")
    payment_method: str = Field(min_length=1)
    outcome: str = Field(pattern="^(success|abandoned|pending)$")
    attempt_count: int = Field(default=0, ge=0)
    customer_return_behavior: Optional[str] = Field(default="pending", pattern="^(recovered|failed|pending)$")


class SimulatorSubscriptionRequest(BaseModel):
    subscription_id: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = None
    amount: float = Field(gt=0, description="Transaction amount")
    payment_method: str = Field(min_length=1)
    outcome: str = Field(pattern="^(success|failed|halted)$")
    failure_code: Optional[str] = None
    attempt_count: int = Field(default=0, ge=0)
    mandate_status: Optional[str] = None
    previous_successful_payments: int = Field(default=5, ge=0)
    days_since_last_payment: int = Field(default=30, ge=0)
    simulated_customer_action: str = Field(default="ignored", pattern="^(recovered|failed|ignored|pending)$")


class SimulatorReceivableRequest(BaseModel):
    invoice_id: str = Field(min_length=1)
    customer_name: str = Field(min_length=1)
    customer_email: Optional[str] = None
    amount: float = Field(gt=0, description="Invoice amount")
    days_overdue: int = Field(default=0, ge=0)
    current_status: str = Field(pattern="^(ISSUED|DUE|OVERDUE|AT_RISK|CHASE_ELIGIBLE|CHASED|PROMISE_PENDING|PAID|ESCALATED|STOPPED)$")
    attempt_count: int = Field(default=0, ge=0)
    simulated_customer_action: str = Field(default="ignored", pattern="^(recovered|failed|ignored|promise_pending|paid)$")


@router.post("/checkout")
def simulate_checkout(req: SimulatorCheckoutRequest):
    if req.outcome == "success" or req.outcome == "pending":
        return {
            "status": req.outcome,
            "message": f"Checkout {req.outcome}.",
            "event_id": req.checkout_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": None
        }

    event_payload = {
        "event_id": req.checkout_id,
        "event_type": "checkout.abandoned",
        "amount": float(req.amount),
        "attempt_count": req.attempt_count,
        "previous_successful_payments": 0,
        "days_since_last_payment": 0,
        "failure_code": None,
        "mandate_status": None,
        "simulated_checkout_outcome": req.customer_return_behavior
    }

    customer_payload = {
        "name": req.customer_name,
        "email": req.customer_email,
        "phone": None
    }

    try:
        recovery_result = process_recovery_event(event_payload, customer_payload)

        return {
            "status": "abandoned",
            "message": "Checkout abandoned. Triggered RecoverAI analysis.",
            "event_id": req.checkout_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": recovery_result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Recovery Process Error: {str(e)}"
        )


@router.post("/transaction")
def simulate_transaction(req: SimulatorTransactionRequest):
    if req.outcome == "failed" and not req.failure_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="failure_code is required when outcome is 'failed'"
        )

    event_id = req.transaction_id

    if req.outcome == "success":
        return {
            "status": "success",
            "message": "Simulated payment successful. No recovery intervention required.",
            "event_id": event_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": None
        }

    event_payload = {
        "event_id": event_id,
        "event_type": "payment.failed",
        "amount": float(req.amount),
        "attempt_count": req.attempt_count,
        "previous_successful_payments": req.previous_successful_payments,
        "days_since_last_payment": req.days_since_last_payment,
        "failure_code": req.failure_code,
        "mandate_status": req.mandate_status
    }

    customer_payload = {
        "name": req.customer_name,
        "email": req.customer_email,
        "phone": None
    }

    try:
        recovery_result = process_recovery_event(event_payload, customer_payload)

        return {
            "status": "failed",
            "message": "Payment failed. Triggered RecoverAI analysis.",
            "event_id": event_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": recovery_result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Recovery Process Error: {str(e)}"
        )


@router.post("/subscription")
def simulate_subscription(req: SimulatorSubscriptionRequest):
    if req.outcome == "success":
        return {
            "status": req.outcome,
            "message": "Subscription charge successful.",
            "event_id": f"{req.subscription_id}_att_{req.attempt_count}",
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": None
        }

    if req.outcome == "halted":
        return {
            "status": "halted",
            "message": "Subscription sequence explicitly halted.",
            "event_id": f"{req.subscription_id}_att_{req.attempt_count}",
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": None
        }

    attempt_event_id = f"{req.subscription_id}_att_{req.attempt_count}"

    event_payload = {
        "event_id": attempt_event_id,
        "event_type": "subscription.charged.failed",
        "amount": float(req.amount),
        "attempt_count": req.attempt_count,
        "previous_successful_payments": req.previous_successful_payments,
        "days_since_last_payment": req.days_since_last_payment,
        "failure_code": req.failure_code,
        "mandate_status": req.mandate_status,
        "simulated_checkout_outcome": req.simulated_customer_action
    }

    customer_payload = {
        "name": req.customer_name,
        "email": req.customer_email,
        "phone": None
    }

    try:
        recovery_result = process_recovery_event(event_payload, customer_payload)

        return {
            "status": "failed",
            "message": "Subscription charge failed. Triggered RecoverAI analysis.",
            "event_id": attempt_event_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": recovery_result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Recovery Process Error: {str(e)}"
        )


@router.post("/receivable")
def simulate_receivable(req: SimulatorReceivableRequest):
    if req.current_status == "PAID":
        return {
            "status": req.current_status,
            "message": "Simulated Invoice Paid. Stop continuous actions.",
            "event_id": req.invoice_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": None
        }

    attempt_event_id = f"{req.invoice_id}_chase_{req.attempt_count}"

    event_payload = {
        "event_id": attempt_event_id,
        "event_type": "b2b.receivable.overdue",
        "amount": float(req.amount),
        "attempt_count": req.attempt_count,
        "days_overdue": req.days_overdue,
        "failure_code": None,
        "mandate_status": None,
        "simulated_checkout_outcome": req.simulated_customer_action,
        "current_status": req.current_status
    }

    customer_payload = {
        "name": req.customer_name,
        "email": req.customer_email,
        "phone": None
    }

    try:
        recovery_result = process_recovery_event(event_payload, customer_payload)
        return {
            "status": "failed",
            "message": "B2B Receivable Action simulated natively.",
            "event_id": attempt_event_id,
            "amount": req.amount,
            "customer": req.customer_name,
            "environment": "SIMULATED",
            "recovery_analysis": recovery_result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Recovery Process Error: {str(e)}"
        )
