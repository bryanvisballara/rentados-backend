import { useEffect, useState } from 'react';
import { porteriaApi } from '../../api/client';
import SignaturePad from '../components/SignaturePad';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';

export default function BitacoraPage() {
  const [units, setUnits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [packages, setPackages] = useState([]);
  const [filterUnitId, setFilterUnitId] = useState('');
  const [deliveryUnitId, setDeliveryUnitId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadLog(unitId = filterUnitId) {
    const [unitsData, logData] = await Promise.all([
      porteriaApi.units(),
      porteriaApi.bitacora({ unitId: unitId || undefined }),
    ]);
    setUnits(unitsData.units || []);
    setEntries(logData.entries || []);
  }

  async function loadPackages(unitId) {
    if (!unitId) {
      setPackages([]);
      setSelectedPackageId('');
      return;
    }
    const data = await porteriaApi.lockerPackages.list({ unitId, status: 'active', requireEnabled: 'false' });
    setPackages(data.packages || []);
    setSelectedPackageId('');
  }

  useEffect(() => {
    loadLog().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadPackages(deliveryUnitId).catch((err) => setError(err.message));
  }, [deliveryUnitId]);

  async function applyFilter(e) {
    e.preventDefault();
    setError('');
    try {
      await loadLog(filterUnitId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deliverPackage(e) {
    e.preventDefault();
    if (!selectedPackageId) return;
    if (!recipientName.trim()) {
      setError('Indica quién recibe el paquete');
      return;
    }
    if (!signatureData) {
      setError('La firma es obligatoria');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await porteriaApi.lockerPackages.pickup(selectedPackageId, {
        signatureRecipientName: recipientName.trim(),
        signatureData,
      });
      setSuccess('Paquete entregado y registrado en bitácora.');
      setRecipientName('');
      setSignatureData('');
      setSelectedPackageId('');
      await loadLog(filterUnitId);
      await loadPackages(deliveryUnitId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Bitácora</h1>
        <p>Entrega de paquetes con firma y registro de movimientos del equipo de portería.</p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      <div className="porteria__card">
        <h2>Entregar paquete</h2>
        <form className="admin-form" onSubmit={deliverPackage}>
          <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
            Unidad
            <UnitSelectField
              units={units}
              value={deliveryUnitId}
              onChange={setDeliveryUnitId}
              required
            />
          </label>

          {deliveryUnitId && (
            <label style={{ gridColumn: '1 / -1' }}>
              Paquete pendiente
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                required
              >
                <option value="">Seleccionar paquete</option>
                {packages.map((pkg) => (
                  <option key={pkg._id} value={pkg._id}>
                    {new Date(pkg.createdAt).toLocaleString()} · {pkg.comment || 'Sin descripción'} ·{' '}
                    {pkg.status === 'held' ? 'Retención' : 'Pendiente'}
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedPackageId && (
            <>
              <label style={{ gridColumn: '1 / -1' }}>
                Nombre de quien recibe
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                />
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="porteria__hint">Firma del residente</p>
                <SignaturePad onChange={setSignatureData} />
              </div>
            </>
          )}

          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving || !selectedPackageId}>
              {saving ? 'Registrando…' : 'Confirmar entrega'}
            </button>
          </div>
        </form>
      </div>

      <div className="porteria__card">
        <h2>Filtrar bitácora</h2>
        <form className="admin-form" onSubmit={applyFilter}>
          <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
            Unidad (opcional)
            <UnitSelectField units={units} value={filterUnitId} onChange={setFilterUnitId} />
          </label>
          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn admin-btn--ghost">
              Aplicar filtro
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => {
                setFilterUnitId('');
                loadLog('').catch((err) => setError(err.message));
              }}
            >
              Ver todo
            </button>
          </div>
        </form>
      </div>

      <div className="porteria__card admin-table-wrap">
        <h2>Registro de movimientos</h2>
        {entries.length === 0 ? (
          <p className="porteria__hint">Sin registros aún.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Unidad</th>
                <th>Descripción</th>
                <th>Recibió</th>
                <th>Hora ingreso</th>
                <th>Entregó</th>
                <th>Hora entrega</th>
                <th>Firma</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.kind}-${entry.id}`}>
                  <td>{entry.kind === 'package' ? 'Paquete' : 'Visitante'}</td>
                  <td>
                    {entry.unitNumber}
                    {entry.tower ? ` · T${entry.tower}` : ''}
                  </td>
                  <td>{entry.description}</td>
                  <td>{entry.receivedBy || '—'}</td>
                  <td>{entry.receivedAt ? new Date(entry.receivedAt).toLocaleString() : '—'}</td>
                  <td>{entry.deliveredBy || '—'}</td>
                  <td>{entry.deliveredAt ? new Date(entry.deliveredAt).toLocaleString() : '—'}</td>
                  <td>{entry.signatureRecipientName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
