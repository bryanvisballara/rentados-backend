import { formatCop } from '../api/client';

const PRICING_LABELS = {
  free: 'Gratis',
  per_use: 'Por uso',
  monthly: 'Mensual',
  per_hour: 'Por hora',
  per_block: 'Por paquete',
};

export function formatFacilityCost(f) {
  if (f.bookable) {
    const mode = f.bookingPricing?.mode || 'free';
    if (mode === 'hourly' && f.bookingPricing?.hourlyRate > 0) {
      return `${formatCop(f.bookingPricing.hourlyRate)}/hora · Reservable`;
    }
    if (mode === 'blocks' && f.bookingPricing?.blocks?.length) {
      return `${f.bookingPricing.blocks.length} paquete(s) · Reservable`;
    }
    if (mode === 'flat' && (f.bookingPricing?.flatPrice || f.price)) {
      return `${formatCop(f.bookingPricing?.flatPrice || f.price)} · Reservable`;
    }
    return 'Reservable · Gratis';
  }

  if (f.price > 0) {
    return `${formatCop(f.price)} · ${PRICING_LABELS[f.pricingType] || f.pricingType}`;
  }
  return 'Gratis';
}
