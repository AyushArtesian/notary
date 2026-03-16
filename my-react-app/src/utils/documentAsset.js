import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"];

export const getMimeTypeFromDataUrl = (dataUrl) => {
  if (typeof dataUrl !== "string") return "";
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.toLowerCase() || "";
};

export const isPdfLike = ({ fileName = "", mimeType = "", dataUrl = "" } = {}) => {
  const normalizedName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase() || getMimeTypeFromDataUrl(dataUrl);
  return normalizedMimeType === "application/pdf" || normalizedName.endsWith(".pdf");
};

export const isImageLike = ({ fileName = "", mimeType = "", dataUrl = "" } = {}) => {
  const normalizedName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase() || getMimeTypeFromDataUrl(dataUrl);

  if (normalizedMimeType.startsWith("image/")) {
    return true;
  }

  return IMAGE_EXTENSIONS.some((extension) => normalizedName.endsWith(`.${extension}`));
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image preview."));
    image.src = src;
  });

const limitText = (context, text, maxWidth) => {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let trimmed = text;
  while (trimmed.length > 1 && context.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}...`;
};

const renderCanvasToPng = (canvas) => canvas.toDataURL("image/png");

const createFallbackCardImage = (fileName, mimeType) => {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 960;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  const extension = (fileName.split(".").pop() || mimeType.split("/").pop() || "FILE").toUpperCase().slice(0, 5);
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#f8fafc");
  gradient.addColorStop(1, "#e2e8f0");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(15, 23, 42, 0.12)";
  context.shadowBlur = 32;
  context.shadowOffsetY = 10;
  context.fillRect(80, 70, 560, 820);
  context.shadowColor = "transparent";

  context.fillStyle = "#0f172a";
  context.font = "700 150px Segoe UI";
  context.textAlign = "center";
  context.fillText(extension || "FILE", canvas.width / 2, 360);

  context.fillStyle = "#475569";
  context.font = "600 42px Segoe UI";
  context.fillText("Uploaded document", canvas.width / 2, 470);

  context.fillStyle = "#64748b";
  context.font = "32px Segoe UI";
  context.fillText(limitText(context, fileName || "Untitled file", 420), canvas.width / 2, 550);

  context.fillStyle = "#94a3b8";
  context.font = "28px Segoe UI";
  context.fillText(limitText(context, mimeType || "Preview generated for drag-and-drop", 460), canvas.width / 2, 610);

  context.strokeStyle = "#cbd5e1";
  context.lineWidth = 4;
  context.strokeRect(110, 100, 500, 760);

  return renderCanvasToPng(canvas);
};

const createPdfPreviewImage = async (dataUrl) => {
  const loadingTask = pdfjs.getDocument(dataUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.25 });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  await page.render({ canvasContext: context, viewport }).promise;
  return renderCanvasToPng(canvas);
};

const createImagePreviewImage = async (dataUrl) => {
  const image = await loadImage(dataUrl);
  const maxWidth = 720;
  const maxHeight = 960;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is unavailable.");
  }

  context.drawImage(image, 0, 0, width, height);
  return renderCanvasToPng(canvas);
};

export const createDocumentDragAsset = async ({
  fileName = "document",
  dataUrl,
  mimeType = "",
  userRole = "owner",
} = {}) => {
  if (!dataUrl) {
    return null;
  }

  const resolvedMimeType = mimeType || getMimeTypeFromDataUrl(dataUrl);

  try {
    if (isPdfLike({ fileName, mimeType: resolvedMimeType, dataUrl })) {
      const preview = await createPdfPreviewImage(dataUrl);
      return {
        id: `uploaded-doc-${userRole}-${Date.now()}`,
        name: fileName,
        type: "image",
        image: preview,
        user: userRole,
        source: "uploaded-document",
      };
    }

    if (isImageLike({ fileName, mimeType: resolvedMimeType, dataUrl })) {
      const preview = await createImagePreviewImage(dataUrl);
      return {
        id: `uploaded-doc-${userRole}-${Date.now()}`,
        name: fileName,
        type: "image",
        image: preview,
        user: userRole,
        source: "uploaded-document",
      };
    }
  } catch (error) {
    console.warn("[documentAsset] Falling back to generated card preview:", error);
  }

  return {
    id: `uploaded-doc-${userRole}-${Date.now()}`,
    name: fileName,
    type: "image",
    image: createFallbackCardImage(fileName, resolvedMimeType),
    user: userRole,
    source: "uploaded-document",
  };
};