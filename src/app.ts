import express, { Application } from "express";
import cors from 'cors';
import helmet from 'helmet';
import ordersRouter from "./routes/orders";
import authRouter from "./routes/authRoute";
import webhookRouter from "./routes/webhooks";
import { errorHandler, securityHeaders } from './auth/auth';
import connectDB from './config/databaseConnection';

const app: Application = express();

// connect to mongodb database
connectDB();

// security middleware for production deployment
app.use(helmet());
app.use(securityHeaders);

// cors configuration for cross-origin requests - UPDATED FOR FRONTEND
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', // added this cuz reactjs is running on port 3001
    ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-correlation-id']
}));

// parse json payloads with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// api route handlers
app.use("/orders", ordersRouter);
app.use("/auth", authRouter);
app.use("/webhooks", webhookRouter);

// global error handling middleware
app.use(errorHandler);

export default app;