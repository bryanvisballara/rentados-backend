import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/client';
import '../admin.css';

export default function ResidentsPage() {
  const [residents, setResidents] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });

  useEffect(() => {
    adminApi
      .residents.list(filters)
      .then((data) => setResidents(data.residents))
      .catch((err) => setError(err.message));
  }, [filters]);

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Base de datos de residentes</h1>
        <p>Consulta clientes por unidad, filtra por estado y revisa su historial.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-card">
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Nombre o unidad"
            />
          </label>
          <label>
            Estado administración
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="current">Al día</option>
              <option value="pending">Pendiente</option>
              <option value="overdue">Moroso</option>
            </select>
          </label>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Residente</th>
              <th>Unidad</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r._id}>
                <td>
                  {r.userId?.firstName} {r.userId?.lastName}
                </td>
                <td>{r.unitId?.number || '—'}</td>
                <td>{r.unitId?.type || '—'}</td>
                <td>
                  <span className={`admin-badge admin-badge--${r.unitId?.adminStatus}`}>
                    {r.unitId?.adminStatus}
                  </span>
                </td>
                <td>
                  <Link to={`/admin/residentes/${r._id}`} className="admin-link">
                    Ver detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
