import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { generateInviteToken, hashToken } from '../utils/security.js';

const router = Router();

const createCenterSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

router.post('/centers', async (req, res) => {
  try {
    const data = createCenterSchema.parse(req.body);
    const result = await query(
      `
        INSERT INTO education_centers (name, phone, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [data.name, data.phone || null, data.status || 'active'],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/centers', async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT id, name, phone, status, created_at, updated_at
        FROM education_centers
        ORDER BY created_at DESC
      `,
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/centers/:id/invite-owner', async (req, res) => {
  try {
    const centerId = req.params.id;
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
        VALUES ($1, 'center_owner', $2, now() + interval '7 days', $3)
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

export default router;
