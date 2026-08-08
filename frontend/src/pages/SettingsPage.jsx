import { useState, useEffect } from 'react';
import { settingsApi, subjectsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import TimetableManager from '../components/TimetableManager';

const SUBJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#10b981', '#06b6d4',
  '#3b82f6', '#a78bfa',
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // New subject modal/form state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubColor, setNewSubColor] = useState(SUBJECT_COLORS[0]);
  const [newSubTarget, setNewSubTarget] = useState('');

  const loadData = async () => {
    try {
      const [resSet, resSub] = await Promise.all([
        settingsApi.get(),
        subjectsApi.list(),
      ]);
      setSettings(resSet.data.settings);
      setSubjects(resSub.data.subjects);
    } catch {
      toast.error('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleModeChange = async (newMode) => {
    try {
      const res = await settingsApi.update({ mode: newMode });
      setSettings(res.data.settings);
      toast.success(`Switched to ${newMode === 'overall' ? 'Overall' : 'Per-Subject'} mode`);
    } catch {
      toast.error('Failed to update mode');
    }
  };

  const handleTargetChange = async (val) => {
    const target = parseFloat(val);
    if (isNaN(target) || target < 0 || target > 100) return;
    try {
      const res = await settingsApi.update({ default_target_percent: target });
      setSettings(res.data.settings);
      toast.success('Default target updated');
    } catch {
      toast.error('Failed to update target');
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    const nameTrimmed = newSubName.trim();
    if (!nameTrimmed) return;

    if (subjects.some((s) => s.name.trim().toLowerCase() === nameTrimmed.toLowerCase())) {
      toast.error(`Subject "${nameTrimmed}" already exists`);
      return;
    }

    try {
      await subjectsApi.create({
        name: nameTrimmed,
        color: newSubColor,
        target_percent: newSubTarget ? parseFloat(newSubTarget) : null,
      });
      toast.success('Subject added');
      setNewSubName('');
      setNewSubTarget('');
      setShowAddSubject(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add subject');
    }
  };

  const handleDeduplicateSubjects = async () => {
    try {
      const res = await subjectsApi.deduplicate();
      toast.success(res.data.message);
      loadData();
    } catch {
      toast.error('Failed to merge duplicate subjects');
    }
  };

  const handleDeleteSubject = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? All associated timetable slots and lecture records will be removed.`)) return;
    try {
      await subjectsApi.delete(id);
      toast.success('Subject deleted');
      loadData();
    } catch {
      toast.error('Failed to delete subject');
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="skeleton" style={{ height: '32px', width: '50%' }} />
        </div>
        <div className="skeleton" style={{ height: '200px' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1 }}>
      <div className="page-content animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure attendance rules & manage subjects</p>
        </div>

        {/* User Info Card */}
        <div className="card mb-6 animate-fadeInUp flex items-center justify-between">
          <div>
            <p className="font-bold text-lg">{user?.name || 'Student'}</p>
            <p className="text-xs text-muted mt-1">{user?.email}</p>
          </div>
          <button className="btn btn-sm btn-danger" onClick={logout}>
            Sign Out
          </button>
        </div>

        {/* Appearance / Theme Toggle */}
        <div className="card mb-6 animate-fadeInUp">
          <p className="font-semibold text-lg mb-3">Appearance</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              {
                value: 'dark',
                label: 'Dark',
                icon: '🌙',
                desc: 'Dark surfaces & vibrant accents',
              },
              {
                value: 'light',
                label: 'Light',
                icon: '☀️',
                desc: 'Clean & bright for daylight',
              },
            ].map((opt) => {
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  style={{
                    padding: '14px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all var(--duration) var(--ease)',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>{opt.icon}</span>
                  <p className="font-semibold text-sm" style={{ color: isActive ? 'var(--color-primary-light)' : 'var(--text-primary)', marginTop: '4px' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Toggle Settings */}
        <div className="card mb-6 animate-fadeInUp">
          <p className="font-semibold text-lg mb-3">Attendance Criteria</p>
          <div className="flex flex-col gap-3">
            {[
              { value: 'per_subject', label: 'Per Subject Mode', desc: 'Calculates bunk room and target per subject separately' },
              { value: 'overall', label: 'Overall Combined Mode', desc: 'Aggregates all attendance into one single combined percentage' },
            ].map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleModeChange(opt.value)}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${settings?.mode === opt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: settings?.mode === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all var(--duration)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: `2px solid ${settings?.mode === opt.value ? 'var(--color-primary)' : 'var(--text-muted)'}`,
                    background: settings?.mode === opt.value ? 'var(--color-primary)' : 'transparent',
                  }} />
                  <div>
                    <p className="font-semibold text-sm">{opt.label}</p>
                    <p className="text-xs text-muted mt-1">{opt.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Default Target Attendance (%)</label>
            <input
              className="form-input"
              type="number"
              min="0" max="100"
              value={settings?.defaultTargetPercent || 75}
              onChange={(e) => handleTargetChange(e.target.value)}
            />
          </div>
        </div>

        {/* Subjects List & Manage */}
        <div className="card mb-6 animate-fadeInUp">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="font-semibold text-lg">Subjects ({subjects.length})</p>
              {new Set(subjects.map((s) => s.name.trim().toLowerCase())).size < subjects.length && (
                <p className="text-xs text-danger mt-0.5">⚠️ Duplicate subject entries detected</p>
              )}
            </div>
            <div className="flex gap-2">
              {new Set(subjects.map((s) => s.name.trim().toLowerCase())).size < subjects.length && (
                <button className="btn btn-sm btn-primary" onClick={handleDeduplicateSubjects}>
                  ✨ Merge Duplicates
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setShowAddSubject(!showAddSubject)}>
                {showAddSubject ? 'Cancel' : '+ Add Subject'}
              </button>
            </div>
          </div>

          {showAddSubject && (
            <form onSubmit={handleAddSubject} className="flex flex-col gap-3 mb-4 p-4 glass-card">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  placeholder="Subject Name"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Color</label>
                <div className="color-swatches">
                  {SUBJECT_COLORS.map((c) => (
                    <div
                      key={c}
                      className={`color-swatch ${c === newSubColor ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewSubColor(c)}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Target % (optional)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder={`Uses default (${settings?.defaultTargetPercent}%) if blank`}
                  value={newSubTarget}
                  onChange={(e) => setNewSubTarget(e.target.value)}
                  min="0" max="100"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-sm mt-2">Save Subject</button>
            </form>
          )}

          <div className="flex flex-col gap-2">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center gap-3">
                  <div className="color-dot" style={{ background: s.color }} />
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted">
                      Target: {s.targetPercent !== null ? `${s.targetPercent}%` : `Default (${settings?.defaultTargetPercent}%)`}
                    </p>
                  </div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSubject(s.id, s.name)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Timetable Manager: Preview, Edit, Add, or Upload OCR */}
        <TimetableManager />
      </div>
    </div>
  );
}
