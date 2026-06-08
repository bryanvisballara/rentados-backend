import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, platformApi } from '../../api/client';
import '../../admin/admin.css';
import './ShopPage.css';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const STATUS_BADGE = {
  pending: 'admin-badge--pending',
  confirmed: 'admin-badge--paid',
  preparing: 'admin-badge--pending',
  ready: 'admin-badge--paid',
  delivered: 'admin-badge--paid',
  cancelled: 'admin-badge--overdue',
};

export default function RestaurantOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [statusLabels, setStatusLabels] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState(null);

  async function load() {
    const params = { status: statusFilter };
    if (restaurantFilter !== 'all') params.restaurantId = restaurantFilter;
    const [ordersData, restaurantsData] = await Promise.all([
      platformApi.restaurantOrders(params),
      platformApi.restaurants(),
    ]);
    setOrders(ordersData.orders);
    setStatusLabels(ordersData.statusLabels || {});
    setRestaurants(restaurantsData.restaurants.filter((item) => item.isActive !== false));
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [statusFilter, restaurantFilter]);

  const counts = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  async function updateStatus(order, status) {
    setSavingId(order._id);
    setError('');
    setSuccess('');
    try {
      await platformApi.updateRestaurantOrder(order._id, { status });
      setSuccess(`Pedido ${order.orderNumber} actualizado.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <Link to="/super-admin/restaurantes" className="app-adoption-back">
          ← Restaurantes
        </Link>
        <h1>Pedidos de restaurantes</h1>
        <p>Pedidos de restaurantes propios de Rentados desde los conjuntos.</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      <div className="shop-page__toolbar">
        <select
          className="shop-order-status-select"
          value={restaurantFilter}
          onChange={(e) => setRestaurantFilter(e.target.value)}
        >
          <option value="all">Todos los restaurantes</option>
          {restaurants.map((restaurant) => (
            <option key={restaurant._id} value={restaurant._id}>
              {restaurant.name}
            </option>
          ))}
        </select>
        <select
          className="shop-order-status-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.value !== 'all' && counts[option.value] ? ` (${counts[option.value]})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-card admin-table-wrap shop-table-card">
        <table className="admin-table shop-orders-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Restaurante</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="shop-orders-empty">
                  No hay pedidos con este filtro.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <Fragment key={order._id}>
                  <tr className={expandedId === order._id ? 'is-expanded' : ''}>
                    <td>
                      <button
                        type="button"
                        className="shop-order-link"
                        onClick={() => setExpandedId((prev) => (prev === order._id ? null : order._id))}
                      >
                        {order.orderNumber}
                      </button>
                      <span className="shop-order-meta">
                        {new Date(order.createdAt).toLocaleString('es-CO')}
                      </span>
                    </td>
                    <td>{order.restaurantName}</td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <span className="shop-order-meta">
                        {order.buildingName} · {order.unitTower} {order.unitNumber}
                      </span>
                    </td>
                    <td>{formatMoney(order.total, order.currency)}</td>
                    <td>
                      <span className={`admin-badge ${STATUS_BADGE[order.status] || ''}`}>
                        {order.statusLabel || statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td>
                      <select
                        className="shop-order-status-select"
                        value={order.status}
                        disabled={savingId === order._id}
                        onChange={(e) => updateStatus(order, e.target.value)}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
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
                              <strong>Notas:</strong> {order.notes}
                            </p>
                          )}
                          <ul className="shop-order-detail__items">
                            {order.items.map((item) => (
                              <li key={`${item.menuItemId}-${item.name}`}>
                                <div>
                                  <strong>{item.name}</strong>
                                  <span className="shop-order-meta">
                                    {item.quantity} × {formatMoney(item.unitPrice, item.currency)}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
