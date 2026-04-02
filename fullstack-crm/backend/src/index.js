import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ownerRoutes from './routes/ownerRoutes.js';
import managerRoutes from './routes/managerRoutes.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/owner', ownerRoutes);
app.use('/api/manager', managerRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || 'Internal error' });
});

app.listen(port, () => {
  console.log(`CRM backend listening on http://localhost:${port}`);
});
