# Deployment setup

This site is built and published automatically by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push
to `main`. There is no manual build/copy step anymore.

## One-time GitHub setup (already done, documented for reference)

**Repository secrets** — Settings → Secrets and variables → Actions:

- `APP_DATA_URL` — the deployed Google Apps Script web app URL that acts as
  this app's data backend.
- `APP_DATA_SECRET` — the shared secret the app sends with every request to
  that backend.

Both are generated from: `GMail:cuptodare > AppScripts > https://script.google.com/home`.
If the Apps Script deployment is ever redeployed or the secret rotated,
update these two repository secrets to match.

**Pages source** — Settings → Pages → Build and deployment → Source is set to
**GitHub Actions** (not "Deploy from a branch"). Don't switch this back, or
the workflow's Pages deployment step will stop taking effect.

**`local-sync` dependency** — `package.json` depends on
[`cuptordare/local-sync`](https://github.com/cuptordare/local-sync) (pinned
to a commit on the `poc` branch) via a git dependency. That repo must stay
**public**, otherwise `npm ci` in CI has no credentials to clone it.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the real `APP_DATA_URL` /
   `APP_DATA_SECRET` values (see above for where to find them).
3. `npm run build` then `npm run dev` to serve the built `dist/` locally.

`.env` is gitignored and must never be committed.
