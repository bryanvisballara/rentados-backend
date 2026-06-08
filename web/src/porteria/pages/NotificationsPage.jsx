import { useEffect, useState } from 'react';
import { porteriaApi } from '../../api/client';
import ResidentSelectField from '../../admin/components/ResidentSelectField';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';

export default function NotificationsPage() {
  const [residents, setResidents] = useState([]);
  const [units, setUnits] = useState([]);
  const [targetType, setTargetType] = useState('resident');
  const [residentId, setResidentId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('Aviso de portería');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([porteriaApi.residents(), porteriaApi.units()])
      .then(([residentsData, unitsData]) => {
        setResidents(residentsData.residents || []);
        setUnits(unitsData.units || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await porteriaApi.notifications.send({
        title: title.trim() || 'Aviso de portería',
        message,
        residentId: targetType === 'resident' ? residentId : undefined,
        unitId: targetType === 'unit' ? unitId : undefined,
      });
      setSuccess(`Notificación enviada a ${result.count} residente(s).`);
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Notificaciones</h1>
        <p>Envía avisos rápidos a una unidad o residente (domicilios, visitas, novedades).</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria__card">
        <form className="admin-form" onSubmit={handleSubmit}>
          <label style={{ gridColumn: '1 / -1' }}>
            Enviar a
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="resident">Residente específico</option>
              <option value="unit">Toda la unidad</option>
            </select>
          </label>

          {targetType === 'resident' ? (
            <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
              Residente
              <ResidentSelectField
                residents={residents}
                value={residentId}
                onChange={setResidentId}
                required
              />
            </label>
          ) : (
            <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
              Unidad
              <UnitSelectField units={units} value={unitId} onChange={setUnitId} required />
            </label>
          )}

          <label style={{ gridColumn: '1 / -1' }}>
            Título
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label style={{ gridColumn: '1 / -1' }}>
            Mensaje
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ej: Llegó tu domicilio de Rappi, pasa a recogerlo en portería."
              required
            />
          </label>

          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Enviando…' : 'Enviar notificación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
