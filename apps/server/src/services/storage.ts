import { createUuidV7 } from "@siakad-itbkmmubar/uuid";

export interface FileValidationOptions {
  allowedMimeTypes?: readonly string[];
  maxBytes: number;
}

export interface ValidatedFileMetadata {
  declaredMime: string | undefined;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface FileStorage {
  delete: (objectKey: string) => Promise<void>;
  get: (objectKey: string) => Promise<R2ObjectBody | null>;
  put: (
    objectKey: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: R2PutOptions
  ) => Promise<R2Object>;
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

const sanitizeFilename = (filename: string): string => {
  const sanitized = [
    ...filename.normalize("NFKC").replaceAll("/", "").replaceAll("\\", ""),
  ]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .trim();

  return sanitized.slice(0, 180) || "file";
};

export const validateFileMetadata = (
  metadata: {
    declaredMime?: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  },
  options: FileValidationOptions
): ValidatedFileMetadata => {
  if (!Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes < 0) {
    throw new FileValidationError("Ukuran file tidak valid.");
  }

  if (metadata.sizeBytes > options.maxBytes) {
    throw new FileValidationError(
      `Ukuran file maksimal ${Math.floor(options.maxBytes / 1_000_000)} MB.`
    );
  }

  if (
    options.allowedMimeTypes &&
    !options.allowedMimeTypes.includes(metadata.mimeType)
  ) {
    throw new FileValidationError("Jenis file tidak didukung.");
  }

  return {
    declaredMime: metadata.declaredMime,
    filename: sanitizeFilename(metadata.filename),
    mimeType: metadata.mimeType,
    sizeBytes: metadata.sizeBytes,
  };
};

export const createPrivateObjectKey = (
  namespace: string,
  entityId: string
): string => {
  const normalizedNamespace = namespace.replaceAll(/[^a-z0-9/-]/giu, "");
  const normalizedEntityId = entityId.replaceAll(/[^a-z0-9_-]/giu, "");
  return `${normalizedNamespace}/${normalizedEntityId}/${createUuidV7()}`;
};

export const createR2FileStorage = (bucket: R2Bucket): FileStorage => ({
  delete: (objectKey) => bucket.delete(objectKey),
  get: (objectKey) => bucket.get(objectKey),
  put: (objectKey, value, options) => bucket.put(objectKey, value, options),
});

export const uploadWithCompensation = async <T>(
  storage: FileStorage,
  objectKey: string,
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
  commitMetadata: () => Promise<T>,
  options?: R2PutOptions
): Promise<T> => {
  await storage.put(objectKey, value, options);

  try {
    return await commitMetadata();
  } catch (error) {
    try {
      await storage.delete(objectKey);
    } catch (cleanupError) {
      throw new Error(
        "File metadata gagal disimpan dan pembersihan objek juga gagal.",
        {
          cause: cleanupError,
        }
      );
    }

    throw error;
  }
};
