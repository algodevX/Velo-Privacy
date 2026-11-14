/**
 * Exposes the Global Privacy Control signal to page scripts (https://globalprivacycontrol.org).
 * Runs in the page's main world at document_start. Browsers that already implement GPC,
 * such as Brave, are left alone.
 */
if (!('globalPrivacyControl' in Navigator.prototype)) {
  Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
    configurable: true,
    enumerable: true,
    get: () => true,
  });
}
