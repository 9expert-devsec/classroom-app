// src/lib/imageCrop.client.js
export async function centerCropToSquare(
  file,
  size = 512,
  mime = "image/jpeg",
  quality = 0.92,
) {
  const img = await loadImageFromFile(file);

  const s = Math.min(img.width, img.height);
  const sx = Math.floor((img.width - s) / 2);
  const sy = Math.floor((img.height - s) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);

  const blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality),
  );
  if (!blob) throw new Error("Failed to crop image");
  return blob;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
