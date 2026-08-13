const PRINTABLE_ALPHA_THRESHOLD = 16;
const PRINTABLE_COLOR_THRESHOLD = 245;
const CROP_PADDING_RATIO = 0.005;
const MAX_CACHE_ENTRIES = 20;

const trimmedImageCache = new Map<string, Promise<string>>();

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể đọc ảnh logo để tối ưu vùng in."));
    image.src = source;
  });
}

async function trimWhitespace(source: string): Promise<string> {
  const image = await loadImage(source);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width <= 0 || height <= 0) return source;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return source;

  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const isPrintable =
        pixels[pixelIndex + 3] > PRINTABLE_ALPHA_THRESHOLD
        && (
          pixels[pixelIndex] < PRINTABLE_COLOR_THRESHOLD
          || pixels[pixelIndex + 1] < PRINTABLE_COLOR_THRESHOLD
          || pixels[pixelIndex + 2] < PRINTABLE_COLOR_THRESHOLD
        );
      if (!isPrintable) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return source;

  const padding = Math.max(2, Math.ceil(Math.max(width, height) * CROP_PADDING_RATIO));
  const cropLeft = Math.max(0, minX - padding);
  const cropTop = Math.max(0, minY - padding);
  const cropRight = Math.min(width, maxX + padding + 1);
  const cropBottom = Math.min(height, maxY + padding + 1);
  const cropWidth = cropRight - cropLeft;
  const cropHeight = cropBottom - cropTop;

  if (cropWidth === width && cropHeight === height) return source;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = cropWidth;
  outputCanvas.height = cropHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) return source;

  outputContext.drawImage(
    sourceCanvas,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  return outputCanvas.toDataURL("image/png");
}

/**
 * Removes transparent or near-white borders that would otherwise consume
 * physical paper even though no visible logo content is printed there.
 */
export async function trimPrintImageWhitespace(source: string): Promise<string> {
  const cached = trimmedImageCache.get(source);
  if (cached) return cached;

  if (trimmedImageCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = trimmedImageCache.keys().next().value;
    if (oldestKey) trimmedImageCache.delete(oldestKey);
  }

  const result = trimWhitespace(source).catch(() => source);
  trimmedImageCache.set(source, result);
  return result;
}
