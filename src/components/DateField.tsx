import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  min?: string;
  max?: string;
  calendarLabel?: string;
}
function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function DateField({ id, value, onChange, invalid, min, max, calendarLabel }: Props) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const today = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    root.current?.addEventListener('keydown', escape);
    const element = root.current;
    return () => {
      document.removeEventListener('pointerdown', outside);
      element?.removeEventListener('keydown', escape);
    };
  }, [open]);
  const changeMonth = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    setMonth(date.getMonth());
    setYear(date.getFullYear());
  };
  const count = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const title = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1),
  );
  return (
    <div className="date-field" ref={root}>
      <div className="date-input">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          maxLength={10}
          value={value}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          ref={trigger}
          className="icon-btn"
          aria-label={calendarLabel ?? `Choose ${id === 'startDate' ? 'start' : 'end'} date`}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={() => {
            if (!open && !Number.isNaN(parsed.getTime()) && value) {
              setMonth(parsed.getMonth());
              setYear(parsed.getFullYear());
            }
            setOpen(!open);
          }}
        >
          <CalendarDays size={16} />
        </button>
      </div>
      <span id={`${id}-hint`} className="sr-only">
        Enter date as year-month-day, or choose a date from the calendar.
      </span>
      {open && (
        <div
          className="calendar"
          id={`${id}-calendar`}
          role="group"
          aria-label={`Choose date, ${title}`}
        >
          <div className="row between">
            <button
              className="icon-btn"
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={15} />
            </button>
            <strong aria-live="polite">{title}</strong>
            <button
              className="icon-btn"
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="calendar-grid">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} className="calendar-weekday">
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const iso = isoDate(year, month, i + 1);
              return (
                <button
                  key={iso}
                  type="button"
                  className={iso === value ? 'selected' : ''}
                  aria-label={iso}
                  aria-pressed={iso === value}
                  disabled={(!!min && iso < min) || (!!max && iso > max)}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="calendar-today"
            disabled={
              (!!min && isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) < min) ||
              (!!max && isoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) > max)
            }
            onClick={() => {
              const d = new Date();
              onChange(isoDate(d.getFullYear(), d.getMonth(), d.getDate()));
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Choose today
          </button>
        </div>
      )}
    </div>
  );
}
