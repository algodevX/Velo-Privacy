/**
 * Lets every video use the browser's native picture-in-picture, including on sites that
 * opt out with the `disablepictureinpicture` attribute.
 *
 * Runs in the page's main world at document_start, before site scripts. The property is
 * pinned to false so scripts cannot set it, and the attribute is removed wherever it
 * appears. Videos inside closed shadow roots are out of reach.
 */

const ATTRIBUTE = 'disablepictureinpicture';

Object.defineProperty(HTMLVideoElement.prototype, 'disablePictureInPicture', {
  configurable: true,
  enumerable: true,
  get: () => false,
  set: () => undefined,
});

function unlock(root: ParentNode): void {
  for (const video of root.querySelectorAll(`video[${ATTRIBUTE}]`))
    video.removeAttribute(ATTRIBUTE);
}

new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === 'attributes') {
      (record.target as Element).removeAttribute(ATTRIBUTE);
      continue;
    }
    for (const node of record.addedNodes) {
      if (node instanceof HTMLVideoElement) node.removeAttribute(ATTRIBUTE);
      else if (node instanceof Element) unlock(node);
    }
  }
}).observe(document, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: [ATTRIBUTE],
});

unlock(document);
