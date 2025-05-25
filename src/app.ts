import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes from './routes/userRoutes';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import reviewRoutes from './routes/reviews';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple logging
app.use((req: Request, res: Response, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);         // user CRUD & auth
app.use('/api/products', productRoutes);   // buyer product browsing
app.use('/api/cart', cartRoutes);          // buyer cart management
app.use('/api/orders', orderRoutes);       // buyer orders
app.use('/api/reviews', reviewRoutes);     // product reviews

// Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to Nustaka API',
    version: '1.0.0'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;
