def recommend_action(
    diagnosis: str,
    recovery_probability: float,
    payment_data: dict = None
) -> str:

    if not payment_data:
        payment_data = {}

    if diagnosis == "invoice_overdue":
        attempt = payment_data.get("attempt_count", 0)
        if attempt == 1:
            return "send_payment_reminder"
        elif attempt == 2:
            return "second_payment_reminder"
        elif attempt == 3:
            return "final_payment_reminder"
        else:
            return "escalate_receivable"

    if diagnosis == "promise_broken":
        return "follow_up_after_broken_promise"

    if diagnosis == "checkout_abandonment":
        return "send_checkout_reminder"

    if diagnosis == "mandate_revoked" or payment_data.get("mandate_status") == "revoked":
        return "reactivation"

    if payment_data.get("mandate_status") in {"inactive", "cancelled"}:
        return "payment_method_update"

    if diagnosis == "soft_decline":
        if recovery_probability >= 0.30:
            return "controlled_retry"

        return "payment_method_update"

    if diagnosis == "payment_method_expired":
        return "payment_method_update"

    if diagnosis == "temporary_failure":
        if recovery_probability >= 0.30:
            return "controlled_retry"

        return "payment_method_update"

    if diagnosis == "hard_decline":
        return "payment_method_update"

    if diagnosis == "risk_block":
        return "human_review"

    return "no_action"