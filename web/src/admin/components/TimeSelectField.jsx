import { useMemo } from 'react';

function from24h(value) {
  const [h, m] = (value || '08:00').split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minutes: m || 0, period };
}

function to24h(hour12, minutes, period) {
  let h = Number(hour12);
  if (period === 'AM') {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function TimeSelectField({ label, value, onChange, hint, disabled = false }) {
  const parsed = useMemo(() => from24h(value), [value]);

  function update(part, next) {
    const nextState = { ...parsed, [part]: next };
    onChange(to24h(nextState.hour12, nextState.minutes, nextState.period));
  }

  return (
    <label>
      {label}
      <div className="admin-time-select">
        <select
          value={parsed.hour12}
          onChange={(e) => update('hour12', Number(e.target.value))}
          aria-label={`${label} hora`}
          disabled={disabled}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          value={parsed.minutes}
          onChange={(e) => update('minutes', Number(e.target.value))}
          aria-label={`${label} minutos`}
          disabled={disabled}
        >
          {[0, 15, 30, 45].map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select
          value={parsed.period}
          onChange={(e) => update('period', e.target.value)}
          aria-label={`${label} AM/PM`}
          disabled={disabled}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {hint && <span className="admin-field-hint">{hint}</span>}
    </label>
  );
}

export { from24h, to24h };
