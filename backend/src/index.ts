import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Money Tracker Backend is running' });
});

app.get('/api/transactions', (req, res) => {
  // TODO: Implement transaction endpoints
  res.json({ transactions: [] });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Money Tracker Backend running on http://localhost:${PORT}`);
});