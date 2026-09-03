from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.dashboard import router as dashboard_router
from app.routes.recovery import router as recovery_router
from app.routes.webhooks import router as webhooks_router
from app.routes.simulator import router as simulator_router
from app.routes.promises import router as promises_router
from app.routes.analytics import router as analytics_router

app = FastAPI(
    title="RecoverAI API",
    description="AI-powered revenue recovery platform",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(dashboard_router)
app.include_router(simulator_router)
app.include_router(promises_router)
app.include_router(analytics_router)

@app.get("/")
def root():
    return {
        "message": "RecoverAI API is running"
    }

app.include_router(recovery_router)
app.include_router(webhooks_router)
