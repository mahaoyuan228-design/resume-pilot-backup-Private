# Offline regression on Windows

The `Windows clean-checkout smoke` GitHub Actions workflow runs on `windows-latest`
for pull requests, baseline pushes, and manual dispatch. It uses Node 24 and
Windows PowerShell 5.1, with no Dev login, browser profile, signing secrets, or
license service. Reproduce its checks in a fresh checkout with Node 24, from
Windows PowerShell 5.1:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
./scripts/build-internal.ps1
./scripts/build-paid.ps1 -LicenseServiceUrl https://license-ci.invalid
node scripts/build-paid-smoke.mjs
npm run test:windows-smoke
```

`test:windows-smoke` includes the paid rebuild/whitelist guards, all L1 unit tests,
license gates and activation, and actual `build-paid.ps1 -Offline` ZIP tests.
Those tests generate disposable Ed25519 keys in temporary directories and verify
the signed-only config, exact ZIP allowlist, and hashes without ignored local PEMs.
The `.invalid` URL is build configuration only; no request is made to it.
`liveSupportClaimed=false`; these checks do not establish live site support.

Use a fresh isolated checkout. Clone with `git -c core.autocrlf=false clone ...` so frozen-source byte checks see the exact Git blob line endings on Windows and Linux.

1. Run `npm ci --ignore-scripts --no-audit --no-fund`.
2. Set `CHROME_PATH` to a local Chrome executable. Synthetic harnesses launch temporary headless profiles under `os.tmpdir()` and visit local fixtures only.
3. Run `node scripts/dev-sign-example-entitlement.mjs --write-fixtures` in this isolated checkout to generate disposable EXAMPLE crypto fixtures. Never use customer or operator signing keys. Generated PEM files stay ignored and outside extension package allowlists.
4. The HTTPS mock needs OpenSSL (`OPENSSL_BIN` may select it), or disposable DEV-ONLY localhost TLS material under `scripts/dev-mock-license-certs/`. Do not use production certificates or keys.
5. Run `node --test tests/*.test.mjs tests/import/*.test.mjs` and keep the full output. Run the fresh Edge cross-world gate separately with `node tests/e2e/cms-cross-world-keycode-edge.mjs`.
6. Build internal, paid candidate, and paid smoke from the same source. A loopback license URL and EXAMPLE public key are offline test configuration only, never a customer release.

Passing offline tests does not establish live site support or successful save. Real-site acceptance remains Never Save and requires explicit endpoint/readback evidence.
