export const extractPhotos = (params: {
  files?: Express.Multer.File[];
  bodyPhotos?: unknown;
  prefix?: string;
}): string[] | undefined => {
  const { files, bodyPhotos, prefix = "/activities/" } = params;

  if (files && files.length > 0) {
    return files.map((file) => `${prefix}${file.filename}`);
  }

  if (bodyPhotos === undefined || bodyPhotos === null) {
    return undefined;
  }

  return Array.isArray(bodyPhotos) ? (bodyPhotos as string[]) : [bodyPhotos as string];
};

/**
 * Convert relative photo paths to full URLs
 * If photo already has http/https, returns as-is
 */
export const toFullPhotoUrl = (photo: string): string => {
  return photo?.startsWith("http") ? photo : `${process.env.BASE_URL}${photo}`;
};

/**
 * Convert array of photo paths to full URLs
 */
export const toFullPhotoUrls = (photos: unknown): string[] => {
  const arr = Array.isArray(photos) ? photos : [];
  return arr.map((photo: string) => toFullPhotoUrl(photo));
};
