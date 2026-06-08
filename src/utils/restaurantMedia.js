const { requireCloudinary } = require('../config/cloudinary');

function dataUriFromBuffer(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

async function uploadRestaurantImage(buffer, mimetype, type = 'cover') {
  const cloudinary = requireCloudinary();

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), {
    folder: `rentados/restaurants/${type}`,
    resource_type: 'image',
    quality: 'auto:good',
    fetch_format: 'auto',
    overwrite: false,
  });

  return {
    url: result.secure_url,
    cloudinaryPublicId: result.public_id,
  };
}

module.exports = { uploadRestaurantImage };
