MAX_RETRY_ATTEMPTS = 3


def check_policy(
    diagnosis: str,
    action: str,
    attempt_count: int
) -> dict:

    # Explicit mandate revocation always blocks automatic charging.
    if diagnosis == "mandate_revoked":
        if action in {
            "controlled_retry",
            "charge_customer"
        }:
            return {
                "allowed": False,
                "reason": "Mandate was explicitly revoked"
            }

    # Never retry beyond the configured limit.
    if action == "controlled_retry":
        if attempt_count >= MAX_RETRY_ATTEMPTS:
            return {
                "allowed": False,
                "reason": "Maximum retry attempts reached"
            }

    return {
        "allowed": True,
        "reason": "Action satisfies current recovery policy"
    }