import { useEffect, useState } from 'react';
import { formatCop, formatDate, residentApi } from '../api/client';
import './ResidentLayout.css';

function money(amount) {
  return formatCop(amount ?? 0);
}

function StatusBadge({ status }) {
  if (!status) return null;
  return (
    <span className={`resident-util-badge resident-util-badge--${status.tone || 'neutral'}`}>
      {status.label}
    </span>
  );
}

export default function ResidentPublicServicesPage() {
  const [overview, setOverview] = useState(null);
  const [view, setView] = useState('home'); // home | providers | link | detail | history | guide
  const [selectedType, setSelectedType] = useState(null);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [accountCode, setAccountCode] = useState('');
  const [detail, setDetail] = useState(null);
  const [gmail, setGmail] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOverview() {
    const data = await residentApi.utilities.overview();
    setOverview(data);
    return data;
  }

  async function loadGmail() {
    const data = await residentApi.utilities.gmailStatus();
    setGmail(data.gmail);
    return data;
  }

  useEffect(() => {
    document.title = 'Centro de Facturas · Rentados';
    Promise.all([loadOverview(), loadGmail()]).catch((err) => setError(err.message));

    const params = new URLSearchParams(window.location.search);
    const gmailParam = params.get('gmail');
    if (gmailParam === 'connected') {
      setSuccess('Gmail conectado. El Centro Inteligente de Facturas buscará recibos nuevos.');
      loadGmail()
        .then(() => residentApi.utilities.gmailSync())
        .then(async (result) => {
          setGmail(result.connection);
          await loadOverview();
          if (result.summary?.created > 0) {
            setSuccess(
              `Sincronizado: ${result.summary.created} factura(s) nueva(s)${
                result.summary.imported?.length
                  ? ` (${result.summary.imported.join(', ')})`
                  : ''
              }.`
            );
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
    } else if (gmailParam === 'error') {
      setError(params.get('message') || 'No se pudo conectar Gmail');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function openAccountDetail(accountId) {
    setBusy(true);
    setError('');
    try {
      const data = await residentApi.utilities.accountDetail(accountId);
      setDetail(data);
      setView('detail');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openServiceType(serviceType) {
    setError('');
    setSuccess('');
    setSelectedType(serviceType);
    setBusy(true);
    try {
      const linked = (overview?.accounts || []).find(
        (a) => a.serviceType === serviceType.key && a.isActive !== false
      );
      if (linked?.id) {
        await openAccountDetail(linked.id);
        return;
      }
      const data = await residentApi.utilities.providers({ serviceType: serviceType.key });
      setProviders(data.providers || []);
      setView('providers');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startLink(provider) {
    setSelectedProvider(provider);
    setAccountCode('');
    setView('link');
    setError('');
    setSuccess('');
  }

  async function submitLink(e) {
    e.preventDefault();
    if (!selectedProvider) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await residentApi.utilities.linkAccount({
        providerId: selectedProvider.id,
        accountCode: accountCode.trim(),
        accountCodeType: selectedProvider.accountCodeLabel,
      });
      setSuccess(
        `${selectedProvider.name} vinculado. Tu ${selectedProvider.accountCodeLabel || 'código'} quedó guardado.`
      );
      await loadOverview();
      if (result?.account?.id) {
        await openAccountDetail(result.account.id);
      } else {
        setView('home');
      }
      setSelectedProvider(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unlinkAccount(accountId) {
    if (!window.confirm('¿Desvincular este servicio? Podrás volver a registrarlo después.')) return;
    setBusy(true);
    try {
      await residentApi.utilities.unlinkAccount(accountId);
      await loadOverview();
      setDetail(null);
      setView('home');
      setSuccess('Servicio desvinculado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function payBill(bill) {
    setBusy(true);
    setError('');
    try {
      const data = await residentApi.utilities.openPayment(bill.id);
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openProviderPortal(accountId) {
    setBusy(true);
    setError('');
    try {
      const data = await residentApi.utilities.openPortal(accountId);
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank', 'noopener,noreferrer');
      }
      if (data.message) setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid(bill) {
    if (!window.confirm('¿Confirmas que ya pagaste esta factura en el portal del proveedor?')) return;
    setBusy(true);
    try {
      await residentApi.utilities.markPaid(bill.id);
      await loadOverview();
      if (detail?.account?.id) await openAccountDetail(detail.account.id);
      setSuccess('Pago registrado en tu historial de servicios públicos.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function connectGmail() {
    setBusy(true);
    setError('');
    try {
      const data = await residentApi.utilities.gmailConnect();
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      setError('No se pudo iniciar la conexión con Gmail');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function syncGmail() {
    setBusy(true);
    setError('');
    try {
      const result = await residentApi.utilities.gmailSync();
      setGmail(result.connection);
      await loadOverview();
      const created = result.summary?.created || 0;
      setSuccess(
        created > 0
          ? `Centro de Facturas: ${created} nueva(s)${
              result.summary?.imported?.length ? ` · ${result.summary.imported.join(', ')}` : ''
            }.`
          : 'Sin facturas nuevas. Si ya activaste el correo con la empresa, vincula tu código del servicio.'
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGmail() {
    if (!window.confirm('¿Desconectar Gmail? Dejaremos de buscar facturas nuevas en tu correo.')) {
      return;
    }
    setBusy(true);
    try {
      const data = await residentApi.utilities.gmailDisconnect();
      setGmail(data.gmail);
      setSuccess('Gmail desconectado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function goHome() {
    setView('home');
    setSelectedType(null);
    setSelectedProvider(null);
    setDetail(null);
    setError('');
  }

  const accounts = overview?.accounts || [];
  const pendingBills = overview?.pendingBills || [];
  const payments = overview?.payments || [];
  const serviceTypes = overview?.serviceTypes || [];
  const city = overview?.city || '';

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Centro de Facturas</h1>
        <p className="resident-page__subtitle">
          {city
            ? `Vincula tus códigos en ${city} y conecta Gmail: Rentados detecta facturas nuevas, guarda el PDF y te avisa.`
            : 'Vincula tus proveedores, conecta Gmail y recibe avisos inteligentes de facturas.'}
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}
        {success && <div className="resident-success">{success}</div>}

        {view !== 'home' && (
          <button type="button" className="resident-util-back" onClick={goHome}>
            ← Volver
          </button>
        )}

        {view === 'home' && overview && (
          <>
            <section className="resident-card" style={{ marginBottom: '1rem' }}>
              <h2 className="resident-util-section-title">Centro Inteligente de Facturas</h2>
              <p className="resident-util-meta" style={{ marginBottom: '0.75rem' }}>
                Una sola conexión de Gmail para detectar facturas de Air-e, Gases del Caribe, Triple
                A, Claro, Movistar, Tigo y más. Extraemos el PDF, leemos el valor y te notificamos.
                {gmail?.aiConfigured
                  ? ' Análisis con IA activo.'
                  : ' Parsers + lectura de PDF activos (activa OPENAI_API_KEY para IA completa).'}
                {gmail?.pushEnabled ? ' Push casi en tiempo real activo.' : ''}
              </p>
              {gmail?.connected ? (
                <>
                  <p className="resident-util-meta">
                    Conectado: <strong>{gmail.googleEmail || 'Gmail'}</strong>
                    {gmail.lastSyncAt ? ` · Última sync ${formatDate(gmail.lastSyncAt)}` : ''}
                    {gmail.pushEnabled ? ' · Push activo' : ''}
                  </p>
                  <div className="resident-util-form" style={{ marginTop: '0.75rem' }}>
                    <button type="button" disabled={busy} onClick={syncGmail}>
                      {busy ? 'Analizando correo…' : 'Buscar facturas ahora'}
                    </button>
                    <button
                      type="button"
                      className="resident-util-btn-secondary"
                      disabled={busy}
                      onClick={disconnectGmail}
                    >
                      Desconectar Gmail
                    </button>
                    <button
                      type="button"
                      className="resident-util-btn-secondary"
                      onClick={() => setView('guide')}
                    >
                      ¿No te llegan correos de factura?
                    </button>
                  </div>
                </>
              ) : (
                <div className="resident-util-form">
                  <button type="button" disabled={busy} onClick={connectGmail}>
                    Conectar Gmail
                  </button>
                  <button
                    type="button"
                    className="resident-util-btn-secondary"
                    onClick={() => setView('guide')}
                  >
                    Guía: activar factura por correo
                  </button>
                  {gmail && gmail.configured === false && (
                    <p className="resident-util-hint">
                      El administrador aún debe configurar las credenciales de Google en el servidor.
                    </p>
                  )}
                </div>
              )}
            </section>

            {pendingBills.length > 0 && (
              <section className="resident-card" style={{ marginBottom: '1rem' }}>
                <h2 className="resident-util-section-title">Facturas por pagar</h2>
                {pendingBills.map((bill) => (
                  <div key={bill.id} className="resident-payment">
                    <div>
                      <strong>{bill.provider?.name || bill.serviceTypeLabel}</strong>
                      <p className="resident-util-meta">
                        {bill.period || 'Factura'}
                        {bill.dueDate ? ` · Vence ${formatDate(bill.dueDate)}` : ''}
                      </p>
                      <StatusBadge
                        status={
                          bill.status === 'overdue'
                            ? { label: 'En mora', tone: 'danger' }
                            : { label: 'A tiempo', tone: 'warning' }
                        }
                      />
                    </div>
                    <div className="resident-util-actions">
                      <strong>{money(bill.amount)}</strong>
                      <button type="button" disabled={busy} onClick={() => payBill(bill)}>
                        Pagar
                      </button>
                      {bill.documentUrl && (
                        <a
                          className="resident-util-btn-secondary resident-util-link-btn"
                          href={bill.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver PDF
                        </a>
                      )}
                      <button
                        type="button"
                        className="resident-util-btn-secondary"
                        disabled={busy}
                        onClick={() => markPaid(bill)}
                      >
                        Ya pagué
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {accounts.length > 0 && (
              <section className="resident-card" style={{ marginBottom: '1rem' }}>
                <h2 className="resident-util-section-title">Mis servicios vinculados</h2>
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className="resident-util-account-row"
                    onClick={() => openAccountDetail(account.id)}
                  >
                    <div>
                      <div className="resident-util-account-row__title">
                        <strong>{account.provider?.name || account.serviceTypeLabel}</strong>
                        <StatusBadge status={account.status} />
                      </div>
                      <p className="resident-util-meta">
                        {account.serviceTypeLabel} · {account.accountCodeType || 'Código'}{' '}
                        {account.accountCode}
                        {account.amountDue > 0 ? ` · ${money(account.amountDue)}` : ''}
                      </p>
                    </div>
                    <span aria-hidden>›</span>
                  </button>
                ))}
              </section>
            )}

            <div className="resident-util-grid">
              {serviceTypes.map((type) => {
                const linked = accounts.find((a) => a.serviceType === type.key);
                return (
                  <button
                    key={type.key}
                    type="button"
                    className="resident-util-card"
                    disabled={busy}
                    onClick={() => openServiceType(type)}
                  >
                    <div>
                      <div className="resident-util-account-row__title">
                        <strong>{type.label}</strong>
                        {linked?.status && <StatusBadge status={linked.status} />}
                      </div>
                      <span>
                        {linked
                          ? `${linked.provider?.name || 'Vinculado'} · ${linked.accountCode}${
                              linked.amountDue > 0 ? ` · ${money(linked.amountDue)}` : ''
                            }`
                          : city
                            ? `Elegir proveedor en ${city}`
                            : 'Registrar proveedor'}
                      </span>
                    </div>
                    <span aria-hidden>›</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="resident-util-history-btn"
              onClick={() => setView('history')}
            >
              Historial de pagos de servicios públicos
            </button>
          </>
        )}

        {view === 'detail' && detail?.account && (
          <section className="resident-card">
            <div className="resident-util-account-row__title" style={{ marginBottom: '0.5rem' }}>
              <h2 className="resident-util-section-title" style={{ margin: 0 }}>
                {detail.account.provider?.name || detail.account.serviceTypeLabel}
              </h2>
              <StatusBadge status={detail.account.status} />
            </div>
            <p className="resident-util-meta" style={{ marginBottom: '1rem' }}>
              {detail.account.serviceTypeLabel} · {detail.account.accountCodeType || 'Código'}{' '}
              {detail.account.accountCode}
            </p>

            <div className="resident-util-amount-box">
              <p>Valor a pagar</p>
              <strong>
                {detail.account.amountDue > 0 ? money(detail.account.amountDue) : money(0)}
              </strong>
              <span>
                {detail.account.status?.key === 'current'
                  ? 'No tienes facturas pendientes registradas.'
                  : detail.account.latestBill?.dueDate
                    ? `Vence ${formatDate(detail.account.latestBill.dueDate)}`
                    : 'Factura pendiente'}
              </span>
            </div>

            {(detail.openBills || []).map((bill) => (
              <div key={bill.id} className="resident-payment">
                <div>
                  <strong>{bill.period || 'Factura actual'}</strong>
                  <p className="resident-util-meta">
                    {bill.dueDate ? `Vence ${formatDate(bill.dueDate)}` : 'Sin fecha de vencimiento'}
                  </p>
                  <StatusBadge
                    status={
                      bill.status === 'overdue'
                        ? { label: 'En mora', tone: 'danger' }
                        : { label: 'A tiempo', tone: 'warning' }
                    }
                  />
                </div>
                <div className="resident-util-actions">
                  <strong>{money(bill.amount)}</strong>
                  <button type="button" disabled={busy} onClick={() => payBill(bill)}>
                    Pagar en portal
                  </button>
                  {bill.documentUrl && (
                    <a
                      className="resident-util-btn-secondary resident-util-link-btn"
                      href={bill.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={bill.documentFileName || 'factura-aire.pdf'}
                    >
                      Descargar PDF
                    </a>
                  )}
                  <button
                    type="button"
                    className="resident-util-btn-secondary"
                    disabled={busy}
                    onClick={() => markPaid(bill)}
                  >
                    Ya pagué
                  </button>
                </div>
              </div>
            ))}

            <div className="resident-util-form" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => openProviderPortal(detail.account.id)}
              >
                Consultar / pagar en {detail.account.provider?.name || 'el proveedor'}
              </button>
              <button
                type="button"
                className="resident-util-btn-secondary"
                disabled={busy}
                onClick={() => {
                  setSelectedProvider(detail.account.provider);
                  setAccountCode(detail.account.accountCode || '');
                  setSelectedType({
                    key: detail.account.serviceType,
                    label: detail.account.serviceTypeLabel,
                  });
                  setView('link');
                }}
              >
                Editar {detail.account.accountCodeType || 'código'}
              </button>
              <button
                type="button"
                className="resident-util-btn-secondary"
                disabled={busy}
                onClick={() => unlinkAccount(detail.account.id)}
              >
                Desvincular
              </button>
            </div>

            {detail.lookup?.message && (
              <p className="resident-util-hint">{detail.lookup.message}</p>
            )}
          </section>
        )}

        {view === 'providers' && selectedType && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">{selectedType.label}</h2>
            <p className="resident-util-meta" style={{ marginBottom: '0.75rem' }}>
              Proveedores disponibles{city ? ` en ${city}` : ''}. Elige el tuyo.
            </p>
            {providers.length === 0 ? (
              <p className="resident-empty">
                Aún no hay proveedores configurados para esta ciudad. Contacta a soporte Rentados.
              </p>
            ) : (
              <div className="resident-util-grid">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    type="button"
                    className="resident-util-card"
                    onClick={() => startLink(provider)}
                  >
                    <div>
                      <strong>{provider.name}</strong>
                      <span>{provider.accountCodeLabel || 'Código'}</span>
                    </div>
                    <span aria-hidden>›</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'link' && selectedProvider && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">{selectedProvider.name}</h2>
            <p className="resident-util-meta" style={{ marginBottom: '0.75rem' }}>
              {selectedProvider.accountCodeHelp ||
                `Ingresa tu ${selectedProvider.accountCodeLabel || 'código'} con el proveedor. Se guardará para no volver a digitarlo.`}
            </p>
            <form className="resident-util-form" onSubmit={submitLink}>
              <label>
                {selectedProvider.accountCodeLabel || 'Código'}
                <input
                  value={accountCode}
                  onChange={(e) => setAccountCode(e.target.value)}
                  placeholder={
                    selectedProvider.slug === 'aire-energia' ? 'Ej. 7945070' : 'Tu código'
                  }
                  required
                  autoComplete="off"
                />
              </label>
              <button type="submit" disabled={busy || !accountCode.trim()}>
                {busy ? 'Guardando…' : 'Guardar y vincular'}
              </button>
              {selectedType && (
                <button
                  type="button"
                  className="resident-util-btn-secondary"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const data = await residentApi.utilities.providers({
                        serviceType: selectedType.key,
                      });
                      setProviders(data.providers || []);
                      setSelectedProvider(null);
                      setView('providers');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cambiar de proveedor
                </button>
              )}
            </form>
          </section>
        )}

        {view === 'guide' && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">Guía del Centro de Facturas</h2>
            <p className="resident-util-meta" style={{ marginBottom: '1rem' }}>
              El truco no es una API por empresa: es que cada proveedor te envíe la factura al mismo
              Gmail. Luego Rentados la detecta sola.
            </p>

            <ol className="resident-util-guide" style={{ marginBottom: '1.25rem' }}>
              <li>
                <strong>Conecta Gmail</strong>
                <span>Solo lectura. Rentados busca facturas nuevas y guarda el PDF.</span>
              </li>
              <li>
                <strong>Vincula tu código por servicio</strong>
                <span>
                  NIC (Air-e), contrato (Gas/Triple A), cuenta o línea (Claro/Movistar/Tigo).
                </span>
              </li>
              <li>
                <strong>Activa factura digital en cada empresa</strong>
                <span>Al mismo correo de Gmail. Usa los enlaces de abajo.</span>
              </li>
            </ol>

            <h3 className="resident-util-section-title">Air-e (energía)</h3>
            <div className="resident-util-guide__actions" style={{ marginBottom: '1rem' }}>
              <a
                href="https://www.air-e.com"
                target="_blank"
                rel="noopener noreferrer"
                className="resident-util-link-btn resident-util-btn-secondary"
              >
                Oficina virtual
              </a>
              <a
                href="https://wa.me/573134300000"
                target="_blank"
                rel="noopener noreferrer"
                className="resident-util-link-btn resident-util-btn-secondary"
              >
                WhatsApp
              </a>
            </div>

            <h3 className="resident-util-section-title">Gases del Caribe</h3>
            <div className="resident-util-guide__actions" style={{ marginBottom: '1rem' }}>
              <a
                href="https://portal.gascaribe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="resident-util-link-btn resident-util-btn-secondary"
              >
                Portal Gascaribe
              </a>
              <a
                href="https://wa.me/576053227000"
                target="_blank"
                rel="noopener noreferrer"
                className="resident-util-link-btn resident-util-btn-secondary"
              >
                WhatsApp
              </a>
            </div>

            <h3 className="resident-util-section-title">Triple A / Claro / Movistar / Tigo</h3>
            <p className="resident-util-meta" style={{ marginBottom: '0.75rem' }}>
              En la app o web de cada empresa busca “factura electrónica”, “factura al correo” o
              “facturación digital” y registra el mismo Gmail. Luego vincula tu código aquí.
            </p>

            <div className="resident-util-form" style={{ marginTop: '1rem' }}>
              <button type="button" disabled={busy || gmail?.connected} onClick={connectGmail}>
                {gmail?.connected ? 'Gmail ya conectado' : 'Conectar Gmail ahora'}
              </button>
              <button type="button" className="resident-util-btn-secondary" onClick={goHome}>
                Listo, volver
              </button>
            </div>
          </section>
        )}

        {view === 'history' && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">Historial de pagos</h2>
            <p className="resident-util-meta" style={{ marginBottom: '0.75rem' }}>
              Independiente de la administración del conjunto.
            </p>
            {payments.length === 0 ? (
              <p className="resident-empty">Aún no hay pagos registrados.</p>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="resident-payment">
                  <div>
                    <strong>{payment.provider?.name || payment.serviceTypeLabel}</strong>
                    <p className="resident-util-meta">
                      {payment.serviceTypeLabel} · {formatDate(payment.paidAt)}
                    </p>
                  </div>
                  <strong>{money(payment.amount)}</strong>
                </div>
              ))
            )}
          </section>
        )}

        {!overview && !error && <p className="resident-empty">Cargando servicios…</p>}
      </div>
    </div>
  );
}
