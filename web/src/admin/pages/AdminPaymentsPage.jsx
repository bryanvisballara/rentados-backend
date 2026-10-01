import { useEffect, useMemo, useState } from 'react';
import { adminApi, formatCop, formatDate, formatDateTime } from '../../api/client';
import { formatUnitLabel, getUnitTowerName, sortUnitsForPicker } from '../../utils/units';
import { getPaymentConceptLabel } from '../paymentConcepts';
import '../admin.css';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'transfer', label: 'Transferencia' },
];

const STATUS_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'En mora',
  partial: 'Parcial',
  cancelled: 'Anulado',
};

function openPaymentDue(payment) {
  return Number(payment.totalDue ?? Math.max(0, payment.amount - (payment.paidAmount || 0)));
}

function openPaymentDetail(payment) {
  const booking = payment.facilityBookingId;
  if (booking && typeof booking === 'object' && booking.startAt) {
    return `Reserva ${formatDateTime(booking.startAt)}`;
  }
  return formatPeriod(payment.period);
}

function residentLabel(resident) {
  const user = resident.userId || {};
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Sin nombre';
  const unit = formatUnitLabel(resident.unitId);
  const login = user.email ? ` · ${user.email}` : '';
  return `${name} — ${unit}${login}`;
}

function looksLikeAdminManualNotes(notes) {
  const raw = String(notes || '').trim();
  if (!raw) return false;
  const n = raw.toLowerCase();
  if (/tarjeta|tok_|webhook|cuota pagada en línea|ref local-/i.test(n)) return false;
  if (n === 'efectivo' || n === 'transferencia') return true;
  if (/^(efectivo|transferencia|pago en administración)\b/i.test(raw)) return true;
  if (/\s·\s*(efectivo|transferencia)\b/i.test(raw)) return true;
  return false;
}

function isManualEditablePayment(payment) {
  if (!payment || payment.status !== 'paid') return false;
  if (payment.manualAdmin?.voidedAt) return false;
  if (payment.manualAdmin?.registeredAt) return true;
  return looksLikeAdminManualNotes(payment.notes);
}

function manualPaymentTotal(payment) {
  return (
    Number(payment.paidAmount || payment.amount || 0) + Number(payment.interestAmount || 0)
  );
}

function formatPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match) return period || '';
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function AdminPaymentsPage() {
  const [nameQuery, setNameQuery] = useState('');
  const [usernameQuery, setUsernameQuery] = useState('');
  const [tower, setTower] = useState('');
  const [unitId, setUnitId] = useState('');
  const [allUnits, setAllUnits] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registeringPaymentId, setRegisteringPaymentId] = useState('');
  const [adminLineModal, setAdminLineModal] = useState(null);
  const [adminLineSubmitting, setAdminLineSubmitting] = useState(false);
  const [editPaymentModal, setEditPaymentModal] = useState(null);
  const [editPaymentSubmitting, setEditPaymentSubmitting] = useState(false);

  const adminDue = detail?.adminOutstanding?.totalDue ?? 0;
  const otherOpen = useMemo(() => {
    if (!detail?.openPayments) return [];
    return detail.openPayments.filter((p) => p.concept !== 'administration');
  }, [detail]);
  const otherDue = otherOpen.reduce((sum, p) => sum + openPaymentDue(p), 0);

  const paymentHistory = useMemo(() => {
    const list = detail?.payments || [];
    return [...list]
      .filter((p) => p.status === 'paid' || Number(p.paidAmount || 0) > 0)
      .sort((a, b) => {
        const ta = new Date(a.paidAt || a.updatedAt || a.dueDate || 0).getTime();
        const tb = new Date(b.paidAt || b.updatedAt || b.dueDate || 0).getTime();
        return tb - ta;
      });
  }, [detail]);

  useEffect(() => {
    adminApi.units
      .list()
      .then((data) => setAllUnits(data.units || []))
      .catch(() => {});
  }, []);

  const towerOptions = useMemo(() => {
    const names = new Set(allUnits.map((unit) => getUnitTowerName(unit)).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }, [allUnits]);

  const unitsInTower = useMemo(() => {
    if (!tower) return [];
    return allUnits
      .filter((unit) => getUnitTowerName(unit) === tower)
      .sort((a, b) => sortUnitsForPicker(a, b, ''));
  }, [allUnits, tower]);

  const hasSearchCriteria =
    Boolean(nameQuery.trim()) ||
    Boolean(usernameQuery.trim()) ||
    Boolean(tower) ||
    Boolean(unitId);

  useEffect(() => {
    if (!hasSearchCriteria) {
      setSearchResults([]);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      adminApi.residents
        .list({
          name: nameQuery.trim() || undefined,
          username: usernameQuery.trim() || undefined,
          tower: tower || undefined,
          unitId: unitId || undefined,
        })
        .then((data) => setSearchResults((data.residents || []).slice(0, 40)))
        .catch((err) => setError(err.message))
        .finally(() => setSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [nameQuery, usernameQuery, tower, unitId, hasSearchCriteria]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    setError('');
    adminApi.residents
      .get(selectedId)
      .then((data) => {
        setDetail(data);
        const due = data.adminOutstanding?.totalDue ?? 0;
        setAmount(due > 0 ? String(due) : '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  async function registerAdminPayment(e) {
    e.preventDefault();
    if (!selectedId || !detail) return;

    const value = Math.round(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Indica un monto válido');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.payments.create({
        residentId: selectedId,
        amount: value,
        settleAdministration: true,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      setSuccess('Pago registrado correctamente');
      const refreshed = await adminApi.residents.get(selectedId);
      setDetail(refreshed);
      const due = refreshed.adminOutstanding?.totalDue ?? 0;
      setAmount(due > 0 ? String(due) : '');
      setNotes('');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openAdminLineModal(line) {
    setAdminLineModal({
      line,
      amount: String(Math.round(Number(line.totalDue || 0))),
      paymentMethod: 'cash',
    });
  }

  async function submitAdminLinePayment(e) {
    e.preventDefault();
    if (!selectedId || !adminLineModal?.line?.paymentId) return;

    setAdminLineSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.payments.create({
        residentId: selectedId,
        paymentId: adminLineModal.line.paymentId,
        amount: Math.round(Number(adminLineModal.amount)),
        settleAdministrationLine: true,
        paymentMethod: adminLineModal.paymentMethod,
      });
      setSuccess('Cuota de administración registrada');
      setAdminLineModal(null);
      const refreshed = await adminApi.residents.get(selectedId);
      setDetail(refreshed);
      const due = refreshed.adminOutstanding?.totalDue ?? 0;
      setAmount(due > 0 ? String(due) : '');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdminLineSubmitting(false);
    }
  }

  function openEditPaymentModal(payment) {
    setEditPaymentModal({
      payment,
      amount: String(Math.round(manualPaymentTotal(payment))),
      paymentMethod:
        payment.manualAdmin?.paymentMethod ||
        (looksLikeAdminManualNotes(payment.notes) && /transferencia/i.test(payment.notes || '')
          ? 'transfer'
          : 'cash'),
      notes: '',
    });
  }

  async function submitEditPayment(e) {
    e.preventDefault();
    if (!editPaymentModal?.payment?._id || !selectedId) return;

    setEditPaymentSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.payments.update(editPaymentModal.payment._id, {
        paymentMethod: editPaymentModal.paymentMethod,
        amount: Math.round(Number(editPaymentModal.amount)),
        notes: editPaymentModal.notes.trim() || undefined,
      });
      setSuccess('Pago actualizado');
      setEditPaymentModal(null);
      const refreshed = await adminApi.residents.get(selectedId);
      setDetail(refreshed);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditPaymentSubmitting(false);
    }
  }

  async function voidManualPayment() {
    if (!editPaymentModal?.payment?._id || !selectedId) return;
    if (!window.confirm('¿Anular este pago? La deuda volverá a quedar pendiente.')) return;

    setEditPaymentSubmitting(true);
    setError('');
    try {
      await adminApi.payments.void(editPaymentModal.payment._id);
      setSuccess('Pago anulado');
      setEditPaymentModal(null);
      const refreshed = await adminApi.residents.get(selectedId);
      setDetail(refreshed);
      const due = refreshed.adminOutstanding?.totalDue ?? 0;
      setAmount(due > 0 ? String(due) : '');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditPaymentSubmitting(false);
    }
  }

  async function registerOpenPayment(payment) {
    if (!selectedId || !payment?._id) return;
    const isBooking = Boolean(payment.facilityBookingId);

    setRegisteringPaymentId(payment._id);
    setError('');
    setSuccess('');
    try {
      await adminApi.payments.create({
        residentId: selectedId,
        paymentId: payment._id,
        settleBookingPayment: isBooking,
        settleOpenPayment: !isBooking,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      setSuccess(
        isBooking
          ? 'Pago de reserva registrado. La reserva queda confirmada en el calendario.'
          : 'Pago registrado correctamente.'
      );
      const refreshed = await adminApi.residents.get(selectedId);
      setDetail(refreshed);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegisteringPaymentId('');
    }
  }

  function resetSelection() {
    setSelectedId('');
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Pagos</h1>
        <p>
          Busca un residente y registra pagos en efectivo o transferencia: administración
          (meses acumulados) y reservas de servicios de pago (salón, etc.).
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="admin-card">
        <h2>Buscar residente</h2>
        <form className="admin-form admin-form--payments-search" onSubmit={(e) => e.preventDefault()}>
          <label>
            Nombre
            <input
              value={nameQuery}
              onChange={(e) => {
                setNameQuery(e.target.value);
                resetSelection();
              }}
              placeholder="Ej: María García"
              autoComplete="off"
            />
          </label>
          <label>
            Usuario
            <input
              value={usernameQuery}
              onChange={(e) => {
                setUsernameQuery(e.target.value);
                resetSelection();
              }}
              placeholder="Ej: 41201 o correo"
              autoComplete="off"
            />
          </label>
          <label>
            Torre
            <select
              value={tower}
              onChange={(e) => {
                setTower(e.target.value);
                setUnitId('');
                resetSelection();
              }}
            >
              <option value="">Seleccionar torre</option>
              {towerOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Apartamento
            <select
              value={unitId}
              disabled={!tower}
              onChange={(e) => {
                setUnitId(e.target.value);
                resetSelection();
              }}
            >
              <option value="">{tower ? 'Seleccionar apartamento' : 'Primero elige torre'}</option>
              {unitsInTower.map((unit) => (
                <option key={unit._id} value={unit._id}>
                  {unit.type === 'house' ? 'Casa' : unit.type === 'commercial' ? 'Local' : 'Apto'}{' '}
                  {unit.number}
                  {unit.code ? ` (${unit.code})` : ''}
                </option>
              ))}
            </select>
          </label>
        </form>

        {searching && <p className="admin-muted">Buscando…</p>}

        {hasSearchCriteria && !searching && searchResults.length === 0 && (
          <p className="admin-muted">No hay residentes con ese criterio.</p>
        )}

        {searchResults.length > 0 && (
          <div className="admin-payments-results">
            {searchResults.map((resident) => {
              const id = resident._id;
              const active = id === selectedId;
              return (
                <button
                  key={id}
                  type="button"
                  className={`admin-btn admin-btn--ghost admin-payments-results__btn${
                    active ? ' admin-payments-results__btn--active' : ''
                  }`}
                  onClick={() => setSelectedId(id)}
                >
                  {residentLabel(resident)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedId && (
        <div className="admin-card">
          <h2>Saldo y registro</h2>
          {loadingDetail && <p className="admin-muted">Cargando cuenta…</p>}

          {detail && !loadingDetail && (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{residentLabel(detail.resident)}</strong>
              </p>

              <div className="admin-grid admin-grid--balance">
                <div className="admin-stat">
                  <span className="admin-stat__label">Administración pendiente</span>
                  <span className="admin-stat__value admin-stat__value--money">{formatCop(adminDue)}</span>
                </div>
                <div className="admin-stat">
                  <span className="admin-stat__label">Otros conceptos abiertos</span>
                  <span className="admin-stat__value admin-stat__value--money">{formatCop(otherDue)}</span>
                </div>
              </div>

              {detail.adminOutstanding?.lines?.length > 0 && (
                <>
                  <div className="admin-payments-line-cards">
                    {detail.adminOutstanding.lines.map((line) => (
                      <article key={line.paymentId || line.period} className="admin-payments-line-card">
                        <div className="admin-payments-line-card__head">
                          <strong>{formatPeriod(line.period)}</strong>
                          <span className="admin-badge admin-badge--pending">
                            {line.status === 'overdue' ? 'En mora' : 'Pendiente'}
                          </span>
                        </div>
                        <dl className="admin-payments-line-card__rows">
                          <div>
                            <dt>Capital</dt>
                            <dd>{formatCop(line.principalDue)}</dd>
                          </div>
                          <div>
                            <dt>Interés</dt>
                            <dd>{formatCop(line.interestAmount)}</dd>
                          </div>
                          <div>
                            <dt>Total</dt>
                            <dd>{formatCop(line.totalDue)}</dd>
                          </div>
                        </dl>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-payments-line-card__btn"
                          onClick={() => openAdminLineModal(line)}
                        >
                          Pagar cuota
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="admin-table-wrap admin-table-wrap--wide admin-payments-lines-table">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Periodo</th>
                          <th>Estado</th>
                          <th>Capital</th>
                          <th>Interés</th>
                          <th>Total</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.adminOutstanding.lines.map((line) => (
                          <tr key={line.paymentId || line.period}>
                            <td>{formatPeriod(line.period)}</td>
                            <td>{line.status === 'overdue' ? 'En mora' : 'Pendiente'}</td>
                            <td>{formatCop(line.principalDue)}</td>
                            <td>{formatCop(line.interestAmount)}</td>
                            <td>{formatCop(line.totalDue)}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                onClick={() => openAdminLineModal(line)}
                              >
                                Pagar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {adminDue <= 0 && (
                <p className="admin-muted">
                  No hay cuotas de administración pendientes para este residente.
                </p>
              )}

              {otherOpen.length > 0 && (
                <div className="admin-table-wrap" style={{ marginTop: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem' }}>Reservas y otros cobros pendientes</h3>
                  <p className="admin-muted" style={{ marginTop: 0 }}>
                    Usa la misma forma de pago y notas de abajo para cada registro.
                  </p>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Detalle</th>
                        <th>Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {otherOpen.map((p) => {
                        const due = openPaymentDue(p);
                        return (
                          <tr key={p._id}>
                            <td>{getPaymentConceptLabel(p)}</td>
                            <td>{openPaymentDetail(p)}</td>
                            <td>{formatCop(due)}</td>
                            <td>
                              <button
                                type="button"
                                className="admin-btn admin-btn--ghost"
                                disabled={Boolean(registeringPaymentId) || due <= 0}
                                onClick={() => registerOpenPayment(p)}
                              >
                                {registeringPaymentId === p._id
                                  ? 'Registrando…'
                                  : 'Registrar pago'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <form
                className="admin-form admin-form--register-payment"
                onSubmit={registerAdminPayment}
                style={{ marginTop: '1.25rem' }}
              >
                <h3 className="admin-form__section-heading">Administración</h3>
                <label>
                  Forma de pago
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Monto a registrar
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    disabled={adminDue <= 0}
                  />
                </label>
                <label className="admin-form__wide">
                  Notas (opcional)
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Referencia de transferencia, recibo, etc."
                  />
                </label>
                <button
                  type="submit"
                  className="admin-btn admin-form__submit"
                  disabled={submitting || adminDue <= 0}
                >
                  {submitting ? 'Registrando…' : 'Registrar pago de administración'}
                </button>
              </form>

              <div className="admin-table-wrap admin-table-wrap--wide" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ margin: '0 0 0.75rem' }}>Historial de pagos</h3>
                {paymentHistory.length === 0 ? (
                  <p className="admin-muted">Aún no hay pagos registrados para esta unidad.</p>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Periodo</th>
                        <th>Recaudado</th>
                        <th>Interés</th>
                        <th>Estado</th>
                        <th>Notas</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p) => {
                        const collected =
                          p.status === 'paid'
                            ? Number(p.paidAmount || p.amount || 0) +
                              Number(p.interestAmount || 0)
                            : Number(p.paidAmount || 0);
                        return (
                          <tr key={p._id}>
                            <td>{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                            <td>{getPaymentConceptLabel(p)}</td>
                            <td>{formatPeriod(p.period)}</td>
                            <td>{formatCop(collected)}</td>
                            <td>{formatCop(p.interestAmount || 0)}</td>
                            <td>
                              <span className={`admin-badge admin-badge--${p.status}`}>
                                {STATUS_LABELS[p.status] || p.status}
                              </span>
                            </td>
                            <td>{p.notes || '—'}</td>
                            <td>
                              {isManualEditablePayment(p) ? (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--ghost"
                                  onClick={() => openEditPaymentModal(p)}
                                >
                                  Editar
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {editPaymentModal && (
        <div
          className="admin-modal-overlay"
          onClick={() => !editPaymentSubmitting && setEditPaymentModal(null)}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Editar pago manual</h3>
            <p className="admin-modal__hint">
              {getPaymentConceptLabel(editPaymentModal.payment)} ·{' '}
              {formatPeriod(editPaymentModal.payment.period)}
            </p>
            <form className="admin-form" onSubmit={submitEditPayment}>
              <label>
                Forma de pago
                <select
                  value={editPaymentModal.paymentMethod}
                  onChange={(e) =>
                    setEditPaymentModal((prev) => ({ ...prev, paymentMethod: e.target.value }))
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={editPaymentModal.amount}
                  onChange={(e) =>
                    setEditPaymentModal((prev) => ({ ...prev, amount: e.target.value }))
                  }
                />
              </label>
              <label className="admin-form__wide">
                Notas (opcional)
                <input
                  value={editPaymentModal.notes}
                  onChange={(e) =>
                    setEditPaymentModal((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Actualizar referencia o comentario"
                />
              </label>
              <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="admin-btn" disabled={editPaymentSubmitting}>
                  {editPaymentSubmitting ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={editPaymentSubmitting}
                  onClick={() => setEditPaymentModal(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={editPaymentSubmitting}
                  onClick={voidManualPayment}
                >
                  Anular pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminLineModal && (
        <div className="admin-modal-overlay" onClick={() => !adminLineSubmitting && setAdminLineModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3>Registrar pago</h3>
            <p className="admin-modal__hint">
              {formatPeriod(adminLineModal.line.period)} · Total{' '}
              {formatCop(adminLineModal.line.totalDue)}
            </p>
            <form className="admin-form" onSubmit={submitAdminLinePayment}>
              <label>
                Forma de pago
                <select
                  value={adminLineModal.paymentMethod}
                  onChange={(e) =>
                    setAdminLineModal((prev) => ({ ...prev, paymentMethod: e.target.value }))
                  }
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={adminLineModal.amount}
                  onChange={(e) =>
                    setAdminLineModal((prev) => ({ ...prev, amount: e.target.value }))
                  }
                />
              </label>
              <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="admin-btn" disabled={adminLineSubmitting}>
                  {adminLineSubmitting ? 'Registrando…' : 'Confirmar pago'}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={adminLineSubmitting}
                  onClick={() => setAdminLineModal(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
