import { useMemo, useState } from 'react';

export default function UnitSelectField({
  units,
  value,
  onChange,
  required = false,
  placeholder = 'Seleccionar unidad',
}) {
  const [query, setQuery] = useState('');

  const filteredUnits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return units;

    return units.filter((unit) => {
      const number = String(unit.number || '').toLowerCase();
      const tower = String(unit.tower || '').toLowerCase();
      return number.includes(q) || tower.includes(q);
    });
  }, [units, query]);

  return (
    <div className="admin-unit-picker">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por número o torre"
        aria-label="Buscar unidad"
        className="admin-unit-picker__search"
      />
      <p className="admin-unit-picker__meta">
        {filteredUnits.length} de {units.length} unidad(es)
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        size={Math.min(Math.max(filteredUnits.length + 1, 4), 8)}
        className="admin-unit-picker__list"
      >
        <option value="">{placeholder}</option>
        {filteredUnits.map((unit) => (
          <option key={unit._id} value={unit._id}>
            Apto {unit.number}
            {unit.tower ? ` · Torre ${unit.tower}` : ''}
            {unit.pendingPackages ? ` · ${unit.pendingPackages} paq.` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
