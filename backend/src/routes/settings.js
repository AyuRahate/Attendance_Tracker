const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../db/database');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const settings = await prisma.attendanceSettings.findUnique({ where: { userId: req.user.id } });
  res.json({ settings });
});

router.put(
  '/',
  [
    body('mode').optional().isIn(['overall', 'per_subject']),
    body('default_target_percent').optional().isFloat({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const data = {};
    if (req.body.mode !== undefined) data.mode = req.body.mode;
    if (req.body.default_target_percent !== undefined) data.defaultTargetPercent = req.body.default_target_percent;

    const settings = await prisma.attendanceSettings.update({
      where: { userId: req.user.id },
      data,
    });
    res.json({ settings });
  }
);

module.exports = router;
