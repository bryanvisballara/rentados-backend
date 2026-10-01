import { RESTAURANT_WEEKDAYS } from '../utils/restaurantHours';
import './WeeklyHoursEditor.css';

export default function WeeklyHoursEditor({ value, onChange }) {
  function updateDay(dayKey, patch) {
    onChange(
      value.map((row) => (row.day === dayKey ? { ...row, ...patch } : row))
    );
  }

  return (
    <div className="weekly-hours">
      <p className="weekly-hours__hint">Marca los días abiertos y define hora de apertura y cierre.</p>
      <ul className="weekly-hours__list">
        {RESTAURANT_WEEKDAYS.map(({ key, label }) => {
          const row = value.find((item) => item.day === key) || {
            day: key,
            enabled: false,
            start: '11:00',
            end: '22:00',
          };
          return (
            <li key={key} className="weekly-hours__row">
              <label className="weekly-hours__day">
                <input
                  type="checkbox"
                  checked={Boolean(row.enabled)}
                  onChange={(e) => updateDay(key, { enabled: e.target.checked })}
                />
                <span>{label}</span>
              </label>
              <div className="weekly-hours__times">
                <label>
                  <span className="weekly-hours__time-label">Desde</span>
                  <input
                    type="time"
                    value={row.start}
                    disabled={!row.enabled}
                    onChange={(e) => updateDay(key, { start: e.target.value })}
                  />
                </label>
                <label>
                  <span className="weekly-hours__time-label">Hasta</span>
                  <input
                    type="time"
                    value={row.end}
                    disabled={!row.enabled}
                    onChange={(e) => updateDay(key, { end: e.target.value })}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
