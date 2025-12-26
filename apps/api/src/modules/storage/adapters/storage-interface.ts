export type BucketType = "qr" | "biometrics" | "documents";

export interface UploadResult {
  url: string;
  key: string;
  size?: number;
}

export type StorageAdapter = {
  uploadFile: (file: File, fileName: string, contentType: string, bucketType: BucketType) => Promise<UploadResult>;
  getPresignedUrl: (key: string, bucketType: BucketType, expiresIn?: number) => Promise<string>;
}

export type CreateStorageAdapter = () => StorageAdapter;
