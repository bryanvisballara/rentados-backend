const { ResidentVisitorRequest } = require('../models');

function formatVisitorRequest(doc) {
  const visit = doc?.toObject ? doc.toObject() : doc;
  if (!visit) return visit;

  const unit = visit.unitId;
  const resident = visit.residentId;
  const user = resident?.userId;

  return {
    _id: visit._id,
    visitorName: visit.visitorName,
    licensePlate: visit.licensePlate,
    expectedAt: visit.expectedAt,
    notes: visit.notes,
    status: visit.status,
    createdAt: visit.createdAt,
    unitId: unit?._id || unit,
    unitNumber: unit?.number,
    unitCode: unit?.code,
    unitTower: unit?.tower,
    residentName: user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : undefined,
    residentEmail: user?.email,
  };
}

async function listResidentVisitorRequests(buildingId, organizationId, options = {}) {
  const { unitId, status, q, limit = 100 } = options;

  const filter = {
    organizationId,
    buildingId,
  };

  if (unitId) filter.unitId = unitId;
  if (status === 'pending' || status === 'acknowledged' || status === 'cancelled') {
    filter.status = status;
  }

  let requests = await ResidentVisitorRequest.find(filter)
    .populate('unitId', 'number code tower')
    .populate({
      path: 'residentId',
      populate: { path: 'userId', select: 'firstName lastName email' },
    })
    .sort({ status: 1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 200));

  if (q) {
    const search = String(q).toLowerCase().trim();
    requests = requests.filter((row) => {
      const formatted = formatVisitorRequest(row);
      const haystack = [
        formatted.visitorName,
        formatted.licensePlate,
        formatted.unitNumber,
        formatted.unitCode,
        formatted.residentName,
        formatted.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const statusOrder = { pending: 0, acknowledged: 1, cancelled: 2 };
  requests.sort((a, b) => {
    const sa = statusOrder[a.status] ?? 9;
    const sb = statusOrder[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return requests.map(formatVisitorRequest);
}

async function acknowledgeResidentVisitorRequest(requestId, context) {
  const { organization, building } = context;
  if (!organization || !building) {
    const err = new Error('Organización o conjunto no encontrado');
    err.status = 404;
    throw err;
  }

  const request = await ResidentVisitorRequest.findOne({
    _id: requestId,
    organizationId: organization._id,
    buildingId: building._id,
    status: 'pending',
  });

  if (!request) {
    const err = new Error('Solicitud no encontrada o ya fue atendida');
    err.status = 404;
    throw err;
  }

  request.status = 'acknowledged';
  await request.save();

  const populated = await ResidentVisitorRequest.findById(request._id)
    .populate('unitId', 'number code tower')
    .populate({
      path: 'residentId',
      populate: { path: 'userId', select: 'firstName lastName email' },
    });

  return formatVisitorRequest(populated);
}

module.exports = {
  formatVisitorRequest,
  listResidentVisitorRequests,
  acknowledgeResidentVisitorRequest,
};
