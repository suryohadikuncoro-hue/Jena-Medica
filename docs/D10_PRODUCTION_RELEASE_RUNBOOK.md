# D-10 Production Release Runbook

**Status:** preparation only; not executed against Production.  
**Date prepared:** 21 October 2026.  
**Project:** Supabase `sjiezdyxylwvqessyvml`.  
**Decision references:** D-09, D-10, D-11 in `PRODUCT_SPEC.md`.

## 1. Verified preflight state

Read-only inspection of the Production project found:

- Migration history contains 10 entries, ending with `20261017185346_d10_invoice_from_sales_order_drop_shipment_module`.
- The migration archive for that applied migration now uses the matching version ID. Its SQL blob is unchanged.
- The current `sales_invoices` table has `sales_order_id` and no `shipment_id`; `sales_invoice_lines` has `sales_order_line_id` and no `shipment_line_id`.
- `shipments`, `shipment_lines`, and `shipment_status_events` were not returned by the current public-table inventory.
- `sales_invoices` and `sales_invoice_lines` currently have zero rows.
- `create_customer_invoice(uuid,date,text,jsonb)` exists. Its current definition hash is `39edff37c6690fd5bd50be77560df541`; it does not yet include the cumulative-value guard introduced in migration `20261021170000`.
- `update_customer_invoice_draft(uuid,date,text,jsonb)` was not found in the remote function inventory.
- The four follow-up migrations below are in GitHub but are not recorded in remote migration history.

The base migration is therefore recorded and its main table shape is consistent with D-09/D-10. The missing draft-edit RPC and create-path value cap are expected follow-up work, not a reason to re-run the already-applied base migration.

## 2. Migration order

Apply each migration once, in this exact order, only after explicit release approval:

1. `20261020042000_d10_auto_draft_edit.sql` — one draft per SO, editable draft RPC, auto-draft trigger on SO confirmation.
2. `20261021152000_d10_invoice_lock_order.sql` — consistent SO-first lock order for draft edits.
3. `20261021160000_d10_invoice_value_cap.sql` — cumulative value guard for draft edits.
4. `20261021170000_d10_create_invoice_value_cap.sql` — cumulative value guard for invoice creation.

Do **not** reapply `20261017185346_d10_invoice_from_sales_order_drop_shipment_module.sql`; it is already in remote history. Do not edit the contents of any migration already applied.

## 3. Static review findings

- The create path locks the sales order before reading prior invoice quantities/values and locking sales-order lines.
- The final quantity allocation uses the remaining SO-line value to avoid exceeding the line total due to rounding.
- Invoices with status `void` are excluded from active cumulative quantity/value.
- The draft-edit RPC was changed to lock the SO before locking the invoice, aligning with the create path.
- Existing cumulative value above the SO line total is treated as a reconciliation error and blocks additional invoice creation/editing.
- The unique partial index permits at most one invoice with status `draft` per SO; issued invoices may be split across multiple invoices.
- Current invoice tables are empty, so the draft uniqueness migration has no existing invoice rows to conflict with in the observed snapshot.

This is static SQL review only. It is not evidence that PL/pgSQL compiled successfully or that concurrency, rounding, role permissions, and UI flows passed runtime tests.

## 4. Required validation before Production application

### A. Before applying migrations

- Confirm the current `main` commit and all four migration file hashes.
- Recheck remote migration history; stop if any version is already recorded or the state differs from this runbook.
- Verify `sales_invoices` and `sales_invoice_lines` row counts and the presence of the expected base-schema columns.
- Verify there are no existing duplicate draft invoices per SO.
- Run `npm run lint`, `npm run build`, and `npm run build:worker` on the exact application commit intended for release.
- Do not test by creating fake invoices or SOs in Production.

### B. Apply the four migrations

- Apply one migration at a time in the listed order using the approved Supabase migration procedure.
- Stop immediately on any SQL error; do not skip a failed migration or manually insert a migration-history record.
- After each successful application, verify its version appears once in migration history.
- Keep the application release coordinated with the schema release so the application is not left calling RPCs that are not yet present.

### C. Read-only post-migration verification

Verify all of the following before enabling the new flow:

- Migration history has all four new versions, in order.
- `create_customer_invoice(uuid,date,text,jsonb)` exists and includes quantity and cumulative-value guards.
- `update_customer_invoice_draft(uuid,date,text,jsonb)` exists, has the SO-first lock order, and includes cumulative quantity/value guards.
- The unique partial index `sales_invoices_one_draft_per_so_uq` exists.
- The trigger `sales_orders_create_customer_invoice_on_confirmation` exists and calls `app_private.create_draft_customer_invoice_on_so_confirmation()`.
- Shipment tables, shipment RPCs, and shipment-trigger dependencies remain absent; payment tables and payment rows remain intact.
- RLS, policies, function grants, and the PostgREST schema cache are verified.
- Invoice and payment row counts reconcile with the pre-release snapshot; no test rows were created in Production.

### D. Runtime/UAT tests

Run these in an isolated test environment, not Production:

1. Confirming an SO creates exactly one draft; retrying/confirming again does not create another.
2. Editing a draft preserves snapshots and rejects invalid lines, duplicate SO-line IDs, zero/negative quantities, and excessive decimals.
3. Two partial invoices can be issued sequentially while total active quantity and value remain within each SO line.
4. A final partial allocation receives the remaining SO-line value without rounding overrun.
5. A void invoice is excluded from cumulative caps.
6. Concurrent create/edit requests for the same SO serialize without over-invoicing or deadlock.
7. Viewer cannot create/edit invoices; Owner/Admin can.
8. Draft creation/editing does not issue an invoice, create receivables, or create accounting journals.
9. Issuance/posting continues only through the existing guarded workflow.
10. Customer/supplier payment tables and records remain unchanged.

## 5. Release gate and rollback posture

- This runbook does not authorize Production DDL or deployment.
- The base D-09/D-10 migration includes destructive removal of shipment objects/data, but it is already recorded in Production; **do not replay it**.
- The four follow-up migrations replace RPC definitions and add a partial unique index. They do not intentionally rewrite existing business rows.
- If a follow-up migration fails, stop and inspect the transaction/error. Do not continue to later migrations.
- If a post-release RPC or UI check fails, disable the new invoice flow or roll back the application release as appropriate. Do not casually roll back schema migrations or delete invoice/payment data; prepare a forward-fix migration if schema has already changed.
- Do not call the system Production-ready until migration verification, build checks, isolated runtime tests, and Owner/Admin/Viewer UAT pass.

## 6. Validation status at preparation time

| Check | Status |
|---|---|
| Remote migration history | Read-only verified |
| Base schema inventory | Read-only verified |
| Four follow-up migration SQL | Static review completed |
| SQL execution/PLpgSQL compilation | Not run |
| Lint/build/build:worker | Not run |
| Runtime concurrency/rounding tests | Not run |
| UI role-based UAT | Not run |
| Production migrations/deployment | Not performed |
