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
    const { centerId } = req.authContext;
    const parsed = matchingSchema.parse({
      language: req.query.language,
      level: req.query.level,
    });

    const result = await getMatchingResources(parsed.language, parsed.level, centerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  const client = await pool.connect();
  try {
    const { centerId, userId } = req.authContext;
    const data = registrationSchema.parse(req.body);
    await client.query('BEGIN');

    const studentInsert = await client.query(
      `
        INSERT INTO students (center_id, full_name, language_focus, current_level, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [centerId, data.fullName, data.languageFocus, data.currentLevel, userId],
    );

    const student = studentInsert.rows[0];

    const tariffResult = await client.query(
      'SELECT id, total_lessons FROM tariffs WHERE id = $1 AND center_id = $2',
      [data.tariffId, centerId],
    );

    if (!tariffResult.rows.length) {
      throw new Error('Тариф не найден');
    }

    const groupResult = await client.query(
      'SELECT id FROM groups WHERE id = $1 AND center_id = $2',
      [data.groupId, centerId],
    );

    if (!groupResult.rows.length) {
      throw new Error('Группа не найдена');
    }

    await client.query(
      `
        INSERT INTO enrollments (center_id, student_id, group_id, tariff_id, created_by_user_id, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
      `,
      [centerId, student.id, data.groupId, data.tariffId, userId],
    );

    await client.query(
      `
        UPDATE students
        SET lessons_left = lessons_left + $1
        WHERE id = $2
          AND center_id = $3
      `,
      [tariffResult.rows[0].total_lessons, student.id, centerId],
    );

    await client.query(
      `
        INSERT INTO business_events (center_id, user_id, event_type, entity_type, entity_id, payload)
        VALUES ($1, $2, 'student_registered', 'student', $3::text, $4::jsonb)
      `,
      [centerId, userId, String(student.id), JSON.stringify({ groupId: data.groupId, tariffId: data.tariffId })],
    );

    await client.query('COMMIT');

    const finalStudent = await query('SELECT * FROM students WHERE id = $1 AND center_id = $2', [student.id, centerId]);
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
    const { centerId, userId } = req.authContext;
    const data = attendanceSchema.parse(req.body);

    const enrollmentCheck = await query(
      `
        SELECT 1
        FROM enrollments
        WHERE center_id = $1
          AND student_id = $2
          AND group_id = $3
          AND status = 'active'
        LIMIT 1
      `,
      [centerId, data.studentId, data.groupId],
    );

    if (!enrollmentCheck.rows.length) {
      return res.status(400).json({ error: 'Нет активного зачисления для указанного ученика и группы' });
    }

    await query(
      `
        INSERT INTO attendance (center_id, student_id, group_id, lesson_date, attended, created_by_user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [centerId, data.studentId, data.groupId, data.lessonDate, data.attended, userId],
    );

    await query(
      `
        INSERT INTO business_events (center_id, user_id, event_type, entity_type, entity_id, payload)
        VALUES ($1, $2, 'attendance_marked', 'attendance', $3, $4::jsonb)
      `,
      [
        centerId,
        userId,
        `${data.studentId}:${data.groupId}:${data.lessonDate}`,
        JSON.stringify({ attended: data.attended }),
      ],
    );

    const student = await query(
      'SELECT id, full_name, lessons_left FROM students WHERE id = $1 AND center_id = $2',
      [data.studentId, centerId],
    );
    res.status(201).json(student.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
