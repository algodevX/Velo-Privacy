/**
 * Fingerprinting protection. Runs in the page's main world at document_start, in every
 * frame, before any site script.
 *
 * Fingerprinting scripts draw text and shapes, render a WebGL scene or process a sound,
 * then hash the result: tiny differences between graphics cards, drivers and fonts make
 * the hash nearly unique to a device. Here every such reading gets imperceptible noise,
 * the same within a page but different on each page load, so readings cannot be linked
 * across visits. The approach follows Brave's "farbling".
 *
 * Replaced functions are wrapped in a Proxy, which keeps their name, length and
 * native-code string, so pages see the same API surface as before.
 */

const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

/** A deterministic 32-bit hash of `value` under this page's seed (xorshift-multiply). */
function hash(value: number): number {
  let x = (value ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Flips the lowest bit of one colour channel in about one pixel in 16. Invisible, but
 * enough to change any hash of the image. Only depends on the pixel's position, so the
 * same image always comes out the same within the page.
 */
function farblePixels(data: Uint8ClampedArray | Uint8Array): void {
  for (let pixel = 0; pixel < data.length / 4; pixel++) {
    const h = hash(pixel);
    if ((h & 0xf) !== 0) continue;
    const index = pixel * 4 + ((h >>> 4) % 3);
    data[index] = (data[index] ?? 0) ^ 1;
  }
}

/** Larger images are not fingerprints, and copying them would cost noticeable time. */
const MAX_FARBLED_PIXELS = 1 << 20;

function wrap<T extends object, K extends keyof T>(
  target: T | undefined,
  key: K,
  apply: (
    original: T[K] & ((...args: never[]) => unknown),
    self: unknown,
    args: unknown[],
  ) => unknown,
): void {
  const original = target?.[key];
  if (target === undefined || typeof original !== 'function') return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, {
    ...descriptor,
    value: new Proxy(original, {
      apply: (fn, self, args: unknown[]) => apply(fn as never, self, args),
    }),
  });
}

function wrapGetter<T extends object>(
  target: T | undefined,
  key: string,
  get: (original: () => unknown, self: unknown) => unknown,
): void {
  const descriptor = target && Object.getOwnPropertyDescriptor(target, key);
  const original = descriptor?.get;
  if (target === undefined || original === undefined) return;
  Object.defineProperty(target, key, {
    ...descriptor,
    get: new Proxy(original, { apply: (fn, self) => get(() => Reflect.apply(fn, self, []), self) }),
  });
}

// Canvas 2D: pixel reads and exports.

const getImageData = CanvasRenderingContext2D.prototype.getImageData;

wrap(CanvasRenderingContext2D.prototype, 'getImageData', (original, self, args) => {
  const image = Reflect.apply(original, self, args) as ImageData;
  if (image.width * image.height <= MAX_FARBLED_PIXELS) farblePixels(image.data);
  return image;
});

/** A farbled copy of `canvas`, or null when it is empty, too large or unreadable. */
function farbledCopy(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const { width, height } = canvas;
  if (width === 0 || height === 0 || width * height > MAX_FARBLED_PIXELS) return null;
  const copy =
    canvas instanceof HTMLCanvasElement
      ? Object.assign(document.createElement('canvas'), { width, height })
      : new OffscreenCanvas(width, height);
  const context = copy.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (context === null) return null;
  try {
    context.drawImage(canvas, 0, 0);
    const image = Reflect.apply(getImageData, context, [0, 0, width, height]) as ImageData;
    farblePixels(image.data);
    context.putImageData(image, 0, 0);
    return copy;
  } catch {
    // Canvases tainted by cross-origin images cannot be read by the page either.
    return null;
  }
}

for (const key of ['toDataURL', 'toBlob'] as const) {
  wrap(HTMLCanvasElement.prototype, key, (original, self, args) => {
    const copy = farbledCopy(self as HTMLCanvasElement);
    return Reflect.apply(original, copy ?? self, args);
  });
}

if (typeof OffscreenCanvas !== 'undefined') {
  wrap(OffscreenCanvas.prototype, 'convertToBlob', (original, self, args) => {
    const copy = farbledCopy(self as OffscreenCanvas);
    return Reflect.apply(original, copy ?? self, args);
  });
}

// WebGL: the graphics card's name and rendered pixels.

const UNMASKED_VENDOR = 0x9245;
const UNMASKED_RENDERER = 0x9246;

for (const context of [
  globalThis.WebGLRenderingContext,
  globalThis.WebGL2RenderingContext,
] as const) {
  if (context === undefined) continue;
  wrap(context.prototype, 'getParameter', (original, self, args) => {
    // The same generic names browsers report when the debug extension is unavailable.
    if (args[0] === UNMASKED_VENDOR) return 'WebKit';
    if (args[0] === UNMASKED_RENDERER) return 'WebKit WebGL';
    return Reflect.apply(original, self, args);
  });
  wrap(context.prototype, 'readPixels', (original, self, args) => {
    const result = Reflect.apply(original, self, args);
    const pixels = args[6];
    if (pixels instanceof Uint8Array && pixels.length <= MAX_FARBLED_PIXELS * 4) {
      farblePixels(pixels);
    }
    return result;
  });
}

// Audio: rendered samples and frequency analysis.

/** A tiny, deterministic offset for the sample at `index`, far below audibility. */
function audioNoise(index: number): number {
  return ((hash(index) / 0xffffffff) * 2 - 1) * 1e-7;
}

const farbledBuffers = new WeakSet<Float32Array>();

wrap(AudioBuffer.prototype, 'getChannelData', (original, self, args) => {
  const data = Reflect.apply(original, self, args) as Float32Array;
  // The same array is returned on every call, so noise is added only once.
  if (!farbledBuffers.has(data)) {
    farbledBuffers.add(data);
    for (let i = 0; i < data.length; i++) data[i] = (data[i] ?? 0) + audioNoise(i);
  }
  return data;
});

wrap(AnalyserNode.prototype, 'getFloatFrequencyData', (original, self, args) => {
  const result = Reflect.apply(original, self, args);
  const data = args[0];
  if (data instanceof Float32Array) {
    for (let i = 0; i < data.length; i++) data[i] = (data[i] ?? 0) + audioNoise(i) * 1e4;
  }
  return result;
});

// Hardware: report a plausible core count no higher than the real one.

wrapGetter(Navigator.prototype, 'hardwareConcurrency', (original) => {
  const cores = original() as number;
  return cores <= 2 ? cores : 2 + (seed % (cores - 1));
});
