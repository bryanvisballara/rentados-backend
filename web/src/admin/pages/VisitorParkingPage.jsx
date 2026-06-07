import { useEffect, useState } from 'react';
import { adminApi } from '../../api/client';
import '../admin.css';

const emptySpot = { spotNumber: '', zone: 'Visitantes', label: '' };

export default function VisitorParkingPage() {
  const [spots, setSpots] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptySpot);
  const [bulkForm, setBulkForm] = useState({ count: '10', prefix: 'V-', startNumber: '1', zone: 'Visitantes' });
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const data = await adminApi.visitorParking.list();
    setSpots(data.spots);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveSpot(e) {
    e.preventDefault();
    try {
      if (editingId) {
        await adminApi.visitorParking.update(editingId, form);
        setEditingId(null);
      } else {
        await adminApi.visitorParking.create(form);
      }
      setForm(emptySpot);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createBulk(e) {
    e.preventDefault();
    try {
      await adminApi.visitorParking.bulkCreate({
        count: Number(bulkForm.count),
        prefix: bulkForm.prefix,
        startNumber: Number(bulkForm.startNumber),
        zone: bulkForm.zone,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(spot) {
    setEditingId(spot._id);
    setForm({
      spotNumber: spot.spotNumber,
      zone: spot.zone,
      label: spot.label || '',
    });
  }

  async function removeSpot(id) {
    if (!window.confirm('¿Eliminar este parqueadero?')) return;
    try {
      await adminApi.visitorParking.remove(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptySpot);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Parqueaderos de visitantes</h1>
        <p>Define cuántos cupos hay, asígnales número o nombre. La portería los operará después.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-grid" style={{ marginBottom: '1rem' }}>
        <div className="admin-stat">
          <p className="admin-stat__label">Total configurados</p>
          <p className="admin-stat__value">{spots.length}</p>
        </div>
      </div>

      <div className="admin-card">
        <h2>Crear cupos en lote</h2>
        <form className="admin-form" onSubmit={createBulk}>
          <label>
            Cantidad
            <input
              type="number"
              min="1"
              max="100"
              value={bulkForm.count}
              onChange={(e) => setBulkForm({ ...bulkForm, count: e.target.value })}
              required
            />
          </label>
          <label>
            Prefijo
            <input
              value={bulkForm.prefix}
              onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
              placeholder="V-"
            />
          </label>
          <label>
            Número inicial
            <input
              type="number"
              value={bulkForm.startNumber}
              onChange={(e) => setBulkForm({ ...bulkForm, startNumber: e.target.value })}
            />
          </label>
          <label>
            Zona
            <input
              value={bulkForm.zone}
              onChange={(e) => setBulkForm({ ...bulkForm, zone: e.target.value })}
            />
          </label>
          <button type="submit" className="admin-btn">
            Generar parqueaderos
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2>{editingId ? 'Editar parqueadero' : 'Agregar parqueadero individual'}</h2>
        <form className="admin-form" onSubmit={saveSpot}>
          <label>
            Número / código
            <input
              value={form.spotNumber}
              onChange={(e) => setForm({ ...form, spotNumber: e.target.value })}
              placeholder="V-01"
              required
            />
          </label>
          <label>
            Zona
            <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
          </label>
          <label>
            Nombre / etiqueta
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Visitante principal"
            />
          </label>
          <div className="admin-actions">
            <button type="submit" className="admin-btn">
              {editingId ? 'Guardar' : 'Registrar'}
            </button>
            {editingId && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptySpot);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-card admin-table-wrap">
        <h2>Cupos registrados</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Zona</th>
              <th>Etiqueta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {spots.map((s) => (
              <tr key={s._id}>
                <td>{s.spotNumber}</td>
                <td>{s.zone}</td>
                <td>{s.label || '—'}</td>
                <td className="admin-actions">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => startEdit(s)}>
                    Editar
                  </button>
                  <button type="button" className="admin-btn admin-btn--danger" onClick={() => removeSpot(s._id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
