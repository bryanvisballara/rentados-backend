const { configureCloudinary } = require('../config/cloudinary');

function dataUriFromBuffer(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

async function uploadUtilityBillPdf(buffer, { organizationId, fileName, nic } = {}) {
  const cloudinary = configureCloudinary();
  if (!cloudinary) {
    return null;
  }

  const folder = organizationId
    ? `rentados/${organizationId}/utility-bills`
    : 'rentados/utility-bills';
  const safeName = String(fileName || `factura-aire-${nic || 'nic'}.pdf`)
    .replace(/[^\w.\-]+/g, '_')
    .slice(0, 120);

  const result = await cloudinary.uploader.upload(dataUriFromBuffer(buffer, 'application/pdf'), {
    folder,
    resource_type: 'raw',
    public_id: `${Date.now()}-${safeName.replace(/\.pdf$/i, '')}`,
    overwrite: false,
    format: 'pdf',
  });

  return {
    url: result.secure_url,
    cloudinaryPublicId: result.public_id,
    fileName: safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`,
    mimeType: 'application/pdf',
  };
}

module.exports = { uploadUtilityBillPdf };
