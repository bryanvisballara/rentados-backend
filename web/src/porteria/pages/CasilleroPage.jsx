import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTime, porteriaApi } from '../../api/client';
import SignaturePad from '../components/SignaturePad';
import UnitSelectField from '../components/UnitSelectField';
import '../../admin/admin.css';
import '../PorteriaHomePage.css';

const emptyForm = {
  unitId: '',
  comment: '',
  photoUrl: '',
  cloudinaryPublicId: '',
};

const STATUS_LABELS = {
  pending_pickup: 'Pendiente',
  held: 'Retención',
  picked_up: 'Entregado',
};

export default function CasilleroPage() {
  const fileInputRef = useRef(null);
  const [locker, setLocker] = useState({ enabled: false, receiveWhenOverdue: true });
  const [units, setUnits] = useState([]);
  const [packages, setPackages] = useState([]);
  const [entries, setEntries] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [packageQuery, setPackageQuery] = useState('');
  const [packageStatus, setPackageStatus] = useState('active');
  const [packageUnitId, setPackageUnitId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [signatureData, setSignatureData] = useState('');

  const [logUnitId, setLogUnitId] = useState('');
  const [logStatus, setLogStatus] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadUnitsAndSettings() {
    const [settingsData, unitsData] = await Promise.all([
      porteriaApi.settings(),
      porteriaApi.units(),
    ]);
    setLocker(settingsData.locker || { enabled: false });
    setUnits(unitsData.units || []);
  }

  async function loadPackages({ status = packageStatus, unitId = packageUnitId } = {}) {
    const data = await porteriaApi.lockerPackages.list({
      status,
      unitId: unitId || undefined,
      requireEnabled: 'false',
    });
    setPackages(data.packages || []);
  }

  async function loadLog({ unitId = logUnitId } = {}) {
    const data = await porteriaApi.bitacora({
      unitId: unitId || undefined,
      kind: 'package',
      limit: 150,
    });
    setEntries(data.entries || []);
  }

  async function refreshAll() {
    await Promise.all([loadUnitsAndSettings(), loadPackages(), loadLog()]);
  }

  useEffect(() => {
    refreshAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadPackages().catch((err) => setError(err.message));
  }, [packageStatus, packageUnitId]);

  const filteredPackages = useMemo(() => {
    const q = packageQuery.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter((pkg) => {
      const haystack = [
        pkg.unitCode,
        pkg.unitNumber,
        pkg.unitTower,
        pkg.comment,
        pkg.status,
        STATUS_LABELS[pkg.status],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [packages, packageQuery]);

  const selectedPackage = filteredPackages.find((pkg) => pkg._id === selectedPackageId);

  const filteredEntries = useMemo(() => {
    if (!logStatus) return entries;
    if (logStatus === 'received') {
      return entries.filter((entry) => entry.status === 'pending_pickup' || entry.status === 'held');
    }
    if (logStatus === 'delivered') {
      return entries.filter((entry) => entry.status === 'picked_up');
    }
    return entries.filter((entry) => entry.status === logStatus);
  }, [entries, logStatus]);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setError('');
    setSuccess('');

    try {
      setPhotoPreview(URL.createObjectURL(file));
      const data = await porteriaApi.lockerPackages.uploadPhoto(file);
      setForm((prev) => ({
        ...prev,
        photoUrl: data.photo.url,
        cloudinaryPublicId: data.photo.cloudinaryPublicId,
      }));
    } catch (err) {
      setPhotoPreview('');
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await porteriaApi.lockerPackages.create({
        unitId: form.unitId,
        comment: form.comment || undefined,
        photoUrl: form.photoUrl,
        cloudinaryPublicId: form.cloudinaryPublicId || undefined,
      });

      if (result.heldDueToOverdue) {
        setSuccess('Paquete registrado en retención por mora (sin notificar al residente).');
      } else if (result.notified) {
        setSuccess('Paquete registrado y unidad notificada.');
      } else {
        setSuccess('Paquete registrado. La unidad no tiene residentes en la app para notificar.');
      }

      setForm(emptyForm);
      setPhotoPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
      setSuccess('Paquete entregado con firma registrada.');
      setRecipientName('');
      setSignatureData('');
      setSelectedPackageId('');
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="porteria-page">
      <header className="porteria-page__header">
        <h1>Casillero</h1>
        <p>
          Registra paquetes, entrégalos con firma y consulta el movimiento de recibidos y entregados.
          {locker.enabled
            ? locker.receiveWhenOverdue
              ? ' Las unidades en mora sí pueden recibir paquetes.'
              : ' Las unidades en mora no pueden recibir paquetes.'
            : ''}
        </p>
      </header>

      {error && <div className="admin-error porteria-page__alert">{error}</div>}
      {success && <div className="porteria-page__success">{success}</div>}

      {!locker.enabled ? (
        <div className="porteria__card">
          <h2>Casillero no habilitado</h2>
          <p>El administrador debe activarlo en Admin → Portería.</p>
        </div>
      ) : (
        <div className="porteria__card">
          <h2>Registrar paquete nuevo</h2>
          <form className="admin-form porteria__form" onSubmit={handleRegister}>
            <label className="admin-unit-picker-field" style={{ gridColumn: '1 / -1' }}>
              Unidad destino
              <UnitSelectField
                units={units}
                value={form.unitId}
                onChange={(unitId) => setForm({ ...form, unitId })}
                required
                showReceiveHint
                placeholder="Seleccionar unidad"
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Foto del paquete
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                required={!form.photoUrl}
              />
            </label>

            {photoPreview && (
              <div className="porteria__photo-preview" style={{ gridColumn: '1 / -1' }}>
                <img src={photoPreview} alt="Vista previa del paquete" />
                {uploadingPhoto && <span>Subiendo foto…</span>}
              </div>
            )}

            <label style={{ gridColumn: '1 / -1' }}>
              Comentario (opcional)
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="Ej: Caja mediana, frágil, mensajería Servientrega…"
              />
            </label>

            <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
              <button
                type="submit"
                className="admin-btn"
                disabled={saving || uploadingPhoto || !form.photoUrl || !form.unitId}
              >
                {saving ? 'Registrando…' : 'Registrar paquete'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="porteria__card">
        <h2>Entrega de paquetes</h2>
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Buscar
            <input
              type="search"
              value={packageQuery}
              onChange={(e) => setPackageQuery(e.target.value)}
              placeholder="Código, unidad o comentario"
            />
          </label>
          <label>
            Estado
            <select value={packageStatus} onChange={(e) => setPackageStatus(e.target.value)}>
              <option value="active">Pendientes / retención</option>
              <option value="pending_pickup">Solo pendientes</option>
              <option value="held">Solo retención</option>
              <option value="picked_up">Entregados</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <label className="admin-unit-picker-field">
            Unidad
            <UnitSelectField units={units} value={packageUnitId} onChange={setPackageUnitId} />
          </label>
        </form>

        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>Unidad</th>
                <th>Estado</th>
                <th>Comentario</th>
                <th>Recibido</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="admin-empty">
                    No hay paquetes con ese filtro.
                  </td>
                </tr>
              ) : (
                filteredPackages.map((pkg) => (
                  <tr key={pkg._id}>
                    <td>
                      <input
                        type="radio"
                        name="selectedPackage"
                        checked={selectedPackageId === pkg._id}
                        disabled={pkg.status === 'picked_up'}
                        onChange={() => setSelectedPackageId(pkg._id)}
                        aria-label={`Seleccionar paquete ${pkg.unitCode || pkg.unitNumber}`}
                      />
                    </td>
                    <td>
                      {pkg.unitCode || pkg.unitNumber || '—'}
                      {pkg.unitTower ? ` · ${pkg.unitTower}` : ''}
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge--${pkg.status ===
                        pkg.status === 'picked_up'
                          ? 'paid'
                          : pkg.status === 'held'
                            ? 'overdue'
                            : 'pending'
                      }`}>
                        {STATUS_LABELS[pkg.status] || pkg.status}
                      </span>
                    </td>
                    <td>{pkg.comment || '—'}</td>
                    <td>{pkg.createdAt ? formatDateTime(pkg.createdAt) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPackage && selectedPackage.status !== 'picked_up' && (
        <div className="porteria__card">
          <h2>Entregar paquete</h2>
          <p className="porteria__hint">
            {selectedPackage.unitCode || selectedPackage.unitNumber}
            {selectedPackage.unitTower ? ` · ${selectedPackage.unitTower}` : ''}
            {selectedPackage.comment ? ` · ${selectedPackage.comment}` : ''}
          </p>
          <form className="admin-form" onSubmit={deliverPackage}>
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
              <SignaturePad key={selectedPackageId} onChange={setSignatureData} />
            </div>
            <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="admin-btn" disabled={saving}>
                {saving ? 'Registrando…' : 'Confirmar entrega con firma'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setSelectedPackageId('');
                  setRecipientName('');
                  setSignatureData('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="porteria__card">
        <h2>Paquetes registrados</h2>
        <form className="admin-form" onSubmit={(e) => e.preventDefault()}>
          <label className="admin-unit-picker-field">
            Unidad
            <UnitSelectField
              units={units}
              value={logUnitId}
              onChange={(unitId) => {
                setLogUnitId(unitId);
                loadLog({ unitId }).catch((err) => setError(err.message));
              }}
            />
          </label>
          <label>
            Tipo
            <select value={logStatus} onChange={(e) => setLogStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="received">Recibidos pendientes</option>
              <option value="delivered">Entregados</option>
              <option value="held">Retención</option>
            </select>
          </label>
          <div className="admin-actions" style={{ alignSelf: 'end' }}>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={() => {
                setLogUnitId('');
                setLogStatus('');
                loadLog({ unitId: '' }).catch((err) => setError(err.message));
              }}
            >
              Ver todo
            </button>
          </div>
        </form>

        <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Unidad</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Recibió</th>
                <th>Ingreso</th>
                <th>Entregó</th>
                <th>Entrega</th>
                <th>Firma</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    Sin movimientos con ese filtro.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={`package-${entry.id}`}>
                    <td>
                      {entry.unitNumber}
                      {entry.tower ? ` · ${entry.tower}` : ''}
                    </td>
                    <td>{entry.description}</td>
                    <td>{STATUS_LABELS[entry.status] || entry.status || '—'}</td>
                    <td>{entry.receivedBy || '—'}</td>
                    <td>{entry.receivedAt ? formatDateTime(entry.receivedAt) : '—'}</td>
                    <td>{entry.deliveredBy || '—'}</td>
                    <td>{entry.deliveredAt ? formatDateTime(entry.deliveredAt) : '—'}</td>
                    <td>{entry.signatureRecipientName || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
