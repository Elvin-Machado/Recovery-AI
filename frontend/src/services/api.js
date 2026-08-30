const API_BASE_URL = "http://127.0.0.1:8000";

export async function getDashboard() {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard data");
  }

  return response.json();
}