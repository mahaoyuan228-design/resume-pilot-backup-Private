/**
 * Test-only transport for the experimental GTH intent write.
 * Not on the product allowlist. Packed modules must not import it.
 * The shipped engine does not handle this message.
 */
export const GTH_INTENT_TEST_TYPE = 'GTH_INTENT_TEST';

export function createGthIntentTestFill(api) {
  return async function fillIntent({ tab, requestId, binding, answers }) {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/core/matcher.js', 'src/content/engine.js'],
    });
    return api.tabs.sendMessage(tab.id, {
      type: GTH_INTENT_TEST_TYPE,
      requestId,
      profileBinding: binding,
      answers,
    });
  };
}
