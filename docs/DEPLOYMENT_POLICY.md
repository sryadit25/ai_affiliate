# Lumaway Production Deployment Policy

Manual deploy only. Vercel Git auto-deploy is disabled (`deploymentEnabled.main: false` in `vercel.json`, no `ignoreCommand`). Push to `main` never triggers production by itself.

## Required flow (manual)

1. Create a feature / fix branch from `main`.
2. Commit all work to that branch only.
3. Open a Pull Request to `main`.
4. Wait for **Lumaway CI Gate / validate** to pass:
   - route validation
   - TypeScript
   - production build
   - HTTP smoke test
5. Squash-merge the Pull Request to `main`.
6. From `ai_affiliate/`, run manual deploy: `npx vercel link` (once, project `ai-lumaway`), then `npx vercel --prod`.
7. Verify production: fetch `https://app.lumaway.online/sw.js` (expect `lumaway-shell-v5`), hard-reload `Ctrl+Shift+R`, confirm Service Workers version.

## Important

- Do not use `main` as a working branch.
- Always run `npx vercel --prod` from `ai_affiliate/` (never from the parent `project/` folder) and link project `ai-lumaway`, not `lumaway-marketing`.
- A production release is valid only after manual `npx vercel --prod` succeeds and `sw.js` verification passes.
- When a build fails on a PR branch, fix the branch and rerun CI before merging. Do not patch the failure directly on `main`.

## PR39 objective

This policy prevents the PR38 pattern where several partial commits were sent to Vercel before all dependent files were present and before build errors had been fixed.

Manual-deploy update: Git auto-deploy is now fully disabled. The PR39 PR-flow above stays, but the final production step is always an explicit `npx vercel --prod` from `ai_affiliate/` — never an automatic push-triggered deployment.
