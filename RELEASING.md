# Releasing

This package publishes to npm via **Trusted Publishing** (OIDC) from GitHub
Actions (`.github/workflows/publish.yml`). No npm token is stored anywhere — the
workflow proves its identity to npm with a short-lived OIDC token, and npm adds a
provenance attestation automatically.

## One-time setup (on npmjs.com)

1. Open the package's **Settings → Trusted Publisher** (under your account).
2. Add a **GitHub Actions** trusted publisher:
   - Organization or user: `EddieSu`
   - Repository: `claudecode-md-reviewer`
   - Workflow filename: `publish.yml`
   - Environment: *(leave blank)*

> Bootstrap note: if the package does not exist on npm yet and npm won't let you
> pre-configure a trusted publisher, do **one** manual publish to create it
> (`npm publish` with an OTP), then add the trusted publisher above. Every release
> after that is tokenless.

## Cutting a release

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Commit on a branch, merge to `main`, then tag and push:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main vX.Y.Z
   ```
3. The **Publish to npm** workflow runs on the tag and publishes via OIDC.
   (You can also trigger it manually from the **Actions** tab — `workflow_dispatch`
   publishes whatever version is in `package.json` on `main`.)
