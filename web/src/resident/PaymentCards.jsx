import { useEffect, useState } from 'react';
import { residentApi } from '../api/client';

const emptyCard = {
  holderName: '',
  number: '',
  expMonth: '',
  expYear: '',
  cvv: '',
};

function brandMark(brand) {
  const value = String(brand || '').toLowerCase();
  if (value.includes('visa')) return 'VISA';
  if (value.includes('master')) return 'MC';
  if (value.includes('amex')) return 'AMEX';
  return 'CARD';
}

export default function PaymentCards({ selectedId, onSelect, onChange, layout = 'list' }) {
  const [cards, setCards] = useState([]);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  const [form, setForm] = useState(emptyCard);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await residentApi.paymentMethods();
    const list = data.cards || [];
    setCards(list);
    if (!selectedId && list[0]) onSelect(list[0].id);
    onChange?.(list);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function saveCard(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await residentApi.addPaymentMethod({
        holderName: form.holderName.trim(),
        number: form.number,
        expMonth: Number(form.expMonth),
        expYear: Number(form.expYear),
        cvv: form.cvv,
      });
      setForm(emptyCard);
      setAdding(false);
      setPicking(false);
      await load();
      onSelect(data.card.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selected = cards.find((card) => card.id === selectedId) || null;

  if (layout === 'row') {
    return (
      <div className="resident-checkout__paymethod">
        <button
          type="button"
          className="resident-checkout__row"
          onClick={() => {
            if (!cards.length) setAdding(true);
            else setPicking((open) => !open);
          }}
        >
          <span className={`resident-checkout__brand resident-checkout__brand--${brandMark(selected?.brand).toLowerCase()}`}>
            {selected ? brandMark(selected.brand) : '+'}
          </span>
          <span className="resident-checkout__row-copy">
            <strong>{selected ? selected.last4 : 'Agregar tarjeta'}</strong>
            <span>{selected ? selected.holderName : 'Para pagar este pedido'}</span>
          </span>
          <span className="resident-checkout__chevron" aria-hidden="true">›</span>
        </button>
        {(picking || adding) && (
          <div className="resident-cards resident-cards--nested">
            {cards.map((card) => (
              <label key={card.id} className="resident-cards__option">
                <input
                  type="radio"
                  name="saved-card"
                  checked={selectedId === card.id}
                  onChange={() => {
                    onSelect(card.id);
                    setPicking(false);
                    setAdding(false);
                  }}
                />
                <span>
                  {brandMark(card.brand)} {card.last4}
                  <small>{card.holderName}</small>
                </span>
              </label>
            ))}
            {error && <p className="resident-cards__error">{error}</p>}
            {adding ? (
              <form className="resident-cards__form" onSubmit={saveCard}>
                <input
                  value={form.holderName}
                  onChange={(e) => setForm({ ...form, holderName: e.target.value })}
                  placeholder="Nombre en la tarjeta"
                  required
                />
                <input
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="Número de tarjeta"
                  required
                />
                <div className="resident-cards__row">
                  <input
                    value={form.expMonth}
                    onChange={(e) => setForm({ ...form, expMonth: e.target.value })}
                    inputMode="numeric"
                    placeholder="MM"
                    required
                  />
                  <input
                    value={form.expYear}
                    onChange={(e) => setForm({ ...form, expYear: e.target.value })}
                    inputMode="numeric"
                    placeholder="AAAA"
                    required
                  />
                  <input
                    value={form.cvv}
                    onChange={(e) => setForm({ ...form, cvv: e.target.value })}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="CVV"
                    required
                  />
                </div>
                <div className="resident-cards__actions">
                  <button type="submit" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar tarjeta'}
                  </button>
                  <button type="button" onClick={() => setAdding(false)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="resident-cards__add" onClick={() => setAdding(true)}>
                + Agregar tarjeta
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="resident-cards">
      <p className="resident-cards__title">Tarjeta</p>
      {cards.length === 0 && !adding && (
        <p className="resident-cards__empty">Aún no tienes tarjetas. Agrega una para pagar.</p>
      )}
      {cards.map((card) => (
        <label key={card.id} className="resident-cards__option">
          <input
            type="radio"
            name="saved-card"
            checked={selectedId === card.id}
            onChange={() => onSelect(card.id)}
          />
          <span>
            {card.brand.toUpperCase()} ···· {card.last4}
            <small>
              {card.holderName} · {String(card.expMonth).padStart(2, '0')}/{card.expYear}
            </small>
          </span>
        </label>
      ))}
      {error && <p className="resident-cards__error">{error}</p>}
      {adding ? (
        <form className="resident-cards__form" onSubmit={saveCard}>
          <input
            value={form.holderName}
            onChange={(e) => setForm({ ...form, holderName: e.target.value })}
            placeholder="Nombre en la tarjeta"
            required
          />
          <input
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="Número de tarjeta"
            required
          />
          <div className="resident-cards__row">
            <input
              value={form.expMonth}
              onChange={(e) => setForm({ ...form, expMonth: e.target.value })}
              inputMode="numeric"
              placeholder="MM"
              required
            />
            <input
              value={form.expYear}
              onChange={(e) => setForm({ ...form, expYear: e.target.value })}
              inputMode="numeric"
              placeholder="AAAA"
              required
            />
            <input
              value={form.cvv}
              onChange={(e) => setForm({ ...form, cvv: e.target.value })}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="CVV"
              required
            />
          </div>
          <div className="resident-cards__actions">
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar tarjeta'}
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="resident-cards__add" onClick={() => setAdding(true)}>
          + Agregar tarjeta
        </button>
      )}
    </div>
  );
}
