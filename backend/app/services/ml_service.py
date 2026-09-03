from pathlib import Path

import joblib
import pandas as pd


MODEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "models"
    / "recovery_model.joblib"
)


class RecoveryMLService:
    def __init__(self):
        self.model = joblib.load(MODEL_PATH)

    def predict_recovery(self, payment_data: dict) -> dict:
        input_df = pd.DataFrame([payment_data])
        
        # Intercept unsupported event types
        event_type = payment_data.get("event_type")
        if event_type in ["checkout.abandoned", "b2b.receivable.overdue", "promise.broken"]:
            return {
                "recovery_probability": None,
                "predicted_recoverable": None,
                "prediction_unavailable": True
            }
        
        # Handle None explicitly as pandas/sklearn expect it
        input_df['failure_code'] = input_df['failure_code'].fillna('missing')
        if 'mandate_status' in input_df:
            input_df['mandate_status'] = input_df['mandate_status'].fillna('missing')
        else:
            input_df['mandate_status'] = 'missing'

        probability = self.model.predict_proba(
            input_df
        )[0][1]

        prediction = int(probability >= 0.30)

        return {
            "recovery_probability": round(
                float(probability), 4
            ),
            "predicted_recoverable": prediction
        }


recovery_ml_service = RecoveryMLService()