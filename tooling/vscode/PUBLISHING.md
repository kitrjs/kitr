# Publishing the VS Code extension

The extension ships to two registries: the Visual Studio Marketplace (VS Code) and Open VSX (Cursor, VSCodium, Windsurf, Gitpod and other VS Code forks). The workflow `.github/workflows/vscode-release.yml` does both when a `vscode-v*` tag is pushed, but only once the tokens below exist. Until then it still builds the `.vsix` and attaches it to the run.

## One-time setup

### 1. Visual Studio Marketplace publisher `kitrjs`

1. Sign in at <https://marketplace.visualstudio.com/manage> with a Microsoft account and create the publisher. ID: `kitrjs` (it must match `publisher` in `package.json`). Display name: `kitr`.
2. The token comes from Azure DevOps. Go to <https://dev.azure.com>, create an organisation if you have none (any name; it only holds the token).
3. In that organisation: User settings → Personal access tokens → New token.
   - Organization: **All accessible organizations** (a token scoped to one organisation is rejected by the Marketplace).
   - Scopes: Custom defined → Show all scopes → **Marketplace → Manage**.
   - Expiration: the longest offered; note the date.
4. Check it: `npx @vscode/vsce login kitrjs` and paste the token.

### 2. Open VSX namespace `kitrjs`

1. Sign in at <https://open-vsx.org> with GitHub, then link an Eclipse account when it asks (Settings → Eclipse account; this signs the publisher agreement).
2. Settings → Access Tokens → Generate New Token. Copy it.
3. Create the namespace once: `npx ovsx create-namespace kitrjs -p <token>`.

### 3. Repository secrets

GitHub → the kitr repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
| --- | --- |
| `VSCE_PAT` | the Azure DevOps token |
| `OVSX_PAT` | the Open VSX token |

Either can be left out: that registry is then skipped.

## Releasing

1. Bump `version` in `tooling/vscode/package.json` (Marketplace versions are plain `major.minor.patch`, no pre-release tags) and commit.
2. Tag and push:

   ```sh
   git tag vscode-v0.1.0
   git push origin vscode-v0.1.0
   ```

3. Watch the "VS Code extension" workflow. It installs, typechecks, tests, packages, uploads the `.vsix` as an artifact, then publishes to each registry whose secret is set.

The Marketplace listing appears within a few minutes at <https://marketplace.visualstudio.com/items?itemName=kitrjs.kitr>; Open VSX at <https://open-vsx.org/extension/kitrjs/kitr>.

Before the first public release, add a 128×128 PNG as `media/icon.png`, set `"icon": "media/icon.png"` in `package.json`, and replace the screenshot comment in `README.md` with a real image (the Marketplace shows the README as the listing page).

## Trying a build locally, without any registry

```sh
cd tooling/vscode
npm ci
npm run package          # writes kitr-<version>.vsix
code --install-extension kitr-0.1.0.vsix
```

Or in VS Code: Extensions view → `…` menu → "Install from VSIX…". Every workflow run also has the `.vsix` under Artifacts, so a build from CI installs the same way.

## When a token expires

Both tokens expire. Publishing then fails with a 401 in the workflow. Make a new token as above and replace the secret; nothing else changes.
