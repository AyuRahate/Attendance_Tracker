const {
  calculateAttendance,
  lecturesNeededToReachTarget,
  safeBunkCount,
  getOverallSummary,
} = require('./attendanceEngine');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build record arrays quickly
// ─────────────────────────────────────────────────────────────────────────────
function mkRecords(attended, missed, cancelled = 0) {
  return [
    ...Array(attended).fill({ status: 'attended' }),
    ...Array(missed).fill({ status: 'missed' }),
    ...Array(cancelled).fill({ status: 'cancelled' }),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateAttendance
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateAttendance', () => {
  test('normal case: 7 attended, 3 missed → 70%', () => {
    const r = calculateAttendance(mkRecords(7, 3));
    expect(r.attended).toBe(7);
    expect(r.missed).toBe(3);
    expect(r.total).toBe(10);
    expect(r.percentage).toBeCloseTo(70);
  });

  test('edge: 0 lectures held → percentage is null', () => {
    const r = calculateAttendance([]);
    expect(r.total).toBe(0);
    expect(r.percentage).toBeNull();
  });

  test('edge: all cancelled → total=0, percentage null', () => {
    const r = calculateAttendance(mkRecords(0, 0, 5));
    expect(r.total).toBe(0);
    expect(r.cancelled).toBe(5);
    expect(r.percentage).toBeNull();
  });

  test('edge: 100% attendance (all attended)', () => {
    const r = calculateAttendance(mkRecords(10, 0));
    expect(r.percentage).toBeCloseTo(100);
  });

  test('edge: 0% attendance (all missed)', () => {
    const r = calculateAttendance(mkRecords(0, 10));
    expect(r.percentage).toBeCloseTo(0);
  });

  test('cancelled lectures do not affect total or percentage', () => {
    const withCancelled = calculateAttendance(mkRecords(7, 3, 5));
    const without = calculateAttendance(mkRecords(7, 3, 0));
    expect(withCancelled.percentage).toBeCloseTo(without.percentage);
    expect(withCancelled.total).toBe(without.total);
    expect(withCancelled.cancelled).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// lecturesNeededToReachTarget
// ─────────────────────────────────────────────────────────────────────────────
describe('lecturesNeededToReachTarget', () => {
  test('already at target → 0', () => {
    expect(lecturesNeededToReachTarget(75, 100, 75)).toBe(0);
  });

  test('above target → 0', () => {
    expect(lecturesNeededToReachTarget(80, 100, 75)).toBe(0);
  });

  test('standard: 6/10 → need to reach 75%', () => {
    // Formula: ceil((75*10 - 100*6)/(100-75)) = ceil((750-600)/25) = ceil(6) = 6
    expect(lecturesNeededToReachTarget(6, 10, 75)).toBe(6);
  });

  test('target=100% with missed lectures → Infinity', () => {
    expect(lecturesNeededToReachTarget(8, 10, 100)).toBe(Infinity);
  });

  test('target=100% with 0 held → 0', () => {
    expect(lecturesNeededToReachTarget(0, 0, 100)).toBe(0);
  });

  test('0 lectures held yet, target 75% → need to attend first lecture (ceil)', () => {
    // ceil((75*0 - 100*0)/(100-75)) = ceil(0/25) = 0 → already at target (null handled upstream)
    // 0 total means no data, but formula still works: needed = 0
    expect(lecturesNeededToReachTarget(0, 0, 75)).toBe(0);
  });

  test('very bad attendance: 0/20, target 75%', () => {
    // ceil((75*20 - 100*0)/25) = ceil(1500/25) = ceil(60) = 60
    expect(lecturesNeededToReachTarget(0, 20, 75)).toBe(60);
  });

  test('target=0 → already there', () => {
    expect(lecturesNeededToReachTarget(0, 10, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// safeBunkCount
// ─────────────────────────────────────────────────────────────────────────────
describe('safeBunkCount', () => {
  test('standard: 80/100 → can miss with target 75', () => {
    // floor((100*80 - 75*100)/75) = floor((8000-7500)/75) = floor(500/75) = floor(6.67) = 6
    expect(safeBunkCount(80, 100, 75)).toBe(6);
  });

  test('already below target → 0', () => {
    expect(safeBunkCount(60, 100, 75)).toBe(0);
  });

  test('exactly at target → 0 (cannot safely miss)', () => {
    // floor((100*75 - 75*100)/75) = floor(0/75) = 0
    expect(safeBunkCount(75, 100, 75)).toBe(0);
  });

  test('target=100% → 0 (cannot miss any)', () => {
    expect(safeBunkCount(100, 100, 100)).toBe(0);
  });

  test('target=0% → Infinity', () => {
    expect(safeBunkCount(0, 0, 0)).toBe(Infinity);
  });

  test('no lectures held, target 75% → 0', () => {
    expect(safeBunkCount(0, 0, 75)).toBe(0);
  });

  test('100% attendance, target 75%, 10 held', () => {
    // floor((100*10 - 75*10)/75) = floor((1000-750)/75) = floor(250/75) = floor(3.33) = 3
    expect(safeBunkCount(10, 10, 75)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOverallSummary
// ─────────────────────────────────────────────────────────────────────────────
describe('getOverallSummary — per_subject mode', () => {
  const subjects = [
    { subjectId: 1, name: 'Math', color: '#f00', records: mkRecords(9, 1), targetPercent: 75 }, // 90% → bunkable
    { subjectId: 2, name: 'Physics', color: '#00f', records: mkRecords(3, 7), targetPercent: 75 },
  ];

  test('per_subject mode: no overall block', () => {
    const result = getOverallSummary(subjects, 'per_subject', 75);
    expect(result.overall).toBeNull();
  });

  test('per_subject: Math at 80% → status safe, bunkable > 0', () => {
    const result = getOverallSummary(subjects, 'per_subject', 75);
    const math = result.subjects.find((s) => s.name === 'Math');
    expect(math.status).toBe('safe');
    expect(math.safeBunks).toBeGreaterThan(0);
    expect(math.lecturesNeeded).toBe(0);
  });

  test('per_subject: Physics at 30% → status danger, needs lectures', () => {
    const result = getOverallSummary(subjects, 'per_subject', 75);
    const physics = result.subjects.find((s) => s.name === 'Physics');
    expect(physics.status).toBe('danger');
    expect(physics.lecturesNeeded).toBeGreaterThan(0);
    expect(physics.safeBunks).toBe(0);
  });
});

describe('getOverallSummary — overall mode', () => {
  test('overall mode: pools all subjects', () => {
    const subjects = [
      { subjectId: 1, name: 'Math', color: '#f00', records: mkRecords(10, 0), targetPercent: null },
      { subjectId: 2, name: 'Physics', color: '#00f', records: mkRecords(5, 5), targetPercent: null },
    ];
    const result = getOverallSummary(subjects, 'overall', 75);
    expect(result.overall).not.toBeNull();
    expect(result.overall.attended).toBe(15);
    expect(result.overall.total).toBe(20);
    expect(result.overall.percentage).toBeCloseTo(75);
  });

  test('all-cancelled subject: overall still shows correct data for other subjects', () => {
    const subjects = [
      { subjectId: 1, name: 'Math', color: '#f00', records: mkRecords(8, 2, 0), targetPercent: null },
      { subjectId: 2, name: 'Lab', color: '#0f0', records: mkRecords(0, 0, 5), targetPercent: null },
    ];
    const result = getOverallSummary(subjects, 'overall', 75);
    expect(result.overall.percentage).toBeCloseTo(80); // only Math counts
    expect(result.overall.total).toBe(10); // Lab's cancelled excluded
  });

  test('all subjects with all-cancelled records → overall percentage null', () => {
    const subjects = [
      { subjectId: 1, name: 'A', color: '#f00', records: mkRecords(0, 0, 3), targetPercent: null },
    ];
    const result = getOverallSummary(subjects, 'overall', 75);
    expect(result.overall.percentage).toBeNull();
    expect(result.overall.status).toBe('no_data');
  });
});
