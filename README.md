# RecoverAI - Revenue Intelligence & Recovery Platform

RecoverAI is an AI-powered revenue recovery platform designed for subscription and payment failure workflows. It processes payment signals (including Razorpay webhooks and manual simulators), diagnoses failure root causes using probabilistic ML models, evaluates policy boundaries, and automates retry and promise-to-pay recovery workflows.

---

## 🏗 System Architecture

- **Backend**: FastAPI (Python 3.12)
  - Modular structure (`routes/`, `services/`, `agents/`, `policies/`, `models/`)
  - Webhook processing with HMAC signature verification & idempotency control
  - ML-driven failure prediction & automated recovery recommendation workflow
- **Frontend**: React 19 + Vite (Tailwind CSS, Lucide icons)
  - Dashboard, Transactions, Recovery Queue, Customers, Subscriptions, Receivables, Promises-to-Pay, Payment Simulator, Analytics
- **Database**: Supabase (PostgreSQL)
  - Schemas for revenue events, diagnoses, decisions, actions, promises, recovery results, and audit logs
- **Machine Learning**: `scikit-learn` RandomForest Classifier (`backend/models/recovery_model.joblib`)

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agents/       # AI Recovery Agent logic
│   │   ├── models/       # Pydantic data schemas
│   │   ├── policies/     # Business rule enforcement
│   │   ├── routes/       # FastAPI API endpoints
│   │   └── services/     # Core domain services & ML orchestration
│   ├── models/           # Pre-trained joblib ML model
│   └── requirements.txt  # Python backend dependencies
├── frontend/             # React + Vite application
├── supabase/
│   └── migrations/       # SQL database schema migrations
├── train_improved_model.py # ML training script (dataset & model generator)
└── README.md
```

---

## ⚡ Quick Start

### 1. Database Setup (Supabase)
Apply all SQL files from `supabase/migrations/` in order to your Supabase PostgreSQL database:
1. `001_initial_schema.sql`
2. `002_recovery_signals.sql`
3. `003_promises_schema.sql`

---

### 2. Backend Setup
```bash
cd backend

# Configure environment variables (.env)
# Create backend/.env containing:
# SUPABASE_URL=<your-supabase-url>
# SUPABASE_SECRET_KEY=<your-supabase-service-role-key>
# RAZORPAY_KEY_ID=<your-razorpay-key-id>
# RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
# RAZORPAY_WEBHOOK_SECRET=<your-razorpay-webhook-secret>

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --port 8000
```
API endpoints will be live at `http://127.0.0.1:8000`.

---

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Frontend will be live at `http://localhost:5173`.

---

## 🚀 Razorpay Test Mode Integration

1. Start local backend server on port 8000.
2. Expose the server via ngrok:
   ```bash
   ngrok http 8000
   ```
3. In Razorpay Dashboard (Test Mode):
   - Go to **Account & Settings → Webhooks**.
   - Add webhook URL: `https://<ngrok-url>/api/webhooks/razorpay`
   - Set secret matching `RAZORPAY_WEBHOOK_SECRET`.
   - Enable event: `payment.failed`.
4. Failed payments received via webhook trigger the automated HMAC signature verification, idempotency check, ML diagnosis, policy evaluation, and recovery workflow execution.

---

## 🤖 Machine Learning Model Training

To retrain the Random Forest recovery model:
```bash
python train_improved_model.py
```
This generates an updated `backend/models/recovery_model.joblib` binary used directly by `ml_service`.

