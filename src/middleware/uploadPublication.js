const multer = require('multer');

const MAX_BYTES = 50 * 1024 * 1024;

const uploadPublicationMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const allowed = /^(image\/(jpeg|jpg|png|gif|webp|heic|heif)|video\/(mp4|quicktime|webm|mpeg))$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP) o videos (MP4, MOV, WebM).'));
  },
});

module.exports = { uploadPublicationMedia, MAX_BYTES };
