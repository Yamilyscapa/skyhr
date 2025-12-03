import type { StorageAdapter } from "./adapters/storage-interface";

const getFileExtension = (mimeType: string): string => {
  return mimeType.includes('jpeg') ? 'jpg' : mimeType.split('/')[1] || 'bin';
};

/**
 * Storage service utility functions for handling
 * file uploads (e.g., user face images, QR codes).
 *
 * @param relationId - The ID of the relation to the file.
 * @param index - The index of the file in the relation.
 * @param storeType - The type of the store to the file.
 * @param fileExtension - The extension of the file.
 * @returns The file name based on the parameters such as relation ID, index, and storage type.
 */
const generateFileName = (relationId: string, index: number, storeType: string, fileExtension: string): string => {
  return `${relationId}-${index}-${storeType}.${fileExtension}`;
};

export const uploadUserFace = (storageAdapter: StorageAdapter) =>
  async (file: File, userId: string, faceIndex: number, storeType: string): Promise<{ url: string; fileName: string }> => {
    const type = file.type;
    const fileExtension = getFileExtension(type);
    const fileName = generateFileName(userId, faceIndex, storeType, fileExtension);

    const result = await storageAdapter.uploadFile(file, fileName, type);

    return {
      url: result.url,
      fileName: result.key,
    };
  };

export const uploadQr = (storageAdapter: StorageAdapter) =>
  async (file: File, storeType: string, relationId: string): Promise<{ url: string; fileName: string }> => {
    // ! relation ID undestrood as organization ID or location ID
    
    if (!relationId) {
      throw new Error("Relation ID is required");
    }

    const type = file.type;
    const fileExtension = getFileExtension(type);
    const fileName = generateFileName(relationId, 0, storeType, fileExtension);

    const result = await storageAdapter.uploadFile(file, fileName, type);

    return {
      url: result.url,
      fileName: result.key,
    };
  };

export const uploadPermissionDocument = (storageAdapter: StorageAdapter) =>
  async (file: File, permissionId: string, documentIndex: number): Promise<{ url: string; fileName: string }> => {
    if (!permissionId) {
      throw new Error("Permission ID is required");
    }

    const type = file.type;
    const fileExtension = getFileExtension(type);
    const fileName = generateFileName(permissionId, documentIndex, "permission-document", fileExtension);

    const result = await storageAdapter.uploadFile(file, fileName, type);

    return {
      url: result.url,
      fileName: result.key,
    };
  };

export const createStorageService = (storageAdapter: StorageAdapter) => ({
  uploadUserFace: uploadUserFace(storageAdapter),
  uploadQr: uploadQr(storageAdapter),
  uploadPermissionDocument: uploadPermissionDocument(storageAdapter)
});

export type StorageService = ReturnType<typeof createStorageService>;