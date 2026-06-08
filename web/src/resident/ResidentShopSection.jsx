import { useEffect, useMemo, useState } from 'react';
import { formatMoney, residentApi } from '../api/client';

const STATUS_LABELS = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function ResidentShopSection({ shopData }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState({});
  const [notes, setNotes] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const products = shopData?.products || [];
  const categories = shopData?.categories || [];
  const featured = shopData?.featured || [];

  useEffect(() => {
    residentApi
      .shopOrders()
      .then((data) => setOrders(data.orders || []))
      .catch(() => setOrders([]));
  }, []);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') return products;
    return products.filter(
      (product) => String(product.categoryId?._id || product.categoryId) === categoryFilter
    );
  }, [products, categoryFilter]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((item) => String(item._id) === productId);
        if (!product || quantity < 1) return null;
        return { product, quantity };
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartTotal = useMemo(
    () =>
      cartLines.reduce(
        (sum, line) => sum + line.product.price * line.quantity,
        0
      ),
    [cartLines]
  );

  const cartCurrency = cartLines[0]?.product.currency || 'COP';
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  function addToCart(product) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const current = prev[product._id] || 0;
      const nextQty = current + 1;
      if (product.stock != null && nextQty > product.stock) return prev;
      return { ...prev, [product._id]: nextQty };
    });
    setShowCheckout(true);
  }

  function updateCartQty(productId, quantity) {
    setCart((prev) => {
      const next = { ...prev };
      if (quantity < 1) {
        delete next[productId];
        return next;
      }
      next[productId] = quantity;
      return next;
    });
  }

  async function submitOrder() {
    if (cartLines.length === 0) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const result = await residentApi.createShopOrder({
        items: cartLines.map((line) => ({
          productId: line.product._id,
          quantity: line.quantity,
        })),
        notes: notes.trim() || undefined,
      });
      setSuccess(`Pedido ${result.order.orderNumber} recibido. Te contactaremos pronto.`);
      setCart({});
      setNotes('');
      setShowCheckout(false);
      const data = await residentApi.shopOrders();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!shopData) {
    return <p className="resident__empty">Cargando shop…</p>;
  }

  if (products.length === 0) {
    return (
      <div className="resident__card">
        <h2>Shop — Productos hogar</h2>
        <p className="resident__empty">
          No hay productos disponibles para tu ciudad ({shopData.location?.city || '—'}).
        </p>
      </div>
    );
  }

  return (
    <section className="resident__section resident__shop">
      {error && <div className="resident__error">{error}</div>}
      {success && <div className="resident__shop-success">{success}</div>}

      {featured.length > 0 && categoryFilter === 'all' && (
        <div className="resident__card">
          <h2>Destacados</h2>
          <div className="resident__shop-grid">
            {featured.map((product) => (
              <ShopProductCard key={product._id} product={product} featured onAdd={addToCart} />
            ))}
          </div>
        </div>
      )}

      <div className="resident__card">
        <div className="resident__shop-header">
          <h2>Productos hogar</h2>
          <p className="resident__shop-location">
            Entrega en {shopData.location?.city || 'tu ciudad'}
          </p>
        </div>

        {categories.length > 1 && (
          <div className="resident__shop-filters">
            <button
              type="button"
              className={categoryFilter === 'all' ? 'is-active' : ''}
              onClick={() => setCategoryFilter('all')}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category._id}
                type="button"
                className={categoryFilter === category._id ? 'is-active' : ''}
                onClick={() => setCategoryFilter(category._id)}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        <div className="resident__shop-grid">
          {filteredProducts.map((product) => (
            <ShopProductCard key={product._id} product={product} onAdd={addToCart} />
          ))}
        </div>
      </div>

      {orders.length > 0 && (
        <div className="resident__card">
          <h2>Mis pedidos</h2>
          <ul className="resident__shop-orders">
            {orders.map((order) => (
              <li key={order._id} className="resident__shop-order">
                <div>
                  <p className="resident__shop-order-id">{order.orderNumber}</p>
                  <p className="resident__shop-order-meta">
                    {new Date(order.createdAt).toLocaleString()} · {order.items.length} producto(s)
                  </p>
                </div>
                <div className="resident__shop-order-right">
                  <span className="resident__shop-order-status">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <strong>{formatMoney(order.subtotal, order.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cartCount > 0 && (
        <div className={`resident__shop-cart ${showCheckout ? 'is-open' : ''}`}>
          <button
            type="button"
            className="resident__shop-cart-toggle"
            onClick={() => setShowCheckout((prev) => !prev)}
          >
            <span>
              {cartCount} producto(s) · {formatMoney(cartTotal, cartCurrency)}
            </span>
            <span>{showCheckout ? 'Ocultar' : 'Ver pedido'}</span>
          </button>

          {showCheckout && (
            <div className="resident__shop-cart-panel">
              <ul className="resident__shop-cart-lines">
                {cartLines.map(({ product, quantity }) => (
                  <li key={product._id}>
                    <div>
                      <strong>{product.name}</strong>
                      <p>{formatMoney(product.price, product.currency)} c/u</p>
                    </div>
                    <div className="resident__shop-cart-qty">
                      <button
                        type="button"
                        onClick={() => updateCartQty(product._id, quantity - 1)}
                        aria-label="Quitar uno"
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(product._id, quantity + 1)}
                        aria-label="Agregar uno"
                        disabled={product.stock != null && quantity >= product.stock}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <label className="resident__shop-cart-notes">
                Notas para el pedido (opcional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej: entregar en portería, apto 502…"
                />
              </label>
              <button
                type="button"
                className="resident__shop-cart-submit"
                onClick={submitOrder}
                disabled={submitting}
              >
                {submitting ? 'Enviando…' : 'Confirmar pedido'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShopProductCard({ product, featured, onAdd }) {
  const imageUrl = product.images?.[0]?.url;
  const hasDiscount =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const outOfStock = product.stock === 0;

  return (
    <article className={`resident__shop-card ${featured ? 'resident__shop-card--featured' : ''}`}>
      <div className="resident__shop-card-media">
        {imageUrl ? (
          <img src={imageUrl} alt={product.name} />
        ) : (
          <div className="resident__shop-card-placeholder">Sin imagen</div>
        )}
        {featured && <span className="resident__shop-badge">Destacado</span>}
      </div>
      <div className="resident__shop-card-body">
        {product.categoryId?.name && (
          <p className="resident__shop-category">{product.categoryId.name}</p>
        )}
        <h3>{product.name}</h3>
        {product.shortDescription && <p>{product.shortDescription}</p>}
        <div className="resident__shop-prices">
          <strong>{formatMoney(product.price, product.currency || 'COP')}</strong>
          {hasDiscount && (
            <span className="resident__shop-compare">
              {formatMoney(product.compareAtPrice, product.currency || 'COP')}
            </span>
          )}
        </div>
        {product.stock != null && product.stock <= 5 && product.stock > 0 && (
          <p className="resident__shop-stock">Quedan {product.stock} unidades</p>
        )}
        {outOfStock ? (
          <p className="resident__shop-stock resident__shop-stock--out">Agotado</p>
        ) : (
          <button type="button" className="resident__shop-add" onClick={() => onAdd(product)}>
            Agregar al pedido
          </button>
        )}
      </div>
    </article>
  );
}
