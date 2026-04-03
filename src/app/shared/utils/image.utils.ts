/**
 * Utilidades de optimización de imágenes.
 *
 * Procesa un File de imagen antes del upload a Storage:
 *   - Redimensiona si supera MAX_SIDE (sin upscale)
 *   - Convierte a WebP (soporta alpha → PNG con transparencia safe)
 *   - Aplica compresión con QUALITY
 */

/** Lado máximo en píxeles (ancho o alto, el que sea mayor) */
const MAX_SIDE = 1200;

/** Calidad de compresión WebP (0–1) */
const QUALITY = 0.78;

/** Formato de salida */
const OUTPUT_FORMAT = 'image/webp';
const OUTPUT_EXT = 'webp';

/** MIME types aceptados */
const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export interface ImageOptimizationResult {
  file: File;
  /** true si el browser soportó la conversión a WebP */
  optimized: boolean;
}

/**
 * Verifica si el archivo es una imagen válida según los tipos aceptados.
 */
export function esImagenValida(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type);
}

/**
 * Optimiza un archivo de imagen antes de subirlo:
 *   1. Redimensiona si algún lado supera MAX_SIDE (mantiene proporción, no upscale)
 *   2. Convierte a WebP con QUALITY
 *
 * Si el browser no soporta toBlob/WebP, retorna el archivo original intacto
 * con `optimized: false` para que el flujo no se rompa.
 *
 * @param file Archivo de imagen original
 * @returns Promesa con el File optimizado y flag de éxito
 */
export async function optimizarImagen(
  file: File
): Promise<ImageOptimizationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { width, height } = calcularDimensiones(img.naturalWidth, img.naturalHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ file, optimized: false });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({ file, optimized: false });
            return;
          }

          const nombreBase = file.name.replace(/\.[^.]+$/, '');
          const optimizedFile = new File([blob], `${nombreBase}.${OUTPUT_EXT}`, {
            type: OUTPUT_FORMAT,
          });

          resolve({ file: optimizedFile, optimized: true });
        },
        OUTPUT_FORMAT,
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file, optimized: false });
    };

    img.src = objectUrl;
  });
}

/**
 * Calcula las dimensiones finales respetando:
 *   - Proporción original
 *   - No superar MAX_SIDE en ningún lado
 *   - No escalar hacia arriba (no upscale)
 */
function calcularDimensiones(
  w: number,
  h: number
): { width: number; height: number } {
  if (w <= MAX_SIDE && h <= MAX_SIDE) {
    return { width: w, height: h };
  }

  const ratio = Math.min(MAX_SIDE / w, MAX_SIDE / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}
