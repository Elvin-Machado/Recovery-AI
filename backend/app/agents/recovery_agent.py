from app.services.diagnosis_service import diagnose_payment
from app.services.decision_service import recommend_action
from app.services.ml_service import recovery_ml_service
from app.services.action_service import action_executor
from app.policies.recovery_policy import check_policy


class RecoveryAgent:

    def process(self, payment_data: dict) -> dict:

        # 1. Diagnose the revenue-loss event
        diagnosis = diagnose_payment(payment_data)

        # 2. Get ML recovery probability
        ml_result = recovery_ml_service.predict_recovery(
            payment_data
        )

        recovery_probability = ml_result[
            "recovery_probability"
        ]

        # 3. Determine recommended intervention
        recommended_action = recommend_action(
            diagnosis,
            recovery_probability,
            payment_data
        )

        # 4. Check whether the action is allowed
        policy_result = check_policy(
            diagnosis,
            recommended_action,
            payment_data["attempt_count"],
            payment_data
        )

        # 5. Execute ONLY if policy allows it
        if policy_result["allowed"]:

            action_result = action_executor.execute(
                recommended_action,
                payment_data
            )

        else:

            action_status = "blocked"
            if payment_data.get("current_status") == "PROMISE_PENDING":
                action_status = "pending_customer_action"

            action_result = {
                "status": action_status,
                "action": recommended_action,
                "amount_recovered": 0
            }

        return {
            "diagnosis": diagnosis,
            "recovery_probability": recovery_probability,
            "predicted_recoverable": ml_result[
                "predicted_recoverable"
            ],
            "recommended_action": recommended_action,
            "policy": policy_result,
            "action": action_result
        }


recovery_agent = RecoveryAgent()