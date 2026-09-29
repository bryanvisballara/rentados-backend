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

async function uploadPlatformHomeServiceImage(buffer, mimetype, serviceId) {
  const cloudinary = requireCloudinary();
  const folder = `rentados/platform/home-services/${serviceId}`;

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), {
    folder,
    resource_type: 'image',
    overwrite: true,
    quality: 'auto:good',
    fetch_format: 'auto',
    transformation: [{ width: 900, height: 600, crop: 'fill', gravity: 'auto' }],
  });

  return result.secure_url;
}

async function uploadPlatformHomeServiceMemberMedia(buffer, mimetype, serviceId, memberId) {
  const cloudinary = requireCloudinary();
  const folder = `rentados/platform/home-services/${serviceId}/members/${memberId}`;
  const isVideo = mimetype.startsWith('video/');

  const options = {
    folder,
    resource_type: isVideo ? 'video' : 'image',
    overwrite: false,
  };

  if (isVideo) {
    options.eager = [{ width: 640, height: 360, crop: 'limit', format: 'jpg' }];
    options.eager_async = false;
  } else {
    options.quality = 'auto:good';
    options.fetch_format = 'auto';
  }

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), options);
  return mapUploadResult(result);
}

async function uploadRentadosHomeServiceImage(buffer, mimetype, organizationId, serviceId) {
  const cloudinary = requireCloudinary();
  const folder = organizationId
    ? `rentados/${organizationId}/home-services/${serviceId}`
    : 'rentados/home-services';

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), {
    folder,
    resource_type: 'image',
    overwrite: true,
    quality: 'auto:good',
    fetch_format: 'auto',
    transformation: [{ width: 900, height: 600, crop: 'fill', gravity: 'auto' }],
  });

  return result.secure_url;
}

async function uploadBuildingHeroImage(buffer, mimetype, organizationId, buildingId) {
  const cloudinary = requireCloudinary();
  const folder = organizationId
    ? `rentados/${organizationId}/buildings/${buildingId}/hero`
    : 'rentados/buildings/hero';

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, mimetype), {
    folder,
    resource_type: 'image',
    overwrite: true,
    quality: 'auto:good',
    fetch_format: 'auto',
    transformation: [{ width: 1600, height: 900, crop: 'limit' }],
  });

  return result.secure_url;
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

module.exports = {
  uploadPublicationFile,
  uploadRentadosHomeServiceImage,
  uploadPlatformHomeServiceImage,
  uploadPlatformHomeServiceMemberMedia,
  uploadBuildingHeroImage,
  deletePublicationMedia,
  mapUploadResult,
};
