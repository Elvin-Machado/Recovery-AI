MAX_RETRY_ATTEMPTS = 3
MAX_CHASERS = 3
MAX_PROMISE_ESCALATION = 3

def check_policy(
    diagnosis: str,
    action: str,
    attempt_count: int,
    payment_data: dict = None
) -> dict:
    if not payment_data:
        payment_data = {}

    current_status = payment_data.get("current_status", "")
    mandate_status = payment_data.get("mandate_status", "")

    # Receivables protections
    if diagnosis == "invoice_overdue":
        if current_status == "PAID":
            return {
                "allowed": False,
                "reason": "Invoice is already paid. Chaser prevented."
            }
        if current_status == "PROMISE_PENDING":
            return {
                "allowed": False,
                "reason": "Customer has an active promise. Normal chaser stopped."
            }
        if attempt_count >= MAX_CHASERS:
            return {
                "allowed": False,
                "reason": "Maximum permitted chasers reached. Escalating or Stopped."
            }

    # Promise-to-Pay protections
    if diagnosis == "promise_broken":
        if current_status == "FULFILLED":
            return {
                "allowed": False,
                "reason": "Promise already fulfilled. No further escalation."
            }
        if attempt_count >= MAX_PROMISE_ESCALATION:
            return {
                "allowed": False,
                "reason": "Maximum promise escalation reached. Stopped."
            }
        return {
            "allowed": True,
            "reason": None
        }

    # Mandate protections (Revoked / Inactive / Cancelled mandates block automatic retries)
    if mandate_status in {"revoked", "inactive", "cancelled"} or diagnosis == "mandate_revoked":
        if action in {"controlled_retry", "charge_customer"}:
            return {
                "allowed": False,
                "reason": f"Mandate status '{mandate_status or 'revoked'}' blocks automatic retry."
            }

    # Hard declines (card expired, account closed, etc.) block automatic retries
    if diagnosis in {"hard_decline", "payment_method_expired"}:
        if action in {"controlled_retry", "charge_customer"}:
            return {
                "allowed": False,
                "reason": f"Hard decline ({diagnosis}) blocks automatic retry."
            }

    # Never retry beyond the configured limit.
    if action == "controlled_retry":
        if attempt_count >= MAX_RETRY_ATTEMPTS:
            return {
                "allowed": False,
                "reason": "Maximum retry attempts reached"
            }

    # Bound checkout reminders to just 1 attempt to prevent spam
    if action == "send_checkout_reminder":
        if attempt_count >= 1:
            return {
                "allowed": False,
                "reason": "Customer already received a checkout reminder"
            }

    return {
        "allowed": True,
        "reason": "Action satisfies current recovery policy"
    }