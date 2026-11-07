export const MAX_UPLOAD_EDGE = 1600;
const IMAGE_QUALITY = 0.82;

export function fittedSize(width: number, height: number, maxEdge = MAX_UPLOAD_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, IMAGE_QUALITY);
  });
}

/** Shrink a gallery upload when the browser can draw it. The API still checks type and size. */
export async function compressUpload(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = fittedSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webp = await canvasBlob(canvas, "image/webp");
  const encoded = webp ?? (await canvasBlob(canvas, "image/jpeg"));
  if (!encoded || encoded.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  const type = encoded.type || (webp ? "image/webp" : "image/jpeg");
  const extension = type === "image/webp" ? "webp" : "jpg";
  return new File([encoded], `${base}.${extension}`, { type });
}
