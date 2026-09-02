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

        return {
            "status": "no_action",
            "action": "no_action",
            "amount_recovered": 0,
            "message": "No recovery action executed"
        }

    def _controlled_retry(
        self,
        payment_data: dict
    ) -> Dict:

        amount = payment_data["amount"]

        # Test-mode simulation.
        # We will replace this with the actual
        # Razorpay test-mode integration later.

        simulated_success = (
            payment_data["failure_code"]
            == "insufficient_funds"
            and payment_data["attempt_count"] < 3
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