Yes. With these **exact five roles**, I would simplify the architecture and make every dashboard map directly to the responsibilities in your PS.

The important distinction is:

* **Sales Rep** = creates and manages deals
* **Sales Manager / Approver** = commercial governance
* **Finance / Operations** = financial + fulfillment governance
* **Customer** = negotiation and confirmation
* **Admin** = master data + platform configuration

Below is the complete architecture around those roles.

# DealFlow360 — Final Role-Based System Architecture

```text id="6r6a7"
                         DEALFLOW360
                 B2B DEAL GOVERNANCE PLATFORM
                              │
                    ┌─────────┴─────────┐
                    │ AUTHENTICATION    │
                    │ + RBAC            │
                    └─────────┬─────────┘
                              │
       ┌──────────────────────┼─────────────────────────┐
       │                      │                         │
       ▼                      ▼                         ▼
 SALES REP            SALES MANAGER              FINANCE / OPS
 DASHBOARD             DASHBOARD                  DASHBOARD
       │                      │                         │
       └───────────┬──────────┴────────────┬────────────┘
                   │                       │
                   ▼                       ▼
             CUSTOMER PORTAL             ADMIN
                   │                    DASHBOARD
                   └──────────┬────────────┘
                              ▼
                       ┌───────────────┐
                       │  DEAL ENGINE  │
                       └───────┬───────┘
                               │
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
   PRICING ENGINE         MARGIN ENGINE         RULE ENGINE
       🔵                      🔵                    🔵
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               ▼
                         RISK ENGINE 🟣
                               │
                   ┌───────────┼───────────┐
                   ▼           ▼           ▼
              RISK SCORE   ANOMALY     RECOMMENDATION
                   │           │           │
                   └───────────┼───────────┘
                               ▼
                         GENAI LAYER 🟠
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             COPILOT      EXPLANATION     NEGOTIATION
                               │
                               ▼
                         AGENTIC LAYER 🟠
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
            DEAL AGENT    NEGOTIATION      FULFILLMENT
                             AGENT            AGENT
               │               │               │
               └───────────────┼───────────────┘
                               ▼
                      APPROVAL ENGINE 🔵
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             SALES MANAGER          FINANCE / OPS
                    │                     │
                    └──────────┬──────────┘
                               ▼
                         ORDER ENGINE
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
           INVENTORY       FULFILLMENT      BILLING
              🔵               🔵              🔵
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                          EVENT BUS
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        NOTIFICATION        AUDIT           ANALYTICS
              │                │                │
              └────────────────┼────────────────┘
                               ▼
                         DEAL HEALTH
```

---

# 1. Sales Rep Dashboard

Your first role is:

> **Sales Rep — Builds quotations, applies discounts, adds upsell items, tracks approval/fulfillment, responds to negotiations.**

So the dashboard should be:

```text id="5s7r4a"
SALES REP DASHBOARD
│
├── Dashboard
├── My Customers
├── My Deals
├── Create Quotation
├── Quotations
├── Approval Status
├── Negotiations
├── Fulfillment Tracking
├── AI Recommendations
└── Notifications
```

## Sales Rep Home

```text id="g7z9xk"
┌────────────────────────────────────────────────────┐
│                 SALES COMMAND CENTER                │
├────────────────────────────────────────────────────┤
│                                                    │
│ My Pipeline       Active Quotes       Won Deals     │
│ ₹42L              18                 12             │
│                                                    │
│ Approval Pending  Negotiations       At Risk        │
│ 5                 3                  4              │
│                                                    │
├────────────────────────────────────────────────────┤
│ 🔴 ACTION REQUIRED                                 │
│                                                    │
│ ABC Corp     Discount approval pending             │
│ XYZ Ltd      Customer counter-offer                │
│ PQR Ltd      Fulfillment delay                     │
│                                                    │
├────────────────────────────────────────────────────┤
│ 🤖 AI INSIGHTS                                     │
│                                                    │
│ 3 customers have high upsell probability.          │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

# 2. Sales Rep — Create Quotation Flow

This is the most important sales flow.

```text id="v1j8oa"
SALES REP
   │
   ▼
Select Customer
   │
   ▼
Create Quotation
   │
   ▼
Add Products
   │
   ▼
🔵 PRICE CALCULATION
   │
   ▼
🟣 UPSELL / CROSS-SELL
   │
   ▼
Sales Rep Adds Items
   │
   ▼
Apply Discount
   │
   ▼
🔵 MARGIN CALCULATION
   │
   ▼
🟣 RISK ANALYSIS
   │
   ▼
🟠 AI COPILOT
   │
   ├── Explain risk
   ├── Suggest products
   └── Suggest negotiation strategy
   │
   ▼
🔵 APPROVAL RULE CHECK
   │
   ├── Within limit
   │       ↓
   │     Continue
   │
   └── Above limit
           ↓
      Approval Request
```

---

# 3. Quotation Screen

Make this the hero UI.

```text id="t1qu4k"
┌────────────────────────────────────────────────────────┐
│ CREATE QUOTATION                                       │
│ Customer: ABC Corporation                              │
├────────────────────────────────────────────────────────┤
│ PRODUCT       QTY       PRICE       DISCOUNT     TOTAL  │
│ Laptop         20       ₹50,000       10%       ₹9L     │
│ Support        20       ₹5,000         0%       ₹1L     │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 🤖 AI DEAL COPILOT                                     │
│                                                        │
│ Recommended: Extended Warranty                         │
│                                                        │
│ Purchase affinity: 82%                                 │
│ Margin impact: +3.4%                                   │
│                                                        │
│ [ ADD TO QUOTE ]                                       │
│                                                        │
├────────────────────────────────────────────────────────┤
│ DEAL HEALTH: 🟡 72/100                                 │
│                                                        │
│ Margin       24%                                       │
│ Discount     10%                                       │
│ Risk         Medium                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

# 4. Sales Rep — Approval Tracking

Salesperson doesn't approve their own risky deal.

They see:

```text id="8j8y6k"
MY APPROVALS

Deal #1024
Discount: 18%
Risk: 84

Status:
🟡 Waiting for Sales Manager

Submitted:
10:42 AM

Last Action:
Awaiting review
```

If Finance/Operations second-level approval is required:

```text id="4o0exd"
Sales Manager
      ↓
APPROVED
      ↓
Finance / Operations
      ↓
PENDING
```

---

# 5. Sales Rep — Fulfillment Tracking

After approval:

```text id="f3grt7"
APPROVED QUOTE
      ↓
ORDER
      ↓
FULFILLMENT
      ↓
┌──────────────────────────┐
│ Mumbai Warehouse         │
│ 30 / 50 units            │
│ 🟢 Ready                 │
├──────────────────────────┤
│ Pune Warehouse           │
│ 20 / 50 units            │
│ 🟡 Processing            │
└──────────────────────────┘
```

Salesperson can see progress but doesn't necessarily control warehouse decisions.

---

# 6. Sales Rep — Customer Negotiation

Customer sends:

> "Can you reduce the price by another 5%?"

Sales Rep gets:

```text id="t85dy2"
🔔 CUSTOMER COUNTER-OFFER

ABC Corporation
Additional discount requested: 5%

Current margin: 24%
Projected margin: 19%

Risk: 81 🔴

🤖 AI NEGOTIATION ADVISOR

Option A:
3% discount + free installation

Option B:
5% discount

Option C:
2% discount + extended support

Recommended: Option A
```

Sales rep can respond.

---

# 7. Sales Manager / Approver Dashboard

Your second role:

> **Reviews/approves/rejects quotations exceeding discount thresholds, configures discount tiers/approval chains, monitors deal health.**

Dashboard:

```text id="g5m3we"
SALES MANAGER DASHBOARD
│
├── Overview
├── Approval Queue
├── Deal Health
├── Team Pipeline
├── Discount Monitoring
├── Margin Monitoring
├── At-Risk Deals
├── Approval Rules
└── Reports
```

---

# 8. Sales Manager — Approval Center

```text id="g2r3j5"
APPROVAL CENTER

┌─────────────────────────────────────────────┐
│ Deal       Value    Discount   Margin Risk  │
├─────────────────────────────────────────────┤
│ ABC        ₹18L       18%       17%   🔴91  │
│ XYZ        ₹12L       15%       20%   🟠78  │
│ PQR        ₹8L        12%       24%   🟡61  │
└─────────────────────────────────────────────┘
```

Clicking a deal:

```text id="1nd4ae"
DEAL #1024

Discount: 18%
Allowed: 10%

Margin: 17%
Target: 25%

Risk: 91/100

WHY?

✓ Discount exceeds tier
✓ Margin below target
✓ Customer negotiated twice
✓ Discount above rep's normal range
```

Then:

```text
[ APPROVE ]
[ REJECT ]
[ REQUEST CHANGES ]
```

---

# 9. Sales Manager — Configure Discount Tiers

```text id="j6y9c0"
DISCOUNT CONFIGURATION

Customer Tier
────────────────────
Standard       10%
Premium        15%
Enterprise     20%

Product Category
────────────────────
Hardware       10%
Software       15%
Services       8%

Approval Chain
────────────────────
0–10%       Auto
10–15%      Sales Manager
15–20%      Sales Manager + Finance
>20%        Senior Approval
```

This part is **100% 🔵 Rule-Based**.

---

# 10. Sales Manager — Deal Health

```text id="myq3tz"
DEAL HEALTH

🟢 Healthy        82
🟡 At Risk        31
🔴 Critical       14

TOP RISKS

ABC Corp
Risk 91
Discount anomaly

XYZ Ltd
Risk 86
Margin deterioration

PQR Ltd
Risk 81
Stalled negotiation
```

Manager can drill down.

---

# 11. Finance / Operations Dashboard

Your third role is combined:

> **Second-level approvals + warehouse fulfillment splits/backorders + recurring billing/credit notes.**

Dashboard:

```text id="q7l9xz"
FINANCE / OPERATIONS
│
├── Dashboard
├── High-Risk Approvals
├── Orders
├── Inventory
├── Warehouse Allocation
├── Fulfillment
├── Backorders
├── Invoices
├── Recurring Billing
├── Credit Notes
└── Reconciliation
```

---

# 12. Finance / Operations — Second-Level Approval

Flow:

```text id="cb2ql8"
Sales Rep
   │
   ▼
Discount exceeds threshold
   │
   ▼
Sales Manager
   │
   ▼
Approved
   │
   ▼
Risk still HIGH?
   │
   ▼
Finance / Operations
   │
   ├── Review Margin
   ├── Review Financial Impact
   ├── Review Risk
   └── Review Deal History
   │
   ▼
Approve / Reject
```

This is where your two-level governance becomes clear.

---

# 13. Finance Approval Screen

```text id="6e8v3h"
HIGH-RISK DEAL

Deal Value              ₹50L
Discount                 21%
Expected Margin          14%
Revenue Impact           ₹39.5L

Risk Score               93 🔴

FINANCE ANALYSIS

Discount impact          HIGH
Margin impact            HIGH
Customer risk            MEDIUM

🤖 AI SUMMARY

"Approval creates significant margin
erosion. A lower discount combined with
extended support preserves approximately
₹3.2L additional margin."

[ APPROVE ]
[ REJECT ]
[ REQUEST REVISION ]
```

---

# 14. Finance / Operations — Warehouse Allocation

```text id="9j2m7x"
ORDER #1024

Required:
100 Laptops

WAREHOUSE STOCK

Mumbai
60 available

Pune
40 available

Delhi
20 available
```

System recommends:

```text id="5x3p1d"
OPTIMAL SPLIT

Mumbai → 60
Pune   → 40

Shipments: 2
Estimated Cost: ₹18,000
Estimated Delivery: 2 days

[ ACCEPT PLAN ]
```

---

# 15. Backorder Flow

If inventory is insufficient:

```text id="o2d6m1"
ORDER
 ↓
Inventory Check 🔵
 ↓
Insufficient Stock
 ↓
Backorder Created
 ↓
Finance / Operations Review
 ↓
┌──────────────┬──────────────┐
▼              ▼              ▼
Wait          Split         Substitute
             Shipment        Product
```

AI/agent can recommend the best option.

But the final business action should be controlled by the Operations user/rules.

---

# 16. Finance — Recurring Billing

```text id="q4o7j1"
ORDER
 │
 ├── Hardware
 │
 └── Support Subscription
           │
           ▼
    Billing Schedule
           │
    ┌──────┼──────┐
    ▼      ▼      ▼
 Month 1 Month 2 Month 3 ...
```

Finance dashboard:

```text id="7q7m2a"
RECURRING BILLING

Active Subscriptions       342
MRR                         ₹24L
Invoices Due                ₹8L
Overdue                     ₹2L

Credit Notes
Pending                     7
Processed                   18
```

---

# 17. Customer Portal

Your fourth role:

> **Views quotation, requests changes, asks line-level questions, counters discounts, confirms final terms.**

Customer gets a **simple portal**, not internal dashboards.

```text id="v7e5rm"
CUSTOMER PORTAL
│
├── Overview
├── Quotations
├── Negotiations
├── Orders
├── Shipments
├── Invoices
├── Subscriptions
└── Notifications
```

---

# 18. Customer Quotation View

```text id="av2d3k"
ABC CORPORATION

QUOTATION #DF-1024

Laptop × 20              ₹9,00,000
Support × 20             ₹1,00,000
Installation             ₹50,000

─────────────────────────────
Total                   ₹10,50,000

[ ACCEPT ]
[ REQUEST CHANGE ]
[ ASK QUESTION ]
[ COUNTER OFFER ]
```

---

# 19. Customer Line-Level Question

Customer clicks Support:

```text id="e9s2pr"
SUPPORT × 20

Price: ₹1,00,000

Question:
"Does this include 24/7 support?"
```

Sales rep receives:

```text id="m6w8qk"
Customer Question

Deal #DF-1024
Line: Support

"Does this include 24/7 support?"

[ RESPOND ]
```

This creates a clean communication trail.

---

# 20. Customer Counter Offer

```text id="x5f3v9"
CURRENT

Total: ₹10,50,000
Discount: 10%

CUSTOMER REQUEST

"Can you offer 15% discount?"

[ SUBMIT COUNTER OFFER ]
```

Then:

```text id="k8v5t1"
COUNTER OFFER CREATED
       ↓
Pricing recalculated 🔵
       ↓
Margin recalculated 🔵
       ↓
Risk recalculated 🟣
       ↓
Approval required?
       ↓
YES
       ↓
Sales Manager
```

This is one of your strongest end-to-end flows.

---

# 21. Customer Final Confirmation

```text id="r3h6mx"
FINAL QUOTATION

Total: ₹10,20,000

✓ Pricing approved
✓ Discount approved
✓ Terms confirmed
✓ Delivery confirmed

[ CONFIRM FINAL TERMS ]
```

Click:

```text id="n9j4z2"
QUOTE ACCEPTED
      ↓
ORDER CREATED
```

---

# 22. Admin Dashboard

Your fifth role:

> **Manages products, price lists, discount tiers, warehouses, subscription plans, analytics/reporting.**

Admin dashboard:

```text id="x2h8qs"
ADMIN DASHBOARD
│
├── Overview
├── Products
├── Categories
├── Price Lists
├── Discount Tiers
├── Approval Chains
├── Warehouses
├── Inventory Setup
├── Subscription Plans
├── Users / Roles
├── AI Configuration
└── Platform Analytics
```

---

# 23. Admin Master Data

```text id="k5c3vq"
ADMIN
 │
 ├── Products
 │    ├── SKU
 │    ├── Price
 │    ├── Category
 │    └── Margin
 │
 ├── Price Lists
 │
 ├── Discount Tiers
 │
 ├── Approval Chains
 │
 ├── Warehouses
 │
 └── Subscription Plans
```

These become inputs into the rest of the system.

---

# 24. Admin Analytics

```text id="e7r3xk"
PLATFORM ANALYTICS

Total Revenue            ₹12.8Cr
Total Deals              1,240
Win Rate                  67%
Average Discount           9.2%
Average Margin            25.4%

────────────────────────────

DISCOUNT LEAKAGE

Prevented Margin Loss     ₹42L

────────────────────────────

FULFILLMENT

On Time                  94%
Backorders                3%
```

---

# 25. Now the Critical Part — Rule vs AI vs GenAI vs Agentic

You specifically asked for this.

Use this architecture:

```text id="z3s9n4"
                    DEALFLOW360 INTELLIGENCE
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
    RULE ENGINE           AI / ML                GENAI
       🔵                    🟣                     🟠
   "What is             "What is likely       "What should
    allowed?"             to happen?"          we say?"
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                         AGENTIC AI
                              🟠
                    "What actions should
                     I take?"
```

---

# 26. 🔵 Rule-Based Components

These should be deterministic.

### Pricing

```text
Product price
× quantity
- discount
+ tax
= total
```

### Discount rules

```text
Discount <= allowed threshold
```

### Approval routing

```text
10% → Manager
15% → Manager + Finance
```

### Margin

```text
Revenue - Cost = Margin
```

### Inventory

```text
Available stock >= requested quantity
```

### Billing

```text
Invoice amount
Proration
Tax
Credit note
```

### RBAC

```text
Sales Rep → cannot approve own high-risk deal
Manager → can approve commercial discount
Finance → can approve second-level financial risk
```

**Never delegate these critical calculations to an LLM.**

---

# 27. 🟣 AI / ML Components

AI/ML answers:

> **"What is likely to happen?"**

Use it for:

### Deal Risk Prediction

```text
Deal Risk = 87%
```

### Discount Anomaly

```text
This discount is 2.4×
the salesperson's historical average.
```

### Customer Purchase Probability

```text
Warranty:
82% probability
```

### Deal Stagnation

```text
Deal has 76% probability of becoming stalled.
```

### Fulfillment Risk

```text
Expected delivery delay probability: 68%.
```

### Upsell Recommendation

```text
Recommended Product:
Extended Warranty
```

---

# 28. 🟠 GenAI Components

GenAI answers:

> **"How should I explain or communicate this?"**

### AI Deal Copilot

Salesperson asks:

> "Why is this deal risky?"

GenAI explains the structured risk results.

### Deal Summary

> "ABC Corp is negotiating aggressively, and the proposed discount reduces margin below the target."

### Negotiation Advisor

Customer asks:

> "Give me 5% more discount."

GenAI generates possible responses/options.

### Customer Communication

Generate:

> "We can offer an additional 3% discount if the installation service remains included."

### Natural Language Analytics

Manager asks:

> "Which deals are threatening this month's margin?"

GenAI converts the request into a structured query, gets data, and explains the results.

---

# 29. 🟠 Agentic AI

Agentic AI should be used when the system needs to **perform a multi-step workflow using tools**.

Don't call every AI feature an agent.

### Deal Monitoring Agent

```text
Monitor Deal
    ↓
Detect Risk Change
    ↓
Get Deal Details
    ↓
Check Approval Status
    ↓
Create Notification
```

### Negotiation Agent

```text
Customer Counter Offer
       ↓
Get Customer History
       ↓
Get Pricing Rules
       ↓
Get Margin
       ↓
Generate Options
       ↓
Validate Options
       ↓
Send Recommendation
```

### Fulfillment Agent

```text
Order
 ↓
Check Inventory
 ↓
Check Warehouses
 ↓
Calculate Shipment Options
 ↓
Compare Cost + Delivery
 ↓
Recommend Allocation
```

### Approval Agent

```text
Deal Risk Changed
       ↓
Check Approval Requirements
       ↓
Identify Approver
       ↓
Create Approval Task
       ↓
Notify Approver
```

---

# 30. Agent Safety Architecture

Very important for your project.

Don't allow:

```text
LLM → Direct Database
```

Instead:

```text id="8q0j5y"
                AGENT
                  │
                  ▼
             TOOL GATEWAY
                  │
                  ▼
            RULE VALIDATOR
                  │
                  ▼
             BUSINESS API
                  │
                  ▼
              DATABASE
```

Example:

Agent says:

> "Apply 20% discount."

It **cannot directly change the database**.

It must call:

```text
applyDiscount()
```

The Rule Engine checks:

```text
20% allowed?
NO
```

Then:

> "Approval required."

This makes your architecture much more credible.

---

# 31. Complete Deal Lifecycle

Now put everything together.

```text id="w5f6kj"
                         ADMIN
                           │
                    Configure System
                           │
                           ▼
                 Products / Pricing /
              Discount / Warehouse /
                    Billing Rules
                           │
                           ▼
                      SALES REP
                           │
                           ▼
                    CREATE DEAL
                           │
                           ▼
                  ADD PRODUCTS
                           │
                           ▼
                🔵 PRICING ENGINE
                           │
                           ▼
               🟣 RECOMMENDATION
                           │
                           ▼
                    ADD UPSELL
                           │
                           ▼
                 APPLY DISCOUNT
                           │
                           ▼
                🔵 MARGIN ENGINE
                           │
                           ▼
                  🟣 RISK ENGINE
                           │
                           ▼
                  🟠 AI COPILOT
                           │
                           ▼
              🔵 APPROVAL ENGINE
                           │
                     ┌─────┴─────┐
                     │           │
                  NORMAL       HIGH RISK
                     │           │
                     │           ▼
                     │      SALES MANAGER
                     │           │
                     │      Approve/Reject
                     │           │
                     │           ▼
                     │      FINANCE/OPS
                     │           │
                     └─────┬─────┘
                           ▼
                     CUSTOMER PORTAL
                           │
                   ┌───────┴────────┐
                   │                │
                ACCEPT          NEGOTIATE
                   │                │
                   │                ▼
                   │         🟠 NEGOTIATION
                   │              AGENT
                   │                │
                   │                ▼
                   │          Recalculate
                   │                │
                   │                ▼
                   │          Re-approval
                   │                │
                   └───────┬────────┘
                           ▼
                     FINAL CONFIRM
                           │
                           ▼
                         ORDER
                           │
                           ▼
                  🔵 INVENTORY CHECK
                           │
                           ▼
                FINANCE / OPERATIONS
                           │
                  ┌────────┴────────┐
                  ▼                 ▼
              AVAILABLE         SHORTAGE
                  │                 │
                  ▼                 ▼
             FULFILLMENT         BACKORDER
                  │
                  ▼
             🟠 FULFILLMENT
                AGENT
                  │
                  ▼
            WAREHOUSE SPLIT
                  │
                  ▼
               SHIPMENT
                  │
                  ▼
             🔵 BILLING
                  │
          ┌───────┴────────┐
          ▼                ▼
       ONE-TIME         RECURRING
       INVOICE          BILLING
          │                │
          └───────┬────────┘
                  ▼
               PAYMENT
                  │
                  ▼
             DEAL CLOSED
                  │
                  ▼
             DEAL HEALTH
                  │
                  ▼
              ANALYTICS
```

---

# 32. Event-Driven Architecture

Every important action generates an event.

```text id="s6m2kh"
                     EVENT BUS
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
   SALES EVENTS       AI EVENTS       OPS EVENTS
       │                 │                 │
       ▼                 ▼                 ▼
DealCreated        RiskChanged       InventoryChanged
QuoteCreated       AnomalyFound      ShipmentCreated
DiscountChanged    Recommendation    BackorderCreated
QuoteAccepted      Generated         InvoiceCreated
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
                  NOTIFICATION SERVICE
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
           SALES       MANAGER     FINANCE
```

---

# 33. Backend Microservice/Module Architecture

For a hackathon, you don't need 20 actual microservices.

Use a **modular monolith + AI service** initially.

```text id="f7a2kx"
                    FRONTEND
                  React + Vite
                       │
                       ▼
                 API GATEWAY
                       │
              Spring Boot Backend
                       │
 ┌─────────────────────┼─────────────────────┐
 │                     │                     │
 ▼                     ▼                     ▼
AUTH MODULE        SALES MODULE        CUSTOMER MODULE
 │                     │                     │
 ▼                     ▼                     ▼
RBAC              DEAL MODULE          PORTAL
                       │
                       ▼
                 QUOTATION MODULE
                       │
 ┌─────────────────────┼──────────────────────┐
 ▼                     ▼                      ▼
PRICING             APPROVAL              INVENTORY
MODULE               MODULE                MODULE
 │                     │                      │
 ▼                     ▼                      ▼
MARGIN              GOVERNANCE            FULFILLMENT
                       │                      │
                       └──────────┬───────────┘
                                  ▼
                              BILLING
                                  │
                                  ▼
                              ANALYTICS
```

Separate AI service:

```text id="o5h31y"
Spring Boot
     │
     ├── Deal API
     ├── Pricing
     ├── Approval
     ├── Inventory
     └── Billing
             │
             ▼
         AI SERVICE
         Python/FastAPI
             │
      ┌──────┼───────┐
      ▼      ▼       ▼
    Risk  Recommend  ML
             │
             ▼
          LLM API
```

---

# 34. Database Design

Core tables:

```text id="z9u8ct"
USERS
ROLES
PERMISSIONS
CUSTOMERS

PRODUCTS
PRODUCT_CATEGORIES
PRICE_LISTS
PRICE_LIST_ITEMS

QUOTATIONS
QUOTATION_ITEMS

DISCOUNT_RULES
APPROVAL_RULES
APPROVAL_REQUESTS

DEALS
DEAL_RISK
DEAL_EVENTS
RECOMMENDATIONS
ANOMALIES

NEGOTIATIONS
NEGOTIATION_MESSAGES

WAREHOUSES
INVENTORY
INVENTORY_RESERVATIONS
FULFILLMENTS
SHIPMENTS
BACKORDERS

ORDERS
INVOICES
PAYMENTS
CREDIT_NOTES

SUBSCRIPTION_PLANS
SUBSCRIPTIONS
BILLING_SCHEDULES

NOTIFICATIONS
AUDIT_LOGS
AGENT_ACTIONS
```

---

# 35. Role → Permission Matrix

This is also useful for your presentation.

| Function                 | Sales Rep | Sales Manager | Finance/Ops | Customer |     Admin |
| ------------------------ | --------: | ------------: | ----------: | -------: | --------: |
| Create Deal              |         ✅ |             ✅ |           ❌ |        ❌ |         ❌ |
| Create Quote             |         ✅ |             ✅ |           ❌ |        ❌ |         ❌ |
| Apply Discount           |         ✅ |             ✅ |           ❌ |        ❌ | Configure |
| Approve Discount         |         ❌ |             ✅ |           ✅ |        ❌ | Configure |
| Configure Discount Rules |         ❌ |             ✅ |           ❌ |        ❌ |         ✅ |
| View Deal Health         |       Own |          Team |    Relevant |      Own |       All |
| Negotiate                |         ✅ |      Optional |           ❌ |        ✅ |         ❌ |
| Warehouse Split          |      View |          View |           ✅ |     View | Configure |
| Backorder                |         ❌ |             ❌ |           ✅ |     View | Configure |
| Billing                  |      View |          View |           ✅ |     View | Configure |
| Credit Note              |         ❌ |             ❌ |           ✅ |  Request | Configure |
| Products                 |      View |          View |        View |     View |  ✅ Manage |
| Price Lists              |      View |          View |        View |     View |  ✅ Manage |
| Analytics                |       Own |          Team | Finance/Ops |      Own |  Platform |

---

# 36. The Four Intelligence Layers in Your Presentation

I would put this exact concept on a slide:

```text id="j6t1g8"
┌─────────────────────────────────────────────┐
│             DEALFLOW360 BRAIN               │
├─────────────────────────────────────────────┤
│                                             │
│ 🔵 RULE ENGINE                              │
│ Pricing • Discount • Approval • Billing     │
│                                             │
│ 🟣 AI / ML                                  │
│ Risk • Anomaly • Prediction • Upsell        │
│                                             │
│ 🟠 GENAI                                    │
│ Copilot • Explanation • Negotiation         │
│                                             │
│ 🟠 AGENTIC AI                               │
│ Deal Agent • Approval Agent • Fulfillment   │
│ Agent • Negotiation Agent                   │
│                                             │
└─────────────────────────────────────────────┘
```

### One-line explanation:

**Rule Engine decides what is allowed.**
**AI predicts what will happen.**
**GenAI explains/recommends what to do.**
**Agents execute multi-step actions through controlled tools.**

---

# 37. The Most Important End-to-End Demo

For your actual presentation, I would demonstrate **one deal across all five roles**:

```text id="c2t7vz"
ADMIN
 │
 │ configures 10% discount limit
 ▼
SALES REP
 │
 │ creates ₹50L quote
 │ adds AI upsell
 │ applies 18% discount
 ▼
RISK ENGINE
 │
 │ detects high risk
 ▼
SALES MANAGER
 │
 │ reviews + approves
 ▼
CUSTOMER
 │
 │ counters with additional 5%
 ▼
NEGOTIATION AI
 │
 │ recommends alternative
 ▼
SALES MANAGER
 │
 │ re-approves
 ▼
FINANCE / OPS
 │
 │ checks high-risk financial impact
 │ optimizes warehouse split
 ▼
FULFILLMENT
 │
 │ ships from Mumbai + Pune
 ▼
BILLING
 │
 │ hardware invoice
 │ + recurring subscription
 ▼
CUSTOMER
 │
 │ confirms / pays
 ▼
DEAL CLOSED
 │
 ▼
DEAL HEALTH
 │
 ▼
ADMIN / MANAGER ANALYTICS
```

**That is your complete DealFlow360 story.**

And the strongest architectural message is:

> **One deal, five roles, one shared deal state, four intelligence layers, and an event-driven workflow from quotation to negotiation to fulfillment to billing.**


# DealFlow360: Intelligent Self-Governing Sales Operations Platform
## Implementation & Architecture Plan

DealFlow360 transforms traditional passive quotation and sales operations into a **self-governing, event-driven B2B deal engine**. The platform continuously analyzes margin, discount risk, inventory reality, and customer negotiation behavior—automatically enforcing business guardrails, recommending value-maximizing actions, coordinating warehouse fulfillment, and managing hybrid billing schedules.

---

## 1. System Architecture & Component Design

The platform operates on **three distinct, cooperating layers**:
1. **Deterministic Business Engine**: Enforces mathematical precision for pricing, discount ceilings, multi-warehouse splitting, and hybrid billing/proration.
2. **Deal Intelligence Engine**: Computes Deal DNA, multi-dimensional risk scores, affinity-based recommendations, and tactical negotiation counter-proposals.
3. **Autonomous Event Loop**: Listens to state transitions (discount modified, customer counter-offered, inventory changed, quote stalled) and triggers recalculation, re-approval routing, and alert nudges.

```text
                                DEALFLOW360 ARCHITECTURE
                                
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │   INTERNAL SALES WORKSPACE    │               │   CUSTOMER NEGOTIATION PORTAL │
       │  (Sales Rep, Manager, Finance)│               │    (Secure Magic Token Link)  │
       └───────────────┬───────────────┘               └───────────────┬───────────────┘
                       │                                               │
                       ▼                                               ▼
       ┌───────────────────────────────────────────────────────────────────────────────┐
       │                          REST API & REAL-TIME GATEWAY                         │
       │                   FastAPI / JWT Auth / Role-Based Security                    │
       └───────────────────────────────────────┬───────────────────────────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │  DETERMINISTIC BUSINESS LAYER │               │     DEAL INTELLIGENCE LAYER   │
       │                               │               │                               │
       │ • Dynamic Pricing Engine      │◄─────────────►│ • Deal DNA Profiler           │
       │ • Tier & Category Ceilings    │               │ • Blended Risk Engine (0-100) │
       │ • Approval Chain Router       │               │ • Hybrid Recommendation Engine│
       │ • Multi-Warehouse Optimizer   │               │ • Negotiation Advisor         │
       │ • Hybrid Billing & Proration  │               │ • Anomaly & Sentry Watcher    │
       │ • Audit Trail Logger          │               │ • "Why?" Explainability Graph │
       └───────────────┬───────────────┘               └───────────────┬───────────────┘
                       │                                               │
                       └───────────────────────┬───────────────────────┘
                                               ▼
       ┌───────────────────────────────────────────────────────────────────────────────┐
       │                         PERSISTENCE & REPOSITORIES                            │
       │           Relational Storage (SQLite/PostgreSQL) + Seed Database              │
       └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Winning & Unique Differentiators (Beyond the Problem Statement)

To guarantee a hackathon-winning project, DealFlow360 introduces 5 high-impact innovations on top of the original PS requirements:

1. **Deal DNA 🧬 Profile**:
   A 5-dimensional holistic score (Commercial, Behavioral, Operational, Financial, Risk) updated in real time with every keystroke, replacing flat numbers with an intuitive biological deal health signature.
2. **AI Deal Copilot & Real-Time Margin Guardian 🛡️**:
   A live interactive sidebar during quotation creation that computes margin impact, flags category-specific breaches instantly, and surfaces explainable upsell suggestions with projected margin deltas.
3. **"What Changed?" Visual Impact Diff & Negotiation Advisor 🤝**:
   When a customer counters in the portal, the system generates a visual before-and-after diff (Revenue $\Delta$, Margin $\Delta$, Risk $\Delta$) and produces **3 tactical counter-options (Pareto-optimal packages)** for the sales rep instead of a simple accept/reject.
4. **Interactive "What-If" Deal Simulator Sandbox 🎛️**:
   A live interactive sandbox where reps or managers can drag discount sliders, toggle warehouse locations, or adjust subscription lengths to preview Deal Health, shipping costs, and required approval chains *before* committing.
5. **Conditional Approvals ("Approve with Condition") ✍️**:
   Managers can approve deals contingent on specific business constraints (e.g. "Approved only if annual upfront payment is retained" or "Approved only if installation service remains"). The engine validates compliance before the order can close.

---

## 3. Data Model & Relational Schema

The database is partitioned into 6 clean domains:

### 1. Identity & RBAC
- `User`: `id`, `email`, `name`, `password_hash`, `role` (`SALES_REP`, `SALES_MANAGER`, `FINANCE_USER`, `ADMIN`), `team`, `historical_avg_discount`
- `Customer`: `id`, `name`, `email`, `company`, `tier` (`BRONZE`, `SILVER`, `GOLD`), `payment_terms`, `negotiation_rating`

### 2. Catalog & Governance
- `Product`: `id`, `sku`, `name`, `category` (`HARDWARE`, `SERVICE`, `SUBSCRIPTION`), `unit_price`, `cost_price`, `tax_rate`, `unit_of_measure`, `is_promoted`
- `ProductVariant`: `id`, `product_id`, `attribute_name` (e.g., RAM, Duration), `attribute_value`, `price_delta`
- `DiscountRule`: `id`, `customer_tier`, `product_category`, `max_discount_pct` (e.g., Gold Hardware = 15%, Gold Service = 10%)
- `ApprovalRule`: `id`, `risk_min`, `risk_max`, `required_roles` (e.g., [SALES_MANAGER], [SALES_MANAGER, FINANCE_USER])

### 3. Quotation & Deal Flow
- `Quotation`: `id`, `quote_number`, `customer_id`, `sales_rep_id`, `status` (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `SENT_TO_CUSTOMER`, `UNDER_NEGOTIATION`, `RE_APPROVAL_REQUIRED`, `CONFIRMED`, `CANCELLED`), `total_gross`, `total_discount`, `total_net`, `gross_margin_pct`, `deal_health_score`, `blended_risk_score`, `magic_token`, `last_activity_at`
- `QuotationItem`: `id`, `quotation_id`, `product_id`, `variant_id`, `quantity`, `unit_price`, `cost_price`, `discount_pct`, `line_total`, `line_margin_pct`, `billing_type` (`ONE_TIME`, `RECURRING`), `subscription_plan_id`
- `NegotiationThread`: `id`, `quotation_id`, `author_type` (`CUSTOMER`, `SALES_REP`), `author_name`, `message`, `line_item_id`, `counter_discount_pct`, `created_at`
- `ApprovalRecord`: `id`, `quotation_id`, `step_index`, `approver_role`, `approver_user_id`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`), `reason`, `condition_text`, `decided_at`
- `AuditLog`: `id`, `quotation_id`, `user_id`, `user_name`, `action`, `details_json`, `timestamp`

### 4. Operations & Warehouse Fulfillment
- `Warehouse`: `id`, `name`, `code`, `location`, `base_shipping_cost`, `per_unit_shipping_cost`
- `Inventory`: `id`, `warehouse_id`, `product_id`, `stock_on_hand`, `stock_reserved`, `reorder_point`
- `FulfillmentPlan`: `id`, `quotation_id`, `total_shipments`, `estimated_shipping_cost`, `status` (`PROPOSED`, `ACCEPTED`, `DISPATCHED`, `COMPLETED`)
- `FulfillmentSplit`: `id`, `fulfillment_plan_id`, `warehouse_id`, `product_id`, `quantity_fulfilled`, `shipment_number`, `is_backorder`

### 5. Hybrid Billing & Subscriptions
- `SubscriptionPlan`: `id`, `name`, `billing_frequency` (`MONTHLY`, `QUARTERLY`, `YEARLY`), `discount_incentive_pct`
- `Order`: `id`, `quotation_id`, `order_number`, `confirmed_at`, `status`
- `Invoice`: `id`, `order_id`, `invoice_type` (`ONE_TIME`, `RECURRING_SCHEDULE`, `CREDIT_NOTE`), `amount`, `tax_amount`, `status` (`DRAFT`, `SENT`, `PAID`, `OVERDUE`), `due_date`, `paid_at`
- `BillingSchedule`: `id`, `order_id`, `quotation_item_id`, `installment_number`, `period_start`, `period_end`, `amount`, `status` (`SCHEDULED`, `BILLED`, `PAID`)
- `ProrationEvent`: `id`, `quotation_item_id`, `previous_quantity`, `new_quantity`, `effective_date`, `prorated_adjustment_amount`

---

## 4. Algorithmic Specifications

### A. Blended Discount Risk Score ($\mathcal{R}_{deal}$)
The blended risk score guarantees that reps cannot game the system by distributing discounts across lines while keeping each line marginally below individual ceilings.

$$\mathcal{R}_{deal} = \min\left(100, \; 35 \cdot \frac{M_{excess}}{0.15} + 30 \cdot \frac{E_{total}}{0.10 \cdot V_{total}} + 20 \cdot \mathcal{A}_{rep} + 15 \cdot \mathcal{M}_{penalty}\right)$$

Where:
- $L_i = \min(\text{Ceiling}(Tier, Cat_i), \text{Ceiling}(Cat_i))$
- Line violation: $\Delta_i = \max(0, D_i - L_i)$
- Maximum single line violation: $M_{excess} = \max_i (\Delta_i)$
- Total excess discount monetary value: $E_{total} = \sum (\Delta_i \cdot \text{GrossValue}_i)$
- Rep Anomaly $\mathcal{A}_{rep} = \max\left(0, \frac{D_{avg} - \bar{D}_{rep}}{\bar{D}_{rep}}\right)$
- Margin Penalty $\mathcal{M}_{penalty} = \max\left(0, \frac{0.25 - \text{Margin}_{deal}}{0.25}\right)$

**Governance Routing Thresholds**:
* $\mathcal{R}_{deal} \le 30$ AND $M_{excess} = 0$: **Auto-Approve (Direct to Fulfillment/Send)**
* $30 < \mathcal{R}_{deal} \le 65$ OR $0 < M_{excess} \le 5\%$: **Level 1: Sales Manager Approval**
* $\mathcal{R}_{deal} > 65$ OR $M_{excess} > 5\%$ OR $\text{Margin} < 15\%$: **Level 2: Dual Approval (Sales Manager $\rightarrow$ Finance Operations)**

### B. Hybrid Recommendation Scoring ($S_{rec}$)
Recommendations balance historical affinity, margin health, and promotional campaigns:

$$S_{rec}(p) = 0.40 \cdot \text{Affinity}(p, \text{Cart}) + 0.25 \cdot \text{MarginScore}(p) + 0.20 \cdot \text{PromoBoost}(p) + 0.15 \cdot \text{StockAvail}(p)$$

- Filters out any candidate product whose unit margin is below the Admin-configured minimum margin threshold ($20\%$).
- Explains the decision: e.g. *"78% co-purchase affinity with Laptop + Active Q3 Promotion (+4.2% margin lift)"*.

### C. Multi-Warehouse Optimization
Given required line quantities $\{q_i\}$, the engine optimizes:

$$\min \sum_{w \in W_{selected}} \left( \text{BaseShipCost}_w + \sum_i q_{i,w} \cdot \text{UnitCost}_w \right) + \lambda \cdot |W_{selected}|$$

1. First seeks a **0-split warehouse** capable of fulfilling $100\%$ of items.
2. If none, searches 2-warehouse combinations that minimize total shipment count and freight charges.
3. Automatically reserves available stock, flags remaining shortages as **Backorders**, and triggers an automated *"Consolidate Remaining Backorder"* notification upon replenishment.

### D. Hybrid Billing & Proration Calculation
For mid-cycle subscription changes (e.g. seat changes on Day $d$ of a $D$-day billing cycle):

$$\text{Adjustment} = \Delta \text{Qty} \times \text{Unit Price} \times \left(\frac{D - d}{D}\right)$$

- Upgrades trigger an immediate prorated supplemental invoice.
- Downgrades trigger an automatic Credit Note or reduction on the subsequent cycle schedule.

---

## 5. User Roles & Experiences

| Role | Core Capabilities |
| :--- | :--- |
| **Sales Rep** | Builds quotes, reviews AI recommendations, views live Deal DNA & margin indicators, submits for approval, tracks deal health, reviews customer counter-offers. |
| **Sales Manager** | Configures discount ceilings & approval policies, reviews pending Level 1 quotes, executes "Approve with Condition", reviews Deal Health Center anomalies. |
| **Finance / Ops** | Handles Level 2 high-risk approvals, inspects warehouse split recommendations, overrides fulfillment, verifies recurring schedules & credit notes. |
| **Customer (Portal)** | Accesses quotes via magic link (read-only sensitive cost data), submits line comments, inputs counter-discount proposals, confirms quotation with 1 click. |
| **Admin** | Manages master products, customer tiers, warehouses, recurring plans, co-purchase pairing matrices, and platform-wide exportable analytics. |

---

## 6. End-to-End Demo Script (The Winning 7-Scene Story)

To blow away the judges, the live demonstration follows the persona of **TechNova Global** buying enterprise hardware and SaaS:

* **Scene 1 (AI Deal Copilot in Action)**: Rep selects 50 Laptops + 50 Monitors. Copilot immediately surfaces: *"TechNova frequently purchases Extended Warranty & Pro Setup. Adding these increases deal margin by +4.2%."* Rep clicks `[Add to Quote]`. Total and margin immediately increase.
* **Scene 2 (Margin Guardian & Blended Violation)**: Rep applies an aggressive 18% discount to Setup Service (Service ceiling is 10%, even though customer is Gold). Margin Guardian triggers: Deal Health drops to 🔴 38%, Risk Score jumps to 79. Approval chain dynamically updates to require **Sales Manager + Finance Dual Approval**.
* **Scene 3 (Manager Review & Conditional Approval)**: Manager logs in, opens Deal Health Center, inspects ABC Corp / TechNova alert with full "Why?" explainability breakdown, and approves with condition: *"Approved on condition that 1-year Pro Support is retained."*
* **Scene 4 (Smart Multi-Warehouse Split)**: Fulfillment engine detects Mumbai has 30 laptops and Pune has 20. Recommends a 2-warehouse split with exact freight cost breakdown. Rep accepts split.
* **Scene 5 (Hybrid Billing Generation)**: System generates instant one-time hardware invoice (₹15,00,000) and an automated 12-month recurring SaaS schedule (₹50,000/mo).
* **Scene 6 (Customer Portal & Counter Negotiation)**: Customer opens magic portal link. Requests an additional 5% discount. System instantly detects deal deterioration, updates status to `RE_APPROVAL_REQUIRED`, and Negotiation Advisor computes 3 smart counter-offers for the rep.
* **Scene 7 (Final Close & Payment)**: Customer accepts Counter-Option B. One-click confirmation converts quote to confirmed Order, records initial payment, and updates Deal Health to 🟢 Closed.

---

## 7. Deliverables & Hackathon Criteria Mapping

- [x] **Working Application (Backend + Frontend)**: Full-stack implementation with rich seed data ready for immediate execution.
- [x] **5-Minute Live Demo Walkthrough**: Structured 7-scene narrative covering both one-time + subscription and negotiation + approval flows end-to-end.
- [x] **One-Page Architecture & Data Flow Diagram**: Visual diagram embedded in documentation and UI.
- [x] **Future Roadmap ("What We Would Build Next")**: Multi-currency dynamic hedging, autonomous SLA supplier re-routing, and CRM CRM/ERP bidirectional sync.
- [x] **Interactive Test Flow (All 8 PS Checkpoints)**: Verified against the problem statement test checklist.

---

## 8. Proposed Project Directory Structure

```text
odoo_final/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entry point & CORS
│   │   ├── config.py                   # App configuration & JWT secret
│   │   ├── database.py                 # SQLite/PostgreSQL engine & session
│   │   ├── models/                     # SQLAlchemy models for all 6 domains
│   │   │   ├── auth.py
│   │   │   ├── catalog.py
│   │   │   ├── quotation.py
│   │   │   ├── fulfillment.py
│   │   │   ├── billing.py
│   │   │   └── audit.py
│   │   ├── schemas/                    # Pydantic schemas for request/response
│   │   ├── services/                   # Core business & AI engines
│   │   │   ├── pricing_service.py      # Pricing, margin, ceilings
│   │   │   ├── risk_engine.py          # Blended risk & Deal DNA scoring
│   │   │   ├── recommendation_service.py# Level 1-3 hybrid upsell engine
│   │   │   ├── fulfillment_service.py  # Multi-warehouse optimizer & backorders
│   │   │   ├── billing_service.py      # Split billing, schedules, proration
│   │   │   ├── negotiation_service.py  # Diff engine & Negotiation Advisor
│   │   │   └── audit_service.py        # Event logger
│   │   ├── routes/                     # REST API endpoints
│   │   │   ├── auth_routes.py
│   │   │   ├── catalog_routes.py
│   │   │   ├── quotation_routes.py
│   │   │   ├── approval_routes.py
│   │   │   ├── fulfillment_routes.py
│   │   │   ├── billing_routes.py
│   │   │   ├── portal_routes.py        # Customer portal restricted endpoints
│   │   │   ├── analytics_routes.py
│   │   │   └── simulator_routes.py     # "What-If" sandbox endpoints
│   │   └── seed_data.py                # Rich seed data for TechNova demo
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── App.jsx                     # Route definitions & Role Switcher
│   │   ├── context/AuthContext.jsx     # User session & role switcher
│   │   ├── api/client.js               # Axios / Fetch client
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Navigation & quick role switch
│   │   │   ├── DealCopilot.jsx         # Live Copilot & Margin Guardian
│   │   │   ├── DealDnaBadge.jsx        # Visual 5-dimensional DNA radar/badge
│   │   │   ├── UpsellPanel.jsx         # Live recommendation cards
│   │   │   ├── WhatChangedDiff.jsx     # Negotiation comparison view
│   │   │   ├── NegotiationAdvisor.jsx  # Smart counter-offer cards
│   │   │   ├── WarehouseSplitModal.jsx # Fulfillment optimization view
│   │   │   └── AuditTimeline.jsx       # Event & approval audit history
│   │   └── pages/
│   │       ├── Dashboard.jsx           # Deal Health Center & Anomaly alerts
│   │       ├── PipelineKanban.jsx      # Visual deal stages
│   │       ├── QuotationBuilder.jsx    # Cart, pricing, live margin
│   │       ├── ApprovalsHub.jsx        # Manager & Finance approval queue
│   │       ├── FulfillmentHub.jsx      # Multi-warehouse status & backorders
│   │       ├── BillingHub.jsx          # Hybrid billing, schedules & proration
│   │       ├── CustomerPortal.jsx      # Customer negotiation screen (magic link)
│   │       ├── BackendConfig.jsx       # Admin settings: tiers, rules, stock
│   │       ├── DealSimulator.jsx       # Interactive "What-If" sandbox
│   │       └── ReportsAnalytics.jsx    # Exportable charts (PDF/Excel)
└── README.md                           # Architecture diagram & quickstart guide
```

---

## 9. Verification Plan

### Automated Verification
1. **Engine Test Suite**: Run backend unit tests verifying:
   - Category vs. customer tier discount ceiling enforcement.
   - Blended risk score calculation and multi-line violation detection.
   - Single-warehouse vs. multi-warehouse split cost minimization.
   - Prorated billing calculations on mid-cycle subscription changes.
   - Portal counter-offer re-routing to approval chain.

### End-to-End Scenario Verification
1. Execute the 8-step walkthrough from the PS PDF.
2. Verify customer portal security (ensuring cost prices and internal risk scores are never leaked in portal endpoints).
3. Test edge cases: 100% discount, zero inventory across all warehouses, multiple mid-cycle quantity updates.


