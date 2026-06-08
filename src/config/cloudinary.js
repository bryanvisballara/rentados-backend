const cloudinary = require('cloudinary').v2;

function configureCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true });
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

function requireCloudinary() {
  const client = configureCloudinary();
  if (!client) {
    const err = new Error(
      'Cloudinary no está configurado. Define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET (o CLOUDINARY_URL).'
    );
    err.status = 503;
    throw err;
  }
  return client;
}

module.exports = { configureCloudinary, requireCloudinary };
