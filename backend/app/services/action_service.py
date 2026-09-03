from typing import Dict


class ActionExecutor:

    def execute(
        self,
        action: str,
        payment_data: dict
    ) -> Dict:

        if action == "controlled_retry":
            return self._controlled_retry(payment_data)

        if action == "payment_method_update":
            return self._payment_method_update(payment_data)

        if action == "reactivation":
            return self._reactivation(payment_data)

        if action == "human_review":
            return self._human_review(payment_data)

        if action == "send_checkout_reminder":
            return self._send_checkout_reminder(payment_data)

        if action in ["send_payment_reminder", "second_payment_reminder", "final_payment_reminder", "escalate_receivable", "follow_up_after_broken_promise"]:
            return self._simulate_b2b_action(action, payment_data)

        return {
            "status": "no_action",
            "action": "no_action",
            "amount_recovered": 0,
            "message": "No recovery action executed"
        }

    def _send_checkout_reminder(
        self,
        payment_data: dict
    ) -> Dict:
        out = payment_data.get("simulated_checkout_outcome", "pending")
        if out == "recovered":
            return {
                "status": "success",
                "action": "send_checkout_reminder",
                "amount_recovered": payment_data.get("amount", 0)
            }
        elif out == "failed":
            return {
                "status": "failed",
                "action": "send_checkout_reminder",
                "amount_recovered": 0
            }
        
        return {
            "status": "pending_customer_action",
            "action": "send_checkout_reminder",
            "amount_recovered": 0
        }

    def _simulate_b2b_action(self, action: str, payment_data: dict) -> Dict:
        out = payment_data.get("simulated_checkout_outcome", "ignored")
        if out == "paid" or out == "recovered":
            return {
                "status": "success",
                "action": action,
                "amount_recovered": payment_data.get("amount", 0)
            }
        elif out == "promise_pending":
            return {
                "status": "pending_customer_action",
                "action": action,
                "amount_recovered": 0
            }
        
        return {
            "status": "failed", # Ignored/unpaid -> failed attempt
            "action": action,
            "amount_recovered": 0
        }

    def _controlled_retry(
        self,
        payment_data: dict
    ) -> Dict:

        amount = payment_data["amount"]

        failure_code = payment_data.get("failure_code")
        mandate_status = payment_data.get("mandate_status")
        attempt_count = payment_data.get("attempt_count", 0)

        simulated_success = (
            failure_code in {"insufficient_funds", "temporary_decline"}
            and mandate_status not in {"revoked", "inactive", "cancelled"}
            and attempt_count < 3
        )

        if simulated_success:
            return {
                "status": "success",
                "action": "controlled_retry",
                "amount_recovered": amount
            }

        return {
            "status": "failed",
            "action": "controlled_retry",
            "amount_recovered": 0
        }

    def _payment_method_update(
        self,
        payment_data: dict
    ) -> Dict:

        return {
            "status": "pending_customer_action",
            "action": "payment_method_update",
            "amount_recovered": 0
        }

    def _reactivation(
        self,
        payment_data: dict
    ) -> Dict:

        return {
            "status": "pending_customer_action",
            "action": "reactivation",
            "amount_recovered": 0
        }

    def _human_review(
        self,
        payment_data: dict
    ) -> Dict:

        return {
            "status": "escalated",
            "action": "human_review",
            "amount_recovered": 0
        }


action_executor = ActionExecutor()