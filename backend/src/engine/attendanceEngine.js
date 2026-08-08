/**
 * Attendance Calculation Engine
 * ==============================
 * Pure functions — no database access, no side effects.
 * All inputs are plain numbers; outputs are plain numbers or objects.
 *
 * Variables used throughout:
 *   A = lectures attended
 *   T = total lectures held (attended + missed; cancelled excluded)
 *   p = target percentage (0–100)
 */

/**
 * Calculate attendance statistics for a set of lecture records.
 *
 * @param {Array<{status: 'attended'|'missed'|'cancelled'}>} records
 * @returns {{ attended: number, missed: number, cancelled: number, total: number, percentage: number|null }}
 */
function calculateAttendance(records) {
  let attended = 0;
  let missed = 0;
  let cancelled = 0;

  for (const r of records) {
    if (r.status === 'attended') attended++;
    else if (r.status === 'missed') missed++;
    else if (r.status === 'cancelled') cancelled++;
  }

  const total = attended + missed; // cancelled excluded
  const percentage = total === 0 ? null : (attended / total) * 100;

  return { attended, missed, cancelled, total, percentage };
}

/**
 * Calculate the minimum number of consecutive lectures a student must
 * attend (from now) to reach or exceed the target percentage.
 *
 * Derivation:
 *   (A + x) / (T + x) >= p/100
 *   x >= (pT - 100A) / (100 - p)   [when p < 100]
 *   x = ceil(max(0, (pT - 100A) / (100 - p)))
 *
 * Special case p = 100: need to attend every remaining lecture forever.
 * We return Infinity to signal "impossible to guarantee" unless A === T.
 *
 * @param {number} attended  - A
 * @param {number} total     - T
 * @param {number} targetPercent - p (0–100)
 * @returns {number} - integer, or Infinity if p=100 and A < T
 */
function lecturesNeededToReachTarget(attended, total, targetPercent) {
  const A = attended;
  const T = total;
  const p = targetPercent;

  // Already at or above target
  if (T > 0 && (A / T) * 100 >= p) return 0;
  if (T === 0 && p === 0) return 0;

  // Special case: target is 100%
  if (p >= 100) {
    // Impossible to recover if any lecture was missed
    if (T > 0 && A < T) return Infinity;
    // If no lectures held yet, return 0 (trivially at 100% with 0/0, but practically 0 needed)
    return 0;
  }

  // x = ceil((pT - 100A) / (100 - p))
  const numerator = p * T - 100 * A;
  const denominator = 100 - p;
  const x = Math.ceil(numerator / denominator);

  return Math.max(0, x);
}

/**
 * Calculate the maximum number of lectures a student can safely miss
 * (from now) while staying at or above the target percentage.
 *
 * Derivation:
 *   A / (T + x) >= p/100
 *   x <= (100A - pT) / p   [when p > 0]
 *   x = floor(max(0, (100A - pT) / p))
 *
 * Special case p = 0: can miss infinite lectures, return Infinity.
 *
 * @param {number} attended  - A
 * @param {number} total     - T
 * @param {number} targetPercent - p (0–100)
 * @returns {number} - integer >= 0 (0 means cannot safely miss any)
 */
function safeBunkCount(attended, total, targetPercent) {
  const A = attended;
  const T = total;
  const p = targetPercent;

  // Already below target — cannot bunk at all
  if (T > 0 && (A / T) * 100 < p) return 0;

  // Target is 0% — can always bunk
  if (p === 0) return Infinity;

  // Special case: target is 100% — can never miss a single lecture
  if (p >= 100) return 0;

  // x = floor((100A - pT) / p)
  const numerator = 100 * A - p * T;
  const x = Math.floor(numerator / p);

  return Math.max(0, x);
}

/**
 * Aggregate attendance stats across multiple subjects.
 *
 * In 'overall' mode: pool all attended/total counts and apply target once.
 * In 'per_subject' mode: return per-subject stats with their own targets.
 *
 * @param {Array<{
 *   subjectId: number,
 *   name: string,
 *   color: string,
 *   records: Array<{status: string}>,
 *   targetPercent: number
 * }>} subjects
 * @param {'overall'|'per_subject'} mode
 * @param {number} defaultTarget - used in overall mode
 * @returns {{
 *   mode: string,
 *   overall: object|null,
 *   subjects: Array<object>
 * }}
 */
function getOverallSummary(subjects, mode, defaultTarget = 75) {
  const subjectStats = subjects.map((s) => {
    const stats = calculateAttendance(s.records);
    const target = s.targetPercent !== null && s.targetPercent !== undefined
      ? s.targetPercent
      : defaultTarget;

    const needed = lecturesNeededToReachTarget(stats.attended, stats.total, target);
    const bunkable = safeBunkCount(stats.attended, stats.total, target);
    const atOrAboveTarget = stats.percentage !== null && stats.percentage >= target;

    return {
      subjectId: s.subjectId,
      name: s.name,
      color: s.color,
      ...stats,
      targetPercent: target,
      lecturesNeeded: atOrAboveTarget ? 0 : needed,
      safeBunks: atOrAboveTarget ? bunkable : 0,
      status: stats.percentage === null
        ? 'no_data'
        : stats.percentage >= target
          ? 'safe'
          : 'danger',
    };
  });

  let overall = null;

  if (mode === 'overall') {
    const totalAttended = subjectStats.reduce((s, x) => s + x.attended, 0);
    const totalHeld = subjectStats.reduce((s, x) => s + x.total, 0);
    const totalCancelled = subjectStats.reduce((s, x) => s + x.cancelled, 0);
    const overallPct = totalHeld === 0 ? null : (totalAttended / totalHeld) * 100;
    const needed = lecturesNeededToReachTarget(totalAttended, totalHeld, defaultTarget);
    const bunkable = safeBunkCount(totalAttended, totalHeld, defaultTarget);
    const atOrAbove = overallPct !== null && overallPct >= defaultTarget;

    overall = {
      attended: totalAttended,
      total: totalHeld,
      cancelled: totalCancelled,
      percentage: overallPct,
      targetPercent: defaultTarget,
      lecturesNeeded: atOrAbove ? 0 : needed,
      safeBunks: atOrAbove ? bunkable : 0,
      status: overallPct === null
        ? 'no_data'
        : overallPct >= defaultTarget
          ? 'safe'
          : 'danger',
    };
  }

  return { mode, overall, subjects: subjectStats };
}

module.exports = {
  calculateAttendance,
  lecturesNeededToReachTarget,
  safeBunkCount,
  getOverallSummary,
};
