import { Fragment, useEffect, useMemo, useState } from 'react';
import { formatMoney, platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ShopPage.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const STATUS_BADGE = {
  pending: 'admin-badge--pending',
  confirmed: 'admin-badge--paid',
  preparing: 'admin-badge--pending',
  delivered: 'admin-badge--paid',
  cancelled: 'admin-badge--overdue',
};

export default function ShopOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusLabels, setStatusLabels] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState(null);

  async function load() {
    const data = await platformApi.shopOrders({ status: statusFilter });
    setOrders(data.orders);
    setStatusLabels(data.statusLabels || {});
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [statusFilter]);

  const counts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      },
      {}
    );
  }, [orders]);

  async function updateStatus(order, status) {
    setSavingId(order._id);
    setError('');
    setSuccess('');
    try {
      await platformApi.updateShopOrder(order._id, { status });
      setSuccess(`Pedido ${order.orderNumber} actualizado.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function toggleExpanded(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Pedidos shop</h1>
        <p>Pedidos realizados por residentes desde el catálogo de productos hogar.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="shop-page__toolbar">
        <div className="shop-page__tabs">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`shop-page__tab ${statusFilter === option.value ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
              {option.value !== 'all' && counts[option.value] != null && ` · ${counts[option.value]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-grid" style={{ marginBottom: '1rem' }}>
        <div className="admin-stat">
          <p className="admin-stat__label">Pedidos en vista</p>
          <p className="admin-stat__value">{orders.length}</p>
        </div>
      </div>

      <div className="admin-card admin-table-wrap shop-table-card">
        <div className="shop-table-card__head">
          <h2>Listado de pedidos</h2>
          <p>
            {statusFilter === 'all'
              ? 'Últimos pedidos recibidos de todos los conjuntos.'
              : `Filtrando por: ${STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label}`}
          </p>
        </div>

        {orders.length === 0 ? (
          <p className="shop-orders-empty">No hay pedidos con este filtro.</p>
        ) : (
          <table className="admin-table shop-orders-table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Residente</th>
                <th>Entrega</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order._id}>
                  <tr className={expandedId === order._id ? 'is-expanded' : ''}>
                    <td>
                      <button
                        type="button"
                        className="shop-order-link"
                        onClick={() => toggleExpanded(order._id)}
                      >
                        {order.orderNumber}
                      </button>
                      <span className="shop-order-meta">
                        {new Date(order.createdAt).toLocaleString()}
                      </span>
                      <span className="shop-order-meta">
                        {order.items.length} producto(s)
                      </span>
                    </td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <span className="shop-order-meta">{order.customerEmail}</span>
                      {order.customerPhone && (
                        <span className="shop-order-meta">{order.customerPhone}</span>
                      )}
                    </td>
                    <td>
                      <strong>{order.buildingName || '—'}</strong>
                      <span className="shop-order-meta">
                        {order.unitTower ? `${order.unitTower} · ` : ''}Apto {order.unitNumber || '—'}
                      </span>
                      <span className="shop-order-meta">
                        {[order.city, order.country].filter(Boolean).join(', ') || '—'}
                      </span>
                    </td>
                    <td>
                      <strong>{formatMoney(order.subtotal, order.currency)}</strong>
                    </td>
                    <td>
                      <span className={`admin-badge ${STATUS_BADGE[order.status] || ''}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="admin-actions">
                      <select
                        className="shop-order-status-select"
                        value={order.status}
                        disabled={savingId === order._id}
                        onChange={(e) => updateStatus(order, e.target.value)}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  {expandedId === order._id && (
                    <tr className="shop-order-detail-row">
                      <td colSpan={6}>
                        <div className="shop-order-detail">
                          {order.notes && (
                            <p className="shop-order-detail__notes">
                              <strong>Notas del residente:</strong> {order.notes}
                            </p>
                          )}
                          <ul className="shop-order-detail__items">
                            {order.items.map((item, index) => (
                              <li key={`${item.productId}-${index}`}>
                                {item.imageUrl && (
                                  <img src={item.imageUrl} alt="" className="shop-order-detail__thumb" />
                                )}
                                <div>
                                  <strong>{item.name}</strong>
                                  <span className="shop-order-meta">
                                    {item.quantity} × {formatMoney(item.unitPrice, item.currency)}
                                    {item.sku ? ` · SKU ${item.sku}` : ''}
                                  </span>
                                </div>
                                <strong>{formatMoney(item.lineTotal, item.currency)}</strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
