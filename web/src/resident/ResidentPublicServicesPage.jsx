import { useEffect, useState } from 'react';
import { residentApi } from '../api/client';
import './ResidentLayout.css';

const TYPE_LABELS = {
  energy: 'Energía eléctrica',
  water: 'Agua',
  gas: 'Gas',
  internet: 'Internet',
  phone: 'Telefonía',
};

function providerId(provider) {
  return String(provider?.id || provider?._id || '');
}

function accountForProvider(accounts, provider) {
  const id = providerId(provider);
  return (accounts || []).find(
    (account) => account.isActive !== false && providerId(account.provider) === id
  );
}

export default function ResidentPublicServicesPage() {
  const [overview, setOverview] = useState(null);
  const [view, setView] = useState('home');
  const [selectedType, setSelectedType] = useState(null);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState(null);
  const [accountCode, setAccountCode] = useState('');
  const [savedAccount, setSavedAccount] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  async function loadOverview() {
    const data = await residentApi.utilities.overview();
    setOverview(data);
    return data;
  }

  useEffect(() => {
    document.title = 'Centro de Facturas · Rentados';
    loadOverview().catch((err) => setError(err.message));
  }, []);

  const accounts = overview?.accounts || [];
  const serviceTypes = overview?.serviceTypes || [];
  const city = overview?.city || 'tu ciudad';

  function goHome() {
    setView('home');
    setSelectedType(null);
    setProvider(null);
    setError('');
    setSuccess('');
  }

  function goProviders() {
    setView('providers');
    setProvider(null);
    setError('');
    setSuccess('');
  }

  async function openType(type) {
    setError('');
    setSuccess('');
    setSelectedType(type);
    setBusy(true);
    try {
      const data = await residentApi.utilities.providers({ serviceType: type.key });
      setProviders(data.providers || []);
      setView('providers');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function openProvider(item, sourceAccounts = accounts) {
    const existing = accountForProvider(sourceAccounts, item);
    setProvider(item);
    setAccountCode(existing?.accountCode || '');
    setSavedAccount(existing || null);
    setEditing(false);
    setView('provider');
    setError('');
    setSuccess('');
  }

  async function saveCode(event) {
    event.preventDefault();
    if (!provider) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await residentApi.utilities.linkAccount({
        providerId: provider.id,
        accountCode,
      });
      const account = result.account;
      setSavedAccount(account);
      setAccountCode(account.accountCode || accountCode);
      setEditing(false);
      const data = await loadOverview();
      setSuccess('Dato guardado. Queda asociado a tu unidad.');
      if (account?.provider) {
        setProvider((current) => ({ ...current, ...account.provider, id: account.provider.id || current?.id }));
      }
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    const value = String(savedAccount?.accountCode || accountCode || '').trim();
    if (!value) return;
    let copiedOk = false;
    try {
      await navigator.clipboard.writeText(value);
      copiedOk = true;
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        copiedOk = document.execCommand('copy');
        area.remove();
      } catch {
        copiedOk = false;
      }
    }
    if (!copiedOk) {
      setError('No se pudo copiar el código.');
      return;
    }
    setError('');
    setCopied(true);
    setSuccess('Código copiado al portapapeles.');
    window.setTimeout(() => setCopied(false), 2000);
  }

  function pay() {
    const url = provider?.paymentUrl || savedAccount?.provider?.paymentUrl;
    if (!url) {
      setError('Este prestador aún no tiene página de pagos.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const typeLabel = selectedType ? TYPE_LABELS[selectedType.key] || selectedType.label : '';
  const codeLabel = provider?.accountCodeLabel || 'Código de cobro';
  const storedCode = savedAccount?.accountCode || '';

  return (
    <div className="resident-page">
      <header className="resident-page__header">
        <h1 className="resident-page__title">Centro de Facturas</h1>
        <p className="resident-page__subtitle">
          Guarda el dato de cobro de cada servicio en {city} y paga directo en la página de la empresa.
        </p>
      </header>

      <div className="resident-page__body">
        {error && <div className="resident-error">{error}</div>}
        {success && <div className="resident-success">{success}</div>}

        {view !== 'home' && (
          <button type="button" className="resident-util-back" onClick={view === 'provider' ? goProviders : goHome}>
            ← Volver
          </button>
        )}

        {view === 'home' && overview && (
          <div className="resident-util-grid">
            {serviceTypes.map((type) => {
              const linked = accounts.filter((account) => account.serviceType === type.key);
              const label = TYPE_LABELS[type.key] || type.label;
              return (
                <button
                  key={type.key}
                  type="button"
                  className="resident-util-card"
                  disabled={busy}
                  onClick={() => openType(type)}
                >
                  <div>
                    <strong>{label}</strong>
                    <span>
                      {linked.length
                        ? linked
                            .map((account) => account.provider?.name)
                            .filter(Boolean)
                            .join(', ')
                        : `Prestadores en ${city}`}
                    </span>
                  </div>
                  <span aria-hidden>›</span>
                </button>
              );
            })}
          </div>
        )}

        {view === 'providers' && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">{typeLabel}</h2>
            <p className="resident-util-meta">Prestadores en {city}. Elige el tuyo para guardar el dato de cobro.</p>
            {providers.length === 0 ? (
              <p className="resident-util-hint">No hay prestadores de este servicio en {city}.</p>
            ) : (
              <div className="resident-util-grid" style={{ marginTop: '0.85rem' }}>
                {providers.map((item) => {
                  const saved = accountForProvider(accounts, item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="resident-util-card"
                      onClick={() => openProvider(item)}
                    >
                      <div>
                        <div className="resident-util-account-row__title">
                          <strong>{item.name}</strong>
                          {saved && <span className="resident-util-badge resident-util-badge--success">Guardado</span>}
                        </div>
                        <span>{saved ? `${saved.accountCodeType || item.accountCodeLabel}: ${saved.accountCode}` : item.accountCodeLabel}</span>
                      </div>
                      <span aria-hidden>›</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {view === 'provider' && provider && (
          <section className="resident-card">
            <h2 className="resident-util-section-title">{provider.name}</h2>
            <p className="resident-util-meta">
              {provider.accountCodeHelp || `Guarda tu ${codeLabel.toLowerCase()} para pagarlo cuando lo necesites.`}
            </p>

            {storedCode && !editing ? (
              <div className="resident-util-saved">
                <div>
                  <span className="resident-util-meta">{codeLabel}</span>
                  <p>{storedCode}</p>
                </div>
              </div>
            ) : (
              <form id="utility-code-form" className="resident-util-form" onSubmit={saveCode}>
                <label htmlFor="utility-account-code">{codeLabel}</label>
                <input
                  id="utility-account-code"
                  value={accountCode}
                  onChange={(event) => setAccountCode(event.target.value)}
                  placeholder={codeLabel}
                  autoComplete="off"
                  required
                />
              </form>
            )}

            {storedCode && !editing && (
              <button type="button" className="resident-util-copy" onClick={copyCode}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                {copied ? 'Copiado' : 'Copiar al portapapeles'}
              </button>
            )}

            {storedCode && !editing ? (
              <button type="button" className="resident-util-update" onClick={() => setEditing(true)}>
                Actualizar dato
              </button>
            ) : (
              <button type="submit" form="utility-code-form" className="resident-util-update" disabled={busy}>
                {busy ? 'Guardando…' : storedCode ? 'Actualizar dato' : 'Guardar dato'}
              </button>
            )}

            {provider.paymentUrl && (
              <button type="button" className="resident-util-pay" onClick={pay}>
                Pagar en {provider.name}
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
