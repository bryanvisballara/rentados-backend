import { useEffect, useMemo, useState } from 'react';
import { adminApi, formatCop } from '../../api/client';
import ResidentSelectField from '../components/ResidentSelectField';
import { buildPaymentConceptOptions } from '../paymentConcepts';

const emptyForm = {
  residentId: '',
  amount: '',
  concept: 'administration',
  otherConcept: '',
  notes: '',
};

export default function RegisterPaymentModal({ open, onClose, onSuccess }) {
  const [residents, setResidents] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const conceptOptions = useMemo(() => buildPaymentConceptOptions(facilities), [facilities]);
  const isOtherConcept = form.concept === 'other';

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setError('');
    Promise.all([adminApi.residents.list(), adminApi.facilities.list()])
      .then(([residentsData, facilitiesData]) => {
        setResidents(residentsData.residents || []);
        setFacilities(facilitiesData.facilities || []);
      })
      .catch((err) => setError(err.message));
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (isOtherConcept && !form.otherConcept.trim()) {
      setError('Escribe el concepto del pago');
      setSaving(false);
      return;
    }

    try {
      const result = await adminApi.payments.create({
        residentId: form.residentId,
        amount: Number(form.amount),
        concept: form.concept,
        conceptLabel: isOtherConcept ? form.otherConcept.trim() : undefined,
        notes: form.notes || undefined,
      });
      onSuccess?.(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar nuevo pago</h2>
        <p className="admin-modal__hint">
          El pago se aplicará primero a cuotas pendientes o en mora de la unidad. El saldo restante queda
          registrado como pago recibido y se refleja en cartera, historial del residente y su app.
        </p>

        {error && <div className="admin-error">{error}</div>}

        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="admin-unit-picker-field">
            Residente
            <ResidentSelectField
              key={open ? 'open' : 'closed'}
              residents={residents}
              value={form.residentId}
              onChange={(residentId) => setForm({ ...form, residentId })}
              required
            />
          </label>
          <label>
            Monto (COP)
            <input
              type="number"
              min="1"
              step="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="420000"
              required
            />
          </label>
          <label>
            Concepto
            <select
              value={form.concept}
              onChange={(e) =>
                setForm({
                  ...form,
                  concept: e.target.value,
                  otherConcept: e.target.value === 'other' ? form.otherConcept : '',
                })
              }
              required
            >
              {conceptOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {isOtherConcept && (
            <label style={{ gridColumn: '1 / -1' }}>
              ¿Cuál concepto?
              <input
                value={form.otherConcept}
                onChange={(e) => setForm({ ...form, otherConcept: e.target.value })}
                placeholder="Ej: Reparación ascensor, evento privado…"
                required
              />
            </label>
          )}
          <label style={{ gridColumn: '1 / -1' }}>
            Detalle (opcional)
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ej: Transferencia Bancolombia, referencia 12345"
            />
          </label>
          {form.amount && (
            <p className="admin-hours-preview" style={{ gridColumn: '1 / -1' }}>
              Total a registrar: <strong>{formatCop(Number(form.amount))}</strong>
            </p>
          )}
          <div className="admin-actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="admin-btn" disabled={saving}>
              {saving ? 'Registrando…' : 'Registrar pago'}
            </button>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
