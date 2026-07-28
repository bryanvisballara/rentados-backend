const { ApartmentVisit, Unit } = require('../models');

function formatApartmentVisit(visit) {
  const doc = visit?.toObject ? visit.toObject() : visit;
  if (!doc) return doc;

  const unit = doc.unitId;
  const registeredBy = doc.registeredBy;
  const exitedBy = doc.exitedBy;

  return {
    ...doc,
    unitNumber: unit?.number,
    unitCode: unit?.code,
    unitTower: unit?.towerId?.name || unit?.tower,
    registeredByName: registeredBy
      ? `${registeredBy.firstName || ''} ${registeredBy.lastName || ''}`.trim()
      : undefined,
    exitedByName: exitedBy
      ? `${exitedBy.firstName || ''} ${exitedBy.lastName || ''}`.trim()
      : undefined,
  };
}

async function registerApartmentVisit(input, context) {
  const { organization, building, userId } = context;
  const visitorName = String(input.visitorName || '').trim();
  const documentId = String(input.documentId || '').trim();
  const notes = String(input.notes || '').trim();

  if (!visitorName) throw new Error('El nombre del visitante es requerido');
  if (!documentId) throw new Error('La cédula es requerida');
  if (!input.unitId) throw new Error('Selecciona el apartamento a visitar');

  const unit = await Unit.findOne({
    _id: input.unitId,
    buildingId: building._id,
    organizationId: organization._id,
    isActive: true,
  });
  if (!unit) throw new Error('Unidad no encontrada');

  const visit = await ApartmentVisit.create({
    organizationId: organization._id,
    buildingId: building._id,
    unitId: unit._id,
    visitorName,
    documentId,
    notes: notes || undefined,
    status: 'active',
    entryAt: new Date(),
    registeredBy: userId,
  });

  const populated = await ApartmentVisit.findById(visit._id)
    .populate('unitId', 'number code tower')
    .populate('registeredBy', 'firstName lastName');

  return formatApartmentVisit(populated);
}

async function exitApartmentVisit(visitId, context) {
  const { organization, building, userId } = context;

  const visit = await ApartmentVisit.findOne({
    _id: visitId,
    organizationId: organization._id,
    buildingId: building._id,
    status: 'active',
  });
  if (!visit) throw new Error('Visita activa no encontrada');

  visit.status = 'exited';
  visit.exitAt = new Date();
  visit.exitedBy = userId;
  await visit.save();

  const populated = await ApartmentVisit.findById(visit._id)
    .populate('unitId', 'number code tower')
    .populate('registeredBy', 'firstName lastName')
    .populate('exitedBy', 'firstName lastName');

  return formatApartmentVisit(populated);
}

async function listApartmentVisits(buildingId, organizationId, { unitId, status, q, limit = 100 } = {}) {
  const filter = { buildingId, organizationId };
  if (unitId) filter.unitId = unitId;
  if (status === 'active' || status === 'exited') filter.status = status;

  let visits = await ApartmentVisit.find(filter)
    .populate('unitId', 'number code tower')
    .populate('registeredBy', 'firstName lastName')
    .populate('exitedBy', 'firstName lastName')
    .sort({ entryAt: -1 })
    .limit(Math.min(Number(limit) || 100, 200));

  if (q) {
    const search = String(q).toLowerCase().trim();
    visits = visits.filter((visit) => {
      const haystack = [
        visit.visitorName,
        visit.documentId,
        visit.unitId?.number,
        visit.unitId?.code,
        visit.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return visits.map(formatApartmentVisit);
}

module.exports = {
  formatApartmentVisit,
  registerApartmentVisit,
  exitApartmentVisit,
  listApartmentVisits,
};
