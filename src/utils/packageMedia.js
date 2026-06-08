const { requireCloudinary } = require('../config/cloudinary');
const { mapUploadResult } = require('./publicationMedia');

function dataUriFromBuffer(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

async function uploadPackagePhoto(buffer, mimetype, organizationId) {
  const cloudinary = requireCloudinary();
  const folder = organizationId ? `rentados/${organizationId}/locker` : 'rentados/locker';

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), {
    folder,
    resource_type: 'image',
    quality: 'auto:good',
    fetch_format: 'auto',
    overwrite: false,
  });

  return mapUploadResult(result);
}

module.exports = { uploadPackagePhoto };
