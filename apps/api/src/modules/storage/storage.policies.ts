export function storagePolicies() {
  return {
    userFace: {
      maxSize: 50 * 1024 * 1024, // 50MB
      allowedTypes: ["image/png", "image/jpg", "image/jpeg", "image/webp","image/heic", "image/heif", "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"],
    },
    permissionDocument: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
        "image/heic",
        "image/heif",
        "image/bmp",
        "image/svg+xml",
      ],
    },
    imagesLimit: (images: string[]): boolean => {
        const MAX_IMAGES = 3;
        return !(images.length < MAX_IMAGES);
    }
  };
}