const { RentadosHomeService } = require('../models');
const { RENTADOS_HOME_SERVICES_CATALOG } = require('../data/rentadosHomeServicesCatalog');

function formatRentadosHomeService(doc) {
  const item = doc?.toObject ? doc.toObject() : doc;
  if (!item) return item;
  return {
    id: item._id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    sortOrder: item.sortOrder,
    isActive: item.isActive !== false,
  };
}

async function ensureRentadosHomeServices(organizationId) {
  if (!organizationId) return [];

  await Promise.all(
    RENTADOS_HOME_SERVICES_CATALOG.map((item) =>
      RentadosHomeService.findOneAndUpdate(
        { organizationId, slug: item.slug },
        {
          $setOnInsert: {
            organizationId,
            slug: item.slug,
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
            sortOrder: item.sortOrder,
            isActive: true,
          },
        },
        { upsert: true }
      )
    )
  );

  const services = await RentadosHomeService.find({ organizationId, isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });

  return services.map(formatRentadosHomeService);
}

async function listRentadosHomeServicesForAdmin(organizationId) {
  await ensureRentadosHomeServices(organizationId);
  const services = await RentadosHomeService.find({ organizationId }).sort({
    sortOrder: 1,
    name: 1,
  });
  return services.map(formatRentadosHomeService);
}

module.exports = {
  formatRentadosHomeService,
  ensureRentadosHomeServices,
  listRentadosHomeServicesForAdmin,
  RENTADOS_HOME_SERVICES_CATALOG,
};
