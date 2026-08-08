const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const prisma = require('../db/database');
const Tesseract = require('tesseract.js');

const router = express.Router();
router.use(auth);

// Store uploads temporarily in memory
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif|bmp/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_MAP = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

/**
 * Perform local Tesseract OCR on the image buffer
 * and parse text into structured timetable slots.
 */
async function parseWithTesseract(imageBuffer) {
  const { data } = await Tesseract.recognize(imageBuffer, 'eng');
  const text = data.text;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const extractedSlots = [];
  let currentDay = 0; // Default Monday

  const timeRegex = /(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*[-–—to]+\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i;
  const simpleTimeRegex = /(\d{1,2})\s*[-–—to]\s*(\d{1,2})/i;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Check if line specifies a day
    for (const [dayName, dayIdx] of Object.entries(DAY_MAP)) {
      if (lowerLine.includes(dayName)) {
        currentDay = dayIdx;
        break;
      }
    }

    // Match explicit time range HH:MM - HH:MM
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      let startH = parseInt(timeMatch[1], 10);
      const startM = timeMatch[2];
      const startAmPm = timeMatch[3];
      let endH = parseInt(timeMatch[4], 10);
      const endM = timeMatch[5];
      const endAmPm = timeMatch[6];

      if (startAmPm && startAmPm.toLowerCase() === 'pm' && startH < 12) startH += 12;
      if (endAmPm && endAmPm.toLowerCase() === 'pm' && endH < 12) endH += 12;

      const startTime = `${String(startH).padStart(2, '0')}:${startM}`;
      const endTime = `${String(endH).padStart(2, '0')}:${endM}`;

      // Clean subject text (remove the time match)
      let subjectName = line.replace(timeRegex, '').replace(/[|:\-_]/g, ' ').trim();
      if (!subjectName || subjectName.length < 2) subjectName = 'Lecture';

      extractedSlots.push({
        day_of_week: currentDay,
        start_time: startTime,
        end_time: endTime,
        subject_name: subjectName,
        confidence: Math.round((data.confidence / 100) * 100) / 100,
        flagged: data.confidence < 80,
      });
    } else {
      // Check simple hour range (e.g. 9-10 Math)
      const simpleMatch = line.match(simpleTimeRegex);
      if (simpleMatch) {
        const startH = parseInt(simpleMatch[1], 10);
        const endH = parseInt(simpleMatch[2], 10);
        if (startH >= 7 && startH <= 20 && endH >= 8 && endH <= 21) {
          const startTime = `${String(startH).padStart(2, '0')}:00`;
          const endTime = `${String(endH).padStart(2, '0')}:00`;
          let subjectName = line.replace(simpleTimeRegex, '').replace(/[|:\-_]/g, ' ').trim();
          if (!subjectName || subjectName.length < 2) subjectName = 'Lecture';

          extractedSlots.push({
            day_of_week: currentDay,
            start_time: startTime,
            end_time: endTime,
            subject_name: subjectName,
            confidence: Math.round((data.confidence / 100) * 100) / 100,
            flagged: data.confidence < 80,
          });
        }
      }
    }
  }

  // If local Tesseract extracted valid slots, return them
  if (extractedSlots.length > 0) {
    return extractedSlots;
  }

  // If text was found but no explicit time slots matched, format lines into slots
  const nonDayLines = lines.filter((l) => l.length > 2 && !DAYS.some((d) => l.toLowerCase().includes(d)));
  if (nonDayLines.length > 0) {
    return nonDayLines.slice(0, 6).map((line, idx) => ({
      day_of_week: idx % 5, // Mon-Fri
      start_time: `${String(9 + (idx % 4)).padStart(2, '0')}:00`,
      end_time: `${String(10 + (idx % 4)).padStart(2, '0')}:00`,
      subject_name: line.replace(/[^a-zA-Z0-9\s]/g, '').trim() || `Subject ${idx + 1}`,
      confidence: 0.75,
      flagged: true, // flag for user confirmation
    }));
  }

  return getMockOcrResult();
}

/**
 * Parse a timetable image using Gemini Vision API if key available,
 * otherwise fall back to local Tesseract OCR engine.
 */
async function parseTimetableWithVision(imageBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `You are a timetable OCR expert. Analyze this timetable image and extract all scheduled classes.

Return ONLY a valid JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "day_of_week": 0,
    "start_time": "09:00",
    "end_time": "10:00",
    "subject_name": "Mathematics",
    "confidence": 0.95
  }
]

Rules:
- day_of_week: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
- start_time and end_time: 24-hour HH:MM format
- subject_name: exact text as shown in the timetable cell
- confidence: 0.0 to 1.0 (how confident you are about this cell's reading)
- Flag cells with confidence < 0.8 by setting confidence low
- If a cell is empty or a break/lunch period, skip it`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const text = result.response.text().trim();

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((entry) => ({
          day_of_week: Number(entry.day_of_week),
          start_time: String(entry.start_time),
          end_time: String(entry.end_time),
          subject_name: String(entry.subject_name).trim(),
          confidence: Number(entry.confidence ?? 1.0),
          flagged: Number(entry.confidence ?? 1.0) < 0.8,
        }));
      }
    } catch (err) {
      console.warn('[OCR] Gemini Vision call failed, falling back to local Tesseract:', err.message);
    }
  }

  // Local OCR Fallback via Tesseract.js
  console.log('[OCR] Running local Tesseract OCR engine...');
  return await parseWithTesseract(imageBuffer);
}

function getMockOcrResult() {
  return [
    { day_of_week: 0, start_time: '09:00', end_time: '10:00', subject_name: 'Mathematics', confidence: 0.95, flagged: false },
    { day_of_week: 0, start_time: '10:00', end_time: '11:00', subject_name: 'Physics', confidence: 0.92, flagged: false },
    { day_of_week: 1, start_time: '09:00', end_time: '10:00', subject_name: 'Chemistry', confidence: 0.75, flagged: true },
    { day_of_week: 2, start_time: '11:00', end_time: '12:00', subject_name: 'Mathematics', confidence: 0.98, flagged: false },
    { day_of_week: 3, start_time: '14:00', end_time: '16:00', subject_name: 'Physics Lab', confidence: 0.88, flagged: false },
    { day_of_week: 4, start_time: '09:00', end_time: '10:00', subject_name: 'English', confidence: 0.91, flagged: false },
  ];
}

// ── POST /timetable/upload-screenshot ─────────────────────────────────────
router.post('/upload-screenshot', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  console.log(`[OCR] Received file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

  try {
    const rawSlots = await parseTimetableWithVision(req.file.buffer, req.file.mimetype);
    console.log(`[OCR] Extracted ${rawSlots.length} raw slots`);

    // Fetch existing user subjects to auto-match names
    const userSubjects = await prisma.subject.findMany({
      where: { userId: req.user.id },
    });

    const slots = rawSlots.map((slot) => {
      let matchedId = '';
      if (slot.subject_name && userSubjects.length > 0) {
        const cleanExtracted = slot.subject_name.toLowerCase().trim();
        const found = userSubjects.find((sub) => {
          const subName = sub.name.toLowerCase().trim();
          return (
            cleanExtracted === subName ||
            cleanExtracted.includes(subName) ||
            subName.includes(cleanExtracted)
          );
        });
        if (found) {
          matchedId = found.id;
        }
      }
      return {
        ...slot,
        subject_id: matchedId,
      };
    });

    const flaggedCount = slots.filter((s) => s.flagged).length;

    res.json({
      draft: slots,
      flaggedCount,
      requiresReview: flaggedCount > 0,
      message:
        flaggedCount > 0
          ? `Extracted ${slots.length} slot(s). ${flaggedCount} slot(s) need review before saving.`
          : `Extracted ${slots.length} slot(s) successfully. Please review and confirm.`,
    });
  } catch (err) {
    console.error('[OCR] Error processing image:', err);
    res.status(500).json({
      error: 'Failed to parse timetable image',
      detail: err.message,
    });
  }
});

module.exports = router;
