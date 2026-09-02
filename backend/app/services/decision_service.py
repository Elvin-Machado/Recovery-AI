def recommend_action(
    diagnosis: str,
    recovery_probability: float
) -> str:

    if diagnosis == "mandate_revoked":
        return "reactivation"

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