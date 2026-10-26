import { z } from 'zod';

export const avatarDataUrlSchema = z.string()
  .max(1_398_127)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);

const MAX_AVATAR_BYTES = 1_048_576;

export function validateAvatarImage(dataUrl) {
  if (!avatarDataUrlSchema.safeParse(dataUrl).success) {
    return { status: 400, error: 'La imagen debe ser JPEG, PNG o WebP en formato Base64.' };
  }

  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const imageBytes = Buffer.from(base64, 'base64');
  if (imageBytes.toString('base64') !== base64) {
    return { status: 400, error: 'El contenido de la imagen Base64 no es válido.' };
  }
  if (imageBytes.byteLength > MAX_AVATAR_BYTES) {
    return { status: 413, error: 'La foto de perfil no puede superar 1 MB.' };
  }

  const isJpeg = imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
  const isPng = imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = imageBytes.toString('ascii', 0, 4) === 'RIFF'
    && imageBytes.toString('ascii', 8, 12) === 'WEBP';
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';'));
  if (
    (mimeType === 'image/jpeg' && !isJpeg)
    || (mimeType === 'image/png' && !isPng)
    || (mimeType === 'image/webp' && !isWebp)
  ) {
    return { status: 400, error: 'El contenido no coincide con el formato de imagen declarado.' };
  }
  return null;
}
