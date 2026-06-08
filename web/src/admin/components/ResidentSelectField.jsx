import { useMemo, useState } from 'react';

function formatResidentLabel(resident) {
  const name = `${resident.userId?.firstName || ''} ${resident.userId?.lastName || ''}`.trim();
  const unit = resident.unitId?.number ? `Apto ${resident.unitId.number}` : 'Sin unidad';
  return `${name || 'Sin nombre'} · ${unit}`;
}

export default function ResidentSelectField({
  residents,
  value,
  onChange,
  required = false,
  placeholder = 'Seleccionar residente',
}) {
  const [query, setQuery] = useState('');

  const filteredResidents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return residents;

    return residents.filter((resident) => {
      const name = `${resident.userId?.firstName || ''} ${resident.userId?.lastName || ''}`.toLowerCase();
      const email = resident.userId?.email?.toLowerCase() || '';
      const unit = String(resident.unitId?.number || '').toLowerCase();
      return name.includes(q) || email.includes(q) || unit.includes(q);
    });
  }, [residents, query]);

  const valueInList = !value || filteredResidents.some((r) => r._id === value);

  return (
    <div className="admin-unit-picker">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nombre, email o unidad"
        aria-label="Buscar residente"
        className="admin-unit-picker__search"
      />
      <p className="admin-unit-picker__meta">
        {filteredResidents.length} de {residents.length} residente(s)
        {value && !valueInList ? ' · selección fuera del filtro actual' : ''}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        size={Math.min(Math.max(filteredResidents.length + 1, 4), 8)}
        className="admin-unit-picker__list"
      >
        <option value="">{placeholder}</option>
        {filteredResidents.map((resident) => (
          <option key={resident._id} value={resident._id}>
            {formatResidentLabel(resident)}
          </option>
        ))}
      </select>
      {filteredResidents.length === 0 && (
        <p className="admin-unit-picker__empty">No hay residentes con ese filtro.</p>
      )}
    </div>
  );
}
