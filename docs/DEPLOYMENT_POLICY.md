# Lumaway Production Deployment Policy

Vercel Git auto-deploy is **enabled** — `vercel.json` no longer blocks it (the old `git.deploymentEnabled` block was removed because it was the root cause of "sudah deploy tapi tampilan tidak berubah"). Push to `main` triggers a production deployment; push to a non-`main` branch triggers a preview deployment.

No custom auto-deploy worker, GitHub Action, or `ignoreCommand` is used for production. Deployment is handled entirely by Vercel's native Git integration plus the repo's CI gate. The legacy "Frequent Crons" GitHub Actions workflow was deleted (Vercel Hobby only allows the single weekly cron in `vercel.json`).

## Required flow

1. Create a feature / fix branch from `main` (or commit directly on `main` locally — see note below).
2. Commit only to that branch.
3. Open a Pull Request to `main`.
4. Wait for **Lumaway CI Gate / validate** to pass:
   - migration validation
   - route validation
   - public asset paths
   - TypeScript
   - production build
   - HTTP smoke test
5. Squash-merge the Pull Request to `main` (or push directly to `main` if the change was authored and verified locally).
6. Vercel auto-deploys `main` to production. There is no manual `npx vercel --prod` requirement.
7. Verify production: fetch `https://app.lumaway.online/sw.js` (expect `lumaway-shell-v6`), hard-reload `Ctrl+Shift+R`, confirm the Service Worker version.

## Important

- A commit that is only committed locally but never `git push`-ed will never deploy. Always push after committing.
- Production project is `ai-lumaway`; the marketing site is a separate project (`lumaway-marketing`). Never deploy the app from the parent `project/` folder.
- If a build fails on a PR branch, fix the branch and rerun CI before merging. Do not patch the failure directly on `main`.
- Do not re-add a `git.deploymentEnabled` block that disables `main` — that reintroduces the stale-UI problem.

## Never overwrite a teammate's work

Two contributors push to this repo with different GitHub accounts. The `.githooks/pre-push` hook refuses a push when the local branch is behind `origin` (rebase guard) so a teammate who forgot to `git pull` cannot overwrite newer commits. Run `git pull --rebase origin <branch>` before pushing when the hook blocks you.

## Service worker cache policy

`public/sw.js` uses `CACHE_VERSION` (currently `v6`). Navigation requests are **network-first** (`cache: "no-store"`) and the HTML shell is no longer precached, so a new deployment is always served instead of a stale UI. Bump `CACHE_VERSION` whenever a change must force old clients to drop their cache.
