# ICM Methodology — Information-Centric Mapping

**Single source of truth for project-wide documentation and reference conventions.**  
Based on Jake van Clief's Information-Centric Mapping methodology.

---

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Single Source of Truth (SSOT)** | One authoritative file per domain (e.g., `agents.md` for area map, `context.md` for repo context, `ICM_METHODOLOGY.md` for this convention) |
| **Relative References Only** | All cross-file links use paths relative to project root (`./`, `../`, `docs/`, `.agents/`) |
| **No Hardcoded Absolute Paths** | Never use machine-specific paths (`C:\Users\...`, `/home/user/...`) |
| **Structured Navigation** | Folder structure mirrors information architecture; `README.md` at each level for orientation |
| **Canonical Naming** | Consistent naming: `agents.md`, `context.md`, `ICM_METHODOLOGY.md`, `SKILL.md` |

---

## Path Conventions

### Root-Level Reference Files
| File | Purpose | Links To |
|------|---------|----------|
| `agents.md` | Area map for agents | `app/`, `lib/`, `supabase/`, `.agents/`, `.claude/`, `docs/` |
| `context.md` | Repo context & constraints | `agents.md`, `README.md`, `masalah/` |
| `README.md` | Product overview | `agents.md`, `context.md`, `docs/` |
| `ICM_METHODOLOGY.md` | This file — documentation conventions | All `.md` files |

### Skill References (`.agents/skills/`, `.claude/skills/`)
```markdown
# Correct ✅
.agents/skills/using-superpowers/
.agents/skills/web-design-guidelines
.agents/skills/hallmark

# Incorrect ❌
C:\Users\Surya\OneDrive\Documents\project\ai_affiliate\.agents\skills\using-superpowers\
```

### Documentation Cross-Links (in `docs/`)
```markdown
# Correct ✅
See [Deployment Policy](./DEPLOYMENT_POLICY.md)
See [Database Migration Policy](../DATABASE_MIGRATION_POLICY.md)
See [Area Map](../agents.md)

# Incorrect ❌
See C:\Users\Surya\...\DEPLOYMENT_POLICY.md
See https://github.com/.../DEPLOYMENT_POLICY.md (unless external reference)
```

### Code/Config References
```markdown
# Correct ✅
Configuration: `tailwind.config.mjs`
Routes: `app/api/ai/route.ts`
Shared lib: `lib/server-auth.ts`

# Incorrect ❌
Configuration: C:\project\tailwind.config.mjs
```

---

## Folder Structure Mapping (ICM Navigation)

```
ai_affiliate/                          ← Project root
├── agents.md                          ← SSOT: Area map for agents
├── context.md                         ← SSOT: Repo context & constraints
├── ICM_METHODOLOGY.md                 ← SSOT: This documentation convention
├── README.md                          ← SSOT: Product overview
├── .agents/                           ← Agent-specific skills & config
│   └── skills/
│       ├── using-superpowers/SKILL.md
│       ├── web-design-guidelines/SKILL.md
│       └── hallmark/SKILL.md
├── .claude/                           ← Claude-specific skills (mirrors .agents/)
│   └── skills/
│       ├── using-superpowers/SKILL.md
│       └── web-design-guidelines/SKILL.md
├── docs/                              ← Domain-organized documentation
│   ├── README.md                      ← SSOT: Docs index & navigation
│   ├── auth/                          ← Auth domain
│   ├── operations/                    ← Operations domain
│   ├── payments/                      ← Payments domain
│   ├── product/                       ← Product domain
│   └── security/                      ← Security domain
├── app/                               ← Next.js App Router
│   ├── app.lumaway/                   ← Workspace app
│   ├── web/                           ← Public web
│   ├── api/                           ← API routes
│   └── ...
├── lib/                               ← Shared implementation
├── supabase/                          ← Database & migrations
│   ├── migrations/                    ← Timestamped SQL migrations
│   └── PRODUCTION_MIGRATION_MANIFEST.md
├── masalah/                           ← Task-specific context (ICM: "problem space")
│   ├── f.pdf                          ← ICM background material
│   └── f2.pdf
└── public/                            ← Static assets & PWA
```

---

## Documentation Standards

### 1. Every Domain Folder Has a `README.md`
```markdown
# docs/auth/README.md
# Auth Domain Documentation

## Overview
Authentication flows, session management, account recovery.

## Files
- [PR82A_AUTH_RECOVERY_RELIABILITY.md](./PR82A_AUTH_RECOVERY_RELIABILITY.md)
- [Session Management](./session-management.md) (if exists)

## Related
- [Area Map: Auth](../agents.md#autentikasi-dan-alur-akun)
- [Context: Auth Constraints](../context.md#batasan-produk)
```

### 2. PR/Feature Docs Link to SSOTs
```markdown
# docs/product/PR82E_LISTING_FOLLOWUP_CHANNEL.md
# Listing Follow-up Channel

## Context
Extends [Listing workflow](../context.md#creator--store-intelligence) in workspace.

## Area Map Reference
- [Agents: Product & Commerce](../agents.md#ui-workspace-aplikasi-dan-kerangka-bersama)
- [Context: Listing Focus](../context.md#creator--store-intelligence)

## Implementation
...
```

### 3. Skills Reference Each Other Relatively
```markdown
# .agents/skills/using-superpowers/SKILL.md
## Platform Adaptation
- Claude Code: `../claude-code-tools.md` (if exists)
- See also: `.claude/skills/using-superpowers/SKILL.md` (mirror)
```

---

## Enforcement Rules

1. **Pre-commit Check**: CI should verify no absolute Windows paths in `.md` files
2. **Link Validation**: Relative links must resolve from project root
3. **SSOT Compliance**: No duplicate domain definitions across files
4. **Navigation Consistency**: Each `docs/*/README.md` links back to `../agents.md` and `../context.md`

---

## Quick Reference for Contributors

| Task | Follow This Pattern |
|------|---------------------|
| Add new skill | Create `.agents/skills/<name>/SKILL.md` + mirror to `.claude/skills/` |
| Document new feature | Add to `docs/<domain>/PR###_FEATURE.md` + update `docs/<domain>/README.md` |
| Update area map | Edit `agents.md` only — it's the SSOT |
| Change repo constraints | Edit `context.md` only — it's the SSOT |
| Link to another doc | Use relative path from current file |
| Reference code file | Use backtick path: `app/api/ai/route.ts` |

---

## Validation Checklist

Before committing documentation changes:
- [ ] No absolute paths (`C:\`, `/home/`, `/Users/`)
- [ ] All relative links resolve from project root
- [ ] Domain has `README.md` with navigation
- [ ] Links to `agents.md` and `context.md` use `../agents.md`, `../context.md`
- [ ] Skill references use `.agents/skills/` or `.claude/skills/`
- [ ] No duplicate domain definitions (check SSOT files first)

---

*This document is the single source of truth for ICM conventions in this project.  
Update it when conventions evolve; all other files must conform.*