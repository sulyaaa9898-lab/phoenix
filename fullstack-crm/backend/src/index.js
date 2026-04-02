import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ownerRoutes from './routes/ownerRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import authRoutes from './routes/authRoutes.js';
import centerRoutes from './routes/centerRoutes.js';
import { authContextMiddleware, requireRole } from './middleware/authContext.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());
app.use(authContextMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/platform', requireRole('platform_owner'), platformRoutes);
app.use('/api/center', centerRoutes);
app.use('/api/owner', requireRole('center_owner', 'platform_owner'), ownerRoutes);
app.use('/api/manager', requireRole('manager', 'center_owner', 'platform_owner'), managerRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Internal error' });
});

app.listen(port, () => {
  console.log(`CRM backend listening on http://localhost:${port}`);
});
