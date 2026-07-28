/**
 * Lit un fichier image et retourne une data URL JPEG redimensionnée/compressée,
 * afin de pouvoir la stocker directement avec la fiche produit.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxSize = 800,
  quality = 0.75,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire l'image"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image invalide"));
    image.src = dataUrl;
  });

  const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}
