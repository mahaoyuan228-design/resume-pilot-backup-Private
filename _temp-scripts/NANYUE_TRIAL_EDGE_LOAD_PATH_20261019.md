# Trial Edge load path · 2026-10-19

南粤 (`SU670a291d6202cc7666c744bc`) readiness PASS and a partial fill-without-save were run on Jeremy's trial Edge. This is not full site support. Acceptance stays **85%**. Never Save / submit.

Trial Edge CDP **9237** currently loads the extension from:

`Desktop\简历投递器\dist\edge-internal-v0.1.0-20261013-130219\extension`

That path is **not** `ResumeQuickFill-Dev 003753`.

Ops should sync the extension into the actual `--load-extension` directory before the next live run. Loading a different unpacked folder will not pick up the 南粤 signature patch.
