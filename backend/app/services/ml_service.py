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