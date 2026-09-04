const BASE = "/api"; // proxied to FastAPI, see vite.config.js

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function runReconciliation() {
  const res = await fetch(`${BASE}/reconcile/run`, { method: "POST" });
  if (!res.ok) throw new Error(`/reconcile/run -> ${res.status}`);
  return res.json(); // ADJUST: expected to include close_id somewhere in the response
}

export async function getCloseState(closeId) {
  return getJSON(`/close/${closeId}/state`); // ControllerState
}

export async function getExceptions(closeId) {
  return getJSON(`/close/${closeId}/exceptions`); // FinanceException[]
}

export async function getEvidence(transactionId) {
  return getJSON(`/transaction/${transactionId}/evidence`); // EvidenceRecord
}

export async function getForecast(closeId, currentBalance) {
  return getJSON(`/close/${closeId}/forecast?current_balance=${currentBalance}`);
}

export async function getEvaluation(closeId) {
  return getJSON(`/close/${closeId}/evaluation`);
}

export async function getTaxMatches(closeId) {
  return getJSON(`/close/${closeId}/tax-matches`);
}

export async function askSettlementQA(closeId, question) {
  const res = await fetch(`${BASE}/close/${closeId}/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`/qa -> ${res.status}`);
  return res.json();
}