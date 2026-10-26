# Payments Domain Documentation

**Single source of truth for payments, billing & payout documentation.**

---

## Overview
Payment processing, subscription billing, token wallet, affiliate payouts, and integration with payment gateways.

## Files

| File | Description |
|------|-------------|
| [`PR78C_E2E_GUARDRAIL.md`](./PR78C_E2E_GUARDRAIL.md) | End-to-end payment guardrails |

---

## Cross-References (ICM)

| Reference | Purpose |
|-----------|---------|
| [`../agents.md`](../agents.md#pembayaran-langganan-atau-pencairan) | Area map: Payments, subscriptions, payouts |
| [`../context.md`](../context.md#batasan-produk) | Product constraints: Server-side payments |
| [`../ICM_METHODOLOGY.md`](../ICM_METHODOLOGY.md) | Documentation conventions |
| [`../../app/api/payments/`](../../app/api/payments/) | Payments API routes |
| [`../../app/api/subscriptions/`](../../app/api/subscriptions/) | Subscriptions API routes |
| [`../../app/api/integrations/`](../../app/api/integrations/) | Integrations API routes |
| [`../../lib/payment-gateway.ts`](../../lib/payment-gateway.ts) | Payment gateway abstraction |
| [`../../lib/server-secrets.ts`](../../lib/server-secrets.ts) | Server-side secrets management |

---

*Follows [ICM Methodology](../ICM_METHODOLOGY.md) — all links relative to project root.*