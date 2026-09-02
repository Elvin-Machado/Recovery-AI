const API_BASE_URL = "http://127.0.0.1:8000";

export async function getDashboard() {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
}


export async function getDashboardEvents() {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/events`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard events");
  }

  return response.json();
}


export async function getEvents() {
  return getDashboardEvents();
}


export async function processRecovery(event, customer) {
  const response = await fetch(
    `${API_BASE_URL}/api/recovery/process`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        customer,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);

    throw new Error(
      errorData?.detail || "Failed to process recovery"
    );
  }

  return response.json();
}