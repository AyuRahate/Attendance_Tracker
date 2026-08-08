import { useState, useEffect } from 'react';
import { lecturesApi } from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPicker({ selectedDateStr, onSelectDate }) {
  const selectedDate = new Date(selectedDateStr + 'T00:00:00Z');
  
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth());
  const [monthSummary, setMonthSummary] = useState({});

  // Sync view when selectedDateStr changes
  useEffect(() => {
    const d = new Date(selectedDateStr + 'T00:00:00Z');
    if (!isNaN(d.getTime())) {
      setViewYear(d.getUTCFullYear());
      setViewMonth(d.getUTCMonth());
    }
  }, [selectedDateStr]);

  // Load attendance indicators for the visible month
  useEffect(() => {
    let isMounted = true;
    lecturesApi
      .monthSummary(viewYear, viewMonth + 1)
      .then((res) => {
        if (isMounted) {
          setMonthSummary(res.data.summaryByDate || {});
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleTodayClick = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    onSelectDate(todayStr);
  };

  // Generate Month Grid
  const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();

  // Convert JS Sunday=0 to Mon=0...Sun=6
  let startDow = firstDayOfMonth.getUTCDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const todayObj = new Date();
  const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

  const cells = [];
  // Empty leading cells
  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateFormatted = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr: dateFormatted });
  }

  return (
    <div className="calendar-picker-card card animate-fadeIn">
      {/* Calendar Header Navigation */}
      <div className="calendar-header">
        <div className="flex items-center gap-2">
          <button className="calendar-nav-btn" onClick={handlePrevMonth} title="Previous Month">
            ‹
          </button>
          <span className="calendar-month-title">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button className="calendar-nav-btn" onClick={handleNextMonth} title="Next Month">
            ›
          </button>
        </div>

        <button className="btn btn-xs btn-ghost" onClick={handleTodayClick}>
          Today
        </button>
      </div>

      {/* Weekday Labels Header */}
      <div className="calendar-weekdays font-semibold text-xs text-muted mb-2">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="calendar-days-grid">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="calendar-cell empty" />;
          }

          const isSelected = cell.dateStr === selectedDateStr;
          const isToday = cell.dateStr === todayStr;
          const summary = monthSummary[cell.dateStr];

          return (
            <button
              key={cell.dateStr}
              className={`calendar-cell ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => onSelectDate(cell.dateStr)}
            >
              <span className="cell-day-num">{cell.day}</span>
              
              {/* Attendance Indicator Dots */}
              {summary && (
                <div className="cell-indicators">
                  {summary.attended > 0 && <span className="ind-dot ind-attended" />}
                  {summary.missed > 0 && <span className="ind-dot ind-missed" />}
                  {summary.cancelled > 0 && <span className="ind-dot ind-cancelled" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
