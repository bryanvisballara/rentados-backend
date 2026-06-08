import { useEffect, useState } from 'react';
import { porteriaApi } from '../../api/client';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';

export default function NotificationsPage() {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [title, setTitle] = useState('Aviso de portería');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    porteriaApi.units()
      .then((unitsData) => setUnits(unitsData.units || []))
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
        unitId,
      });

      if (result.count > 0) {
        setSuccess(`Notificación enviada a ${result.count} residente(s) de la unidad.`);
      } else {
        setSuccess('Mensaje registrado. La unidad no tiene residentes en la app para notificar.');
      }
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
        <p>Envía avisos a una unidad (domicilios, visitas, novedades).</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria__card">
        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
            Unidad destino
            <UnitSelectField
              units={units}
              value={unitId}
              onChange={setUnitId}
              required
              placeholder="Seleccionar unidad"
            />
          </label>

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
            <button type="submit" className="admin-btn" disabled={saving || !unitId}>
              {saving ? 'Enviando…' : 'Enviar notificación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
