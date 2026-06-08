const { requireCloudinary } = require('../config/cloudinary');

function dataUriFromBuffer(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

function mapUploadResult(result) {
  const isVideo = result.resource_type === 'video';
  const thumbnailUrl =
    result.eager?.[0]?.secure_url ||
    (!isVideo ? result.secure_url : undefined);

  return {
    type: isVideo ? 'video' : 'image',
    url: result.secure_url,
    cloudinaryPublicId: result.public_id,
    thumbnailUrl,
  };
}

async function uploadPublicationFile(buffer, mimetype, organizationId) {
  const cloudinary = requireCloudinary();
  const folder = organizationId
    ? `rentados/${organizationId}/publications`
    : 'rentados/publications';

  const isVideo = mimetype.startsWith('video/');

  const options = {
    folder,
    resource_type: 'auto',
    overwrite: false,
  };

  if (isVideo) {
    options.eager = [{ width: 640, height: 360, crop: 'limit', format: 'jpg' }];
    options.eager_async = false;
  } else {
    options.quality = 'auto:good';
    options.fetch_format = 'auto';
  }

  const result = await cloudinary.uploader.upload(
    dataUriFromBuffer(buffer, mimetype),
    options
  );

  return mapUploadResult(result);
}

async function deletePublicationMedia(mediaItems = []) {
  const cloudinary = requireCloudinary();

  await Promise.all(
    mediaItems
      .filter((item) => item.cloudinaryPublicId)
      .map((item) =>
        cloudinary.uploader.destroy(item.cloudinaryPublicId, {
          resource_type: item.type === 'video' ? 'video' : 'image',
        })
      )
  );
}

module.exports = { uploadPublicationFile, deletePublicationMedia, mapUploadResult };
