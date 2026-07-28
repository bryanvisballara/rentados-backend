function formatServiceCategory(category) {
  return {
    id: category._id,
    _id: category._id,
    name: category.name,
    slug: category.slug,
    description: category.description || '',
    icon: category.icon || '',
    sortOrder: category.sortOrder ?? 0,
    isActive: category.isActive !== false,
  };
}

async function resolveActiveCategoryIds(ServiceCategory, categoryIds = []) {
  const normalizedIds = [...new Set((categoryIds || []).map(String))].filter(Boolean);
  if (!normalizedIds.length) return [];

  const categories = await ServiceCategory.find({
    _id: { $in: normalizedIds },
    isActive: true,
  }).select('_id');

  if (categories.length !== normalizedIds.length) {
    const error = new Error('Selecciona categorías válidas del catálogo');
    error.status = 400;
    throw error;
  }

  return categories.map((category) => category._id);
}

module.exports = { formatServiceCategory, resolveActiveCategoryIds };
