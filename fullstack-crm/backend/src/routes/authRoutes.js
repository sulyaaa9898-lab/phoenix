import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { hashPassword, hashToken } from '../utils/security.js';

const router = Router();

const activateSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(2),
  password: z.string().min(6),
  email: z.string().email().optional(),
});

router.post('/activate', async (req, res) => {
  const client = await pool.connect();

  try {
    const data = activateSchema.parse(req.body);
    const tokenHash = hashToken(data.token);

    await client.query('BEGIN');

    const inviteResult = await client.query(
      `
        SELECT id, center_id, role_to_assign
        FROM invites
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        LIMIT 1
      `,
      [tokenHash],
    );

    if (!inviteResult.rows.length) {
      throw new Error('Инвайт недействителен или просрочен');
    }

    const invite = inviteResult.rows[0];

    const userResult = await client.query(
      `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at
      `,
      [data.name, data.email || null, hashPassword(data.password)],
    );

    const user = userResult.rows[0];

    await client.query(
      `
        INSERT INTO user_center_roles (user_id, center_id, role)
        VALUES ($1, $2, $3)
      `,
      [user.id, invite.center_id, invite.role_to_assign],
    );

    await client.query(
      `
        UPDATE invites
        SET used_at = now()
        WHERE id = $1
      `,
      [invite.id],
    );

    await client.query('COMMIT');

    res.status(201).json({
      user,
      role: invite.role_to_assign,
      centerId: invite.center_id,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
