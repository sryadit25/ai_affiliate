# Auth Domain Documentation

**Single source of truth for authentication & account documentation.**

---

## Overview
Authentication flows, session management, account recovery, and multi-user workspace isolation.

## Files

| File | Description |
|------|-------------|
| [`PR82A_AUTH_RECOVERY_RELIABILITY.md`](./PR82A_AUTH_RECOVERY_RELIABILITY.md) | Auth recovery reliability improvements |

---

## Cross-References (ICM)

| Reference | Purpose |
|-----------|---------|
| [`../agents.md`](../agents.md#autentikasi-dan-alur-akun) | Area map: Auth & account flows |
| [`../context.md`](../context.md#batasan-produk) | Product constraints: Auth & RLS |
| [`../ICM_METHODOLOGY.md`](../ICM_METHODOLOGY.md) | Documentation conventions |
| [`../../app/login/`](../../app/login/) | Login route implementation |
| [`../../app/register/`](../../app/register/) | Registration route implementation |
| [`../../app/api/auth/`](../../app/api/auth/) | Auth API endpoints |
| [`../../lib/server-auth.ts`](../../lib/server-auth.ts) | Server auth utilities |
| [`../../lib/supabase-browser.ts`](../../lib/supabase-browser.ts) | Browser Supabase client |

---

*Follows [ICM Methodology](../ICM_METHODOLOGY.md) — all links relative to project root.*