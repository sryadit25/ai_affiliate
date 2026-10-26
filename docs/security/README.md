# Security Domain Documentation

**Single source of truth for security, privacy & audit documentation.**

---

## Overview
Security audits, RLS policies, RPC classification, multi-user privacy boundaries, member aliases, and owner bundle isolation.

## Files

| File | Description |
|------|-------------|
| [`PR78A_SECURITY_DEFINER_AUDIT.md`](./PR78A_SECURITY_DEFINER_AUDIT.md) | Security definer audit |
| [`PR81F_RPC_SECURITY_CLASSIFICATION.md`](./PR81F_RPC_SECURITY_CLASSIFICATION.md) | RPC security classification |
| [`PR82L_MULTIUSER_PRIVACY_BOUNDARY.md`](./PR82L_MULTIUSER_PRIVACY_BOUNDARY.md) | Multi-user privacy boundary |
| [`PR82M_MULTIUSER_PRIVACY_AUDIT.md`](./PR82M_MULTIUSER_PRIVACY_AUDIT.md) | Multi-user privacy audit |
| [`PR82N_STABLE_MEMBER_ALIASES.md`](./PR82N_STABLE_MEMBER_ALIASES.md) | Stable member aliases |
| [`PR82O_OWNER_BUNDLE_ISOLATION.md`](./PR82O_OWNER_BUNDLE_ISOLATION.md) | Owner bundle isolation |

---

## Cross-References (ICM)

| Reference | Purpose |
|-----------|---------|
| [`../agents.md`](../agents.md#skema-basis-data-rls-atau-rpc) | Area map: Database schema, RLS, RPC |
| [`../context.md`](../context.md#batasan-produk) | Product constraints: Workspace isolation & RLS |
| [`../ICM_METHODOLOGY.md`](../ICM_METHODOLOGY.md) | Documentation conventions |
| [`../DATABASE_MIGRATION_POLICY.md`](./DATABASE_MIGRATION_POLICY.md) | DB migration workflow (SSOT) |
| [`../SUPABASE_ADVISOR_AUDIT_20260925.md`](./SUPABASE_ADVISOR_AUDIT_20260925.md) | Supabase advisor findings |
| [`../../supabase/migrations/`](../../supabase/migrations/) | Timestamped SQL migrations |
| [`../../supabase/PRODUCTION_MIGRATION_MANIFEST.md`](../../supabase/PRODUCTION_MIGRATION_MANIFEST.md) | Production migration manifest |

---

*Follows [ICM Methodology](../ICM_METHODOLOGY.md) — all links relative to project root.*