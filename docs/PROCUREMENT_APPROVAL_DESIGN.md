# Procurement approval workflow — design specification (v1)

**Status:** Frozen for implementation (Phase 3).  
**Last updated:** 2026-06-14

This document is the single source of truth for purchase-order approval before issue. Bill, transfer, and sales approval are explicitly deferred unless noted.

---

## 1. Scope (v1)

| Document | v1 | Notes |
|----------|----|-------|
| Purchase order (issue) | **In scope** | Primary workflow |
| Vendor bill (AP post) | **Out of v1** | Bills use three-way match / PPV hold instead |
| Stock transfer (dispatch) | **Deferred** | Reuse same pattern in a later wave |
| Sales order | **Deferred** | Sales UI not shipped |

---

## 2. Trigger rules

Stored in `workspace_control_registry` under `registry_key = 'APPROVAL_SETTINGS'`, `scope_level = 'TENANT_GLOBAL'`.

```json
{
  "require_po_approval_before_issue": false,
  "po_approval_threshold_amount": null,
  "allow_submitter_self_approve_below_threshold": false,
  "po_approver_user_ids": []
}
```

| Rule | Behavior |
|------|----------|
| `require_po_approval_before_issue = false` | Current behavior: draft → Issue → `ISSUED_ACTIVE` |
| `require_po_approval_before_issue = true`, threshold null | Every PO must be submitted and approved before issue |
| Threshold set (NUMERIC) | POs with `total_net_amount <= threshold` may skip approval **only if** self-approve flag is true and submitter is in approver list; otherwise approval required |
| Approver list empty | OWNER role users may approve; configured `po_approver_user_ids` are additional approvers |

---

## 3. State machine

Uses existing `purchase_document_status` enum.

```
DRAFT
  │ submit_for_approval (when policy requires)
  ▼
PENDING_APPROVAL
  │ approve ──────────────────► ISSUED_ACTIVE (via issue_purchase_order after approval record)
  │ reject ───────────────────► DRAFT (with rejection reason in approval request)
  │
  │ cancel (from DRAFT or PENDING_APPROVAL)
  ▼
CANCELLED
```

**Rejection:** Returns PO to `DRAFT`. Submitter may edit and re-submit. Rejection reason stored on `document_approval_requests.decision_notes`.

**Direct issue (policy off):** `issue_purchase_order` from `DRAFT` unchanged.

**Approved issue:** After `approve_purchase_order`, status remains `PENDING_APPROVAL` until `issue_purchase_order` runs (auto-chained on approve in RPC) → `ISSUED_ACTIVE`.

---

## 4. Actors

| Role | Capabilities |
|------|----------------|
| Submitter | Any user with `can_edit_purchase_orders()` |
| Approver | OWNER **or** user id in `po_approver_user_ids` |
| Self-approve | Only when policy allows and amount ≤ threshold |

Delegate grant pattern mirrors organization settings delegates (`grantOrganizationSettingsDelegate`).

---

## 5. Audit model

New table `document_approval_requests` (pending workflow). Existing `document_approvals` records **completed** approval decisions.

### `document_approval_requests`

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | PK |
| tenant_id | UUID | RLS |
| document_type | TEXT | `PURCHASE_ORDER` v1 |
| document_id | UUID | PO id |
| status | TEXT | `PENDING`, `APPROVED`, `REJECTED` |
| submitted_by | UUID | User |
| submitted_at | TIMESTAMPTZ | |
| decided_by | UUID | Nullable until decided |
| decided_at | TIMESTAMPTZ | |
| decision_notes | TEXT | Rejection reason or approver comment |

On **approve:** insert row into `document_approvals` (approved_by, approved_at, notes) for GL backpost compatibility.

---

## 6. RPCs (Phase 3)

| RPC | Purpose |
|-----|---------|
| `submit_purchase_order_for_approval(p_purchase_order_id)` | DRAFT → PENDING_APPROVAL |
| `approve_purchase_order(p_purchase_order_id, p_notes)` | PENDING → approve + chain issue |
| `reject_purchase_order(p_purchase_order_id, p_notes)` | PENDING → DRAFT |
| `issue_purchase_order` (modified) | Refuse if policy requires approval and status ≠ approved path |

Posting steps: `po_submitted_for_approval`, `po_approved`, `po_rejected`.

---

## 7. Dashboard

- **Badge:** Count POs in `PENDING_APPROVAL` (existing query).
- **Queue panel:** New section on `/dashboard` or `/procurement/purchase-orders?status=PENDING_APPROVAL` — clickable rows for approvers.

---

## 8. Settings UI wireframe

Location: `/settings/modules/procurement?tab=approvals`

```
┌─────────────────────────────────────────────────────────────┐
│ Procurement settings › Approvals                            │
├─────────────────────────────────────────────────────────────┤
│ [Switch] Require approval before issuing purchase orders    │
│                                                             │
│ Approval threshold (optional)     [________] base currency │
│   POs at or below this amount may skip approval when        │
│   self-approve is enabled.                                  │
│                                                             │
│ [Switch] Allow submitter to self-approve below threshold    │
│                                                             │
│ Approvers                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Name          Email              [Revoke]               │ │
│ │ Jane Owner    owner@…            —                        │ │
│ │ Bob Buyer     bob@…              [Revoke]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ [Grant approver…]                                           │
│                                                             │
│ Workflow preview                                            │
│   Draft → Submit → Pending approval → Approved → Issued   │
└─────────────────────────────────────────────────────────────┘
```

Implemented in: `apps/web/components/settings/modules/procurement-approvals-panel.tsx`

---

## 9. Decision log (frozen)

| Question | Decision |
|----------|----------|
| Bills require approval before AP GL? | **No** — match status / PPV hold gates posting |
| Submitter self-approve below threshold? | **Optional** — off by default |
| Notifications v1? | **In-app only** — dashboard badge + PO list filter |
| Multi-level approval chains? | **Deferred** — single approver v1 |

---

## 10. Exit criteria

- [x] This document reviewed and treated as frozen
- [ ] Phase 3 implementation matches sections 2–7
