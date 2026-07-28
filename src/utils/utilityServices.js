const SERVICE_TYPES = [
  { key: 'energy', label: 'Energía eléctrica' },
  { key: 'water', label: 'Acueducto y alcantarillado' },
  { key: 'gas', label: 'Gas natural' },
  { key: 'internet', label: 'Internet y televisión' },
  { key: 'phone', label: 'Telefonía móvil' },
];

const SERVICE_TYPE_KEYS = SERVICE_TYPES.map((item) => item.key);

function serviceTypeLabel(key) {
  return SERVICE_TYPES.find((item) => item.key === key)?.label || key;
}

function normalizeCity(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

module.exports = {
  SERVICE_TYPES,
  SERVICE_TYPE_KEYS,
  serviceTypeLabel,
  normalizeCity,
};
