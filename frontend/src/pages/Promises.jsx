import { useState, useEffect } from "react";
import {
  createPromise,
  recordPromisePayment,
  breakPromise,
  escalatePromise,
  deletePromise,
  listPromises,
} from "../services/api";

function formatINR(amount) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function Promises() {
  const [promises, setPromises] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [form, setForm] = useState({
    promise_ref: "",
    invoice_ref: "",
    customer_name: "",
    customer_email: "",
    promised_amount: "50000",
    promise_date: "",
  });

  const loadPromises = async () => {
    setLoading(true);
    try {
      const data = await listPromises();
      setPromises(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromises();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const promise = await createPromise({
        ...form,
        promised_amount: parseFloat(form.promised_amount),
      });
      setPromises((p) => [promise, ...p]);
      setSelected(promise);
      setForm({
        promise_ref: "",
        invoice_ref: "",
        customer_name: "",
        customer_email: "",
        promised_amount: "50000",
        promise_date: "",
      });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (p, ev) => {
    ev.preventDefault();
    setError(null);
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    try {
      const updated = await recordPromisePayment({
        promise_ref: p.promise_ref,
        payment_amount: amt,
      });
      setPromises((list) =>
        list.map((x) => (x.promise_ref === p.promise_ref ? { ...x, ...updated } : x))
      );
      if (selected?.promise_ref === p.promise_ref) setSelected(updated);
      setPaymentAmount("");
    } catch (e2) {
      setError(e2.message);
    }
  };

  const handleBreak = async (p) => {
    setError(null);
    try {
      const updated = await breakPromise(p.promise_ref);
      setPromises((list) =>
        list.map((x) => (x.promise_ref === p.promise_ref ? { ...x, ...updated } : x))
      );
      if (selected?.promise_ref === p.promise_ref) setSelected(updated);
    } catch (e2) {
      setError(e2.message);
    }
  };

  const handleEscalate = async (p) => {
    setError(null);
    try {
      const updated = await escalatePromise(p.promise_ref);
      setPromises((list) =>
        list.map((x) => (x.promise_ref === p.promise_ref ? { ...x, ...updated } : x))
      );
      if (selected?.promise_ref === p.promise_ref) setSelected(updated);
    } catch (e2) {
      setError(e2.message);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Are you sure you want to delete promise ${p.promise_ref}?`)) {
      return;
    }
    setError(null);
    try {
      await deletePromise(p.promise_ref);
      setPromises((list) => list.filter((x) => x.promise_ref !== p.promise_ref));
      if (selected?.promise_ref === p.promise_ref) {
        setSelected(null);
      }
    } catch (e2) {
      setError(e2.message);
    }
  };

  const statusBadge = (status) => {
    const map = {
      PROMISE_PENDING: "bg-blue-100 text-blue-800",
      PARTIALLY_FULFILLED: "bg-amber-100 text-amber-800",
      FULFILLED: "bg-green-100 text-green-800",
      BROKEN: "bg-red-100 text-red-800",
      ESCALATED: "bg-purple-100 text-purple-800",
      CANCELLED: "bg-gray-200 text-gray-700",
    };
    return `px-2 py-1 rounded text-xs font-bold ${map[status] || "bg-gray-100 text-gray-700"}`;
  };

  const activeCount = promises.filter(
    (p) => p.status === "PROMISE_PENDING" || p.status === "PARTIALLY_FULFILLED"
  ).length;
  const totalPromised = promises.reduce((s, p) => s + Number(p.promised_amount || 0), 0);
  const totalPaid = promises.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const fulfilledCount = promises.filter((p) => p.status === "FULFILLED").length;
  const brokenCount = promises.filter((p) => p.status === "BROKEN" || p.status === "ESCALATED").length;

  return (
    <main className="dashboard overflow-auto h-full p-8 bg-[#F8F9FA]">
      <header className="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase mb-1 block">Promise to Pay</span>
          <h1 className="text-2xl font-bold text-gray-900">Promise-to-Pay Tracker</h1>
          <p className="text-sm text-gray-500 mt-2">
            Deterministic promise lifecycle routed through RecoverAI guardrails.
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full mb-2">SIMULATED / TEST MODE</span>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Active Promises</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Total Promised</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatINR(totalPromised)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatINR(totalPaid)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Fulfilled</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fulfilledCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Broken / Escalated</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{brokenCount}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-fit">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Create Promise</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Promise Reference</label>
              <input required className="w-full px-3 py-2 border border-gray-300 rounded text-sm" value={form.promise_ref}
                onChange={(e) => setForm({ ...form, promise_ref: e.target.value })} placeholder="PROM-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Invoice Reference</label>
              <input required className="w-full px-3 py-2 border border-gray-300 rounded text-sm" value={form.invoice_ref}
                onChange={(e) => setForm({ ...form, invoice_ref: e.target.value })} placeholder="INV-1001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company / Customer</label>
              <input required className="w-full px-3 py-2 border border-gray-300 rounded text-sm" value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Promised (₹)</label>
                <input required type="number" min="1" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" value={form.promised_amount}
                  onChange={(e) => setForm({ ...form, promised_amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Promise Date</label>
                <input required type="date" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" value={form.promise_date}
                  onChange={(e) => setForm({ ...form, promise_date: e.target.value })} />
              </div>
            </div>
            <button disabled={loading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded text-sm transition-colors">
              {loading ? "Creating..." : "Create Promise"}
            </button>
          </form>
        </section>

        {/* Promise table */}
        <section className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Promise Register</h3>
            <button onClick={loadPromises} className="text-xs font-semibold text-emerald-700 hover:underline">Refresh</button>
          </div>

          {promises.length === 0 && !loading && (
            <p className="text-sm text-gray-400 text-center py-8">No promises recorded yet.</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Promised</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Remaining</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {promises.map((p) => {
                  const promised = Number(p.promised_amount || 0);
                  const paid = Number(p.amount_paid || 0);
                  const remaining = promised - paid;
                  return (
                    <tr key={p.promise_ref} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelected(p)}>
                      <td className="py-2 pr-3 font-mono text-xs">{p.promise_ref}</td>
                      <td className="py-2 pr-3">{p.customer_name}</td>
                      <td className="py-2 pr-3">{formatINR(promised)}</td>
                      <td className="py-2 pr-3 text-emerald-600">{formatINR(paid)}</td>
                      <td className="py-2 pr-3">{formatINR(remaining)}</td>
                      <td className="py-2 pr-3 text-xs">{p.promise_date}</td>
                      <td className="py-2 pr-3"><span className={statusBadge(p.status)}>{p.status.replaceAll("_", " ")}</span></td>
                      <td className="py-2">
                        {p.status === "PROMISE_PENDING" || p.status === "PARTIALLY_FULFILLED" ? (
                          <span className="text-xs font-semibold text-emerald-700 underline">Manage</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500">View</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Promise detail */}
      {selected && (
        <section className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Promise Detail — <span className="font-mono">{selected.promise_ref}</span>
            </h3>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-700">Close ✕</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Invoice</p>
              <p className="font-mono text-sm mt-1">{selected.invoice_ref}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Promised</p>
              <p className="font-bold text-sm mt-1">{formatINR(selected.promised_amount)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Paid</p>
              <p className="font-bold text-emerald-600 text-sm mt-1">{formatINR(selected.amount_paid)}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Remaining</p>
              <p className="font-bold text-sm mt-1">{formatINR(Number(selected.promised_amount) - Number(selected.amount_paid))}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Promise Date</p>
              <p className="text-sm mt-1">{selected.promise_date}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Status</p>
              <span className={statusBadge(selected.status)}>{selected.status.replaceAll("_", " ")}</span>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Escalation Stage</p>
              <p className="text-sm mt-1">{selected.escalation_stage || 0} / 3</p>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Customer</p>
              <p className="text-sm mt-1">{selected.customer_name}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1">
              {(selected.status === "PROMISE_PENDING" || selected.status === "PARTIALLY_FULFILLED") && (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Record Payment (₹)</label>
                    <input type="number" min="1" className="w-40 px-3 py-2 border border-gray-300 rounded text-sm"
                      value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={String(Math.max(Number(selected.promised_amount) - Number(selected.amount_paid), 0))} />
                  </div>
                  <button onClick={(ev) => handlePayment(selected, ev)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded">
                    Record Payment
                  </button>
                  <button onClick={() => handleBreak(selected)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded">
                    Mark Broken
                  </button>
                </div>
              )}

              {selected.status === "BROKEN" && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-700 flex-1">
                    <strong>Promise broken.</strong> Promised: {formatINR(selected.promised_amount)}, Paid: {formatINR(selected.amount_paid)}, Remaining: {formatINR(Number(selected.promised_amount) - Number(selected.amount_paid))}
                  </div>
                  <button onClick={() => handleEscalate(selected)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded">
                    Escalate (Stage {selected.escalation_stage || 0} → {selected.escalation_stage || 0 + 1})
                  </button>
                </div>
              )}

              {selected.status === "FULFILLED" && (
                <div className="p-3 bg-green-50 rounded border border-green-200 text-sm text-green-700">
                  <strong>Promise fulfilled.</strong> Full amount paid: {formatINR(selected.amount_paid)}
                </div>
              )}
            </div>

            <button
              onClick={() => handleDelete(selected)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded transition-colors"
            >
              Delete Promise
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default Promises;