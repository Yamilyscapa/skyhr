import type { Location } from "./types";
import API from "@/api";

export async function downloadQrCode(location: Location) {
  if (!location.qr_code_url) {
    alert("No hay un código QR disponible para esta sucursal.");
    return;
  }

  try {
    // Fetch presigned URL from API
    const response = await API.getQrPresignedUrl(location.qr_code_url);
    const presignedUrl = response.url;

    // Fetch the image and create a blob for download
    const imageResponse = await fetch(presignedUrl);
    const blob = await imageResponse.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${location.name || "ubicacion"}-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Failed to download QR code:", error);
    
    // Fallback for development - try direct URL
    const link = document.createElement("a");
    link.href = location.qr_code_url;
    link.download = `${location.name || "ubicacion"}-qr.png`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
