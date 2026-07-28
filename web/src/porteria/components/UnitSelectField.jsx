import { useMemo, useState } from 'react';
import { formatUnitLabel, matchUnitQuery, sortUnitsForPicker } from '../../utils/units';

function unitOptionLabel(unit, { showReceiveHint = false } = {}) {
  const base = formatUnitLabel(unit);
  const parts = [];
  if (unit.pendingPackages) parts.push(`${unit.pendingPackages} paq.`);
  if (unit.adminStatus === 'overdue') parts.push('Mora');
  if (showReceiveHint && unit.canReceivePackages === false) parts.push('No recibe paquetes');
  return parts.length ? `${base} · ${parts.join(' · ')}` : base;
}

export default function UnitSelectField({
  units,
  value,
  onChange,
  required = false,
  placeholder = 'Seleccionar unidad',
  showReceiveHint = false,
  onlyReceivable = false,
}) {
  const [query, setQuery] = useState('');

  const sourceUnits = useMemo(() => {
    if (!onlyReceivable) return units;
    return units.filter((unit) => unit.canReceivePackages !== false);
  }, [units, onlyReceivable]);

  const filteredUnits = useMemo(() => {
    if (!query.trim()) return sourceUnits;
    return sourceUnits.filter((unit) => matchUnitQuery(unit, query));
  }, [sourceUnits, query]);

  const sortedUnits = useMemo(
    () => [...filteredUnits].sort((a, b) => sortUnitsForPicker(a, b, query)),
    [filteredUnits, query]
  );

  return (
    <div className="admin-unit-picker">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por código (ej: 41201)"
        aria-label="Buscar unidad"
        className="admin-unit-picker__search"
      />
      <p className="admin-unit-picker__meta">
        {sortedUnits.length} de {sourceUnits.length} unidad(es)
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        size={Math.min(Math.max(sortedUnits.length + 1, 4), 8)}
        className="admin-unit-picker__list"
      >
        <option value="">{placeholder}</option>
        {sortedUnits.map((unit) => (
          <option key={unit._id} value={unit._id} disabled={showReceiveHint && unit.canReceivePackages === false}>
            {unitOptionLabel(unit, { showReceiveHint })}
          </option>
        ))}
      </select>
      {sortedUnits.length === 0 && (
        <p className="admin-unit-picker__empty">No hay unidades con ese filtro.</p>
      )}
    </div>
  );
}
