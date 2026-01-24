// src/lib/cloudinaryUpload.server.js
import cloudinary from "@/lib/cloudinary";

export async function uploadSignatureDataUrl(
  dataUrl,
  { folder = "classroom/receive", publicId = "" } = {},
) {
  if (!dataUrl || typeof dataUrl !== "string")
    throw new Error("missing dataUrl");

  const res = await cloudinary.uploader.upload(dataUrl, {
    folder,
    public_id: publicId || undefined,
    resource_type: "image",
    overwrite: true,
  });

  return {
    url: res.secure_url || "",
    publicId: res.public_id || "",
    width: res.width,
    height: res.height,
    format: res.format,
  };
}
