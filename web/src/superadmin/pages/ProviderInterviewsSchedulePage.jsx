import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatDateTime, formatTime, platformApi } from '../../api/client';
import ProviderInterviewCalendar, {
  addDays,
  startOfWeek,
} from '../components/ProviderInterviewCalendar';
import ProviderInterviewMonthCalendar, {
  buildMonthGrid,
  startOfMonth,
} from '../components/ProviderInterviewMonthCalendar';
import '../../admin/admin.css';
import './ProviderInterviewsSchedulePage.css';

const VIEW_OPTIONS = [
  { value: 'week', label: 'Semanal' },
  { value: 'month', label: 'Mensual' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
];

const STATUS_LABELS = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_BADGE = {
  scheduled: 'provider-schedule__badge--scheduled',
  completed: 'provider-schedule__badge--completed',
  cancelled: 'provider-schedule__badge--cancelled',
};

function endOfWeek(weekStart) {
  const end = addDays(weekStart, 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatMonthLabel(date) {
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function providerLabel(interview) {
  const provider = interview.providerId;
  if (!provider) return 'Prestador eliminado';
  return provider.businessName || 'Sin nombre';
}

function providerContact(interview) {
  const user = interview.providerId?.userId;
  if (!user) return '—';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return [name, user.email, user.phone].filter(Boolean).join(' · ') || '—';
}

function providerCategories(interview) {
  const categories = interview.providerId?.categoryIds || [];
  return categories.map((c) => c.name).filter(Boolean).join(', ') || '—';
}

export default function ProviderInterviewsSchedulePage() {
  const [viewMode, setViewMode] = useState('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [statusFilter, setStatusFilter] = useState('scheduled');
  const [interviews, setInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState(null);

  const monthGrid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);

  const period = useMemo(() => {
    if (viewMode === 'week') {
      const weekEnd = endOfWeek(weekStart);
      return {
        from: weekStart,
        to: weekEnd,
        label: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
        countLabel: 'esta semana',
      };
    }

    return {
      from: monthGrid.gridStart,
      to: monthGrid.gridEnd,
      label: formatMonthLabel(monthDate),
      countLabel: 'este mes',
    };
  }, [viewMode, weekStart, monthDate, monthGrid]);

  async function load() {
    const data = await platformApi.interviews({
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      status: statusFilter,
    });
    setInterviews(data.interviews || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [period.from, period.to, statusFilter]);

  function goToToday() {
    const now = new Date();
    if (viewMode === 'week') {
      setWeekStart(startOfWeek(now));
    } else {
      setMonthDate(startOfMonth(now));
    }
  }

  function goPrevious() {
    if (viewMode === 'week') {
      setWeekStart((current) => addDays(current, -7));
      return;
    }
    setMonthDate((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)));
  }

  function goNext() {
    if (viewMode === 'week') {
      setWeekStart((current) => addDays(current, 7));
      return;
    }
    setMonthDate((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)));
  }

  async function updateStatus(interview, status) {
    setSavingId(interview._id);
    setError('');
    setSuccess('');
    try {
      await platformApi.updateInterview(interview._id, { status });
      setSuccess('Cita actualizada.');
      setSelectedInterview(null);
      setSelectedDay(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-page provider-schedule">
      <header className="admin-page__header">
        <h1>Cronograma de prestadores</h1>
        <p>
          Entrevistas y citas con aspirantes en hora Colombia. Cambia entre vista semanal o mensual.
        </p>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-card provider-schedule__success">{success}</div>}

      <div className="provider-schedule__toolbar">
        <div className="provider-schedule__week-nav">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={goPrevious}>
            ←
          </button>
          <button type="button" className="admin-btn" onClick={goToToday}>
            Hoy
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={goNext}>
            →
          </button>
          <h2 className="provider-schedule__week-title">{period.label}</h2>
        </div>

        <div className="provider-schedule__filters">
          <div className="provider-schedule__view-toggle" role="group" aria-label="Vista del calendario">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`provider-schedule__view-btn${
                  viewMode === option.value ? ' provider-schedule__view-btn--active' : ''
                }`}
                onClick={() => setViewMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label>
            Estado
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="provider-schedule__count">
            {interviews.length} cita{interviews.length === 1 ? '' : 's'} {period.countLabel}
          </span>
        </div>
      </div>

      <div className="provider-schedule__legend">
        <span className="provider-schedule__legend-item provider-schedule__legend-item--scheduled">
          Programada
        </span>
        <span className="provider-schedule__legend-item provider-schedule__legend-item--completed">
          Completada
        </span>
        <span className="provider-schedule__legend-item provider-schedule__legend-item--cancelled">
          Cancelada
        </span>
      </div>

      {viewMode === 'week' ? (
        <ProviderInterviewCalendar
          weekStart={weekStart}
          interviews={interviews}
          onSelectInterview={setSelectedInterview}
        />
      ) : (
        <ProviderInterviewMonthCalendar
          monthDate={monthDate}
          interviews={interviews}
          onSelectInterview={setSelectedInterview}
          onSelectDay={(day, dayInterviews) =>
            setSelectedDay({ day, interviews: dayInterviews })
          }
        />
      )}

      <div className="admin-card provider-schedule__footer">
        <div>
          <h2>Agendar nueva cita</h2>
          <p className="admin-empty" style={{ marginBottom: 0 }}>
            Las entrevistas se crean desde solicitudes pendientes de prestadores.
          </p>
        </div>
        <Link to="/super-admin/solicitudes-prestadores" className="admin-btn">
          Ir a solicitudes prestadores
        </Link>
      </div>

      {selectedDay && (
        <div className="admin-modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="admin-modal provider-schedule__modal" onClick={(e) => e.stopPropagation()}>
            <header className="provider-schedule__modal-head">
              <div>
                <h2>Citas del día</h2>
                <p>{formatDate(selectedDay.day)}</p>
              </div>
            </header>

            {selectedDay.interviews.length === 0 ? (
              <p className="admin-empty">No hay entrevistas este día.</p>
            ) : (
              <ul className="provider-schedule__day-list">
                {selectedDay.interviews.map((interview) => (
                  <li key={interview._id}>
                    <button
                      type="button"
                      className={`provider-schedule__day-item provider-schedule__day-item--${interview.status || 'scheduled'}`}
                      onClick={() => {
                        setSelectedDay(null);
                        setSelectedInterview(interview);
                      }}
                    >
                      <strong>{formatTime(interview.scheduledAt)}</strong>
                      <span>{providerLabel(interview)}</span>
                      <small>{STATUS_LABELS[interview.status] || interview.status}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="admin-actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setSelectedDay(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedInterview && (
        <div className="admin-modal-overlay" onClick={() => setSelectedInterview(null)}>
          <div className="admin-modal provider-schedule__modal" onClick={(e) => e.stopPropagation()}>
            <header className="provider-schedule__modal-head">
              <div>
                <h2>{providerLabel(selectedInterview)}</h2>
                <p>{formatDateTime(selectedInterview.scheduledAt)}</p>
              </div>
              <span
                className={`provider-schedule__badge ${STATUS_BADGE[selectedInterview.status] || ''}`}
              >
                {STATUS_LABELS[selectedInterview.status] || selectedInterview.status}
              </span>
            </header>

            <dl className="provider-schedule__details">
              <div>
                <dt>Categorías</dt>
                <dd>{providerCategories(selectedInterview)}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>{providerContact(selectedInterview)}</dd>
              </div>
              {selectedInterview.location && (
                <div>
                  <dt>Lugar</dt>
                  <dd>{selectedInterview.location}</dd>
                </div>
              )}
              {selectedInterview.notes && (
                <div>
                  <dt>Notas</dt>
                  <dd>{selectedInterview.notes}</dd>
                </div>
              )}
              <div>
                <dt>Horario</dt>
                <dd>{formatTime(selectedInterview.scheduledAt)} · duración estimada 1 h</dd>
              </div>
              <div>
                <dt>Agendada</dt>
                <dd>{formatDateTime(selectedInterview.createdAt)}</dd>
              </div>
            </dl>

            <div className="admin-actions">
              {selectedInterview.status === 'scheduled' && (
                <>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={savingId === selectedInterview._id}
                    onClick={() => updateStatus(selectedInterview, 'completed')}
                  >
                    Marcar completada
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    disabled={savingId === selectedInterview._id}
                    onClick={() => updateStatus(selectedInterview, 'cancelled')}
                  >
                    Cancelar cita
                  </button>
                </>
              )}
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setSelectedInterview(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
