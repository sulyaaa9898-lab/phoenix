import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';

const router = Router();

const tariffSchema = z.object({
  courseId: z.number().int().positive(),
  price: z.number().nonnegative(),
  totalLessons: z.number().int().positive(),
});

const teacherSchema = z.object({
  fullName: z.string().min(2),
  languages: z.array(z.string()).min(1),
  levels: z.array(z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])).min(1),
  workSchedule: z.record(z.array(z.object({ start: z.string(), end: z.string() }))),
});

const roomSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().positive(),
});

router.post('/tariffs', async (req, res) => {
  try {
    const { centerId } = req.authContext;
    const data = tariffSchema.parse(req.body);

    const courseExists = await query('SELECT id FROM courses WHERE id = $1 AND center_id = $2', [data.courseId, centerId]);
    if (!courseExists.rows.length) {
      return res.status(404).json({ error: 'Курс не найден в текущем центре' });
    }

    const result = await query(
      `
        INSERT INTO tariffs (center_id, course_id, price, total_lessons)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [centerId, data.courseId, data.price, data.totalLessons],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/teachers', async (req, res) => {
  try {
    const { centerId } = req.authContext;
    const data = teacherSchema.parse(req.body);
    const result = await query(
      `
        INSERT INTO teachers (center_id, full_name, languages, levels, work_schedule)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING *
      `,
      [centerId, data.fullName, data.languages, data.levels, JSON.stringify(data.workSchedule)],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { centerId } = req.authContext;
    const data = roomSchema.parse(req.body);
    const result = await query(
      `
        INSERT INTO rooms (center_id, name, capacity)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [centerId, data.name, data.capacity],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/snapshot', async (_req, res) => {
  try {
    const { centerId } = _req.authContext;
    const [courses, tariffs, teachers, rooms] = await Promise.all([
      query('SELECT * FROM courses WHERE center_id = $1 ORDER BY id DESC', [centerId]),
      query('SELECT * FROM tariffs WHERE center_id = $1 ORDER BY id DESC', [centerId]),
      query('SELECT * FROM teachers WHERE center_id = $1 ORDER BY id DESC', [centerId]),
      query('SELECT * FROM rooms WHERE center_id = $1 ORDER BY id DESC', [centerId]),
    ]);

    res.json({
      courses: courses.rows,
      tariffs: tariffs.rows,
      teachers: teachers.rows,
      rooms: rooms.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
