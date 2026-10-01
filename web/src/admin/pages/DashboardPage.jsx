import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, formatCop } from '../../api/client';
import RegisterPaymentModal from '../components/RegisterPaymentModal';
import '../admin.css';

const DEFAULT_RESIDENT_HERO =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [heroNotice, setHeroNotice] = useState('');
  const [heroFile, setHeroFile] = useState(null);
  const [heroPreview, setHeroPreview] = useState('');
  const [heroBusy, setHeroBusy] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState('');

  async function loadDashboard() {
    const dashboard = await adminApi.dashboard();
    setData(dashboard);
  }

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!heroFile) {
      setHeroPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(heroFile);
    setHeroPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [heroFile]);

  async function saveHeroImage() {
    if (!heroFile) return;
    setHeroBusy(true);
    setHeroNotice('');
    setError('');
    try {
      const result = await adminApi.building.uploadHero(heroFile);
      setData((current) =>
        current ? { ...current, building: result.building || current.building } : current
      );
      setHeroFile(null);
      const input = document.getElementById('admin-building-hero-file');
      if (input) input.value = '';
      setHeroNotice('Imagen del inicio actualizada. Los residentes la verán al abrir la app.');
    } catch (err) {
      setError(err.message);
    } finally {
      setHeroBusy(false);
    }
  }

  async function resetHeroImage() {
    if (!window.confirm('¿Quitar la imagen personalizada y usar la predeterminada en la app?')) return;
    setHeroBusy(true);
    setHeroNotice('');
    setError('');
    try {
      const result = await adminApi.building.update({ heroImageUrl: '' });
      setData((current) =>
        current ? { ...current, building: result.building || current.building } : current
      );
      setHeroFile(null);
      setHeroNotice('Se restauró la imagen predeterminada del inicio.');
    } catch (err) {
      setError(err.message);
    } finally {
      setHeroBusy(false);
    }
  }

  function handlePaymentSuccess(result) {
    setPaymentNotice(`Pago registrado: ${formatCop(result.payment?.paidAmount || result.payment?.amount)}`);
    loadDashboard().catch((err) => setError(err.message));
  }

  const stats = data?.stats ?? {};
  const finance = data?.finance ?? {};
  const period = finance.currentPeriod || '';
  const heroImageUrl = data?.building?.heroImageUrl || '';
  const heroDisplay = heroPreview || heroImageUrl || DEFAULT_RESIDENT_HERO;

  const financeCards = [
    { view: 'cartera-actual', label: 'Cartera actual', value: formatCop(finance.carteraActual), money: true },
    { view: 'recaudo', label: 'Recaudo del mes', value: formatCop(finance.recaudoMes), money: true },
    { view: 'morosidad', label: 'Morosidad total', value: formatCop(finance.morosidadTotal), money: true },
    { view: 'pendiente', label: 'Pendiente del mes', value: formatCop(finance.pendienteMes), money: true },
    { view: 'facturado', label: 'Facturado del mes', value: formatCop(finance.facturadoMes), money: true },
    { view: 'tasa-recaudo', label: 'Tasa de recaudo', value: `${finance.tasaRecaudo ?? 0}%`, money: false },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <h1>Panel administrativo</h1>
        <p>{data?.building?.name || 'Resumen del conjunto'}</p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {paymentNotice && <div className="admin-success">{paymentNotice}</div>}
      {heroNotice && <div className="admin-success">{heroNotice}</div>}

      <div className="admin-card admin-building-hero">
        <h2>Imagen del inicio (app residentes)</h2>
        <p className="admin-building-hero__hint">
          Esta foto aparece en la portada del home de la app para {data?.building?.name || 'tu conjunto'}.
        </p>
        <div className="admin-building-hero__preview">
          <img src={heroDisplay} alt="Vista previa del inicio residente" />
        </div>
        <div className="admin-form admin-building-hero__form">
          <label htmlFor="admin-building-hero-file">
            Subir nueva imagen
            <input
              id="admin-building-hero-file"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
              onChange={(event) => setHeroFile(event.target.files?.[0] || null)}
            />
          </label>
          <div className="admin-actions">
            <button
              type="button"
              className="admin-btn"
              disabled={!heroFile || heroBusy}
              onClick={saveHeroImage}
            >
              {heroBusy ? 'Guardando…' : 'Guardar imagen'}
            </button>
            {heroImageUrl && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={heroBusy}
                onClick={resetHeroImage}
              >
                Usar imagen predeterminada
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="admin-grid" style={{ marginBottom: '1rem' }}>
        <div className="admin-stat">
          <p className="admin-stat__label">Apartamentos / unidades</p>
          <p className="admin-stat__value">{stats.units ?? '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Torres</p>
          <p className="admin-stat__value">{stats.towers ?? '—'}</p>
        </div>
        <div className="admin-stat">
          <p className="admin-stat__label">Residentes</p>
          <p className="admin-stat__value">{stats.residents ?? '—'}</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-toolbar">
          <h2 style={{ margin: 0 }}>Cartera — {finance.currentPeriod || 'mes actual'}</h2>
          <button type="button" className="admin-btn" onClick={() => setPaymentModalOpen(true)}>
            Registrar nuevo pago
          </button>
        </div>
        <div className="admin-grid">
          {financeCards.map((card) => (
            <Link
              key={card.view}
              to={`/admin/cartera/${card.view}${period ? `?period=${period}` : ''}`}
              className="admin-stat admin-stat--link"
            >
              <p className="admin-stat__label">{card.label}</p>
              <p className={`admin-stat__value${card.money ? ' admin-stat__value--money' : ''}`}>
                {card.value}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {(finance.highlights ?? []).length > 0 && (
        <div className="admin-card">
          <h2>Alertas financieras</h2>
          <ul className="admin-highlights">
            {finance.highlights.map((item) => (
              <li key={item.message} className={`admin-highlight admin-highlight--${item.type}`}>
                {item.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-card">
        <h2>Resumen operativo</h2>
        <div className="admin-grid">
          <div className="admin-stat">
            <p className="admin-stat__label">Unidades morosas</p>
            <p className="admin-stat__value">{stats.overdue ?? '—'}</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat__label">Parqueaderos visitantes</p>
            <p className="admin-stat__value">{stats.visitorParking ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h2>Accesos rápidos</h2>
        <div className="admin-actions">
          <Link to="/admin/cartera" className="admin-btn admin-btn--ghost">
            Ver cartera
          </Link>
          <Link to="/admin/asignacion" className="admin-btn admin-btn--ghost">
            Asignar residentes
          </Link>
        </div>
      </div>

      <RegisterPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
