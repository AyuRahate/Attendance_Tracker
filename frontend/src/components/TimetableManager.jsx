import { useState, useEffect } from 'react';
import { timetableApi, subjectsApi } from '../api';
import { useToast } from '../context/ToastContext';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableManager({ onUpdate, initialDay = 0 }) {
  const [slots, setSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(initialDay);

  useEffect(() => {
    if (initialDay !== undefined && initialDay !== null) {
      setActiveDay(initialDay);
    }
  }, [initialDay]);

  // Add slot form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSlot, setNewSlot] = useState({
    subject_id: '',
    day_of_week: initialDay || 0,
    start_time: '09:00',
    end_time: '10:00',
  });

  useEffect(() => {
    setNewSlot((prev) => ({ ...prev, day_of_week: activeDay }));
  }, [activeDay]);

  // OCR Upload state
  const [showOcr, setShowOcr] = useState(false);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDraft, setOcrDraft] = useState(null);

  // Collapse / Hide State
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toast = useToast();

  const loadData = async () => {
    try {
      const [resTT, resSub] = await Promise.all([
        timetableApi.get(),
        subjectsApi.list(),
      ]);
      setSlots(resTT.data.slots);
      setSubjects(resSub.data.subjects);
    } catch {
      toast.error('Failed to load timetable data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteSlot = async (id) => {
    try {
      await timetableApi.deleteSlot(id);
      toast.success('Slot removed');
      loadData();
      if (onUpdate) onUpdate();
    } catch {
      toast.error('Failed to delete slot');
    }
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!newSlot.subject_id) {
      toast.error('Please select a subject');
      return;
    }
    try {
      await timetableApi.save({
        slots: [{
          subject_id: Number(newSlot.subject_id),
          day_of_week: Number(newSlot.day_of_week),
          start_time: newSlot.start_time,
          end_time: newSlot.end_time,
        }],
        replaceAll: false,
      });
      toast.success('Slot added to timetable');
      setShowAddForm(false);
      loadData();
      if (onUpdate) onUpdate();
    } catch {
      toast.error('Failed to add slot');
    }
  };

  const handleOcrUpload = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', ocrFile);
      const res = await timetableApi.uploadScreenshot(formData);
      setOcrDraft(res.data.draft);
      toast.info(res.data.message);
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || '';
      toast.error(`OCR failed: ${detail || 'Please try a clearer image or enter slots manually.'}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleQuickAddSubject = async (name, slotIndex) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const res = await subjectsApi.create({ name: trimmed });
      const newSub = res.data.subject;
      toast.success(`Created subject "${newSub.name}"`);
      const updatedSubRes = await subjectsApi.list();
      const updatedSubs = updatedSubRes.data.subjects;
      setSubjects(updatedSubs);

      // Auto-assign new subject to slots with matching extracted name
      setOcrDraft(ocrDraft.map((s, idx) => (
        idx === slotIndex || s.subject_name.toLowerCase().trim() === trimmed.toLowerCase()
          ? { ...s, subject_id: newSub.id }
          : s
      )));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create subject');
    }
  };

  const confirmOcrSlots = async () => {
    const validSlots = ocrDraft.filter((s) => s.subject_id);
    if (validSlots.length === 0) {
      toast.error('Map at least one slot to a subject');
      return;
    }

    try {
      await timetableApi.save({
        slots: validSlots.map((s) => ({
          subject_id: Number(s.subject_id),
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
        replaceAll: false, // append to existing
      });
      toast.success(`Imported ${validSlots.length} slot(s) into timetable!`);
      setOcrDraft(null);
      setShowOcr(false);
      loadData();
      if (onUpdate) onUpdate();
    } catch {
      toast.error('Failed to save imported slots');
    }
  };

  if (loading) {
    return <div className="skeleton" style={{ height: '160px' }} />;
  }

  const slotsByDay = slots.filter((s) => s.dayOfWeek === activeDay);

  return (
    <div className="card mb-6 animate-fadeInUp">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div
          className="flex items-center gap-2 select-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{ cursor: 'pointer' }}
          title={isCollapsed ? 'Click to show timetable' : 'Click to hide timetable'}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-lg">Schedule Editor</p>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                ▼
              </span>
            </div>
            <p className="text-xs text-muted mt-1">{slots.length} slot{slots.length !== 1 ? 's' : ''} configured across all days</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              <button className="btn btn-sm btn-ghost" onClick={() => { setShowOcr(!showOcr); setShowAddForm(false); }}>
                {showOcr ? 'Cancel' : 'Upload Photo'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => { setShowAddForm(!showAddForm); setShowOcr(false); }}>
                {showAddForm ? 'Cancel' : '+ Add Slot'}
              </button>
            </>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Timetable' : 'Hide Timetable'}
          >
            {isCollapsed ? '▼ Show' : '▲ Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="animate-fadeIn">
          {/* OCR Uploader inside Manager */}
      {showOcr && !ocrDraft && (
        <div className="glass-card mb-4 p-4 animate-fadeIn">
          <p className="font-semibold text-sm mb-2">Upload Timetable Image / Screenshot</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setOcrFile(e.target.files[0])}
            style={{ color: 'var(--text-secondary)', marginBottom: '12px', width: '100%' }}
          />
          {ocrFile && (
            <button className="btn btn-primary btn-sm btn-full" onClick={handleOcrUpload} disabled={ocrLoading}>
              {ocrLoading ? 'Extracting...' : 'Extract & Import Slots'}
            </button>
          )}
        </div>
      )}

      {/* OCR Draft Review inside Manager */}
      {ocrDraft && (
        <div className="glass-card mb-4 p-4 animate-fadeIn">
          <p className="font-semibold text-sm mb-1">Review Extracted Slots</p>
          <p className="text-xs text-muted mb-3">Map each extracted slot to one of your subjects:</p>

          <div className="flex flex-col gap-3 max-h-60 overflow-y-auto mb-3">
            {ocrDraft.map((slot, i) => (
              <div key={i} className="p-3" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-xs">{slot.flagged ? '⚠️ ' : ''}{slot.subject_name}</span>
                  <span className="text-xs text-muted">{DAYS[slot.day_of_week]} · {slot.start_time} - {slot.end_time}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    className="form-input form-select"
                    style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
                    value={slot.subject_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOcrDraft(ocrDraft.map((s, idx) => idx === i ? { ...s, subject_id: val } : s));
                    }}
                  >
                    <option value="">— Map to subject —</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                  {!slot.subject_id && slot.subject_name && slot.subject_name !== 'Lecture' && (
                    <button
                      className="btn btn-xs btn-ghost"
                      style={{ fontSize: '11px', padding: '4px 8px', whitespace: 'nowrap' }}
                      title="Create this subject in 1 click"
                      onClick={() => handleQuickAddSubject(slot.subject_name, i)}
                    >
                      + Create
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setOcrDraft(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={confirmOcrSlots}>
              Confirm & Save Slots →
            </button>
          </div>
        </div>
      )}

      {/* Manual Add Slot Form */}
      {showAddForm && (
        <form onSubmit={handleAddSlot} className="glass-card mb-4 p-4 flex flex-col gap-3 animate-fadeIn">
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select
              className="form-input form-select"
              value={newSlot.subject_id}
              onChange={(e) => setNewSlot({ ...newSlot, subject_id: e.target.value })}
              required
            >
              <option value="">— Select Subject —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Day of Week</label>
            <select
              className="form-input form-select"
              value={newSlot.day_of_week}
              onChange={(e) => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
            >
              {DAYS.map((d, idx) => (
                <option key={d} value={idx}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input
                className="form-input"
                type="time"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input
                className="form-input"
                type="time"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-sm mt-1">Save Slot</button>
        </form>
      )}

      {/* Day Tabs */}
      <div className="day-tabs mb-4">
        {DAYS.map((d, idx) => {
          const count = slots.filter((s) => s.dayOfWeek === idx).length;
          return (
            <button
              key={d}
              className={`day-tab ${activeDay === idx ? 'active' : ''}`}
              onClick={() => setActiveDay(idx)}
            >
              {d.slice(0, 3)} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Day Slots List */}
      <div className="flex flex-col gap-2">
        {slotsByDay.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">No classes scheduled for {DAYS[activeDay]}.</p>
        ) : (
          slotsByDay.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between p-3"
              style={{
                background: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                borderLeft: `3px solid ${slot.subject?.color || 'var(--color-primary)'}`,
              }}
            >
              <div>
                <p className="font-semibold text-sm">{slot.subject?.name}</p>
                <p className="text-xs text-muted">{slot.startTime} – {slot.endTime}</p>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSlot(slot.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )}
</div>
);
}
