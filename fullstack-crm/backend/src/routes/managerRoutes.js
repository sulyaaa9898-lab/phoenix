import { Router } from 'express';
import { z } from 'zod';
import { query, pool } from '../db.js';
import { getMatchingResources } from '../services/matchingService.js';

const router = Router();

const matchingSchema = z.object({
  language: z.string().min(1),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
});

const registrationSchema = z.object({
  fullName: z.string().min(2),
  languageFocus: z.string().min(1),
  currentLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  groupId: z.number().int().positive(),
  tariffId: z.number().int().positive(),
});

const attendanceSchema = z.object({
  studentId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  lessonDate: z.string().min(10),
  attended: z.boolean().default(true),
});

router.get('/matching-resources', async (req, res) => {
  try {
    const parsed = matchingSchema.parse({
      language: req.query.language,
      level: req.query.level,
    });

    const result = await getMatchingResources(parsed.language, parsed.level);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const data = registrationSchema.parse(req.body);
    await client.query('BEGIN');

    const studentInsert = await client.query(
      `
        INSERT INTO students (full_name, language_focus, current_level)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [data.fullName, data.languageFocus, data.currentLevel],
    );

    const student = studentInsert.rows[0];

    const tariffResult = await client.query(
      'SELECT id, total_lessons FROM tariffs WHERE id = $1',
      [data.tariffId],
    );

    if (!tariffResult.rows.length) {
      throw new Error('Тариф не найден');
    }

    await client.query(
      `
        INSERT INTO enrollments (student_id, group_id, tariff_id, status)
        VALUES ($1, $2, $3, 'active')
      `,
      [student.id, data.groupId, data.tariffId],
    );

    await client.query(
      `
        UPDATE students
        SET lessons_left = lessons_left + $1
        WHERE id = $2
      `,
      [tariffResult.rows[0].total_lessons, student.id],
    );

    await client.query('COMMIT');

    const finalStudent = await query('SELECT * FROM students WHERE id = $1', [student.id]);
    res.status(201).json(finalStudent.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/attendance', async (req, res) => {
  try {
    const data = attendanceSchema.parse(req.body);
    await query(
      `
        INSERT INTO attendance (student_id, group_id, lesson_date, attended)
        VALUES ($1, $2, $3, $4)
      `,
      [data.studentId, data.groupId, data.lessonDate, data.attended],
    );

    const student = await query('SELECT id, full_name, lessons_left FROM students WHERE id = $1', [data.studentId]);
    res.status(201).json(student.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
