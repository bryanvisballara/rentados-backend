export function formatBuildingAddressLine(addressOrBuilding) {
  const address = addressOrBuilding?.address || addressOrBuilding || {};
  const parts = [address.street, address.city, address.state].filter(Boolean);
  return parts.join(' · ');
}

export function formatBuildingLoginLabel(building) {
  const name = building?.name || '';
  const addressLine = formatBuildingAddressLine(building);
  if (!addressLine) return name;
  return `${name} · ${addressLine}`;
}
