import { pdfjs } from "react-pdf";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DEFAULT_OPTIONS = {
  renderScale: 1.6,
  minWidth: 50,
  minHeight: 14,
  maxHeight: 280,
  minInkRatio: 0.005,
  maxInkRatio: 0.90,
  maxCandidates: 15,
  threshold: 140,
};

export async function loadPdfDocument(pdfSource) {
  if (!pdfSource || typeof pdfSource !== "string") {
    throw new Error("A PDF data URL is required for signature extraction.");
  }

  const task = pdfjs.getDocument(pdfSource);
  return task.promise;
}

export async function renderPdfPageToCanvas(pdfSource, pageNumber = 1, scale = DEFAULT_OPTIONS.renderScale) {
  // Handles either a PDF data URL or a page image data URL as input.
  const isDataUrl = typeof pdfSource === "string" && /^data:/i.test(pdfSource);
  const isImageDataUrl = isDataUrl && /(image\/png|image\/jpe?g)/i.test(pdfSource);

  if (isImageDataUrl) {
    return renderImageToCanvas(pdfSource);
  }

  const pdfDoc = await loadPdfDocument(pdfSource);
  const safePage = clamp(Number(pageNumber) || 1, 1, pdfDoc.numPages);
  const page = await pdfDoc.getPage(safePage);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  await page.render({ canvasContext: context, viewport }).promise;

  return {
    canvas,
    pageNumber: safePage,
    totalPages: pdfDoc.numPages,
  };
}

export async function renderImageToCanvas(imageSource) {
  if (!imageSource || typeof imageSource !== "string") {
    throw new Error("Image data URL is required for image-based signature extraction.");
  }

  const img = await new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(new Error("Failed to load image for signature extraction."));
    image.src = imageSource;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width || 1024;
  canvas.height = img.naturalHeight || img.height || 768;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return {
    canvas,
    pageNumber: 1,
    totalPages: 1,
  };
}

function buildInkMask(imageData, width, height, threshold) {
  const rgba = imageData.data;
  const mask = new Uint8Array(width * height);

  for (let i = 0, px = 0; i < rgba.length; i += 4, px += 1) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    mask[px] = luminance <= threshold ? 1 : 0;
  }

  return mask;
}

function calculateOtsuThreshold(imageData, width, height) {
  const rgba = imageData.data;
  const histogram = new Array(256).fill(0);

  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    histogram[luminance] += 1;
  }

  const pixelCount = width * height;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let countB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i += 1) {
    countB += histogram[i];
    if (countB === 0) continue;

    const countF = pixelCount - countB;
    if (countF === 0) break;

    sumB += i * histogram[i];

    const meanB = sumB / countB;
    const meanF = (sum - sumB) / countF;

    const variance = (countB * countF * (meanB - meanF) ** 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return Math.min(threshold + 5, 200);
}

function connectedComponents(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];

  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const root = y * width + x;
      if (visited[root] || !mask[root]) continue;

      const queue = [root];
      visited[root] = 1;

      let size = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;

      while (queue.length) {
        const index = queue.pop();
        const cx = index % width;
        const cy = (index - cx) / width;

        size += 1;
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;

        for (let i = 0; i < neighbors.length; i += 1) {
          const nx = cx + neighbors[i][0];
          const ny = cy + neighbors[i][1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

          const nIndex = ny * width + nx;
          if (visited[nIndex] || !mask[nIndex]) continue;

          visited[nIndex] = 1;
          queue.push(nIndex);
        }
      }

      components.push({
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        inkPixels: size,
      });
    }
  }

  return components;
}

function mergeNearbyComponents(components) {
  // merge close signature-like components into larger candidate blocks
  const sorted = [...components].sort((a, b) => a.x - b.x || a.y - b.y);
  const merged = [];

  for (let i = 0; i < sorted.length; i += 1) {
    let base = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const next = sorted[j];

      const horizontalGap = Math.max(next.x - (base.x + base.width), base.x - (next.x + next.width), 0);
      const verticalOverlap = Math.max(0, Math.min(base.y + base.height, next.y + next.height) - Math.max(base.y, next.y));
      const minOverlap = Math.min(base.height, next.height) * 0.3;

      const isCloseHorizontally = horizontalGap <= Math.max(12, Math.min(base.width, next.width) * 0.45);
      const overlapsVertically = verticalOverlap >= minOverlap;

      if (isCloseHorizontally && overlapsVertically) {
        const newX = Math.min(base.x, next.x);
        const newY = Math.min(base.y, next.y);
        const newMaxX = Math.max(base.x + base.width, next.x + next.width);
        const newMaxY = Math.max(base.y + base.height, next.y + next.height);

        base = {
          x: newX,
          y: newY,
          width: newMaxX - newX,
          height: newMaxY - newY,
          inkPixels: base.inkPixels + next.inkPixels,
        };

        sorted.splice(j, 1);
        j -= 1;
      }
    }

    merged.push(base);
  }

  // include both original and merged candidates to keep any variants.
  const combined = [...components, ...merged];

  // de-duplicate by integer position and size
  const unique = [];
  const keySet = new Set();

  combined.forEach((comp) => {
    const key = `${Math.round(comp.x)}_${Math.round(comp.y)}_${Math.round(comp.width)}_${Math.round(comp.height)}`;
    if (!keySet.has(key)) {
      keySet.add(key);
      unique.push(comp);
    }
  });

  return unique;
}

function scoreCandidate(component, pageWidth, pageHeight) {
  const aspect = component.width / Math.max(component.height, 1);
  const area = component.width * component.height;
  const pageArea = pageWidth * pageHeight;
  const areaRatio = area / Math.max(pageArea, 1);
  const centerYRatio = (component.y + component.height / 2) / Math.max(pageHeight, 1);

  let score = 0;

  // Signature-like aspect ratio (wide and medium height)
  if (aspect >= 1.5 && aspect <= 15) score += 5;
  else if (aspect >= 0.8 && aspect <= 20) score += 2;

  // Area ratio - signatures are typically 0.05% to 10% of page
  if (areaRatio >= 0.0005 && areaRatio <= 0.15) score += 3;

  // Strong positional preference: lower half is most likely for signatures
  if (centerYRatio >= 0.5) score += 8;
  else if (centerYRatio >= 0.35) score += 4;
  else if (centerYRatio >= 0.25) score += 0;
  else score -= 2;

  // Wider signatures have higher confidence
  if (component.width >= 100) score += 3;
  else if (component.width >= 70) score += 2;
  else if (component.width >= 50) score += 1;

  // Medium height typically indicates signatures, not text
  if (component.height >= 20 && component.height <= 80) score += 2;

  return score;
}

function filterCandidates(components, pageWidth, pageHeight, options) {
  const {
    minWidth,
    minHeight,
    maxHeight,
    minInkRatio,
    maxInkRatio,
    maxCandidates,
  } = options;

  return components
    .map((component) => {
      const boxArea = component.width * component.height;
      const inkRatio = component.inkPixels / Math.max(boxArea, 1);
      const score = scoreCandidate(component, pageWidth, pageHeight);

      return {
        ...component,
        inkRatio,
        score,
      };
    })
    .filter((component) => {
      // Check size constraints
      if (component.width < minWidth) return false;
      if (component.height < minHeight) return false;
      if (component.height > maxHeight) return false;
      
      // Ink ratio check
      if (component.inkRatio < minInkRatio) return false;
      if (component.inkRatio > maxInkRatio) return false;
      
      // Allow components with any reasonable score
      return true;
    })
    .sort((a, b) => {
      // Primary sort: by score descending
      if (b.score !== a.score) return b.score - a.score;
      // Secondary sort: by area descending (prefer larger candidates with same score)
      return b.width * b.height - a.width * a.height;
    })
    .slice(0, maxCandidates);
}

export async function extractSignatureCandidatesFromPdf(pdfSource, pageNumber = 1, customOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const rendered = await renderPdfPageToCanvas(pdfSource, pageNumber, options.renderScale);
  const { canvas, totalPages } = rendered;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  // Use Otsu's thresholding for automatic optimal threshold
  const otsuThreshold = calculateOtsuThreshold(imageData, canvas.width, canvas.height);
  const finalThreshold = Math.min(otsuThreshold, options.threshold);
  
  const mask = buildInkMask(imageData, canvas.width, canvas.height, finalThreshold);
  const components = connectedComponents(mask, canvas.width, canvas.height);

  // merge nearby components to capture split signatures as one candidate
  const augmentedComponents = mergeNearbyComponents(components, canvas.width, canvas.height, options);
  const candidates = filterCandidates(augmentedComponents, canvas.width, canvas.height, options);

  // Fallback: if no candidates, pick largest remaining component from mask
  let finalCandidates = candidates;
  if (!finalCandidates.length && components.length) {
    const largest = components.reduce((best, next) => (next.inkPixels > (best?.inkPixels ?? 0) ? next : best), null);
    if (largest) {
      finalCandidates = [largest];
    }
  }

  return {
    canvas,
    candidates: finalCandidates,
    pageNumber: rendered.pageNumber,
    totalPages,
  };
}

function trimWhitespace(canvas, alphaThreshold = 8, whiteThreshold = 245) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = context.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const isInk = a > alphaThreshold && (r < whiteThreshold || g < whiteThreshold || b < whiteThreshold);
      if (!isInk) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return canvas;
  }

  const pad = 6;
  const cropX = clamp(minX - pad, 0, width - 1);
  const cropY = clamp(minY - pad, 0, height - 1);
  const cropWidth = clamp(maxX - minX + 1 + pad * 2, 1, width - cropX);
  const cropHeight = clamp(maxY - minY + 1 + pad * 2, 1, height - cropY);

  const output = document.createElement("canvas");
  output.width = cropWidth;
  output.height = cropHeight;
  output
    .getContext("2d")
    .drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return output;
}

export function cropCandidateToPngDataUrl(canvas, candidate, extraPadding = 10) {
  if (!canvas || !candidate) {
    throw new Error("Missing canvas or candidate for crop.");
  }

  const x = clamp(Math.floor(candidate.x - extraPadding), 0, canvas.width - 1);
  const y = clamp(Math.floor(candidate.y - extraPadding), 0, canvas.height - 1);
  const width = clamp(Math.ceil(candidate.width + extraPadding * 2), 1, canvas.width - x);
  const height = clamp(Math.ceil(candidate.height + extraPadding * 2), 1, canvas.height - y);

  const cropped = document.createElement("canvas");
  cropped.width = width;
  cropped.height = height;
  cropped.getContext("2d").drawImage(canvas, x, y, width, height, 0, 0, width, height);

  const trimmed = trimWhitespace(cropped);
  return trimmed.toDataURL("image/png");
}
