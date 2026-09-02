import dotenv
dotenv.load_dotenv('D:/razorpay/Recovery-AI/backend/.env')
from app.services.ml_service import recovery_ml_service
print(recovery_ml_service.predict_recovery({
    "amount": 1000.0,
    "attempt_count": 0,
    "previous_successful_payments": 0,
    "days_since_last_payment": 0,
    "failure_code": None
}))