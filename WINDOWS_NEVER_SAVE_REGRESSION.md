# Windows Never-Save regression repairs

The full offline baseline run exposed three environment-sensitive regression problems. CMS basic/self-evaluation tests and the GTH other/skills help check converted file URLs with URL.pathname, yielding C:\C:\... paths on Windows. These tests now use Node's fileURLToPath before constructing filesystem paths. The CMS product code is unchanged.

The CITICS synthetic browser harness already killed its isolated Chromium process before removing the temporary profile. Windows can retain child-process file locks briefly after that signal. Cleanup now awaits fs.promises.rm with bounded retries (maxRetries 30, retryDelay 100) instead of calling rmSync once. Fixture filling and Never-Save checks remain unchanged.

The signed-entitlement verification test expected an EXAMPLE public key with a .pem extension, but the repository ignores .pem files, so a clean checkout lacked it. The public verification key is now tracked as EXAMPLE_ed25519_public.txt, retaining its PEM-format PUBLIC KEY contents. The test and the public-key README row reference that file. The fixture-format assertion checks this public-only key and the paid builder's explicit private-key rejection branch, rather than requiring an untracked private key that signature verification does not use. Signature acceptance, tamper rejection, expiry, and fail-closed tests remain intact. No private-key file was read, changed, or added; the regression suite does not validate the contents of an absent private fixture.

Validation on Windows with Node 24:

- CMS basic info, CMS self evaluation, and GTH other/skills suites: 45 passed.
- All seven CITICS suites: 20 passed with CHROME_PATH set to the installed Chrome executable. Synthetic browser fixtures verify readback, restoration, unchanged neighbors, and zero commit clicks.
- Signed entitlement, mock HTTPS license verification, and GTH intent suites: 38 passed with Git and OpenSSL on PATH.

The broader regression environment also requires Git and OpenSSL on PATH. These tools are setup prerequisites; no test is skipped or weakened. Offline results do not claim live site support.
