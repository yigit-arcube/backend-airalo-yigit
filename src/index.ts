import app from './app';
import 'dotenv/config';


const PORT = process.env.PORT || 3000;

// start server with graceful shutdown handling
const server = app.listen(PORT, () => {
  console.log(`arcube cancellation service running on port ${PORT}`);
  console.log(`health check: http://localhost:${PORT}/orders/health`);
  console.log(`readiness check: http://localhost:${PORT}/orders/ready`);
});

// graceful shutdown handling for production deployment
process.on('SIGTERM', () => {
  console.log('sigterm received, shutting down gracefully');
  server.close(() => {
    console.log('server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('sigint received, shutting down gracefully');
  server.close(() => {
    console.log('server closed');
    process.exit(0);
  });
});

// handle uncaught exceptions in production
process.on('uncaughtException', (err) => {
  console.error('uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default server;