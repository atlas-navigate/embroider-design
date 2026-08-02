import type { RgbaImage } from '@embroider-design/engine';

/**
 * Turning files into raw RGBA, using what the browser already ships.
 *
 * The engine takes decoded pixels and knows nothing about PNG, JPEG or SVG —
 * that is its no-native-dependencies promise. This is the other half of the
 * bargain: Chromium's decoders, its SVG renderer, and its deflate, wrapped
 * into the three shapes the import panels need.
 */

export interface DecodedImage {
  name: string;
  image: RgbaImage;
  /** Downscaled copy kept in the project file so it can be re-traced later. */
  dataUrl: string;
}

/**
 * Copies bytes into a buffer of exactly the right length: bytes that arrive
 * over IPC or out of a zip are views that may sit inside a larger pooled
 * buffer, and a `Blob` built from the raw buffer would take the pool with it.
 */
function ownBuffer(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer;
}

export async function decodeRgbaImage(
  name: string,
  data: Uint8Array,
): Promise<DecodedImage | null> {
  const blob = new Blob([ownBuffer(data)]);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

  // Keep a small copy for the project file, not the original megabytes.
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(bitmap.width * scale));
  thumb.height = Math.max(1, Math.round(bitmap.height * scale));
  thumb.getContext('2d')?.drawImage(bitmap, 0, 0, thumb.width, thumb.height);
  bitmap.close();

  return {
    name,
    image: { data: imageData.data, width: imageData.width, height: imageData.height },
    dataUrl: thumb.toDataURL('image/png'),
  };
}

/**
 * Renders an SVG to pixels and hands those to the tracer.
 *
 * Deliberately raster-first: the engine's path grammar has no elliptical-arc
 * command, and third-party icon SVGs use arcs constantly. Rendering at a
 * generous size and tracing the pixels handles every SVG Chromium can draw,
 * instead of the subset a path parser happens to cover. Vectors have no
 * resolution to lose, so small files are scaled *up* to the working size.
 */
export async function rasterizeSvg(
  name: string,
  data: Uint8Array,
  maxSide = 512,
): Promise<DecodedImage | null> {
  const blob = new Blob([ownBuffer(data)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const element = await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
    if (!element) return null;

    // An SVG with no intrinsic size reports zero; treat it as square.
    const width = element.naturalWidth || maxSide;
    const height = element.naturalHeight || maxSide;
    const scale = maxSide / Math.max(width, height);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    // White ground under the artwork, which is the page the tracer expects —
    // the same flattening `compositeOn` would do with the alpha channel.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);

    return {
      name,
      image: { data: pixels.data, width: pixels.width, height: pixels.height },
      dataUrl: canvas.toDataURL('image/png'),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Chromium's own inflate, in the shape the engine's zip reader asks for.
 * The engine has no zlib — decompression is injected by whoever has one.
 */
export async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([ownBuffer(data)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
