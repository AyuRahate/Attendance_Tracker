import { useState, useEffect } from 'react';
import { summaryApi, subjectsApi, lecturesApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
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

  // Heatmap constants
  const heatmapWeeks = 20;
  const heatmapDays = 7;
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  // Generate heatmap matrix with real calculated dates
  const generateHeatmapData = () => {
    const today = new Date();
    // End on current week's Sunday
    const currentDow = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0=Mon..6=Sun
    const totalDays = heatmapWeeks * 7;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDow - (heatmapWeeks - 1) * 7);

    const columns = [];
    let cur = new Date(startDate);

    for (let w = 0; w < heatmapWeeks; w++) {
      const weekDays = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = cur.toISOString().split('T')[0];
        const isFuture = cur > today;
        
        // Pseudo-deterministic data based on date hash
        const dayNum = cur.getDate();
        const monthNum = cur.getMonth();
        const dayOfWeek = d;

        let attended = 0;
        let missed = 0;
        let level = 0; // 0: none, 1: 1-2, 2: 3-4, 3: 5+

        if (!isFuture && dayOfWeek < 6) { // Mon-Sat
          const seed = (dayNum * 13 + monthNum * 7 + dayOfWeek * 5) % 10;
          if (seed > 2) {
            attended = (seed % 4) + 1;
            missed = seed === 8 ? 1 : 0;
            level = attended >= 4 ? 3 : attended >= 2 ? 2 : 1;
          }
        }

        weekDays.push({
          date: new Date(cur),
          dateStr,
          dayOfWeek: d,
          isFuture,
          attended,
          missed,
          level: isFuture ? 0 : level,
        });

        cur.setDate(cur.getDate() + 1);
      }
      columns.push(weekDays);
    }
    return columns;
  };

  const heatmapColumns = generateHeatmapData();

  // Extract month markers for top header
  const monthMarkers = [];
  let lastMonth = -1;
  heatmapColumns.forEach((col, colIdx) => {
    const month = col[0].date.getMonth();
    if (month !== lastMonth) {
      const monthName = col[0].date.toLocaleString('en-US', { month: 'short' });
      monthMarkers.push({ colIdx, monthName });
      lastMonth = month;
    }
  });

  const heatmapLevelColors = [
    'var(--heatmap-bg-empty)',
    'rgba(16, 185, 129, 0.35)',
    '#10b981',
    '#34d399',
  ];

  // Bar Chart breakdown data (Mon - Sat)
  const daysBreakdown = [
    { day: 'Mon', fullName: 'Monday', attended: 4, missed: 0, total: 4 },
    { day: 'Tue', fullName: 'Tuesday', attended: 3, missed: 1, total: 4 },
    { day: 'Wed', fullName: 'Wednesday', attended: 4, missed: 1, total: 5 },
    { day: 'Thu', fullName: 'Thursday', attended: 2, missed: 1, total: 3 },
    { day: 'Fri', fullName: 'Friday', attended: 3, missed: 2, total: 5 },
    { day: 'Sat', fullName: 'Saturday', attended: 1, missed: 0, total: 1 },
  ];

  const totalWeeklyAttended = daysBreakdown.reduce((acc, d) => acc + d.attended, 0);
  const totalWeeklyClasses = daysBreakdown.reduce((acc, d) => acc + d.total, 0);
  const weeklyRate = Math.round((totalWeeklyAttended / totalWeeklyClasses) * 100);

  return (
    <div className="page-content animate-fadeIn">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Your attendance patterns & weekly insights</p>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="metrics-grid mb-6 stagger-children">
        <div className="metric-card">
          <p className="metric-label">This Week</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-emerald">{totalWeeklyAttended}/{totalWeeklyClasses}</span>
          </div>
          <p className="metric-sub">{weeklyRate}% attendance rate</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">Streak</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-indigo">8</span>
          </div>
          <p className="metric-sub">days in a row</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">Best Subject</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-emerald" style={{ fontSize: '22px' }}>
              {bestSub ? bestSub.name : 'N/A'}
            </span>
          </div>
          <p className="metric-sub">{bestSub ? `${Math.round(bestSub.percentage ?? 100)}% attendance` : 'No data yet'}</p>
        </div>

        <div className="metric-card">
          <p className="metric-label">Risk Alert</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="metric-value text-rose">{atRiskCount}</span>
          </div>
          <p className="metric-sub">{atRiskCount === 1 ? 'subject below target' : 'subjects below target'}</p>
        </div>
      </div>

      {/* Weekly Breakdown Bar Chart Card */}
      <div className="card mb-6 animate-fadeInUp chart-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="card-title text-md font-bold">Weekly Breakdown</h2>
            <p className="text-xs text-secondary mt-0.5">Hover over any day for details</p>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="chart-legend-dot" style={{ background: 'var(--color-emerald)' }} />
              <span className="text-secondary">Attended</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chart-legend-dot" style={{ background: 'var(--color-rose)' }} />
              <span className="text-secondary">Missed</span>
            </div>
            <span className="badge badge-safe text-xs ml-1">{weeklyRate}% Overall</span>
          </div>
        </div>

        {/* Interactive Chart Area */}
        <div className="breakdown-chart-wrapper">
          <div className="breakdown-chart-grid">
            {daysBreakdown.map((item, idx) => {
              const pct = Math.round((item.attended / item.total) * 100);
              const isHovered = hoveredBar === idx;

              return (
                <div
                  key={item.day}
                  className={`breakdown-col ${isHovered ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredBar(idx)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Floating Tooltip */}
                  {isHovered && (
                    <div className="chart-tooltip animate-fadeIn">
                      <p className="font-bold text-xs text-primary">{item.fullName}</p>
                      <div className="tooltip-stat mt-1">
                        <span className="tooltip-dot" style={{ background: '#10b981' }} />
                        <span>Attended: {item.attended}</span>
                      </div>
                      {item.missed > 0 && (
                        <div className="tooltip-stat">
                          <span className="tooltip-dot" style={{ background: '#f43f5e' }} />
                          <span>Missed: {item.missed}</span>
                        </div>
                      )}
                      <p className="tooltip-footer mt-1 font-bold" style={{ color: pct >= 75 ? '#10b981' : '#f59e0b' }}>
                        {pct}% rate ({item.attended}/{item.total})
                      </p>
                    </div>
                  )}

                  {/* Bar Pillars Container */}
                  <div className="bar-track">
                    <div className="bar-pillars">
                      {item.attended > 0 && (
                        <div
                          className="breakdown-bar bar-attended"
                          style={{ height: `${(item.attended / 5) * 100}%` }}
                        >
                          <span className="bar-inner-val">{item.attended}</span>
                        </div>
                      )}
                      {item.missed > 0 && (
                        <div
                          className="breakdown-bar bar-missed"
                          style={{ height: `${(item.missed / 5) * 100}%` }}
                        >
                          <span className="bar-inner-val">{item.missed}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="bar-day-name">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Attendance Heatmap Card */}
      <div className="card mb-6 animate-fadeInUp chart-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="card-title text-md font-bold">Attendance Heatmap</h2>
            <p className="text-xs text-secondary mt-0.5">Consistency across last {heatmapWeeks} weeks</p>
          </div>

          {/* Legend */}
          <div className="heatmap-legend flex items-center gap-1.5 text-xs text-muted">
            <span>Less</span>
            {heatmapLevelColors.map((col, idx) => (
              <div
                key={idx}
                className="heatmap-cell-sm"
                style={{ background: col }}
              />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Layout with Month & Day Labels */}
        <div className="heatmap-container">
          {/* Active Hover Detail Banner */}
          <div className="heatmap-hover-banner">
            {hoveredCell ? (
              <div className="flex items-center gap-2 animate-fadeIn text-xs">
                <span className="font-bold text-primary">
                  {hoveredCell.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}:
                </span>
                {hoveredCell.attended === 0 && hoveredCell.missed === 0 ? (
                  <span className="text-muted">No classes recorded</span>
                ) : (
                  <span className="text-secondary">
                    <strong className="text-emerald">{hoveredCell.attended}</strong> attended,{' '}
                    <strong className="text-rose">{hoveredCell.missed}</strong> missed{' '}
                    ({Math.round((hoveredCell.attended / (hoveredCell.attended + hoveredCell.missed)) * 100)}%)
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted">Hover over any square to view attendance records</span>
            )}
          </div>

          <div className="heatmap-matrix-wrapper">
            {/* Day Labels Column */}
            <div className="heatmap-days-col">
              <span>Mon</span>
              <span></span>
              <span>Wed</span>
              <span></span>
              <span>Fri</span>
              <span></span>
              <span>Sun</span>
            </div>

            {/* Matrix of Columns (Weeks) */}
            <div className="heatmap-columns-scroll">
              <div className="heatmap-matrix">
                {heatmapColumns.map((week, wIdx) => (
                  <div key={wIdx} className="heatmap-col">
                    {week.map((cell, dIdx) => {
                      const isHovered = hoveredCell?.dateStr === cell.dateStr;
                      return (
                        <div
                          key={dIdx}
                          className={`heatmap-cell ${cell.isFuture ? 'future' : ''} ${isHovered ? 'cell-hovered' : ''}`}
                          style={{
                            background: cell.isFuture ? 'transparent' : heatmapLevelColors[cell.level],
                          }}
                          onMouseEnter={() => !cell.isFuture && setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Detail Card */}
      <div className="card animate-fadeInUp">
        <h2 className="card-title text-md font-bold mb-4">Subject Breakdown</h2>

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
