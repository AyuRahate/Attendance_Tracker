const express = require('express');
const { body, param, validationResult } = require('express-validator');
const prisma = require('../db/database');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// ── GET /subjects ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const subjects = await prisma.subject.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ subjects });
});

// ── POST /subjects ────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Subject name is required'),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('target_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, color = '#6366f1', target_percent = null } = req.body;
    const trimmedName = name.trim();

    // Check for existing duplicate subject (case-insensitive) for this user
    const existing = await prisma.subject.findFirst({
      where: {
        userId: req.user.id,
        name: { equals: trimmedName },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `Subject "${trimmedName}" already exists` });
    }

    const subject = await prisma.subject.create({
      data: {
        userId: req.user.id,
        name: trimmedName,
        color,
        targetPercent: target_percent,
      },
    });
    res.status(201).json({ subject });
  }
);

// ── POST /subjects/deduplicate ───────────────────────────────────────────
router.post('/deduplicate', async (req, res) => {
  const userId = req.user.id;
  const allSubjects = await prisma.subject.findMany({
    where: { userId },
    orderBy: { id: 'asc' },
  });

  const grouped = {};
  for (const s of allSubjects) {
    const key = s.name.trim().toLowerCase();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  let removedCount = 0;
  let mergedGroupsCount = 0;

  for (const nameKey of Object.keys(grouped)) {
    const group = grouped[nameKey];
    if (group.length > 1) {
      mergedGroupsCount++;
      const master = group[0];
      const duplicateIds = group.slice(1).map((s) => s.id);

      await prisma.$transaction(async (tx) => {
        // Re-point timetable slots
        await tx.timetableSlot.updateMany({
          where: { subjectId: { in: duplicateIds } },
          data: { subjectId: master.id },
        });

        // Re-point lecture records
        await tx.lectureRecord.updateMany({
          where: { subjectId: { in: duplicateIds } },
          data: { subjectId: master.id },
        });

        // Delete duplicate subjects
        const deleted = await tx.subject.deleteMany({
          where: { id: { in: duplicateIds } },
        });
        removedCount += deleted.count;
      });
    }
  }

  const remaining = await prisma.subject.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    message: `Merged duplicates successfully. Removed ${removedCount} duplicate subject(s).`,
    removedCount,
    mergedGroupsCount,
    subjects: remaining,
  });
});

// ── PUT /subjects/:id ─────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt(),
    body('name').optional().trim().notEmpty(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('target_percent').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const subject = await prisma.subject.findFirst({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const updated = await prisma.subject.update({
      where: { id: subject.id },
      data: {
        name: req.body.name ?? subject.name,
        color: req.body.color ?? subject.color,
        targetPercent: req.body.target_percent !== undefined ? req.body.target_percent : subject.targetPercent,
      },
    });
    res.json({ subject: updated });
  }
);

// ── DELETE /subjects/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const subject = await prisma.subject.findFirst({
    where: { id: Number(req.params.id), userId: req.user.id },
  });
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  await prisma.subject.delete({ where: { id: subject.id } });
  res.json({ message: 'Subject deleted' });
});

module.exports = router;
