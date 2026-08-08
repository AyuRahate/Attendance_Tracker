const express = require('express');
const prisma = require('../db/database');
const auth = require('../middleware/auth');
const { getOverallSummary } = require('../engine/attendanceEngine');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const userId = req.user.id;

  const settings = await prisma.attendanceSettings.findUnique({ where: { userId } });

  const subjects = await prisma.subject.findMany({
    where: { userId },
    include: {
      lectureRecords: { select: { status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const subjectsWithRecords = subjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    color: s.color,
    targetPercent: s.targetPercent,
    records: s.lectureRecords,
  }));

  const summary = getOverallSummary(
    subjectsWithRecords,
    settings.mode,
    settings.defaultTargetPercent
  );

  res.json({ settings, ...summary });
});

module.exports = router;
