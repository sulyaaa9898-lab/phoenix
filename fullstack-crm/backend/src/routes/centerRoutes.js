import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireCenterAccess, requireRole } from '../middleware/authContext.js';
import { generateInviteToken, hashToken } from '../utils/security.js';

const router = Router();

const periodSchema = z.object({
  periodDays: z.coerce.number().int().positive().max(365).default(30),
});

router.post('/:centerId/invite-manager', requireRole('center_owner', 'platform_owner'), requireCenterAccess('centerId'), async (req, res) => {
  try {
    const centerId = req.params.centerId;
    const createdBy = req.authContext.userId;

    const centerExists = await query('SELECT id FROM education_centers WHERE id = $1', [centerId]);
    if (!centerExists.rows.length) {
      return res.status(404).json({ error: 'Центр не найден' });
    }

    const rawToken = generateInviteToken();
    const tokenHash = hashToken(rawToken);

    await query(
      `
        INSERT INTO invites (center_id, role_to_assign, token_hash, expires_at, created_by_user_id)
        VALUES ($1, 'manager', $2, now() + interval '7 days', $3)
      `,
      [centerId, tokenHash, createdBy],
    );

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const activationLink = `${baseUrl}/activate?token=${rawToken}`;

    return res.status(201).json({ activationLink, expiresIn: '7 days' });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get('/:centerId/managers', requireRole('center_owner', 'platform_owner'), requireCenterAccess('centerId'), async (req, res) => {
  try {
    const centerId = req.params.centerId;
    const result = await query(
      `
        SELECT u.id, u.name, u.email, u.created_at
        FROM user_center_roles ucr
        INNER JOIN users u ON u.id = ucr.user_id
        WHERE ucr.center_id = $1
          AND ucr.role = 'manager'
        ORDER BY u.created_at DESC
      `,
      [centerId],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:centerId/analytics/overview', requireRole('center_owner', 'platform_owner'), requireCenterAccess('centerId'), async (req, res) => {
  try {
    const centerId = req.params.centerId;
    const { periodDays } = periodSchema.parse(req.query);

    const [totalStudents, newStudents, renewals] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM students WHERE center_id = $1', [centerId]),
      query(`SELECT COUNT(*)::int AS count FROM students WHERE center_id = $1 AND created_at >= now() - ($2::text || ' days')::interval`, [centerId, periodDays]),
      query(`SELECT COUNT(*)::int AS count FROM business_events WHERE center_id = $1 AND event_type = 'student_renewed' AND created_at >= now() - ($2::text || ' days')::interval`, [centerId, periodDays]),
    ]);

    res.json({
      total_students: totalStudents.rows[0]?.count || 0,
      new_students: newStudents.rows[0]?.count || 0,
      renewals: renewals.rows[0]?.count || 0,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:centerId/analytics/managers', requireRole('center_owner', 'platform_owner'), requireCenterAccess('centerId'), async (req, res) => {
  try {
    const centerId = req.params.centerId;
    const { periodDays } = periodSchema.parse(req.query);

    const result = await query(
      `
        SELECT
          u.id AS user_id,
          u.name,
          COUNT(DISTINCT s.id)::int AS students_registered,
          COUNT(DISTINCT be_renew.id)::int AS renewals,
          COUNT(DISTINCT be_all.id)::int AS activity_count
        FROM user_center_roles ucr
        INNER JOIN users u ON u.id = ucr.user_id
        LEFT JOIN students s
          ON s.center_id = ucr.center_id
         AND s.created_by_user_id = u.id
         AND s.created_at >= now() - ($2::text || ' days')::interval
        LEFT JOIN business_events be_renew
          ON be_renew.center_id = ucr.center_id
         AND be_renew.user_id = u.id
         AND be_renew.event_type = 'student_renewed'
         AND be_renew.created_at >= now() - ($2::text || ' days')::interval
        LEFT JOIN business_events be_all
          ON be_all.center_id = ucr.center_id
         AND be_all.user_id = u.id
         AND be_all.created_at >= now() - ($2::text || ' days')::interval
        WHERE ucr.center_id = $1
          AND ucr.role = 'manager'
        GROUP BY u.id, u.name
        ORDER BY u.name ASC
      `,
      [centerId, periodDays],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
