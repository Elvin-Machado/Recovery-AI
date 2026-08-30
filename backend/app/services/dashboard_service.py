from app.database import supabase


def get_dashboard_metrics():
    revenue_response = (
        supabase
        .table("revenue_events")
        .select("amount, status")
        .execute()
    )

    revenue_events = revenue_response.data or []

    revenue_at_risk = sum(
        float(event["amount"])
        for event in revenue_events
        if event["status"] != "recovered"
    )

    opportunities = sum(
        1
        for event in revenue_events
        if event["status"] != "recovered"
    )

    return {
        "revenue_at_risk": revenue_at_risk,
        "recovered": 0,
        "opportunities": opportunities,
        "blocked_actions": 0,
    }