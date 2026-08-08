const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db/database');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ── GET /timetable ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const slots = await prisma.timetableSlot.findMany({
    where: { userId: req.user.id },
    include: { subject: { select: { name: true, color: true } } },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  res.json({ slots });
});

// ── POST /timetable ───────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('slots').isArray({ min: 1 }),
    body('slots.*.subject_id').isInt(),
    body('slots.*.day_of_week').isInt({ min: 0, max: 6 }),
    body('slots.*.start_time').matches(/^\d{2}:\d{2}$/),
    body('slots.*.end_time').matches(/^\d{2}:\d{2}$/),
    body('replaceAll').optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { slots, replaceAll = false } = req.body;
    const userId = req.user.id;

    // Verify all subjects belong to this user
    for (const slot of slots) {
      const subject = await prisma.subject.findFirst({
        where: { id: slot.subject_id, userId },
      });
      if (!subject) return res.status(403).json({ error: `Subject ${slot.subject_id} not found or not yours` });
    }

    await prisma.$transaction(async (tx) => {
      if (replaceAll) {
        await tx.timetableSlot.deleteMany({ where: { userId } });
      }
      for (const slot of slots) {
        await tx.timetableSlot.create({
          data: {
            userId,
            subjectId: slot.subject_id,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
          },
        });
      }
    });

    const updated = await prisma.timetableSlot.findMany({
      where: { userId },
      include: { subject: { select: { name: true, color: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.status(201).json({ slots: updated });
  }
);

// ── DELETE /timetable/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const slot = await prisma.timetableSlot.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id },
  });
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  await prisma.timetableSlot.delete({ where: { id: slot.id } });
  res.json({ message: 'Slot deleted' });
});

module.exports = router;
