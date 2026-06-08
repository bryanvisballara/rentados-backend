const multer = require('multer');

const MAX_BYTES = 12 * 1024 * 1024;

const uploadPackagePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp|heic|heif)$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Solo se permiten imágenes (JPG, PNG, GIF, WebP).'));
  },
});

module.exports = { uploadPackagePhoto, MAX_BYTES };
