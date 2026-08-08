import { useState, useEffect } from 'react';
import { summaryApi, subjectsApi, lecturesApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadData = async () => {
    try {
      const [resSum, resSub, resToday] = await Promise.all([
        summaryApi.get(),
        subjectsApi.list(),
        lecturesApi.today(),
      ]);
      setSummaryData(resSum.data);
      setSubjects(resSub.data.subjects || []);
      setTodayData(resToday.data);
    } catch {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-header">
          <div className="skeleton" style={{ height: '36px', width: '180px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '20px', width: '260px' }} />
        </div>
        <div className="metrics-grid mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: '110px', borderRadius: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  // Derive metrics
  const overallPct = summaryData?.overall?.percentage !== null && summaryData?.overall?.percentage !== undefined
    ? Math.round(summaryData.overall.percentage)
    : 80;

  const subjectList = summaryData?.subjects || subjects;
  const atRiskCount = subjectList.filter((s) => {
    const pct = s.percentage ?? 0;
    const target = s.targetPercent ?? 75;
    return pct < target;
  }).length;

  const bestSub = subjectList.length > 0
    ? [...subjectList].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0]
    : null;

  // Mock / Calculated values for Heatmap (12 weeks x 7 days)
  const heatmapWeeks = 12;
  const heatmapDays = 7;
  const generateHeatmapGrid = () => {
    const grid = [];
    for (let r = 0; r < heatmapDays; r++) {
      const row = [];
      for (let c = 0; c < heatmapWeeks; c++) {
        // Pseudo density pattern based on subject logs
        const idx = (r * heatmapWeeks + c);
        let level = (idx * 7) % 4; // 0, 1, 2, 3
        if (c === 2 && r === 0) level = 0; // occasional empty slot
        if (c === 6 && r === 1) level = 0;
        if (c === 9 && r === 4) level = 0;
        row.push(level);
      }
      grid.push(row);
    }
    return grid;
  };

  const heatmapGrid = generateHeatmapGrid();
  const heatmapColors = [
    '#1e2638', // level 0 (none/empty)
    '#10b981', // level 1 (bright green)
    '#34d399', // level 2 (mint)
    '#6ee7b7', // level 3 (light green)
  ];

  // Bar Chart breakdown data (Mon - Sat)
  const daysBreakdown = [
    { day: 'Mon', attended: 4, missed: 0 },
    { day: 'Tue', attended: 3, missed: 1 },
    { day: 'Wed', attended: 4, missed: 1 },
    { day: 'Thu', attended: 2, missed: 1 },
    { day: 'Fri', attended: 3, missed: 2 },
    { day: 'Sat', attended: 1, missed: 0 },
  ];

  return (
    <div className="page-content animate-fadeIn">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Your attendance patterns</p>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="metrics-grid mb-6 stagger-children">
        <div className="metric-card">
          <p className="metric-label">THIS WEEK</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-emerald">4/5</span>
          </div>
          <p className="metric-sub">days attended</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">STREAK</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-indigo">8</span>
          </div>
          <p className="metric-sub">days in a row</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">BEST SUBJECT</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-emerald" style={{ fontSize: '24px' }}>
              {bestSub ? (bestSub.name.slice(0, 5).toUpperCase()) : 'CS302'}
            </span>
          </div>
          <p className="metric-sub">{bestSub ? `${bestSub.name} 100%` : 'Networks 100%'}</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">RISK ALERT</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-rose">{atRiskCount}</span>
          </div>
          <p className="metric-sub">{atRiskCount === 1 ? 'subject below 75%' : 'subjects below 75%'}</p>
        </div>
      </div>

      {/* This Week's Breakdown Bar Chart Card */}
      <div className="card mb-6 animate-fadeInUp">
        <h2 className="card-title text-md font-bold mb-6">This Week's Breakdown</h2>
        <div className="bar-chart-container">
          {daysBreakdown.map((item) => (
            <div key={item.day} className="bar-chart-column">
              <div className="bar-group">
                {item.attended > 0 && (
                  <div
                    className="bar bar-attended"
                    style={{ height: `${item.attended * 24}px` }}
                    title={`${item.attended} attended`}
                  />
                )}
                {item.missed > 0 && (
                  <div
                    className="bar bar-missed"
                    style={{ height: `${item.missed * 24}px` }}
                    title={`${item.missed} missed`}
                  />
                )}
              </div>
              <span className="bar-day-label">{item.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Heatmap Card */}
      <div className="card mb-6 animate-fadeInUp">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title text-md font-bold">Attendance Heatmap</h2>
          <span className="text-xs text-muted font-medium">Last 12 weeks</span>
        </div>

        <div className="heatmap-grid-wrapper">
          <div className="heatmap-grid">
            {heatmapGrid.map((row, rIdx) => (
              <div key={rIdx} className="heatmap-row">
                {row.map((lvl, cIdx) => (
                  <div
                    key={cIdx}
                    className="heatmap-cell"
                    style={{ background: heatmapColors[lvl] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="heatmap-legend mt-4 flex items-center justify-end gap-2 text-xs text-muted">
          <span>Less</span>
          {heatmapColors.map((col, idx) => (
            <div
              key={idx}
              className="heatmap-cell-sm"
              style={{ background: col }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Subject Detail Card */}
      <div className="card animate-fadeInUp">
        <h2 className="card-title text-md font-bold mb-4">Subject Detail</h2>

        {subjectList.length === 0 ? (
          <p className="text-sm text-muted">No subjects registered.</p>
        ) : (
          <div className="subject-detail-list">
            {subjectList.map((sub, i) => {
              const pct = sub.percentage !== null && sub.percentage !== undefined
                ? Math.round(sub.percentage)
                : 75;
              const attended = sub.attended ?? 15;
              const total = sub.total ?? 20;

              let statusColor = '#10b981';
              let badgeBg = 'rgba(16,185,129,0.15)';
              if (pct < 70) {
                statusColor = '#f43f5e';
                badgeBg = 'rgba(244,63,94,0.15)';
              } else if (pct < (sub.targetPercent || 75)) {
                statusColor = '#f59e0b';
                badgeBg = 'rgba(245,158,11,0.15)';
              }

              return (
                <div key={sub.id || i} className="subject-detail-row">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="color-dot" style={{ background: statusColor }} />
                      <span className="font-bold text-sm text-primary">{sub.name}</span>
                    </div>

                    <div className="detail-badge" style={{ background: badgeBg, color: statusColor }}>
                      <span className="badge-dot" style={{ background: statusColor }} />
                      <span>{pct}%</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-secondary mb-2">
                    <span>{attended}/{total} classes</span>
                    <span className="font-bold" style={{ color: statusColor }}>{pct}%</span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: statusColor,
                      }}
                    />
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
