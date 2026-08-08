import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subjectsApi, settingsApi, timetableApi } from '../api';
import { useToast } from '../context/ToastContext';

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#10b981', '#06b6d4',
  '#3b82f6', '#a78bfa',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STEPS = [
  { id: 'subjects',  label: 'Add Subjects' },
  { id: 'settings',  label: 'Attendance Rules' },
  { id: 'timetable', label: 'Set Timetable' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();

  // Step 1 — Subjects
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectColor, setSubjectColor] = useState(SUBJECT_COLORS[0]);
  const [subjectTarget, setSubjectTarget] = useState('');
  const [savedSubjects, setSavedSubjects] = useState([]);

  // Step 2 — Settings
  const [mode, setMode] = useState('per_subject');
  const [defaultTarget, setDefaultTarget] = useState('75');

  // Step 3 — Timetable
  const [timetableMethod, setTimetableMethod] = useState(null); // 'manual' | 'ocr'
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ subject_id: '', day_of_week: 0, start_time: '09:00', end_time: '10:00' });
  const [ocrDraft, setOcrDraft] = useState(null);
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Add Subjects ─────────────────────────────────────────────
  const addSubject = () => {
    const trimmed = subjectName.trim();
    if (!trimmed) return;

    if (subjects.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Subject "${trimmed}" is already in your list`);
      return;
    }

    const s = { name: trimmed, color: subjectColor, target_percent: subjectTarget ? parseFloat(subjectTarget) : null };
    setSubjects([...subjects, s]);
    setSubjectName('');
    setSubjectTarget('');
    setSubjectColor(SUBJECT_COLORS[(subjects.length + 1) % SUBJECT_COLORS.length]);
  };

  const removeSubject = (i) => setSubjects(subjects.filter((_, idx) => idx !== i));

  const saveSubjectsAndNext = async () => {
    if (subjects.length === 0) { toast.error('Add at least one subject.'); return; }
    setSubmitting(true);
    try {
      // Fetch existing subjects on server to avoid duplicating
      const resExisting = await subjectsApi.list();
      const existingList = resExisting.data.subjects || [];

      const finalSaved = [];
      for (const s of subjects) {
        const found = existingList.find((ex) => ex.name.trim().toLowerCase() === s.name.trim().toLowerCase());
        if (found) {
          finalSaved.push(found);
        } else {
          const res = await subjectsApi.create(s);
          finalSaved.push(res.data.subject);
        }
      }

      setSavedSubjects(finalSaved);
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save subjects.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 2: Settings ──────────────────────────────────────────────────
  const saveSettingsAndNext = async () => {
    setSubmitting(true);
    try {
      await settingsApi.update({ mode, default_target_percent: parseFloat(defaultTarget) });
      setStep(2);
    } catch { toast.error('Failed to save settings.'); }
    finally { setSubmitting(false); }
  };

  // ── Step 3: Timetable — Manual ────────────────────────────────────────
  const addSlot = () => {
    if (!newSlot.subject_id) { toast.error('Select a subject.'); return; }
    setSlots([...slots, { ...newSlot }]);
    setNewSlot({ subject_id: newSlot.subject_id, day_of_week: newSlot.day_of_week, start_time: newSlot.end_time, end_time: newSlot.end_time });
  };

  const removeSlot = (i) => setSlots(slots.filter((_, idx) => idx !== i));

  // ── Step 3: OCR ───────────────────────────────────────────────────────
  const handleOcrUpload = async () => {
    if (!ocrFile) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', ocrFile);
      const res = await timetableApi.uploadScreenshot(formData);
      setOcrDraft(res.data.draft); // preserve auto-matched subject_id from backend
      toast.info(res.data.message);
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.error || err.message || '';
      toast.error(`OCR failed: ${detail || 'Try a clearer image or use manual entry.'}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const updateOcrSlot = (i, field, val) => {
    setOcrDraft(ocrDraft.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };

  const confirmOcrDraft = () => {
    const mapped = ocrDraft.filter((s) => s.subject_id);
    if (mapped.length === 0) { toast.error('Map at least one slot to a subject.'); return; }
    setSlots(mapped.map((s) => ({
      subject_id: s.subject_id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    })));
    setOcrDraft(null);
    setTimetableMethod('manual'); // show final slot list
    toast.success('OCR slots imported! Review and save.');
  };

  const saveTimetableAndFinish = async () => {
    if (slots.length === 0) {
      // Skip allowed
      navigate('/today');
      return;
    }
    setSubmitting(true);
    try {
      await timetableApi.save({ slots, replaceAll: true });
      toast.success('All set! Welcome to Smart Attendance 🎉');
      navigate('/today');
    } catch { toast.error('Failed to save timetable.'); }
    finally { setSubmitting(false); }
  };

  const subjectForSlot = (id) => savedSubjects.find((s) => s.id === Number(id));

  return (
    <div className="app-shell">
      <div className="page-content animate-fadeInUp">
        {/* Header */}
        <div className="page-header">
          <div className="step-indicator">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
            ))}
          </div>
          <h1 className="page-title">{STEPS[step].label}</h1>
          <p className="page-subtitle">Step {step + 1} of {STEPS.length}</p>
        </div>

        {/* ── STEP 0: Subjects ─────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-5 stagger-children">
            <div className="card animate-fadeInUp">
              <div className="flex flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">Subject Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Engineering Mathematics"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSubject()}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Color</label>
                  <div className="color-swatches">
                    {SUBJECT_COLORS.map((c) => (
                      <div
                        key={c}
                        className={`color-swatch ${c === subjectColor ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setSubjectColor(c)}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target % (optional — overrides default)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="e.g. 75"
                    min="0" max="100"
                    value={subjectTarget}
                    onChange={(e) => setSubjectTarget(e.target.value)}
                  />
                </div>

                <button className="btn btn-ghost" onClick={addSubject} disabled={!subjectName.trim()}>
                  + Add Subject
                </button>
              </div>
            </div>

            {subjects.length > 0 && (
              <div className="flex flex-col gap-3 animate-fadeInUp">
                <p className="text-sm text-secondary font-semibold">Your Subjects</p>
                {subjects.map((s, i) => (
                  <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="color-dot" style={{ background: s.color }} />
                    <div style={{ flex: 1 }}>
                      <p className="font-semibold">{s.name}</p>
                      {s.target_percent && <p className="text-xs text-muted">Target: {s.target_percent}%</p>}
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => removeSubject(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={saveSubjectsAndNext}
              disabled={subjects.length === 0 || submitting}
            >
              {submitting ? 'Saving...' : `Continue with ${subjects.length} subject${subjects.length !== 1 ? 's' : ''} →`}
            </button>
          </div>
        )}

        {/* ── STEP 1: Settings ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-5 stagger-children">
            <div className="card animate-fadeInUp">
              <p className="font-semibold mb-4">How does your college track attendance?</p>
              <div className="flex flex-col gap-3">
                {[
                  { value: 'per_subject', label: 'Per Subject', desc: 'Each subject tracked and enforced independently' },
                  { value: 'overall', label: 'Overall / Combined', desc: 'One percentage across all subjects combined' },
                ].map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${mode === opt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                      background: mode === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all var(--duration)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: `2px solid ${mode === opt.value ? 'var(--color-primary)' : 'var(--text-muted)'}`,
                        background: mode === opt.value ? 'var(--color-primary)' : 'transparent',
                        transition: 'all var(--duration)',
                      }} />
                      <div>
                        <p className="font-semibold">{opt.label}</p>
                        <p className="text-sm text-secondary mt-1">{opt.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card animate-fadeInUp">
              <div className="form-group">
                <label className="form-label">
                  Default Minimum Attendance Target (%)
                  {mode === 'per_subject' && ' — applied to subjects without a custom target'}
                </label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="75"
                  min="0" max="100"
                  value={defaultTarget}
                  onChange={(e) => setDefaultTarget(e.target.value)}
                />
              </div>
              {mode === 'per_subject' && (
                <p className="text-xs text-muted mt-3" style={{ lineHeight: 1.6 }}>
                  Subjects with a custom target set earlier will use that value. Others use this default.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={saveSettingsAndNext}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Timetable ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-5 stagger-children">

            {!timetableMethod && (
              <div className="animate-fadeInUp">
                <div className="card mb-4" style={{ textAlign: 'center', padding: '24px' }}>
                  <div style={{ fontSize: '36px', marginBottom: '12px' }}>📸</div>
                  <p className="font-bold text-lg mb-2">Upload Timetable Photo</p>
                  <p className="text-sm text-secondary mb-4">Take a screenshot of your timetable and let us extract it automatically</p>
                  <button className="btn btn-primary btn-full" onClick={() => setTimetableMethod('ocr')}>
                    Upload Screenshot
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div className="divider" style={{ flex: 1, margin: 0 }} />
                  <span className="text-xs text-muted">or</span>
                  <div className="divider" style={{ flex: 1, margin: 0 }} />
                </div>

                <button className="btn btn-ghost btn-full" onClick={() => setTimetableMethod('manual')}>
                  Enter Manually
                </button>
              </div>
            )}

            {/* OCR Path */}
            {timetableMethod === 'ocr' && !ocrDraft && (
              <div className="card animate-fadeInUp">
                <p className="font-semibold mb-4">Upload your timetable image</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setOcrFile(e.target.files[0])}
                  style={{ color: 'var(--text-secondary)', marginBottom: '12px', width: '100%' }}
                />
                {ocrFile && (
                  <button className="btn btn-primary btn-full" onClick={handleOcrUpload} disabled={ocrLoading}>
                    {ocrLoading ? '🔍 Analyzing...' : '🔍 Extract Timetable'}
                  </button>
                )}
                <button className="btn btn-ghost btn-full mt-2" onClick={() => setTimetableMethod('manual')}>
                  Switch to manual entry
                </button>
              </div>
            )}

            {/* OCR Draft Review */}
            {ocrDraft && (
              <div className="animate-fadeInUp">
                <div className="glass-card mb-4">
                  <p className="font-semibold">Review extracted slots</p>
                  <p className="text-sm text-secondary mt-1">Map each slot to one of your subjects. Flagged slots (⚠️) had low confidence.</p>
                </div>
                <div className="flex flex-col gap-3">
                  {ocrDraft.map((slot, i) => (
                    <div key={i} className="card" style={{ borderColor: slot.flagged ? 'rgba(245,158,11,0.4)' : undefined }}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold">{slot.flagged ? '⚠️ ' : ''}{slot.subject_name}</p>
                          <p className="text-xs text-muted">{DAYS[slot.day_of_week]} · {slot.start_time} – {slot.end_time}</p>
                        </div>
                        <span className="text-xs text-muted">{Math.round(slot.confidence * 100)}%</span>
                      </div>
                      <select
                        className="form-input form-select"
                        value={slot.subject_id}
                        onChange={(e) => updateOcrSlot(i, 'subject_id', Number(e.target.value))}
                      >
                        <option value="">— Map to subject —</option>
                        {savedSubjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-full mt-4" onClick={confirmOcrDraft}>
                  Confirm & Import Slots
                </button>
                <button className="btn btn-ghost btn-full mt-2" onClick={() => setOcrDraft(null)}>
                  Re-upload
                </button>
              </div>
            )}

            {/* Manual Entry */}
            {timetableMethod === 'manual' && !ocrDraft && (
              <div className="animate-fadeInUp flex flex-col gap-4">
                <div className="card">
                  <p className="font-semibold mb-4">Add a class slot</p>
                  <div className="flex flex-col gap-3">
                    <div className="form-group">
                      <label className="form-label">Subject</label>
                      <select
                        className="form-input form-select"
                        value={newSlot.subject_id}
                        onChange={(e) => setNewSlot({ ...newSlot, subject_id: Number(e.target.value) })}
                      >
                        <option value="">— Select —</option>
                        {savedSubjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Day of Week</label>
                      <div className="day-tabs">
                        {DAYS.map((d, i) => (
                          <button
                            key={d}
                            className={`day-tab ${newSlot.day_of_week === i ? 'active' : ''}`}
                            onClick={() => setNewSlot({ ...newSlot, day_of_week: i })}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Start</label>
                        <input
                          className="form-input"
                          type="time"
                          value={newSlot.start_time}
                          onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">End</label>
                        <input
                          className="form-input"
                          type="time"
                          value={newSlot.end_time}
                          onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                        />
                      </div>
                    </div>

                    <button className="btn btn-ghost" onClick={addSlot}>+ Add Slot</button>
                  </div>
                </div>

                {slots.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-secondary font-semibold">Added Slots ({slots.length})</p>
                    {slots.map((s, i) => {
                      const sub = subjectForSlot(s.subject_id);
                      return (
                        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="color-dot" style={{ background: sub?.color }} />
                          <div style={{ flex: 1 }}>
                            <p className="font-semibold text-sm">{sub?.name}</p>
                            <p className="text-xs text-muted">{DAYS[s.day_of_week]} · {s.start_time} – {s.end_time}</p>
                          </div>
                          <button className="btn btn-sm btn-danger" onClick={() => removeSlot(i)}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {(timetableMethod === 'manual' && !ocrDraft) && (
              <div className="flex gap-3 mt-2">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={saveTimetableAndFinish}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : slots.length === 0 ? 'Skip for Now →' : `Save & Start →`}
                </button>
              </div>
            )}

            {!timetableMethod && (
              <button className="btn btn-ghost btn-full" onClick={() => navigate('/today')}>
                Skip for now — I'll add it later
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
