import { isSafeUrl } from "../security/url";

/**
 * Estimate whether a wallpaper photo is light or dark, so the scrim can be
 * strengthened over a light photo and the hero text stays readable. The image
 * is drawn small onto a canvas and its average luminance is sampled. Anything
 * that blocks the read (an unsafe URL, a tainted cross-origin canvas, no DOM)
 * resolves to "dark", which keeps the existing light-text-over-scrim behaviour.
 */
export function analyzePhotoTone(url: string): Promise<"light" | "dark"> {
  // Only load a validated https image; never point an <img> at an arbitrary URL.
  if (
    !isSafeUrl(url, ["https:"]) ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return Promise.resolve("dark");
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = (): void => {
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (context === null) {
          resolve("dark");
          return;
        }
        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        const average = sum / (data.length / 4);
        resolve(average > 150 ? "light" : "dark");
      } catch {
        resolve("dark");
      }
    };
    image.onerror = (): void => {
      resolve("dark");
    };
    image.src = url;
  });
}
