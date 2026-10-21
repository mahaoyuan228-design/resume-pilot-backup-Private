# Offline regression on Windows

Use a fresh isolated checkout. Clone with `git -c core.autocrlf=false clone ...` so frozen-source byte checks see the exact Git blob line endings on Windows and Linux.

1. Run `npm ci --ignore-scripts --no-audit --no-fund`.
2. Set `CHROME_PATH` to a local Chrome executable. Synthetic harnesses launch temporary headless profiles under `os.tmpdir()` and visit local fixtures only.
3. Run `node scripts/dev-sign-example-entitlement.mjs --write-fixtures` in this isolated checkout to generate disposable EXAMPLE crypto fixtures. Never use customer or operator signing keys. Generated PEM files stay ignored and outside extension package allowlists.
4. The HTTPS mock needs OpenSSL (`OPENSSL_BIN` may select it), or disposable DEV-ONLY localhost TLS material under `scripts/dev-mock-license-certs/`. Do not use production certificates or keys.
5. Run `node --test tests/*.test.mjs tests/import/*.test.mjs` and keep the full output. Run the fresh Edge cross-world gate separately with `node tests/e2e/cms-cross-world-keycode-edge.mjs`.
6. Build internal, paid candidate, and paid smoke from the same source. A loopback license URL and EXAMPLE public key are offline test configuration only, never a customer release.

Passing offline tests does not establish live site support or successful save. Real-site acceptance remains Never Save and requires explicit endpoint/readback evidence.
