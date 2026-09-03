import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Request, HTTPException, Header, status

from app.config import RAZORPAY_WEBHOOK_SECRET
from app.services.recovery_workflow import process_recovery_event

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/webhooks",
    tags=["Webhooks"]
)

@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None),
    x_razorpay_event_id: str = Header(None)
):
    if not RAZORPAY_WEBHOOK_SECRET:
        logger.error("RAZORPAY_WEBHOOK_SECRET is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured"
        )

    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing signature"
        )

    body = await request.body()
    
    # Verify signature
    expected_signature = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, x_razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )
    
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )

    # Event ID can come from header or payload
    event_id = x_razorpay_event_id or payload.get("event_id") or payload.get("id")
    if not event_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing event ID"
        )

    event_type = payload.get("event")
    
    # We only care about failure events for recovery
    supported_events = [
        "payment.failed",
        "subscription.charged.failed",
    ]
    if event_type not in supported_events:
        return {"status": "ignored", "reason": "unsupported_event"}
        
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    if not payment_entity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed payment data"
        )

    customer_entity = payload.get("payload", {}).get("customer", {}).get("entity")
    
    customer_name = "Unknown"
    customer_email = payment_entity.get("email")
    customer_phone = payment_entity.get("contact")
    
    if customer_entity:
        customer_name = customer_entity.get("name", "Unknown")
        if not customer_email:
            customer_email = customer_entity.get("email")
        if not customer_phone:
            customer_phone = customer_entity.get("contact")
            
    # Normalize amount: assuming smallest currency unit from Razorpay
    amount = payment_entity.get("amount", 0) / 100.0
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid amount"
        )

    normalized_event = {
        "event_id": str(event_id),
        "event_type": event_type,
        "amount": float(amount),
        "failure_code": payment_entity.get("error_code") or payment_entity.get("error_reason"),
        "attempt_count": 0,
        "previous_successful_payments": 0,
        "days_since_last_payment": 0,
        "mandate_status": None
    }
    
    customer_info = {
        "name": customer_name,
        "email": customer_email,
        "phone": customer_phone
    }
    
    try:
        result = process_recovery_event(normalized_event, customer_info)
        
        if result.get("duplicate"):
            return {"status": "duplicate", "recovery_status": result["revenue_event"]["status"]}
            
        return {"status": "processed", "recovery_status": result["revenue_event"]["status"]}
    except Exception as e:
        logger.error(f"Internal recovery failure: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal recovery failure"
        )
