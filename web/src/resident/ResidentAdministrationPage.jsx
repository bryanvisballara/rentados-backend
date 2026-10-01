import { useEffect, useMemo, useState } from 'react';
import { residentApi } from '../api/client';
import { getPaymentConceptLabel } from '../admin/paymentConcepts';
import { APP_LOCALE, APP_TIMEZONE } from '../utils/dateTime';
import { buildWhatsappUrl } from '../utils/whatsapp';
import PaymentCards from './PaymentCards';
import { ResidentOverlay } from './ResidentLayout';
import { resolveAdministrationCarouselView } from './administrationBalance';
import './ResidentAdministrationPage.css';

const SHORT_CONCEPTS = {
  administration: 'Administración',
  utilities: 'Servicios',
  parking: 'Parqueadero',
  fine: 'Multa',
  service: 'Servicio',
  other: 'Otro',
};

function money(value) {
  return `$ ${Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function initials(firstName, lastName) {
  const letters = `${firstName || ''} ${lastName || ''}`
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
  return (letters || 'R').toUpperCase();
}

function formatPeriod(period) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match) return period || '';
  const label = new Intl.DateTimeFormat(APP_LOCALE, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatLongDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatHistoryDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function conceptName(payment) {
  if (!payment) return 'Cuota';
  return SHORT_CONCEPTS[payment.concept] || getPaymentConceptLabel(payment);
}

function paymentTitle(payment) {
  const period = formatPeriod(payment?.period);
  const name = conceptName(payment);
  return period ? `${name} de ${period.charAt(0).toLowerCase()}${period.slice(1)}` : name;
}

function bogotaMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function isAdminPeriod(period) {
  return /^\d{4}-\d{2}$/.test(String(period || ''));
}

function addMonthsToPeriod(period, delta) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
  if (!match) return period;
  const date = new Date(Number(match[1]), Number(match[2]) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS_BACK = 11;
const MONTHS_FORWARD = 1;

function periodsInRange(startPeriod, endPeriod) {
  const periods = [];
  if (!startPeriod || !endPeriod || startPeriod.localeCompare(endPeriod) > 0) return periods;
  let cursor = startPeriod;
  while (cursor.localeCompare(endPeriod) <= 0) {
    periods.push(cursor);
    cursor = addMonthsToPeriod(cursor, 1);
  }
  return periods;
}

function unitTitle(unit) {
  if (!unit?.number) return 'Tu unidad';
  const prefix = unit.type === 'house' ? 'Casa' : unit.type === 'commercial' ? 'Local' : 'Apto';
  return `${prefix} ${unit.number}`;
}

function towerLabel(tower) {
  const value = String(tower || '').trim();
  if (!value) return '';
  return /^torre\b/i.test(value) ? value : `Torre ${value}`;
}

function isOpenPayment(payment) {
  return payment?.status !== 'paid';
}

export default function ResidentAdministrationPage() {
  const [billing, setBilling] = useState(null);
  const [home, setHome] = useState(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [cardId, setCardId] = useState('');
  const [paying, setPaying] = useState(false);
  const [payNotice, setPayNotice] = useState('');

  async function loadBilling() {
    const [billingData, homeData] = await Promise.all([
      residentApi.billing(),
      residentApi.home().catch(() => null),
    ]);
    setBilling(billingData);
    setHome(homeData);
  }

  useEffect(() => {
    document.title = 'Administración · Rentados';
    loadBilling().catch((err) => setError(err.message));
  }, []);

  const payments = billing?.payments || [];
  const pending = useMemo(
    () =>
      payments
        .filter(isOpenPayment)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [payments]
  );
  const carouselMonths = useMemo(() => {
    const currentPeriod = bogotaMonthKey();
    const byPeriod = new Map(
      payments
        .filter((payment) => payment.concept === 'administration' && isAdminPeriod(payment.period))
        .map((payment) => [payment.period, payment])
    );
    const start = addMonthsToPeriod(currentPeriod, -MONTHS_BACK);
    const end = addMonthsToPeriod(currentPeriod, MONTHS_FORWARD);
    return periodsInRange(start, end).map((period) => ({
      period,
      payment: byPeriod.get(period) || null,
    }));
  }, [payments]);
  const carouselKey = carouselMonths.map((item) => item.period).join('|');
  const history = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === 'paid')
        .sort(
          (a, b) =>
            new Date(b.paidAt || b.updatedAt || 0) - new Date(a.paidAt || a.updatedAt || 0)
        ),
    [payments]
  );

  useEffect(() => {
    const currentPeriod = bogotaMonthKey();
    const found = carouselMonths.findIndex((item) => item.period === currentPeriod);
    setIndex(found >= 0 ? found : 0);
  }, [carouselKey, carouselMonths]);

  const firstName = home?.user?.firstName || 'residente';
  const lastName = home?.user?.lastName || '';
  const mark = initials(firstName, lastName);
  const unit = billing?.unit || home?.unit;
  const buildingName = home?.building?.name || billing?.building?.name || '';
  const residentName = `${firstName} ${lastName}`.trim();
  const unitMeta = [towerLabel(unit?.tower), residentName].filter(Boolean).join(' · ');
  const monthlyFee = billing?.monthlyAdministrationFee;
  const slide = carouselMonths[index] || null;
  const monthKey = bogotaMonthKey();
  const carouselView = useMemo(() => {
    if (!slide?.period) return null;
    return resolveAdministrationCarouselView({
      payments,
      slidePeriod: slide.period,
      monthlyFee,
    });
  }, [slide?.period, payments, monthlyFee]);
  const viewPayment = carouselView?.view || null;
  const breakdown = carouselView?.breakdown || [];
  const aggregateDue = Boolean(carouselView?.aggregate);
  const graceDays = billing?.billingSettings?.gracePeriodDays ?? 5;
  const interestRate = billing?.billingSettings?.monthlyInterestRatePercent ?? 1.5;
  const isOpenView =
    viewPayment &&
    !['paid', 'clear', 'upcoming'].includes(viewPayment.status) &&
    Number(carouselView?.payable ?? 0) > 0;
  const isMora = carouselView?.mode === 'overdue';
  const moraInterest =
    billing?.adminOutstanding?.totalInterest ??
    breakdown.reduce((sum, line) => sum + (Number(line.interestAmount) || 0), 0);
  const payable = carouselView?.payable ?? 0;
  const periodLabel = paymentTitle(
    viewPayment || { concept: 'administration', period: monthKey }
  );
  const showReference =
    isOpenView &&
    viewPayment &&
    !aggregateDue &&
    Number(viewPayment.amount) > Number(viewPayment.totalDue || 0) &&
    Number(viewPayment.totalDue) > 0;

  function payMessage(payment) {
    const place = unitTitle(unit);
    if (payment?.settleOutstandingAdmin) {
      return `Hola, quiero pagar las cuotas de administración pendientes de ${place}. Valor total: ${money(
        payment.totalDue
      )}.`;
    }
    return `Hola, quiero pagar ${paymentTitle(payment)} de ${place}. Valor: ${money(
      payment.totalDue || payment.amount
    )}.`;
  }

  function payableNow() {
    if (aggregateDue && payable > 0) {
      return { settleOutstandingAdmin: true, totalDue: payable, concept: 'administration', period: monthKey };
    }
    if (viewPayment?._id && isOpenView) return viewPayment;
    const open = pending.find((payment) => payment.concept === 'administration') || pending[0];
    if (open) return open;
    return {
      concept: 'administration',
      period: monthKey,
      amount: monthlyFee || 0,
      totalDue: monthlyFee || 0,
    };
  }

  function payCurrent() {
    const payment = payableNow();
    if (payment?.settleOutstandingAdmin || payment?._id) {
      setPayNotice('');
      setSheet('pay');
      return;
    }
    const url = buildWhatsappUrl(
      home?.organization?.contacts?.adminWhatsapp,
      payMessage(payment)
    );
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function confirmAdminPayment() {
    const payment = payableNow();
    if (!payment?.settleOutstandingAdmin && !payment?._id) return;
    if (!cardId) {
      setPayNotice('Elige o agrega una tarjeta.');
      return;
    }
    setPaying(true);
    setPayNotice('');
    try {
      let result = await residentApi.payAdministration(
        payment.settleOutstandingAdmin
          ? { cardId, settleOutstandingAdmin: true }
          : { paymentId: payment._id, cardId }
      );
      if (result.payment?.status !== 'paid' && result.payment?.id) {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          result = await residentApi.cardPayment(result.payment.id);
          if (result.payment?.status === 'paid' || result.payment?.status === 'failed') break;
        }
      }
      if (result.payment?.status !== 'paid') {
        setPayNotice('El pago sigue pendiente. Se aplica cuando el cobro quede aprobado.');
        return;
      }
      await loadBilling();
      setSheet(null);
      setError('');
    } catch (err) {
      setPayNotice(err.message);
    } finally {
      setPaying(false);
    }
  }

  const tone =
    carouselView?.mode === 'upcoming'
      ? 'upcoming'
      : carouselView?.mode === 'paid' || carouselView?.mode === 'clear'
        ? 'ok'
        : carouselView?.mode === 'overdue'
          ? 'overdue'
          : carouselView?.mode === 'pending'
            ? 'pending'
            : 'ok';
  const dueLabel =
    tone === 'overdue' ? 'EN MORA' : tone === 'pending' ? 'PENDIENTE' : tone === 'upcoming' ? 'PRÓXIMO' : 'AL DÍA';

  return (
    <div className="admin-pay">
      <div className="admin-pay__body">
        {error && <p className="admin-pay__error">{error}</p>}

        <article className="admin-pay__unit">
          <span className="admin-pay__unit-avatar" aria-hidden="true">
            {mark}
          </span>
          <div>
            <p className="admin-pay__eyebrow">Unidad seleccionada</p>
            {buildingName && <p className="admin-pay__building">{buildingName}</p>}
            <strong>{unitTitle(unit)}</strong>
            {unitMeta && <p>{unitMeta}</p>}
          </div>
          <span className="admin-pay__chevron" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </span>
        </article>

        {billing && (
          <article className="admin-pay__due">
            <div className="admin-pay__due-head">
              <p className={`admin-pay__badge admin-pay__badge--${tone}`}>{dueLabel}</p>
              <button type="button" className="admin-pay__pay" onClick={payCurrent}>
                Pagar administración
              </button>
            </div>

            {showReference && <p className="admin-pay__reference">{money(viewPayment.amount)}</p>}

            <p className="admin-pay__amount">{payable == null ? '—' : money(payable)}</p>

            <div className="admin-pay__period-nav">
              <button
                type="button"
                className="admin-pay__arrow"
                aria-label="Mes anterior"
                disabled={index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 6-6 6 6 6" />
                </svg>
              </button>
              <p className="admin-pay__period">{periodLabel}</p>
              <button
                type="button"
                className="admin-pay__arrow"
                aria-label="Mes siguiente"
                disabled={index >= carouselMonths.length - 1}
                onClick={() => setIndex((value) => Math.min(carouselMonths.length - 1, value + 1))}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </button>
            </div>

            {viewPayment?.status === 'paid' && viewPayment.paidAt ? (
              <p className="admin-pay__due-meta">Pagado {formatLongDate(viewPayment.paidAt)}</p>
            ) : viewPayment?.status === 'clear' ? (
              <p className="admin-pay__due-meta">Sin saldo pendiente</p>
            ) : viewPayment?.dueDate ? (
              <p className="admin-pay__due-meta">Vence {formatLongDate(viewPayment.dueDate)}</p>
            ) : null}
            <button type="button" className="admin-pay__detail-link" onClick={() => setSheet('detail')}>
              Ver detalle
            </button>
          </article>
        )}

        <h2 className="admin-pay__section">Historial de pagos</h2>
        {history.length === 0 ? (
          <p className="admin-pay__empty">Aún no hay pagos registrados.</p>
        ) : (
          history.map((payment) => (
            <article key={payment._id} className="admin-pay__history">
              <div>
                <strong>{paymentTitle(payment)}</strong>
                <p>{formatHistoryDate(payment.paidAt || payment.updatedAt)}</p>
              </div>
              <div className="admin-pay__history-side">
                <strong>{money(payment.paidAmount || payment.amount)}</strong>
                <span>Pagado</span>
              </div>
            </article>
          ))
        )}

        <h2 className="admin-pay__section">Valores de administración</h2>
        <article className="admin-pay__value">
          <span className="admin-pay__value-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 20V9.5L12 4l8 5.5V20" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </span>
          <div>
            <strong>Administración</strong>
            <p>Cuota mensual</p>
          </div>
          <strong className="admin-pay__value-amount">
            {monthlyFee == null ? '—' : money(monthlyFee)}
          </strong>
        </article>
        <article className="admin-pay__value">
          <span className="admin-pay__value-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5l3 2" />
            </svg>
          </span>
          <div>
            <strong>Pago oportuno</strong>
            <p>Sin interés durante {graceDays} días. Después, {interestRate}% mensual.</p>
          </div>
          <strong
            className={`admin-pay__value-amount${
              moraInterest > 0 ? ' admin-pay__value-amount--due' : ' admin-pay__value-amount--ok'
            }`}
          >
            {moraInterest > 0 ? money(moraInterest) : `${graceDays} días`}
          </strong>
        </article>
      </div>

      {sheet === 'detail' && (
        <ResidentOverlay>
        <div className="admin-pay__sheet" role="dialog" aria-modal="true" aria-labelledby="admin-pay-detail-title">
          <button type="button" className="admin-pay__sheet-backdrop" aria-label="Cerrar detalle" onClick={() => setSheet(null)} />
          <div className="admin-pay__sheet-panel">
            <div className="admin-pay__sheet-head">
              <div>
                <p className="admin-pay__eyebrow">Detalle</p>
                <h2 id="admin-pay-detail-title">{viewPayment ? paymentTitle(viewPayment) : 'Estado de cuenta'}</h2>
              </div>
              <button type="button" className="admin-pay__sheet-close" onClick={() => setSheet(null)}>
                Cerrar
              </button>
            </div>
            {isOpenView ? (
              <>
                {breakdown.length ? (
                  <>
                    {breakdown.map((line) => (
                      <div key={line.period} className="admin-pay__breakdown">
                        <p className="admin-pay__breakdown-title">
                          Administración · {formatPeriod(line.period)}
                        </p>
                        <div className="admin-pay__rows admin-pay__rows--compact">
                          <div className="admin-pay__row">
                            <span>Capital</span>
                            <strong>{money(line.principalDue)}</strong>
                          </div>
                          <div className="admin-pay__row">
                            <span>Intereses por mora</span>
                            <strong>{money(line.interestAmount)}</strong>
                          </div>
                          <div className="admin-pay__row">
                            <span>Subtotal</span>
                            <strong>{money(line.totalDue)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="admin-pay__rows">
                      <div className="admin-pay__row">
                        <span>Capital total</span>
                        <strong>{money(viewPayment.principalDue ?? viewPayment.amount)}</strong>
                      </div>
                      <div className="admin-pay__row">
                        <span>Intereses total</span>
                        <strong>{money(viewPayment.interestAmount ?? moraInterest)}</strong>
                      </div>
                      <div className="admin-pay__row">
                        <span>Total a pagar</span>
                        <strong>{money(payable)}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="admin-pay__rows">
                    <div className="admin-pay__row">
                      <span>Capital</span>
                      <strong>{money(viewPayment.principalDue ?? viewPayment.amount)}</strong>
                    </div>
                    <div className="admin-pay__row">
                      <span>Intereses por mora</span>
                      <strong>{money(viewPayment.interestAmount ?? 0)}</strong>
                    </div>
                    <div className="admin-pay__row">
                      <span>Total a pagar</span>
                      <strong>{money(payable)}</strong>
                    </div>
                    <div className="admin-pay__row">
                      <span>Vencimiento</span>
                      <strong>{formatLongDate(viewPayment.dueDate)}</strong>
                    </div>
                  </div>
                )}
                {aggregateDue && (
                  <p className="admin-pay__note">
                    Incluye {breakdown.length} mes{breakdown.length === 1 ? '' : 'es'} de administración
                    pendiente{breakdown.length === 1 ? '' : 's'}.
                  </p>
                )}
                <p className="admin-pay__note">
                  {home?.organization?.contacts?.adminWhatsapp
                    ? 'El pago se coordina con administración por WhatsApp.'
                    : 'Administración registra este pago. Cuando tengas el comprobante, envíaselo al conjunto.'}
                </p>
                <button type="button" className="admin-pay__sheet-pay" onClick={payCurrent}>
                  Pagar administración
                </button>
              </>
            ) : viewPayment?.status === 'paid' ? (
              <div className="admin-pay__rows">
                <div className="admin-pay__row">
                  <span>Estado</span>
                  <strong>Pagado</strong>
                </div>
                <div className="admin-pay__row">
                  <span>Valor</span>
                  <strong>{money(viewPayment.paidAmount ?? viewPayment.amount)}</strong>
                </div>
                <div className="admin-pay__row">
                  <span>Fecha de pago</span>
                  <strong>{formatLongDate(viewPayment.paidAt)}</strong>
                </div>
              </div>
            ) : (
              <div className="admin-pay__rows">
                <div className="admin-pay__row">
                  <span>Estado</span>
                  <strong>Al día</strong>
                </div>
                <div className="admin-pay__row">
                  <span>Cuota mensual</span>
                  <strong>{monthlyFee == null ? '—' : money(monthlyFee)}</strong>
                </div>
                <div className="admin-pay__row">
                  <span>Intereses</span>
                  <strong>{money(billing?.summary?.totalInterest || 0)}</strong>
                </div>
              </div>
            )}
            {(!viewPayment || viewPayment.status === 'paid') && (
              <button type="button" className="admin-pay__sheet-pay" onClick={payCurrent}>
                Pagar administración
              </button>
            )}
          </div>
        </div>
        </ResidentOverlay>
      )}

      {sheet === 'pay' && (
        <ResidentOverlay>
        <div className="admin-pay__sheet" role="dialog" aria-modal="true" aria-labelledby="admin-pay-card-title">
          <button type="button" className="admin-pay__sheet-backdrop" aria-label="Cerrar pago" onClick={() => setSheet(null)} />
          <div className="admin-pay__sheet-panel">
            <div className="admin-pay__sheet-head">
              <div>
                <p className="admin-pay__eyebrow">Pago con tarjeta</p>
                <h2 id="admin-pay-card-title">{money(payable)}</h2>
              </div>
              <button type="button" className="admin-pay__sheet-close" onClick={() => setSheet(null)}>
                Cerrar
              </button>
            </div>
            <PaymentCards selectedId={cardId} onSelect={setCardId} />
            {payNotice && <p className="admin-pay__note">{payNotice}</p>}
            <button
              type="button"
              className="admin-pay__sheet-pay"
              onClick={confirmAdminPayment}
              disabled={paying}
            >
              {paying ? 'Confirmando pago…' : 'Pagar administración'}
            </button>
          </div>
        </div>
        </ResidentOverlay>
      )}

    </div>
  );
}
