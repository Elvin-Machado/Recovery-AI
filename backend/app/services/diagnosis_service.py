from typing import Dict


FAILURE_DIAGNOSIS = {
    "insufficient_funds": "soft_decline",
    "issuer_unavailable": "temporary_failure",
    "expired_card": "payment_method_expired",
    "card_declined": "hard_decline",
    "fraud_flag": "risk_block",
    "mandate_revoked": "mandate_revoked",
}


def diagnose_payment(payment_data: Dict) -> str:
    failure_code = payment_data.get("failure_code")

    return FAILURE_DIAGNOSIS.get(
        failure_code,
        "unknown_failure"
    )