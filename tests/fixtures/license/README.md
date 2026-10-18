# EXAMPLE license crypto fixtures

**NOT production secrets.** These Ed25519 keys exist only so unit tests can
verify signed entitlement tokens offline. Never issue customer licenses with
these keys. Never embed the private key in a paid Edge package.

| File | Role |
| --- | --- |
| EXAMPLE_ed25519_public.pem | Test public key (may be referenced as documentation embed example) |
| EXAMPLE_ed25519_private.pem | Test private key — tests / `scripts/dev-sign-example-entitlement.mjs` only |
| EXAMPLE_signed_entitlement.json | Sample signed token (active, far-future expiry) |
| EXAMPLE_signed_entitlement_expired.json | Sample signed token that is already expired |
