import httpx
import sys
import time
import uuid
import subprocess

BACKEND_URL = "http://127.0.0.1:8001"

def wait_for_server():
    for _ in range(30):
        try:
            res = httpx.get(f"{BACKEND_URL}/api/dashboard/")
            if res.status_code == 200:
                print("Server is up!")
                return True
        except httpx.ConnectError:
            pass
        time.sleep(1)
    return False

def check_scenario(name, condition, error_msg):
    if condition:
        print(f"PASS: {name}")
    else:
        print(f"FAIL: {name} - {error_msg}")
        raise AssertionError(f"{name} failed")

def run_tests():
    print("Fetching pre-test dashboard metrics...")
    dash_pre = httpx.get(f"{BACKEND_URL}/api/dashboard/").json()
    
    # -------------------------------------------------------------
    # SCENARIO A: Successful recovery
    # -------------------------------------------------------------
    print("\n--- SCENARIO A ---")
    event_a_id = f"evt_{uuid.uuid4().hex[:8]}"
    email_a = f"customer_{uuid.uuid4().hex[:8]}@example.com"
    req_a = {
        "event": {
            "event_id": event_a_id,
            "amount": 1000.0,
            "attempt_count": 0,
            "previous_successful_payments": 5,
            "days_since_last_payment": 30,
            "failure_code": "insufficient_funds" 
        },
        "customer": {
            "name": "Alice A",
            "email": email_a
        }
    }
    res_a = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_a)
    data_a = res_a.json()
    
    check_scenario("A - 200 OK", res_a.status_code == 200, res_a.text)
    check_scenario("A - No Duplicate", not data_a.get("duplicate", False), "Was duplicate")
    check_scenario("A - Revenue status", data_a["revenue_event"]["status"] == "recovered", f"Status: {data_a['revenue_event']['status']}")
    check_scenario("A - Audit log created", data_a["audit_log"] is not None, "No audit log")
    check_scenario("A - Recovery Result success", data_a["recovery_result"]["success"] == True, data_a.get("recovery_result"))
    check_scenario("A - Action status", data_a["action"]["status"] == "success", data_a["action"]["status"])

    # -------------------------------------------------------------
    # SCENARIO B: Duplicate processing
    # -------------------------------------------------------------
    print("\n--- SCENARIO B ---")
    res_b = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_a)
    data_b = res_b.json()
    
    check_scenario("B - 200 OK", res_b.status_code == 200, res_b.text)
    check_scenario("B - Is Duplicate", data_b.get("duplicate", False) == True, "Not flagged as duplicate")
    check_scenario("B - Same Action ID", data_b["action"]["id"] == data_a["action"]["id"], "Different action ID")
    
    # -------------------------------------------------------------
    # SCENARIO C: Blocked action
    # -------------------------------------------------------------
    print("\n--- SCENARIO C ---")
    event_c_id = f"evt_{uuid.uuid4().hex[:8]}"
    email_c = email_a
    req_c = {
        "event": {
            "event_id": event_c_id,
            "amount": 2000.0,
            "attempt_count": 3,
            "previous_successful_payments": 5,
            "days_since_last_payment": 30,
            "failure_code": "insufficient_funds"
        },
        "customer": {
            "name": "Alice A",
            "email": email_c
        }
    }
    res_c = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_c)
    data_c = res_c.json()
    check_scenario("C - 200 OK", res_c.status_code == 200, res_c.text)
    check_scenario("C - Decision rejected", data_c["decision"]["status"] == "blocked", data_c["decision"]["status"])
    check_scenario("C - Action blocked", data_c["action"]["status"] == "blocked", data_c["action"]["status"])
    check_scenario("C - Revenue status blocked", data_c["revenue_event"]["status"] == "blocked", data_c["revenue_event"]["status"])

    # Wait for dashboard to update
    dash_post = httpx.get(f"{BACKEND_URL}/api/dashboard/").json()
    
    recovered_diff = dash_post["recovered"] - dash_pre["recovered"]
    check_scenario("A - Dashboard recovered amount increased", recovered_diff == 1000.0, f"Diff was {recovered_diff}")
    
    risk_diff = dash_post["revenue_at_risk"] - dash_pre["revenue_at_risk"]
    check_scenario("C - Dashboard risk amount increased", risk_diff == 2000.0, f"Risk diff was {risk_diff}")
    
    blocked_diff = dash_post["blocked_actions"] - dash_pre["blocked_actions"]
    check_scenario("C - Dashboard blocked increased", blocked_diff == 1, "Blocked didn't increase")
    
    # -------------------------------------------------------------
    # SCENARIO D: Pending customer action
    # -------------------------------------------------------------
    print("\n--- SCENARIO D ---")
    event_d_id = f"evt_{uuid.uuid4().hex[:8]}"
    req_d = {
        "event": {
            "event_id": event_d_id,
            "amount": 500.0,
            "attempt_count": 0,
            "failure_code": "expired_card"
        },
        "customer": {
            "name": "Bob B",
            "email": "bob@example.com"
        }
    }
    res_d = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_d).json()
    check_scenario("D - Status pending", res_d["revenue_event"]["status"] == "pending_customer_action", res_d["revenue_event"]["status"])

    # -------------------------------------------------------------
    # SCENARIO E: Failed / no_action (null failure code)
    # -------------------------------------------------------------
    print("\n--- SCENARIO E ---")
    event_e_id = f"evt_{uuid.uuid4().hex[:8]}"
    req_e = {
        "event": {
            "event_id": event_e_id,
            "amount": 750.0,
            "failure_code": None
        },
        "customer": {
            "name": "Charlie",
            "email": "charlie@example.com"
        }
    }
    res_e = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_e).json()
    check_scenario("E - null failure_code", res_e["action"]["status"] == "no_action", res_e["action"]["status"])
    check_scenario("E - status failed", res_e["revenue_event"]["status"] == "failed", res_e["revenue_event"]["status"])

    # -------------------------------------------------------------
    # SCENARIO F: Existing seeded/dashboard event
    # -------------------------------------------------------------
    print("\n--- SCENARIO F ---")
    events_res = httpx.get(f"{BACKEND_URL}/api/dashboard/events?limit=50").json()
    unprocessed = [e for e in events_res if e["status"] == "detected"]
    if not unprocessed:
        print("Note: No existing unprocessed 'detected' events found, skipping Scenario F")
    else:
        existing = unprocessed[0]
        req_f = {
            "event": {
                "event_id": existing["id"],
                "amount": existing["amount"],
                "failure_code": "insufficient_funds",
                "attempt_count": 0
            },
            "customer": {
                "name": existing["customers"]["name"],
                "email": existing["customers"].get("email")
            }
        }
        res_f = httpx.post(f"{BACKEND_URL}/api/recovery/process", json=req_f).json()
        check_scenario("F - Uses exact same ID", res_f["revenue_event"]["id"] == existing["id"], "Created new ID")
        check_scenario("F - Workflow completed", res_f["revenue_event"]["status"] != "detected", "Status unchanged")

    # -------------------------------------------------------------
    # SCENARIO G / H
    # -------------------------------------------------------------
    check_scenario("H - Customer reused", data_a["revenue_event"]["customer_id"] == data_c["revenue_event"]["customer_id"], "Customer not reused")

    # -------------------------------------------------------------
    # SCENARIO J: Data Integrity
    # -------------------------------------------------------------
    print("\n--- SCENARIO J: Data Integrity ---")
    data_health = httpx.get(f"{BACKEND_URL}/api/dashboard/data-health").json()
    integrity = httpx.get(f"{BACKEND_URL}/api/dashboard/data-health/integrity").json()
    metrics_consistency = httpx.get(f"{BACKEND_URL}/api/dashboard/data-health/metric-consistency").json()

    print("Data Health:", data_health)
    print("Integrity:", integrity)
    print("Metrics Consistency:", metrics_consistency)

    # Some basic assertions for integrity
    check_scenario("J - No revenue events without customer", integrity["revenue_event_without_customer"] == 0, integrity["revenue_event_without_customer"])
    
    print("\nALL E2E SCENARIOS PASSED")



def main():
    print("Starting server...")
    server = subprocess.Popen([".venv/Scripts/python.exe", "-m", "uvicorn", "app.main:app", "--port", "8001"], cwd="D:/razorpay/Recovery-AI/backend")
    try:
        if wait_for_server():
            run_tests()
        else:
            print("Server failed to start")
    except Exception as e:
        print(f"Tests failed: {e}")
    finally:
        server.terminate()
        server.communicate()

if __name__ == "__main__":
    main()
