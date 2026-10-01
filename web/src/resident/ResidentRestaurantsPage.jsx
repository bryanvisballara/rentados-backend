import { useEffect, useMemo, useState } from 'react';
import { formatMoney, residentApi } from '../api/client';
import PaymentCards from './PaymentCards';
import './ResidentLayout.css';

const CARTS_KEY = 'rentados_restaurant_carts';
const SERVICE_FEE_RATE = 0.015;

function serviceFeeFor(subtotal, rate = SERVICE_FEE_RATE) {
  const base = Number(subtotal) || 0;
  if (base <= 0) return 0;
  return Math.round(base * (Number(rate) || SERVICE_FEE_RATE));
}

function loadOrder() {
  try {
    const raw = sessionStorage.getItem(CARTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return { lines: [], notes: '' };
    if (Array.isArray(parsed.lines)) {
      return { lines: parsed.lines.filter((line) => line.quantity > 0), notes: parsed.notes || '' };
    }
    const lines = [];
    let notes = '';
    Object.entries(parsed).forEach(([restaurantId, draft]) => {
      if (!draft || typeof draft !== 'object') return;
      if (!notes && draft.notes) notes = draft.notes;
      (draft.lines || []).forEach((line) => {
        const quantity = Number(
          draft.cart?.[line.id] ?? draft.cart?.[String(line.id)] ?? line.quantity ?? 0
        );
        if (quantity > 0) {
          lines.push({
            ...line,
            quantity,
            restaurantId,
            restaurantName: line.restaurantName || draft.restaurantName || '',
          });
        }
      });
    });
    return { lines, notes };
  } catch {
    return { lines: [], notes: '' };
  }
}

function groupLines(lines) {
  const groups = [];
  lines.forEach((line) => {
    let group = groups.find((item) => String(item.id) === String(line.restaurantId));
    if (!group) {
      group = { id: line.restaurantId, name: line.restaurantName || 'Restaurante', lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  });
  return groups;
}

function orderTotals(lines, restaurants) {
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.price) || 0) * line.quantity, 0);
  const involved = restaurants.filter((restaurant) =>
    lines.some((line) => String(line.restaurantId) === String(restaurant.id))
  );
  const deliveryFee = involved.reduce((max, restaurant) => Math.max(max, restaurant.deliveryFee || 0), 0);
  const serviceFee = serviceFeeFor(subtotal, involved[0]?.serviceFeeRate);
  const currency = lines[0]?.currency || involved[0]?.currency || 'COP';
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return { subtotal, deliveryFee, serviceFee, total: subtotal + deliveryFee + serviceFee, currency, count };
}

export default function ResidentRestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [openCheckout, setOpenCheckout] = useState(false);
  const [listCartOpen, setListCartOpen] = useState(false);
  const [order, setOrder] = useState(loadOrder);

  useEffect(() => {
    sessionStorage.setItem(CARTS_KEY, JSON.stringify(order));
  }, [order]);

  useEffect(() => {
    document.title = 'Restaurantes · Rentados';
    residentApi
      .restaurants()
      .then((data) => setRestaurants(data.restaurants || []))
      .catch((err) => setError(err.message));
  }, []);

  const groups = useMemo(() => groupLines(order.lines), [order.lines]);
  const totals = useMemo(() => orderTotals(order.lines, restaurants), [order.lines, restaurants]);

  function changeLineQty(itemId, quantity) {
    setOrder((prev) => ({
      ...prev,
      lines: prev.lines
        .map((line) => (String(line.id) === String(itemId) ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    }));
  }

  function addLine(line) {
    setOrder((prev) => {
      const existing = prev.lines.find((item) => String(item.id) === String(line.id));
      if (!existing) return { ...prev, lines: [...prev.lines, { ...line, quantity: 1 }] };
      return {
        ...prev,
        lines: prev.lines.map((item) =>
          String(item.id) === String(line.id) ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    });
  }

  if (selectedId) {
    return (
      <RestaurantMenu
        restaurantId={selectedId}
        lines={order.lines}
        notes={order.notes}
        totals={totals}
        groups={groups}
        openCheckout={openCheckout}
        onAddLine={addLine}
        onChangeQty={changeLineQty}
        onNotesChange={(notes) => setOrder((prev) => ({ ...prev, notes }))}
        onOpenCheckout={() => setOpenCheckout(true)}
        onCloseCheckout={() => setOpenCheckout(false)}
        onPaid={() => {
          setOrder({ lines: [], notes: '' });
          setOpenCheckout(false);
        }}
        onBack={() => {
          setOpenCheckout(false);
          setSelectedId('');
        }}
      />
    );
  }

  return (
    <div className={`resident-page${totals.count > 0 ? ' resident-restaurant-page--cart' : ''}`}>
      <header className="resident-page__header">
        <h1 className="resident-page__title">Restaurantes</h1>
        <p className="resident-page__subtitle">
          Opciones de comida disponibles para residentes Rentados.
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}

        {restaurants.length === 0 ? (
          <p className="resident-empty">No hay restaurantes disponibles en tu zona.</p>
        ) : (
          restaurants.map((restaurant) => (
            <button
              key={restaurant.id}
              type="button"
              className="resident-restaurant-card resident-restaurant-card--button"
              onClick={() => {
                setOpenCheckout(false);
                setListCartOpen(false);
                setSelectedId(restaurant.id);
              }}
            >
              {restaurant.coverImageUrl || restaurant.logoImageUrl ? (
                <img
                  src={restaurant.coverImageUrl || restaurant.logoImageUrl}
                  alt=""
                  className="resident-restaurant-card__cover"
                />
              ) : (
                <div className="resident-restaurant-card__cover resident-restaurant-card__cover--placeholder">
                  🍽️
                </div>
              )}
              <div>
                <h3 style={{ margin: '0 0 0.2rem' }}>{restaurant.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b655c' }}>
                  {restaurant.cuisineType || 'Cocina variada'}
                  {restaurant.openingHours ? ` · ${restaurant.openingHours}` : ''}
                </p>
                {restaurant.shortDescription && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem' }}>
                    {restaurant.shortDescription}
                  </p>
                )}
                {order.lines.some((line) => String(line.restaurantId) === String(restaurant.id)) && (
                  <p className="resident-restaurant-card__draft">En tu pedido</p>
                )}
                <p className="resident-restaurant-card__meta">
                  {restaurant.deliveryFee > 0
                    ? `Domicilio ${formatMoney(restaurant.deliveryFee, restaurant.currency)}`
                    : 'Domicilio sin costo'}
                  {restaurant.estimatedLabel ? ` · ${restaurant.estimatedLabel}` : ''}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {totals.count > 0 && (
        <>
          {listCartOpen && (
            <button
              type="button"
              className="resident__shop-cart-backdrop"
              aria-label="Cerrar pedido"
              onClick={() => setListCartOpen(false)}
            />
          )}
          <div className={`resident__shop-cart ${listCartOpen ? 'is-open' : ''}`}>
            {listCartOpen && (
              <div className="resident__shop-cart-panel">
                <p className="resident__shop-cart-title">Tu pedido</p>
                {groups.map((group) => (
                  <section key={group.id} className="resident-list-cart__group">
                    <h3>{group.name}</h3>
                    <ul className="resident__shop-cart-lines">
                      {group.lines.map((line) => (
                        <li key={line.id}>
                          <div className="resident__shop-cart-line-copy">
                            <strong>{line.name}</strong>
                            {line.price > 0 && (
                              <p>{formatMoney(line.price, line.currency || totals.currency)} c/u</p>
                            )}
                          </div>
                          <div className="resident__shop-cart-qty">
                            <button
                              type="button"
                              onClick={() => changeLineQty(line.id, line.quantity - 1)}
                              aria-label="Quitar uno"
                            >
                              −
                            </button>
                            <span>{line.quantity}</span>
                            <button
                              type="button"
                              onClick={() => changeLineQty(line.id, line.quantity + 1)}
                              aria-label="Agregar uno"
                            >
                              +
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                <p className="resident-list-cart__total">
                  <span>Total</span>
                  <strong>{formatMoney(totals.total, totals.currency)}</strong>
                </p>
                <button
                  type="button"
                  className="resident__shop-cart-submit"
                  onClick={() => {
                    setListCartOpen(false);
                    setOpenCheckout(true);
                    setSelectedId(order.lines[0]?.restaurantId || '');
                  }}
                >
                  Pagar pedido
                </button>
              </div>
            )}
            <button
              type="button"
              className="resident__shop-cart-toggle"
              onClick={() => setListCartOpen((open) => !open)}
            >
              <span className="resident__shop-cart-toggle__count">{totals.count}</span>
              <span className="resident__shop-cart-toggle__label">
                {totals.count === 1 ? 'plato' : 'platos'} · {formatMoney(totals.total, totals.currency)}
              </span>
              <span className="resident__shop-cart-toggle__action">
                {listCartOpen ? 'Cerrar' : 'Ver'}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RestaurantMenu({
  restaurantId,
  onBack,
  lines,
  notes,
  totals,
  groups,
  openCheckout,
  onAddLine,
  onChangeQty,
  onNotesChange,
  onOpenCheckout,
  onCloseCheckout,
  onPaid,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [cardId, setCardId] = useState('');
  const [delivery, setDelivery] = useState(null);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);

  useEffect(() => {
    setData(null);
    setError('');
    residentApi
      .restaurant(restaurantId)
      .then((payload) => {
        setData(payload);
        document.title = `${payload.restaurant?.name || 'Menú'} · Rentados`;
      })
      .catch((err) => setError(err.message));
  }, [restaurantId]);

  useEffect(() => {
    document.querySelector('.resident-app__main')?.scrollTo({ top: 0 });
  }, [selectedDish, openCheckout]);

  useEffect(() => {
    if (!openCheckout || delivery) return undefined;
    residentApi
      .deliveryProfile()
      .then((data) => setDelivery(data.profile))
      .catch((err) => setError(err.message));
    return undefined;
  }, [openCheckout, delivery]);

  const restaurant = data?.restaurant;
  const categories = data?.categories || [];
  const items = data?.items || [];

  const visibleItems = useMemo(() => {
    if (categoryId === 'all') return items;
    return items.filter((item) => String(item.categoryId) === categoryId);
  }, [items, categoryId]);

  const grouped = useMemo(() => {
    if (categoryId !== 'all') {
      const category = categories.find((item) => String(item.id) === categoryId);
      return [{ category, items: visibleItems }];
    }
    const buckets = categories
      .map((category) => ({
        category,
        items: items.filter((item) => String(item.categoryId) === String(category.id)),
      }))
      .filter((group) => group.items.length > 0);
    const uncategorized = items.filter(
      (item) => !categories.some((category) => String(category.id) === String(item.categoryId))
    );
    if (uncategorized.length) buckets.push({ category: null, items: uncategorized });
    return buckets;
  }, [categoryId, categories, items, visibleItems]);

  const currency = restaurant?.currency || totals.currency || 'COP';
  const deliveryFee = restaurant?.deliveryFee || 0;
  const { subtotal, serviceFee, total, count: cartCount } = totals;

  function addItem(item) {
    if (!item.isAvailable) return;
    onAddLine({
      id: item.id,
      restaurantId,
      restaurantName: restaurant?.name || '',
      name: item.name,
      price: item.price,
      currency: item.currency || currency,
    });
    setSuccess('');
  }

  async function submitOrder() {
    if (!lines.length) return;
    if (!cardId) {
      setError('Elige o agrega una tarjeta para pagar.');
      return;
    }
    if (!delivery?.firstName || !delivery?.lastName || !delivery?.buildingName || !delivery?.apartment || !delivery?.address) {
      setError('Confirma tu nombre, conjunto, apartamento y dirección.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      let result = await residentApi.checkoutRestaurant(lines[0].restaurantId, {
        cardId,
        items: lines.map((line) => ({
          menuItemId: line.id,
          quantity: line.quantity,
        })),
        notes: notes.trim() || undefined,
        delivery,
      });
      if (result.payment?.status !== 'paid' && result.payment?.id) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          result = await residentApi.cardPayment(result.payment.id);
          if (result.payment?.status === 'paid' || result.payment?.status === 'failed') break;
        }
      }
      if (result.payment?.status !== 'paid') {
        setError('El pago sigue pendiente. El pedido se envía cuando el cobro quede aprobado.');
        return;
      }
      onPaid();
      setSelectedDish(null);
      setSuccess(
        `Pago confirmado. Pedido ${result.payment.order?.orderNumber || ''} recibido.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const towerLabel = delivery?.tower
    ? (/^torre\b/i.test(delivery.tower) ? delivery.tower : `Torre ${delivery.tower}`)
    : '';
  const addressLine = delivery
    ? [
        [towerLabel, delivery.apartment && `apto ${delivery.apartment}`].filter(Boolean).join(' '),
        delivery.buildingName,
        delivery.address,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const personName = delivery
    ? [delivery.firstName, delivery.lastName].filter(Boolean).join(' ')
    : '';
  const articleLabel = cartCount === 1 ? '1 artículo' : `${cartCount} artículos`;

  const orderBar =
    cartCount > 0 ? (
      <div className="resident__shop-cart">
        <button
          type="button"
          className="resident__shop-cart-toggle"
          onClick={onOpenCheckout}
        >
          <span className="resident__shop-cart-toggle__count">{cartCount}</span>
          <span className="resident__shop-cart-toggle__label">
            {articleLabel} · {formatMoney(total, currency)}
          </span>
          <span className="resident__shop-cart-toggle__action">Pagar</span>
        </button>
      </div>
    ) : null;

  if (openCheckout && cartCount > 0) {
    return (
      <div className="resident-page resident-checkout">
        <header className="resident-checkout__top">
          <button
            type="button"
            className="resident-checkout__back"
            onClick={onCloseCheckout}
            aria-label="Volver al menú"
          >
            ‹
          </button>
          <div className="resident-checkout__heading">
            <h1>Enviar pedido</h1>
            <button
              type="button"
              className="resident-checkout__address"
              onClick={() => setEditingDelivery((value) => !value)}
            >
              {personName && <strong>{personName}</strong>}
              <span>{addressLine || 'Cargando dirección…'}</span>
            </button>
          </div>
        </header>

        <div className="resident-checkout__body">
          {error && <p className="resident-checkout__error">{error}</p>}

          {editingDelivery && delivery && (
            <div className="resident-delivery__form resident-checkout__edit">
              <input
                value={delivery.firstName}
                onChange={(e) => setDelivery({ ...delivery, firstName: e.target.value })}
                placeholder="Nombre"
              />
              <input
                value={delivery.lastName}
                onChange={(e) => setDelivery({ ...delivery, lastName: e.target.value })}
                placeholder="Apellido"
              />
              <input
                value={delivery.buildingName}
                onChange={(e) => setDelivery({ ...delivery, buildingName: e.target.value })}
                placeholder="Conjunto"
              />
              <input
                value={delivery.tower}
                onChange={(e) => setDelivery({ ...delivery, tower: e.target.value })}
                placeholder="Torre"
              />
              <input
                value={delivery.apartment}
                onChange={(e) => setDelivery({ ...delivery, apartment: e.target.value })}
                placeholder="Apartamento"
              />
              <input
                value={delivery.address}
                onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                placeholder="Dirección"
              />
              <button type="button" onClick={() => setEditingDelivery(false)}>
                Listo
              </button>
            </div>
          )}

          <div className="resident-checkout__row resident-checkout__row--static">
            <span className="resident-checkout__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4.5L15 15" strokeLinecap="round" />
              </svg>
            </span>
            <span className="resident-checkout__row-copy">
              <strong>Aprox. 30 min</strong>
              <span>El tiempo puede variar según el restaurante</span>
            </span>
          </div>

          <PaymentCards selectedId={cardId} onSelect={setCardId} layout="row" />

          {groups.map((group) => {
            const groupCount = group.lines.reduce((sum, line) => sum + line.quantity, 0);
            const isOpen = Boolean(openGroups[group.id]);
            return (
              <div key={group.id}>
                <button
                  type="button"
                  className="resident-checkout__row"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setOpenGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }))
                  }
                >
                  <span className="resident-checkout__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="resident-checkout__row-copy">
                    <strong>{group.name}</strong>
                    <span>{groupCount === 1 ? '1 artículo' : `${groupCount} artículos`}</span>
                  </span>
                  <span className={`resident-checkout__chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true">
                    ›
                  </span>
                </button>
                {isOpen && (
                  <ul className="resident-checkout__items">
                    {group.lines.map((line) => (
                      <li key={line.id}>
                        <div>
                          <strong>{line.name}</strong>
                          <div className="resident__shop-cart-qty">
                            <button type="button" onClick={() => onChangeQty(line.id, line.quantity - 1)} aria-label="Quitar uno">
                              −
                            </button>
                            <span>{line.quantity}</span>
                            <button type="button" onClick={() => onChangeQty(line.id, line.quantity + 1)} aria-label="Agregar uno">
                              +
                            </button>
                          </div>
                        </div>
                        <span>{formatMoney(line.price * line.quantity, line.currency || currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <label className="resident-checkout__notes">
            Nota para el restaurante
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
              placeholder="Ej: sin cebolla, dejar en portería"
            />
          </label>

          <div className="resident-checkout__bill">
            <p>
              <span>Platos</span>
              <strong>{formatMoney(subtotal, currency)}</strong>
            </p>
            <p>
              <span>Domicilio</span>
              <strong>{totals.deliveryFee > 0 ? formatMoney(totals.deliveryFee, currency) : 'Gratis'}</strong>
            </p>
            <p>
              <span>Tarifa de servicio · 1,5%</span>
              <strong>{formatMoney(serviceFee, currency)}</strong>
            </p>
          </div>
        </div>

        <div className="resident-checkout__bar">
          <div>
            <strong className="resident-checkout__total">{formatMoney(total, currency)}</strong>
          </div>
          <button type="button" onClick={submitOrder} disabled={submitting}>
            {submitting ? 'Pagando…' : 'Pagar'}
          </button>
        </div>
      </div>
    );
  }

  if (selectedDish) {
    return (
      <div className={`resident-page${cartCount > 0 ? ' resident-restaurant-page--cart' : ''}`}>
        <header className="resident-page__header resident-dish__back">
          <button type="button" className="resident-link-btn" onClick={() => setSelectedDish(null)}>
            ← {restaurant?.name || 'Menú'}
          </button>
        </header>
        {selectedDish.imageUrl ? (
          <img src={selectedDish.imageUrl} alt="" className="resident-dish__image" />
        ) : (
          <div className="resident-dish__image resident-dish__image--empty" />
        )}
        <div className="resident-page__body resident-dish__body">
          <h1 className="resident-dish__title">{selectedDish.name}</h1>
          {selectedDish.description && (
            <p className="resident-dish__description">{selectedDish.description}</p>
          )}
          <div className="resident-dish__footer">
            <strong>{formatMoney(selectedDish.price, selectedDish.currency || currency)}</strong>
            {selectedDish.isAvailable ? (
              <button type="button" onClick={() => addItem(selectedDish)}>
                Agregar
              </button>
            ) : (
              <span>Agotado</span>
            )}
          </div>
        </div>
        {orderBar}
      </div>
    );
  }

  return (
    <div className={`resident-page${cartCount > 0 ? ' resident-restaurant-page--cart' : ''}`}>
      <header className="resident-page__header">
        <button type="button" className="resident-link-btn" onClick={onBack}>
          ← Restaurantes
        </button>
        <h1 className="resident-page__title">{restaurant?.name || 'Menú'}</h1>
        {restaurant?.shortDescription && (
          <p className="resident-page__subtitle">{restaurant.shortDescription}</p>
        )}
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}
        {success && <div className="resident__shop-success">{success}</div>}

        {!data && !error && <p className="resident-empty">Cargando menú…</p>}

        {restaurant && (
          <>
            {(restaurant.coverImageUrl || restaurant.logoImageUrl) && (
              <img
                src={restaurant.coverImageUrl || restaurant.logoImageUrl}
                alt=""
                className="resident-restaurant-hero"
              />
            )}

            <div className="resident-restaurant-facts">
              <p>{restaurant.cuisineType || 'Cocina variada'}</p>
              {restaurant.openingHours && <p>{restaurant.openingHours}</p>}
              <p>
                {deliveryFee > 0
                  ? `Domicilio ${formatMoney(deliveryFee, currency)}`
                  : 'Domicilio sin costo'}
                {restaurant.estimatedLabel ? ` · Entrega ${restaurant.estimatedLabel.toLowerCase()}` : ''}
              </p>
              {restaurant.minOrderAmount > 0 && (
                <p>Pedido mínimo {formatMoney(restaurant.minOrderAmount, currency)}</p>
              )}
            </div>

            {categories.length > 0 && (
              <div className="resident__shop-filters">
                <button
                  type="button"
                  className={categoryId === 'all' ? 'is-active' : ''}
                  onClick={() => setCategoryId('all')}
                >
                  Todo
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={categoryId === String(category.id) ? 'is-active' : ''}
                    onClick={() => setCategoryId(String(category.id))}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}

            {items.length === 0 ? (
              <p className="resident-empty">Este restaurante aún no tiene platos publicados.</p>
            ) : (
              grouped.map((group) => (
                <section key={group.category?.id || 'otros'} className="resident-menu-group">
                  {group.category && <h2>{group.category.name}</h2>}
                  {group.category?.description && (
                    <p className="resident-menu-group__hint">{group.category.description}</p>
                  )}
                  <div className="resident-menu-list">
                    {group.items.map((item) => (
                      <article
                        key={item.id}
                        className="resident-menu-item resident-menu-item--open"
                        onClick={() => setSelectedDish(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedDish(item);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="resident-menu-item__image" />
                        ) : (
                          <div className="resident-menu-item__image resident-menu-item__image--empty" />
                        )}
                        <div className="resident-menu-item__body">
                          <h3>{item.name}</h3>
                          {item.description && <p>{item.description}</p>}
                          <div className="resident-menu-item__row">
                            <strong>{formatMoney(item.price, item.currency || currency)}</strong>
                            {item.isAvailable ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addItem(item);
                                }}
                              >
                                Agregar
                              </button>
                            ) : (
                              <span>Agotado</span>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {orderBar}
    </div>
  );
}
