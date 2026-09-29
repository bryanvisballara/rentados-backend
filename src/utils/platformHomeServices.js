const { PlatformHomeService, PlatformHomeServiceMember } = require('../models');
const { RENTADOS_HOME_SERVICES_CATALOG } = require('../data/rentadosHomeServicesCatalog');

function formatPlatformService(doc) {
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

function formatPlatformMember(doc) {
  const item = doc?.toObject ? doc.toObject() : doc;
  if (!item) return item;
  return {
    id: item._id,
    serviceId: item.serviceId?._id || item.serviceId,
    memberType: item.memberType,
    name: item.name,
    tagline: item.tagline,
    resume: item.resume,
    media: item.media || [],
    sortOrder: item.sortOrder,
    isActive: item.isActive !== false,
  };
}

async function ensurePlatformHomeServices() {
  await Promise.all(
    RENTADOS_HOME_SERVICES_CATALOG.map((item) =>
      PlatformHomeService.findOneAndUpdate(
        { slug: item.slug },
        {
          $setOnInsert: {
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
}

async function listPlatformHomeServicesForResidents() {
  await ensurePlatformHomeServices();
  const services = await PlatformHomeService.find({ isActive: true }).sort({
    sortOrder: 1,
    name: 1,
  });

  const serviceIds = services.map((s) => s._id);
  const members = await PlatformHomeServiceMember.find({
    serviceId: { $in: serviceIds },
    isActive: true,
  }).sort({ sortOrder: 1, name: 1 });

  const membersByService = new Map();
  members.forEach((m) => {
    const key = String(m.serviceId);
    if (!membersByService.has(key)) membersByService.set(key, []);
    membersByService.get(key).push(formatPlatformMember(m));
  });

  return services.map((s) => ({
    ...formatPlatformService(s),
    members: membersByService.get(String(s._id)) || [],
  }));
}

async function listPlatformHomeServicesForAdmin() {
  await ensurePlatformHomeServices();
  const services = await PlatformHomeService.find().sort({ sortOrder: 1, name: 1 });
  return services.map(formatPlatformService);
}

async function nextPlatformHomeServiceSortOrder() {
  const last = await PlatformHomeService.findOne().sort({ sortOrder: -1 }).select('sortOrder');
  return (last?.sortOrder ?? 0) + 1;
}

async function reorderPlatformHomeServices(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    const err = new Error('Lista de servicios requerida');
    err.status = 400;
    throw err;
  }

  const ids = orderedIds.map(String);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    const err = new Error('Hay servicios repetidos en el orden');
    err.status = 400;
    throw err;
  }

  const total = await PlatformHomeService.countDocuments();
  if (ids.length !== total) {
    const err = new Error('Debes incluir todos los servicios al reordenar');
    err.status = 400;
    throw err;
  }

  const found = await PlatformHomeService.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) {
    const err = new Error('Uno o más servicios no existen');
    err.status = 400;
    throw err;
  }

  await PlatformHomeService.bulkWrite(
    ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { sortOrder: index + 1 } },
      },
    }))
  );

  return listPlatformHomeServicesForAdmin();
}

async function resolveUniquePlatformServiceSlug(baseSlug) {
  const { slugify } = require('./tenantContext');
  let slug = slugify(baseSlug);
  if (!slug) slug = 'servicio';
  let candidate = slug;
  let n = 2;
  while (await PlatformHomeService.findOne({ slug: candidate })) {
    candidate = `${slug}-${n}`;
    n += 1;
  }
  return candidate;
}

module.exports = {
  formatPlatformService,
  formatPlatformMember,
  ensurePlatformHomeServices,
  listPlatformHomeServicesForResidents,
  listPlatformHomeServicesForAdmin,
  nextPlatformHomeServiceSortOrder,
  resolveUniquePlatformServiceSlug,
  reorderPlatformHomeServices,
};
