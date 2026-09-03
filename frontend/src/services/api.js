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
    `${API_BASE_URL}/api/dashboard/events?limit=100`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard events");
  }

  return response.json();
}


export async function getCustomers(limit = 200) {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/customers?limit=${limit}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch customer summary");
  }

  return response.json();
}


export async function getSubscriptions(limit = 200) {
  const response = await fetch(
    `${API_BASE_URL}/api/dashboard/subscriptions?limit=${limit}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch subscription summary");
  }

  return response.json();
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

export async function simulateTransaction(transactionData) {
  const response = await fetch(
    `${API_BASE_URL}/api/simulator/transaction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Failed to simulate transaction"
    );
  }

  return response.json();
}

export async function simulateCheckout(checkoutData) {
  const response = await fetch(
    `${API_BASE_URL}/api/simulator/checkout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Failed to simulate checkout"
    );
  }

  return response.json();
}

export async function simulateSubscription(subscriptionData) {
  const response = await fetch(
    `${API_BASE_URL}/api/simulator/subscription`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Failed to simulate subscription"
    );
  }

  return response.json();
}

export async function simulateReceivable(receivableData) {
  const response = await fetch(
    `${API_BASE_URL}/api/simulator/receivable`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(receivableData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "Failed to simulate b2b receivable"
    );
  }

  return response.json();
}

export async function createPromise(promiseData) {
  const response = await fetch(
    `${API_BASE_URL}/api/promises/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(promiseData),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to create promise");
  }
  return response.json();
}

export async function recordPromisePayment(paymentData) {
  const response = await fetch(
    `${API_BASE_URL}/api/promises/payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to record promise payment");
  }
  return response.json();
}

export async function breakPromise(promiseRef) {
  const response = await fetch(
    `${API_BASE_URL}/api/promises/break`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promise_ref: promiseRef }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to break promise");
  }
  return response.json();
}

export async function escalatePromise(promiseRef) {
  const response = await fetch(
    `${API_BASE_URL}/api/promises/escalate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promise_ref: promiseRef }),
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to escalate promise");
  }
  return response.json();
}

export async function deletePromise(promiseRef) {
  const response = await fetch(
    `${API_BASE_URL}/api/promises/${encodeURIComponent(promiseRef)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to delete promise");
  }
  return response.json();
}

export async function listPromises() {
  const response = await fetch(`${API_BASE_URL}/api/promises/list`);
  return response.json();
}

// ---------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------

export async function getAnalyticsSummary() {
  const response = await fetch(
    `${API_BASE_URL}/api/analytics/summary`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch analytics summary");
  }
  return response.json();
}

export async function getAnalyticsCategories() {
  const response = await fetch(
    `${API_BASE_URL}/api/analytics/categories`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch analytics categories");
  }
  return response.json();
}

export async function getModelBenchmark() {
  const response = await fetch(
    `${API_BASE_URL}/api/analytics/model-benchmark`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch model benchmark");
  }
  return response.json();
}

export async function runAnalyticsBatch() {
  const response = await fetch(
    `${API_BASE_URL}/api/analytics/batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to run analytics batch");
  }
  return response.json();
}
