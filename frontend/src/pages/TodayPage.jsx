import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { lecturesApi, subjectsApi, summaryApi } from '../api';
import { useToast } from '../context/ToastContext';
import CalendarPicker from '../components/CalendarPicker';

const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TodayPage() {
  const [selectedDateStr, setSelectedDateStr] = useState(getTodayStr());
  const [showCalendar, setShowCalendar] = useState(false);
  const [data, setData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);

  const toast = useToast();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resToday, resSub, resSum] = await Promise.all([
        lecturesApi.today(selectedDateStr),
        subjectsApi.list(),
        summaryApi.get(),
      ]);
      setData(resToday.data);
      setSubjects(resSub.data.subjects || []);
      setSummaryData(resSum.data);
    } catch {
      toast.error('Failed to load schedule for selected date.');
    } finally {
      setLoading(false);
    }
  }, [selectedDateStr, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Shift Helpers (Prev Day / Next Day)
  const shiftDate = (days) => {
    const d = new Date(selectedDateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    setSelectedDateStr(`${yyyy}-${mm}-${dd}`);
  };

  const handleMark = async (slotId, status) => {
    try {
      await lecturesApi.mark(slotId, { status, date: selectedDateStr });
      toast.success(`Marked as ${status}`);
      loadData();
    } catch {
      toast.error('Failed to mark lecture.');
    }
  };

  const handleQuickSubjectMark = async (subjectId, status) => {
    try {
      await lecturesApi.markSubject({ subjectId, status, date: selectedDateStr });
      toast.success(`Logged ${status} for subject`);
      loadData();
    } catch {
      toast.error('Failed to update attendance');
    }
  };

  // Sense of Day logic
  const todayStr = getTodayStr();
  const dateObj = new Date(selectedDateStr + 'T00:00:00Z');
  
  let jsDow = dateObj.getUTCDay();
  let dowIdx = jsDow === 0 ? 6 : jsDow - 1; // 0=Mon ... 6=Sun
  const dayName = DAYS_FULL[dowIdx];

  const formattedDateString = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  let dayRelativeTag = '';
  if (selectedDateStr === todayStr) {
    dayRelativeTag = 'Today';
  } else {
    const diffTime = dateObj.getTime() - new Date(todayStr + 'T00:00:00Z').getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    if (diffDays === -1) dayRelativeTag = 'Yesterday';
    else if (diffDays === 1) dayRelativeTag = 'Tomorrow';
    else if (diffDays < 0) dayRelativeTag = `${Math.abs(diffDays)} days ago`;
    else dayRelativeTag = `In ${diffDays} days`;
  }

  // Summary mapping
  const summaryBySub = {};
  if (summaryData?.subjects) {
    summaryData.subjects.forEach((s) => {
      summaryBySub[s.id] = s;
    });
  }

  const slots = data?.slots || [];

  const getSlotStatus = (slot) => {
    if (slot.record?.status === 'attended') return { label: 'Attended', color: '#10b981', type: 'done' };
    if (slot.record?.status === 'missed') return { label: 'Missed', color: '#f43f5e', type: 'missed' };
    if (slot.record?.status === 'cancelled') return { label: 'Cancelled', color: '#64748b', type: 'cancelled' };

    if (selectedDateStr === todayStr) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      if (currentMinutes >= startMins && currentMinutes <= endMins) {
        return { label: 'Live now', color: '#818cf8', type: 'live' };
      }
      if (currentMinutes > endMins) {
        return { label: 'Done', color: '#10b981', type: 'done' };
      }
      return { label: 'Upcoming', color: '#f59e0b', type: 'upcoming' };
    }

    return { label: 'Scheduled', color: '#6366f1', type: 'upcoming' };
  };

  return (
    <div className="page-content animate-fadeIn">
      {/* Date Navigation & Calendar Header */}
      <div className="date-nav-bar card mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="btn btn-sm btn-ghost" onClick={() => shiftDate(-1)} title="Previous Day">
              ‹
            </button>
            <div className="date-display">
              <span className="font-bold text-md text-primary">{formattedDateString}</span>
              <span className="badge badge-primary text-xs ml-2">{dayRelativeTag}</span>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => shiftDate(1)} title="Next Day">
              ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedDateStr !== todayStr && (
              <button className="btn btn-xs btn-primary" onClick={() => setSelectedDateStr(todayStr)}>
                Today
              </button>
            )}
            <button
              className={`btn btn-sm ${showCalendar ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowCalendar(!showCalendar)}
            >
              📅 {showCalendar ? 'Close Calendar' : 'Calendar'}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Calendar Picker */}
      {showCalendar && (
        <div className="mb-6">
          <CalendarPicker
            selectedDateStr={selectedDateStr}
            onSelectDate={(newDate) => {
              setSelectedDateStr(newDate);
              setShowCalendar(false);
            }}
          />
        </div>
      )}

      {/* Senses Day Banner */}
      <div className="sense-day-banner glass-card mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="sense-icon-box">📅</div>
          <div>
            <p className="font-bold text-sm text-primary">
              Sensed: {dayName} Schedule
            </p>
            <p className="text-xs text-secondary mt-0.5">
              {slots.length > 0
                ? `${slots.length} lecture${slots.length === 1 ? '' : 's'} scheduled for ${dayName}s`
                : `No recurring timetable classes for ${dayName}s`}
            </p>
          </div>
        </div>

        <span className="badge badge-safe text-xs font-semibold">
          {selectedDateStr}
        </span>
      </div>

      {/* Schedule List */}
      <div className="mb-6">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: '76px', borderRadius: '12px' }} />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">📅</div>
            <p className="font-semibold text-lg text-primary mb-2">No timetable slots for {dayName}</p>
            <p className="text-sm text-muted mb-4">Set up or edit your weekly schedule in Settings.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/settings')}>
              ⚙️ Manage Timetable →
            </button>
          </div>
        ) : (
          <div className="today-timeline">
            {slots.map((slot) => {
              const statusInfo = getSlotStatus(slot);
              const isLive = statusInfo.type === 'live';

              return (
                <div key={slot.id} className={`timeline-row ${isLive ? 'timeline-live' : ''}`}>
                  {/* Time column */}
                  <div className="timeline-time">
                    <p className="time-text">{slot.startTime}</p>
                    <p className="time-end">{slot.endTime}</p>
                  </div>

                  {/* Class Card */}
                  <div className="timeline-card">
                    <div>
                      <h3 className="timeline-title">{slot.subject?.name}</h3>
                      <p className="timeline-room">LH-{slot.id.toString().padStart(2, '0')}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="timeline-status-badge" style={{ color: statusInfo.color }}>
                        <span
                          className={`status-dot ${isLive ? 'pulse' : ''}`}
                          style={{ background: statusInfo.color }}
                        />
                        <span>{statusInfo.label}</span>
                      </div>

                      {/* Quick Attendance Buttons for Slot */}
                      <div className="flex gap-1">
                        <button
                          className={`quick-log-btn quick-log-check ${slot.record?.status === 'attended' ? 'active' : ''}`}
                          title="Mark Attended"
                          onClick={() => handleMark(slot.id, 'attended')}
                        >
                          ✓
                        </button>
                        <button
                          className={`quick-log-btn quick-log-cross ${slot.record?.status === 'missed' ? 'active' : ''}`}
                          title="Mark Missed"
                          onClick={() => handleMark(slot.id, 'missed')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Attendance for Date Card */}
      <div className="card log-attendance-card animate-fadeInUp">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title text-lg font-bold">Log Attendance for {formattedDateString}</h2>
          <span className="text-xs text-muted font-medium">{dayName}</span>
        </div>

        {subjects.length === 0 ? (
          <p className="text-sm text-muted">No subjects added yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {subjects.map((sub) => {
              const sumInfo = summaryBySub[sub.id] || {};
              const pct = sumInfo.percentage !== null && sumInfo.percentage !== undefined
                ? Math.round(sumInfo.percentage)
                : null;

              let pctColor = '#10b981';
              if (pct !== null) {
                if (pct < 70) pctColor = '#f43f5e';
                else if (pct < (sumInfo.targetPercent || 75)) pctColor = '#f59e0b';
              }

              return (
                <div key={sub.id} className="log-attendance-row">
                  <div className="flex items-center gap-3">
                    <div className="color-dot" style={{ background: sub.color || pctColor }} />
                    <span className="font-semibold text-sm text-primary">{sub.name}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-sm" style={{ color: pctColor }}>
                      {pct !== null ? `${pct}%` : '—'}
                    </span>

                    <div className="flex gap-2">
                      <button
                        className="quick-log-btn quick-log-check"
                        title="Mark Attended"
                        onClick={() => handleQuickSubjectMark(sub.id, 'attended')}
                      >
                        ✓
                      </button>
                      <button
                        className="quick-log-btn quick-log-cross"
                        title="Mark Missed"
                        onClick={() => handleQuickSubjectMark(sub.id, 'missed')}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
