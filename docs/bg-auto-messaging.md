# Background timeout for paid auto pages

`CMS_BASIC_AUTO`, `GTH_BASIC_AUTO`, and sibling auto pages used to `await chrome.runtime.sendMessage` with no deadline. A pending promise leaves the page on 「正在请求后台 …」, `reportPort` gets no `/result`, and the runner hits `timeout_180000`.

The paid Edge hang is not the internal `src/background/worker.mjs` path. Paid packs set the service worker to `src/license/guard-worker.mjs`, which installed education/basic/draft runners but not the `*_AUTO` runners, so those messages had no listener. The paid worker now installs the same runners with `verifyBeforeFill`. `build-paid` also copies `bg-ping.mjs` and `bg-request.mjs`.

Both workers register `BG_PING` and a `bg-wake` port from `src/background/bg-ping.mjs`. No ping within 15s posts `{ok:false, reason:"BG_NO_RESPONSE", phase:"ack", helpNeeded:false, writeAttempted:false, saveAttempted:false, messageType, mode, timeoutMs}` and does not start the job. After a pong, the auto message may run up to 160s. A missing `sendResponse` posts the same reason with `phase:"response"`. Never Save. No license-core redesign.
