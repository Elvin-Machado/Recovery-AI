from typing import Dict


FAILURE_DIAGNOSIS = {
    "insufficient_funds": "soft_decline",
    "temporary_decline": "soft_decline",
    "issuer_unavailable": "temporary_failure",
    "timeout": "temporary_failure",
    "expired_card": "payment_method_expired",
    "card_expired": "payment_method_expired",
    "account_closed": "hard_decline",
    "card_declined": "hard_decline",
    "hard_decline": "hard_decline",
    "fraud_flag": "risk_block",
    "mandate_revoked": "mandate_revoked",
}


def diagnose_payment(payment_data: Dict) -> str:
    # Handle explicit mandate revocation first
    mandate_status = payment_data.get("mandate_status")
    if mandate_status == "revoked":
        return "mandate_revoked"

    # Handle specific non-failure event types logically
    event_type = payment_data.get("event_type", "")
    if event_type == "checkout.abandoned":
        return "checkout_abandonment"
    if event_type == "b2b.receivable.overdue":
        return "invoice_overdue"
    if event_type == "promise.broken":
        return "promise_broken"

    # Default to standard payment failure mapping
    failure_code = payment_data.get("failure_code")
    return FAILURE_DIAGNOSIS.get(
        failure_code,
        "unknown_failure"
    )