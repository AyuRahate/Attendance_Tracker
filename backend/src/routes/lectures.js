const express = require('express');
const { body, param, validationResult } = require('express-validator');
const prisma = require('../db/database');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function getLocalDateString(tzOffsetMinutes) {
  if (tzOffsetMinutes !== undefined && tzOffsetMinutes !== null) {
    const now = new Date();
    const localMs = now.getTime() + tzOffsetMinutes * 60 * 1000;
    return new Date(localMs).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

// ── GET /today ─────────────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  const date = req.query.date || getLocalDateString(req.query.tz ? Number(req.query.tz) : null);
  const dateObj = new Date(date + 'T00:00:00Z');
  const jsDow = dateObj.getUTCDay();
  const dow = jsDow === 0 ? 6 : jsDow - 1;

  const slots = await prisma.timetableSlot.findMany({
    where: { userId: req.user.id, dayOfWeek: dow },
    include: {
      subject: { select: { id: true, name: true, color: true } },
      lectureRecords: {
        where: { date, userId: req.user.id },
        take: 1,
      },
    },
    orderBy: { startTime: 'asc' },
  });

  const result = slots.map((slot) => ({
    id: slot.id,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: slot.subject,
    record: slot.lectureRecords[0] || null,
  }));

  res.json({ date, dayOfWeek: dow, slots: result });
});

// ── GET /lectures/month-summary ─────────────────────────────────────────
router.get('/lectures/month-summary', async (req, res) => {
  const userId = req.user.id;
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const records = await prisma.lectureRecord.findMany({
    where: {
      userId,
      date: { startsWith: monthPrefix },
    },
    select: { date: true, status: true },
  });

  // Group by date
  const summaryByDate = {};
  for (const r of records) {
    if (!summaryByDate[r.date]) {
      summaryByDate[r.date] = { attended: 0, missed: 0, cancelled: 0 };
    }
    summaryByDate[r.date][r.status] = (summaryByDate[r.date][r.status] || 0) + 1;
  }

  res.json({ monthPrefix, summaryByDate });
});

// ── POST /lectures/mark-subject ────────────────────────────────────────────
router.post(
  '/lectures/mark-subject',
  [
    body('subjectId').isInt(),
    body('status').isIn(['attended', 'missed', 'cancelled']),
    body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { subjectId, status } = req.body;
    const userId = req.user.id;
    const date = req.body.date || getLocalDateString(req.body.tz ? Number(req.body.tz) : null);

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const record = await prisma.lectureRecord.create({
      data: {
        userId,
        subjectId,
        date,
        status,
      },
    });

    res.json({ record });
  }
);

// ── POST /lectures/:id/mark ───────────────────────────────────────────────
router.post(
  '/lectures/:id/mark',
  [
    param('id').isInt(),
    body('status').isIn(['attended', 'missed', 'cancelled']),
    body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const slotId = Number(req.params.id);
    const userId = req.user.id;
    const { status } = req.body;
    const date = req.body.date || getLocalDateString(req.body.tz ? Number(req.body.tz) : null);

    const slot = await prisma.timetableSlot.findFirst({ where: { id: slotId, userId } });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });

    const record = await prisma.lectureRecord.upsert({
      where: { userId_timetableSlotId_date: { userId, timetableSlotId: slotId, date } },
      update: { status },
      create: { userId, subjectId: slot.subjectId, timetableSlotId: slotId, date, status },
    });

    res.json({ record });
  }
);

module.exports = router;
