# AI Finance Controller — End-to-End Solution Flow

## 1. Problem

Build an AI Finance Controller that can ingest heterogeneous financial data from ERP, Bank, Payment Gateway, and Tax systems; reconcile related records; explain discrepancies; calculate a measurable match rate; and produce an honest exception list for cases that cannot be resolved from available evidence.

The key design principle is:

> AI should maximize correct financial decisions, not maximize the number of records it labels as matched.

The system therefore combines deterministic finance logic with agentic reasoning and explicit human escalation.

---

## 2. High-Level End-to-End Flow

```text
                         FINANCE USER
                              |
                              v
                    +--------------------+
                    |  Upload Data Pack  |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Data Ingestion      |
                    | & Validation        |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Data Profiler /     |
                    | Schema Detection    |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Normalization &     |
                    | Entity Resolution   |
                    +---------+----------+
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
            ERP              BANK           GATEWAY
             |                |                |
             +----------------+----------------+
                              |
                              v
                    +--------------------+
                    | Canonical Finance   |
                    | Transaction Graph   |
                    +---------+----------+
                              |
                              v
                    +--------------------+
                    | Reconciliation      |
                    | Engine              |
                    +---------+----------+
                              |
                 +------------+-------------+
                 |                          |
                 v                          v
             RESOLVED                  AMBIGUOUS /
                 |                    MISMATCHED
                 |                          |
                 |                          v
                 |                 +--------------------+
                 |                 | Investigation Agent|
                 |                 | Qwen 3 / Ollama    |
                 |                 +---------+----------+
                 |                           |
                 |                    +------+------+
                 |                    |             |
                 |                    v             v
                 |                RESOLVED      UNRESOLVED
                 |                    |             |
                 +--------------------+-------------+
                                      |
                                      v
                            +--------------------+
                            | Evidence & Decision|
                            | Validation         |
                            +---------+----------+
                                      |
                                      v
                            +--------------------+
                            | Exception Manager  |
                            +---------+----------+
                                      |
                                      v
                            +--------------------+
                            | Controller State   |
                            | & KPIs             |
                            +---------+----------+
                                      |
                  +-------------------+-------------------+
                  |                   |                   |
                  v                   v                   v
              Dashboard            Q&A Agent         Cash Forecast
```

---

## 3. Raw Data Sources

The system should not receive four perfectly relational datasets. Each source should resemble a real operational system and expose different evidence.

### ERP

Typical entities:

- Customer
- Invoice
- ERP Payment
- Credit Note
- Accounts Receivable

Example:

```text
invoice_id: INV-1042
customer_name: Acme Industries Limited
invoice_date: 2026-08-12
subtotal: 80729
tax: 17721
total: 98450
status: Open
```

### Payment Gateway

Typical fields:

```text
gateway_payment_id: PG-8821
merchant_ref: ACME-1042
payer_name: ACME IND LTD
payment_date: 2026-08-13
gross_amount: 98450
fee: 0
net_amount: 98450
status: Captured
```

### Bank

Typical fields:

```text
bank_txn_id: BANK-7712
txn_date: 2026-08-14
description: ACME AUG PAYMENT INV1042
reference: NEFT98231
credit: 98450
```

### Tax Ledger

Typical fields:

```text
tax_entry_id: TAX-441
document_ref: INV1042
customer_name: ACME INDUSTRIES
taxable_value: 80729
cgst: 8860.50
sgst: 8860.50
total_tax: 17721
```

The same economic event therefore appears differently across systems.

---

## 4. Canonical Finance Model

The raw records are transformed into a canonical graph.

```text
                         CUSTOMER
                            |
                            v
                         INVOICE
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
           PAYMENT       TAX ENTRY    CREDIT NOTE
              |
              v
       GATEWAY PAYMENT
              |
              v
         SETTLEMENT
              |
              v
        BANK TRANSACTION
```

Important relationship types include:

- Customer -> Invoice
- Invoice -> Payment
- Invoice -> Tax Entry
- Invoice -> Credit Note
- Payment -> Gateway Payment
- Gateway Payment -> Settlement
- Settlement -> Bank Transaction

Relationships can be 1:1, 1:N, N:1, missing, duplicate, or ambiguous.

---

## 5. Synthetic Data Generation

Generate approximately 150–200 underlying economic transactions and transform them into roughly 500–800 raw records across the four systems.

The generator should deliberately introduce realistic reconciliation scenarios:

```text
70   Exact matches
15   Fuzzy/entity matches
10   Date-shifted transactions
5    Partial settlements
5    Duplicate payments
4    Missing bank transactions
3    Amount mismatches
3    Tax mismatches
3    Ambiguous cases
2    Completely unresolved
```

The exact distribution can vary.

Every generated transaction should also have hidden ground truth that the AI never sees.

Example:

```json
{
  "transaction_id": "TXN-1087",
  "ground_truth": {
    "status": "PARTIAL_MATCH",
    "expected_records": [
      "INV-1087",
      "PG-9122",
      "BANK-9931"
    ],
    "expected_exception": "UNEXPLAINED_BANK_DIFFERENCE",
    "financial_difference": 2500
  }
}
```

This enables objective evaluation.

---

## 6. Agentic Landscape

### 6.1 Controller / Orchestrator

Responsible for workflow state.

Input:

```text
Run August Financial Close
```

Actions:

1. Validate data pack.
2. Profile sources.
3. Normalize entities.
4. Run reconciliation.
5. Route uncertain cases to investigation.
6. Validate AI decisions.
7. Generate exceptions.
8. Calculate KPIs.
9. Expose results to dashboard and Q&A.

This should be a controlled workflow/state machine rather than an unrestricted LLM.

---

### 6.2 Data Profiler Agent

Determines what each incoming file represents.

Example:

```text
ERP.xlsx
Detected:
- invoice_id
- customer
- invoice_date
- subtotal
- tax
- total

Entity: INVOICE
```

The profiler allows the system to handle changes in column names without hardcoding filenames.

---

### 6.3 Entity Resolution Agent

Finds likely relationships between differently represented entities.

Example:

```text
ERP:
Acme Industries Limited

Gateway:
ACME IND LTD

Bank:
ACME AUG PAYMENT
```

It produces canonical entities and candidate relationships.

Useful techniques:

- normalization
- exact matching
- fuzzy matching
- string similarity
- embeddings
- semantic reasoning for difficult cases

---

### 6.4 Deterministic Reconciliation Engine

This is the trust layer.

It performs:

- amount comparison
- date tolerance checks
- currency validation
- reference matching
- duplicate detection
- gateway fee calculations
- tax calculations
- split-payment aggregation
- settlement reconciliation

The LLM should not perform core arithmetic.

Example:

```text
Invoice:          250,000
Gateway net:      243,750
Difference:         6,250
Gateway fee:         2.5%

250,000 * 2.5% = 6,250
```

Therefore the difference can be explained deterministically.

---

## 7. Investigation Agent — Qwen 3 / Ollama

This is the main LLM reasoning component.

It is invoked when deterministic reconciliation cannot confidently resolve a case.

The agent receives a compact evidence packet rather than raw files.

Example:

```json
{
  "invoice": {
    "id": "INV-1087",
    "amount": 250000
  },
  "gateway": {
    "payment": 243750,
    "fee": 6250
  },
  "bank": {
    "credit": 241250
  },
  "known_relationships": [
    "gateway fee = 2.5%"
  ]
}
```

Expected structured response:

```json
{
  "classification": "PARTIALLY_RESOLVED",
  "confidence": 0.91,
  "explained_difference": 6250,
  "unexplained_difference": 2500,
  "reason": "Gateway fee explains the first difference, but no evidence explains the additional bank variance.",
  "requires_human_review": true
}
```

Qwen is responsible for semantic reasoning, not authoritative financial calculations.

---

## 8. Evidence Layer

Every decision should store:

```text
Decision
Confidence
Source records
Evidence used
Rules triggered
AI reasoning
Unresolved amount
Human-review requirement
```

Example:

```text
INV-1042

Decision: MATCHED
Confidence: 98%

Evidence:
✓ Invoice reference matched
✓ Customer matched semantically
✓ Amount matched
✓ Date within settlement tolerance
✓ Gateway reference supported relationship
```

For an exception:

```text
INV-1087

Decision: PARTIALLY RESOLVED

Evidence:
✓ Invoice exists
✓ Gateway payment exists
✓ Gateway fee explains ₹6,250
✓ Bank transaction exists
✗ Additional ₹2,500 has no supporting evidence

Human review: REQUIRED
```

---

## 9. Exception Manager

The exception manager converts unresolved findings into actionable finance exceptions.

Example:

```text
Exception #27

Type:
Missing settlement

Transaction:
INV-1098

Exposure:
₹410,000

Severity:
HIGH

Status:
Human Review Required

Reason:
ERP payment exists, but no corresponding bank
settlement was found.
```

Exception categories can include:

- Missing settlement
- Duplicate payment
- Partial payment
- Amount mismatch
- Tax mismatch
- Timing variance
- Ambiguous match
- Missing source record
- Unsupported adjustment

Severity can be calculated using:

```text
financial exposure
+ risk type
+ confidence
+ transaction age
```

---

## 10. Controller State

After reconciliation, maintain a structured state such as:

```json
{
  "close_id": "AUG-2026-001",
  "records_processed": 127,
  "matched": 111,
  "partial_matches": 8,
  "unresolved": 8,
  "match_rate": 0.874,
  "financial_coverage": 0.928,
  "exceptions": [],
  "transactions": [],
  "evidence": []
}
```

This state becomes the single source of truth for the dashboard and Q&A layer.

---

## 11. Controller Dashboard

The primary dashboard should show:

```text
AI FINANCE CONTROLLER
August 2026 Close

Records Processed          127
Matched                    111
Partial                     8
Unresolved                  8

Record Match Rate          87.4%
Financial Coverage         92.8%

High Risk Exceptions         3
Medium Risk Exceptions       4
Low Risk Exceptions          1
```

The user can click into any transaction and see the evidence graph.

---

## 12. Transaction Investigation View

Example:

```text
                 INV-1042
                ₹98,450
                    |
          +---------+---------+
          |         |         |
          v         v         v
        ERP      GATEWAY     TAX
      ₹98,450    ₹98,450   ₹17,721
                    |
                    v
                 BANK
               ₹98,450
```

Relationship states:

```text
GREEN  = verified
YELLOW = AI-supported / inferred
RED    = mismatch
GREY   = missing evidence
```

This makes the AI's decision auditable.

---

## 13. Controller Q&A

The user can ask questions against the structured controller state.

Examples:

> Why is INV-1087 unresolved?

> Which gateway has the highest exception rate?

> What is our largest unresolved financial exposure?

> How much money is tied up in missing settlements?

> Which transactions were resolved using AI inference rather than exact matching?

The Q&A agent should retrieve relevant structured evidence first and use Qwen only to explain it.

It should not re-read the entire raw dataset for every question.

---

## 14. Cash Forecast

Use reconciled transactions, expected settlements, receivables and known obligations to create a short-horizon forecast.

Example:

```text
Current Cash        ₹8.42M
7-Day Forecast      ₹7.91M
14-Day Forecast     ₹6.84M
30-Day Forecast     ₹5.72M
```

Explain the drivers:

```text
Expected inflows       +₹1.29M
Vendor payments        -₹1.84M
Payroll                -₹0.82M
Tax payments           -₹0.42M
Unresolved exposure    -₹0.64M
```

The forecast should remain transparent and should clearly distinguish confirmed cash movements from uncertain expected movements.

---

## 15. End-to-End Dry Run

Consider invoice `INV-1042`.

ERP:

```text
Acme Industries Limited
₹98,450
12-Aug
```

Gateway:

```text
ACME IND LTD
₹98,450
13-Aug
Reference: ACME-1042
```

Bank:

```text
ACME AUG PAYMENT INV1042
₹98,450
14-Aug
```

Tax:

```text
ACME INDUSTRIES
GST: ₹17,721
Reference: INV1042
```

The flow is:

```text
1. Profiler identifies each source.

2. Normalization converts different customer names
   and reference formats into comparable representations.

3. Entity resolution identifies the likely customer
   and transaction relationships.

4. Reconciliation engine checks:
   - amount
   - date
   - reference
   - customer
   - tax

5. All core evidence agrees.

6. No LLM investigation is required.

7. Transaction is marked:
   MATCHED / 98% confidence.

8. Evidence is stored.

9. Match contributes to close KPIs.
```

Now consider a difficult transaction:

```text
ERP:
INV-1087 = ₹250,000

Gateway:
₹243,750
Fee = ₹6,250

Bank:
₹241,250
```

The engine calculates:

```text
ERP → Gateway difference = ₹6,250
Gateway fee = ₹6,250
Remaining difference = ₹2,500
```

The first discrepancy is explained.

The remaining ₹2,500 is not explained.

Qwen receives the evidence and returns:

```text
PARTIALLY_RESOLVED
₹6,250 explained
₹2,500 unresolved
Human review required
```

The exception manager creates the exception.

This is the desired behavior: the system resolves what it can prove and escalates what it cannot.

---

## 16. Evaluation Framework

Because the dataset has hidden ground truth, the system can be evaluated objectively.

Measure:

```text
Match precision
Match recall
Exception precision
Exception recall
False-positive match rate
False-negative match rate
Financial coverage
Unresolved exposure
Average confidence
```

Example:

```text
Records                    127
Correct matches            109
Incorrect matches            2
Correct exceptions           9
Incorrect exceptions         1

Match Precision            98.2%
Match Recall               97.3%
Financial Coverage         92.8%
```

A particularly important metric is the rate at which the AI incorrectly claims a transaction is resolved.

---

## 17. Recommended Technology Architecture

```text
FRONTEND
Next.js
    |
    v
API
FastAPI / Flask
    |
    v
CONTROLLER
Python workflow/state machine
    |
    +-------------------------------+
    |                               |
    v                               v
DATA / RECONCILIATION           AI INVESTIGATION
Python                           Qwen 3 8B
Pandas / Polars                  Ollama
OpenPyXL                         Structured JSON
    |                               |
    +---------------+---------------+
                    |
                    v
              Controller State
                    |
          +---------+---------+
          |         |         |
          v         v         v
      Dashboard    Q&A     Forecast
```

For a hackathon MVP, a database such as SQLite/PostgreSQL is sufficient. A graph database is optional; the conceptual transaction graph can initially be represented with relational tables and relationship records.

---

## 18. Recommended Agent Count

Do not build ten independent LLM agents.

Use:

```text
1. Controller / Orchestrator
2. Data Profiler / Entity Resolution
3. Investigation Agent — Qwen 3 / Ollama
4. Exception Manager
5. Q&A interface
```

The core reconciliation engine should remain deterministic.

The agentic value comes from the controller deciding when deterministic evidence is insufficient, invoking investigation, evaluating the result, and escalating unresolved cases.

---

## 19. Final Product Story

The full product can be summarized as:

```text
UPLOAD
  ↓
UNDERSTAND
  ↓
NORMALIZE
  ↓
RECONCILE
  ↓
INVESTIGATE
  ↓
VALIDATE
  ↓
RESOLVE OR ESCALATE
  ↓
MEASURE
  ↓
EXPLAIN
  ↓
FORECAST
```

The final pitch:

> An AI Finance Controller that reconciles multi-source financial records, explains every decision with evidence, quantifies the financial impact of exceptions, and knows when it does not have enough evidence to make a decision.

The strongest differentiator is not that an LLM can match records. It is that the controller has a **closed-loop reconciliation process with deterministic controls, AI investigation, evidence provenance, measurable ground truth, and explicit human escalation**.