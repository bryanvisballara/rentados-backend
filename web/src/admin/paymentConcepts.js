export const BASE_PAYMENT_CONCEPTS = [
  { value: 'administration', label: 'Administración / condominio' },
  { value: 'parking', label: 'Parqueadero' },
  { value: 'fine', label: 'Multa' },
];

export const OTHER_PAYMENT_CONCEPT = { value: 'other', label: 'Otro' };

export const PAYMENT_CONCEPT_LABELS = {
  administration: 'Administración / condominio',
  utilities: 'Servicios públicos',
  parking: 'Parqueadero',
  fine: 'Multa',
  service: 'Servicio',
  other: 'Otro',
};

export function isPaidFacility(facility) {
  if (!facility) return false;
  if (Number(facility.price) > 0) return true;

  const pricing = facility.bookingPricing || {};
  if (pricing.mode === 'hourly' && Number(pricing.hourlyRate) > 0) return true;
  if (pricing.mode === 'flat' && Number(pricing.flatPrice) > 0) return true;
  if (pricing.mode === 'blocks' && pricing.blocks?.some((b) => Number(b.price) > 0)) return true;

  return ['monthly', 'per_use', 'per_hour', 'per_block'].includes(facility.pricingType);
}

export function buildPaymentConceptOptions(facilities = []) {
  const paidServices = facilities
    .filter(isPaidFacility)
    .map((f) => ({
      value: `service:${f._id}`,
      label: f.name,
      facilityId: f._id,
    }));

  return [...BASE_PAYMENT_CONCEPTS, ...paidServices, OTHER_PAYMENT_CONCEPT];
}

export function getPaymentConceptLabel(payment) {
  if (payment?.conceptLabel) return payment.conceptLabel;

  const facilityName =
    payment?.facilityId?.name ||
    (typeof payment?.facilityId === 'object' ? payment.facilityId?.name : null);

  if (payment?.concept === 'service' && facilityName) return facilityName;

  return PAYMENT_CONCEPT_LABELS[payment?.concept] || payment?.concept || '—';
}
