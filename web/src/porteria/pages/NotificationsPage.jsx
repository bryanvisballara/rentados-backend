import { useEffect, useMemo, useState } from 'react';
import { porteriaApi } from '../../api/client';
import { buildWhatsappUrl, normalizeWhatsappNumber } from '../../utils/whatsapp';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';

function buildWhatsappBody(title, message) {
  const t = (title || '').trim() || 'Aviso de portería';
  const m = (message || '').trim();
  if (!m) return t;
  return `${t}\n\n${m}`;
}

export default function NotificationsPage() {
  const [units, setUnits] = useState([]);
  const [residents, setResidents] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [whatsappResidentId, setWhatsappResidentId] = useState('');
  const [title, setTitle] = useState('Aviso de portería');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([porteriaApi.units(), porteriaApi.residents()])
      .then(([unitsData, residentsData]) => {
        setUnits(unitsData.units || []);
        setResidents(residentsData.residents || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const unitResidentsWithPhone = useMemo(() => {
    if (!unitId) return [];
    return residents.filter((r) => {
      const rid = String(r.unitId?._id || r.unitId || '');
      return rid === unitId && normalizeWhatsappNumber(r.userId?.phone);
    });
  }, [residents, unitId]);

  useEffect(() => {
    if (unitResidentsWithPhone.length === 1) {
      setWhatsappResidentId(unitResidentsWithPhone[0]._id);
      return;
    }
    setWhatsappResidentId('');
  }, [unitId, unitResidentsWithPhone]);

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

  function openWhatsapp() {
    setError('');
    if (!unitId) {
      setError('Selecciona la unidad destino.');
      return;
    }
    if (!message.trim()) {
      setError('Escribe el mensaje antes de enviar por WhatsApp.');
      return;
    }
    if (unitResidentsWithPhone.length === 0) {
      setError(
        'Ningún residente de esta unidad tiene WhatsApp registrado. La administración puede agregarlo en Residentes.'
      );
      return;
    }
    const resident =
      unitResidentsWithPhone.find((r) => r._id === whatsappResidentId) ||
      unitResidentsWithPhone[0];
    const url = buildWhatsappUrl(resident.userId.phone, buildWhatsappBody(title, message));
    if (!url) {
      setError('El número de WhatsApp del residente no es válido.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Notificaciones</h1>
        <p>
          Envía avisos en la app o escribe por WhatsApp a los residentes de la unidad (domicilios,
          visitas, novedades).
        </p>
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

          {unitId && unitResidentsWithPhone.length > 1 && (
            <label style={{ gridColumn: '1 / -1' }}>
              Residente (WhatsApp)
              <select
                value={whatsappResidentId}
                onChange={(e) => setWhatsappResidentId(e.target.value)}
                required
              >
                <option value="">Seleccionar residente</option>
                {unitResidentsWithPhone.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.userId?.firstName} {r.userId?.lastName} · {r.userId?.phone}
                  </option>
                ))}
              </select>
            </label>
          )}

          {unitId && unitResidentsWithPhone.length === 0 && (
            <p className="admin-empty" style={{ gridColumn: '1 / -1', margin: 0 }}>
              Esta unidad no tiene celular/WhatsApp en el portal administrativo (Residentes).
            </p>
          )}

          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving || !unitId}>
              {saving ? 'Enviando…' : 'Enviar notificación'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={
                !unitId ||
                !message.trim() ||
                unitResidentsWithPhone.length === 0 ||
                (unitResidentsWithPhone.length > 1 && !whatsappResidentId)
              }
              onClick={openWhatsapp}
            >
              Enviar por WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
