import { useState, useEffect } from 'react';
import { subjectsApi, summaryApi, lecturesApi } from '../api';
import { useToast } from '../context/ToastContext';

function getSubjectInitials(name) {
  if (!name) return 'CS';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getSubjectAvatarColor(name, colorHex) {
  if (colorHex && colorHex !== '#6366f1') return colorHex;
  const colors = ['#4f46e5', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#059669'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function SubjectsPage() {
  const [summaryData, setSummaryData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadData = async () => {
    try {
      const [resSub, resSum] = await Promise.all([
        subjectsApi.list(),
        summaryApi.get(),
      ]);
      setSubjects(resSub.data.subjects || []);
      setSummaryData(resSum.data);
    } catch {
      toast.error('Failed to load subjects data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuickMark = async (subjectId, status) => {
    try {
      await lecturesApi.mark(`subject_${subjectId}`, { status });
      toast.success(`Marked as ${status}`);
      loadData();
    } catch {
      toast.error('Failed to update attendance');
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="skeleton" style={{ height: '36px', width: '220px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '20px', width: '300px' }} />
        </div>
        <div className="subjects-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton" style={{ height: '220px', borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  // Map summary details by subject ID
  const summaryBySub = {};
  if (summaryData?.subjects) {
    summaryData.subjects.forEach((s) => {
      summaryBySub[s.id] = s;
    });
  }

  return (
    <div className="page-content animate-fadeIn">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">My Subjects</h1>
        <p className="page-subtitle">Tap + / - to log today's class</p>
      </div>

      {subjects.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📚</div>
          <p className="font-bold text-lg mb-1">No subjects added yet</p>
          <p className="text-sm text-secondary mb-4">Add your enrolled subjects to start tracking attendance</p>
        </div>
      ) : (
        <div className="subjects-grid">
          {subjects.map((sub) => {
            const sumInfo = summaryBySub[sub.id] || {};
            const pct = sumInfo.percentage !== null && sumInfo.percentage !== undefined
              ? Math.round(sumInfo.percentage)
              : null;

            const attended = sumInfo.attended ?? 0;
            const total = sumInfo.total ?? 0;
            const safeBunk = sumInfo.safeBunkCount ?? 0;
            const needed = sumInfo.neededLectures ?? 0;
            const targetPct = sumInfo.targetPercent ?? 75;

            // Determine status color theme
            let statusColor = '#10b981'; // green
            let badgeBg = 'rgba(16,185,129,0.15)';
            if (pct !== null) {
              if (pct < 70) {
                statusColor = '#f43f5e'; // red
                badgeBg = 'rgba(244,63,94,0.15)';
              } else if (pct < targetPct) {
                statusColor = '#f59e0b'; // orange/amber
                badgeBg = 'rgba(245,158,11,0.15)';
              }
            }

            const avatarBg = getSubjectAvatarColor(sub.name, sub.color);
            const initials = getSubjectInitials(sub.name);

            return (
              <div key={sub.id} className="subject-card">
                {/* Header Row */}
                <div className="subject-card-header">
                  <div className="subject-avatar" style={{ background: avatarBg }}>
                    {initials}
                  </div>
                  <div className="subject-info">
                    <h3 className="subject-name">{sub.name}</h3>
                    <p className="subject-teacher">Faculty Instructor</p>
                    <p className="subject-schedule">Mon · Wed · Fri 9:00 AM</p>
                  </div>

                  {pct !== null ? (
                    <div className="subject-badge" style={{ background: badgeBg, color: statusColor }}>
                      <span className="badge-dot" style={{ background: statusColor }} />
                      <span>{pct}%</span>
                    </div>
                  ) : (
                    <div className="subject-badge badge-muted">
                      <span>No logs</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar Section */}
                <div className="subject-progress-section">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-secondary font-medium">{attended}/{total} classes</span>
                    <span className="font-bold" style={{ color: statusColor }}>{pct !== null ? `${pct}%` : '0%'}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct ?? 0}%`,
                        background: statusColor,
                      }}
                    />
                  </div>
                </div>

                {/* Callout Message */}
                <div className="subject-callout">
                  {pct === null ? (
                    <span className="text-muted">No attendance logged yet.</span>
                  ) : safeBunk > 0 ? (
                    <span className="callout-safe">
                      ✓ Can skip {safeBunk} more {safeBunk === 1 ? 'class' : 'classes'}
                    </span>
                  ) : needed > 0 ? (
                    <span className="callout-risk">
                      ! Need {needed} more {needed === 1 ? 'class' : 'classes'} to reach {targetPct}%
                    </span>
                  ) : (
                    <span className="callout-safe">✓ On track with target ({targetPct}%)</span>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="subject-actions">
                  <button
                    className="sub-btn sub-btn-attended"
                    onClick={() => handleQuickMark(sub.id, 'attended')}
                  >
                    ✓ Attended
                  </button>
                  <button
                    className="sub-btn sub-btn-missed"
                    onClick={() => handleQuickMark(sub.id, 'missed')}
                  >
                    ✕ Missed
                  </button>
                  <button
                    className="sub-btn sub-btn-cancelled"
                    onClick={() => handleQuickMark(sub.id, 'cancelled')}
                  >
                    Cancelled
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
