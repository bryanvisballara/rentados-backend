import { useEffect, useState } from 'react';
import { porteriaApi } from '../../api/client';
import ResidentSelectField from '../../admin/components/ResidentSelectField';
import '../../admin/admin.css';

const emptyEntry = {
  residentId: '',
  licensePlate: '',
  tower: '',
  visitorName: '',
  spotId: '',
};

export default function ParkingPage() {
  const [summary, setSummary] = useState(null);
  const [residents, setResidents] = useState([]);
  const [towers, setTowers] = useState([]);
  const [form, setForm] = useState(emptyEntry);
  const [exitPlate, setExitPlate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [summaryData, residentsData, towersData] = await Promise.all([
      porteriaApi.parking.summary(),
      porteriaApi.residents(),
      porteriaApi.towers(),
    ]);
    setSummary(summaryData);
    setResidents(residentsData.residents || []);
    setTowers(towersData.towers || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function handleEntry(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await porteriaApi.parking.registerEntry({
        residentId: form.residentId,
        licensePlate: form.licensePlate,
        tower: form.tower || undefined,
        visitorName: form.visitorName || undefined,
        spotId: form.spotId || undefined,
      });
      setSuccess('Visitante registrado. Residente notificado.');
      setForm(emptyEntry);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await porteriaApi.parking.registerExit({ licensePlate: exitPlate });
      setSuccess('Salida registrada. Puesto liberado.');
      setExitPlate('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const availableSpots = summary?.spots?.filter((s) => !s.isOccupied) || [];

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Parqueadero visitantes</h1>
        <p>Registra ingreso con placa y torre. Al salir, busca la placa y libera el puesto.</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria-stats">
        <div className="porteria-stats__item">
          <span>Disponibles</span>
          <strong>{summary?.availableSpots ?? 0}</strong>
        </div>
        <div className="porteria-stats__item">
          <span>Ocupados</span>
          <strong>{summary?.occupiedSpots ?? 0}</strong>
        </div>
        <div className="porteria-stats__item">
          <span>Total puestos</span>
          <strong>{summary?.totalSpots ?? 0}</strong>
        </div>
      </div>

      <div className="porteria__card">
        <h2>Registrar ingreso</h2>
        <form className="admin-form" onSubmit={handleEntry}>
          <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
            Residente que recibe la visita
            <ResidentSelectField
              residents={residents}
              value={form.residentId}
              onChange={(residentId) => setForm({ ...form, residentId })}
              required
            />
          </label>
          <label>
            Placa
            <input
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })}
              placeholder="ABC123"
              required
            />
          </label>
          <label>
            Torre destino
            <select value={form.tower} onChange={(e) => setForm({ ...form, tower: e.target.value })}>
              <option value="">Seleccionar torre</option>
              {towers.map((tower) => (
                <option key={tower} value={tower}>
                  {tower}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nombre visitante (opcional)
            <input
              value={form.visitorName}
              onChange={(e) => setForm({ ...form, visitorName: e.target.value })}
            />
          </label>
          <label>
            Puesto (opcional)
            <select value={form.spotId} onChange={(e) => setForm({ ...form, spotId: e.target.value })}>
              <option value="">Asignar automáticamente</option>
              {availableSpots.map((spot) => (
                <option key={spot._id} value={spot._id}>
                  {spot.spotNumber} {spot.label ? `· ${spot.label}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving || availableSpots.length === 0}>
              {saving ? 'Guardando…' : 'Registrar ingreso'}
            </button>
          </div>
        </form>
      </div>

      <div className="porteria__card">
        <h2>Registrar salida</h2>
        <form className="admin-form" onSubmit={handleExit}>
          <label style={{ gridColumn: '1 / -1' }}>
            Buscar placa
            <input
              value={exitPlate}
              onChange={(e) => setExitPlate(e.target.value.toUpperCase())}
              placeholder="ABC123"
              required
            />
          </label>
          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Procesando…' : 'Dar salida y liberar puesto'}
            </button>
          </div>
        </form>
      </div>

      <div className="porteria__card admin-table-wrap">
        <h2>Visitantes activos</h2>
        {(summary?.activeVisits?.length ?? 0) === 0 ? (
          <p className="porteria__hint">No hay visitantes en el parqueadero.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Unidad</th>
                <th>Torre</th>
                <th>Puesto</th>
                <th>Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {summary.activeVisits.map((visit) => (
                <tr key={visit._id}>
                  <td>{visit.licensePlate}</td>
                  <td>{visit.unitNumber || visit.unitId?.number}</td>
                  <td>{visit.tower || '—'}</td>
                  <td>{visit.spotNumber || visit.spotId?.spotNumber}</td>
                  <td>{new Date(visit.entryAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
