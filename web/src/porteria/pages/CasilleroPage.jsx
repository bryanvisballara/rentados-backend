import { useEffect, useState } from 'react';
import { porteriaApi } from '../../api/client';
import { formatUnitLabel } from '../../utils/units';
import '../../admin/admin.css';

export default function CasilleroPage() {
  const [units, setUnits] = useState([]);
  const [expandedUnitId, setExpandedUnitId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notifyingId, setNotifyingId] = useState('');

  async function load() {
    const data = await porteriaApi.lockerPackages.summaryByUnit();
    setUnits(data.units || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function notifyOverflow(unitId) {
    setNotifyingId(unitId);
    setError('');
    setSuccess('');
    try {
      const result = await porteriaApi.lockerPackages.notifyOverflow(unitId);
      setSuccess(`Unidad notificada (${result.count} paquetes pendientes).`);
    } catch (err) {
      setError(err.message);
    } finally {
      setNotifyingId('');
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Casillero</h1>
        <p>Vista general por unidad. Notifica cuando hay 5 o más paquetes pendientes.</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      {units.length === 0 ? (
        <div className="porteria__card">
          <p className="porteria__hint">No hay paquetes pendientes en casillero.</p>
        </div>
      ) : (
        <div className="porteria__packages">
          {units.map((unit) => (
            <article
              key={unit.unitId}
              className={`porteria__card porteria-unit-card${unit.count >= 5 ? ' porteria-unit-card--alert' : ''}`}
            >
              <div className="porteria-unit-card__head">
                <div>
                  <h2>
                    {formatUnitLabel({
                      number: unit.unitNumber,
                      code: unit.unitCode,
                      tower: unit.tower,
                    })}
                  </h2>
                  <p className="porteria__hint">{unit.count} paquete(s) pendiente(s)</p>
                </div>
                <div className="porteria-unit-card__actions">
                  {unit.count >= 5 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={notifyingId === unit.unitId}
                      onClick={() => notifyOverflow(unit.unitId)}
                    >
                      {notifyingId === unit.unitId ? 'Enviando…' : 'Notificar acumulación'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={() =>
                      setExpandedUnitId(expandedUnitId === unit.unitId ? '' : unit.unitId)
                    }
                  >
                    {expandedUnitId === unit.unitId ? 'Ocultar' : 'Ver detalle'}
                  </button>
                </div>
              </div>

              {expandedUnitId === unit.unitId && (
                <ul className="porteria-unit-card__list">
                  {unit.packages.map((pkg) => (
                    <li key={pkg._id}>
                      <img src={pkg.photoUrl} alt="" className="porteria__package-photo" />
                      <div>
                        <p>{pkg.comment || 'Paquete sin descripción'}</p>
                        <p className="porteria__package-meta">
                          {new Date(pkg.createdAt).toLocaleString()} · Recibió {pkg.registeredByName || '—'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
