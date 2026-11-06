const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type DetectedImage = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

const SIGNATURES: {
  mime: DetectedImage["mime"];
  extension: DetectedImage["extension"];
  matches: (bytes: Uint8Array) => boolean;
}[] = [
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (bytes) =>
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mime: "image/png",
    extension: "png",
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47,
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (bytes) =>
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50,
  },
];

export function detectImage(bytes: Uint8Array): DetectedImage | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

export function imageResponse(
  bytes: ReadableStream | ArrayBuffer | Uint8Array,
  mime: string,
  cache: "public" | "private",
) {
  return new Response(bytes, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": cache === "public" ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function mimeForKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
