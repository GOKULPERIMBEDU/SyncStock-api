import dotenv from 'dotenv';

dotenv.config();

function read(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: read('NODE_ENV', 'development'),
  port: Number(read('PORT', '5000')),
  mongodbUri: read('MONGODB_URI'),
  corsOrigin: read('CORS_ORIGIN', 'http://localhost:5173'),
  smtp: {
    host: read('SMTP_HOST'),
    port: Number(read('SMTP_PORT', '587')),
    user: read('SMTP_USER'),
    pass: read('SMTP_PASS'),
    from: read('SMTP_FROM'),
  },
  alertReceiverEmail: read('ALERT_RECEIVER_EMAIL'),
  jwtSecret: read('JWT_SECRET', 'syncstock-dev-secret-change-me'),
  jwtExpiresIn: read('JWT_EXPIRES_IN', '7d'),
  clientUrl: read('CLIENT_URL', 'http://localhost:5173'),
};

export function assertRequiredEnv(): void {
  if (!env.mongodbUri || env.mongodbUri.includes('<LEAVE_BLANK_FOR_ME>')) {
    throw new Error('MONGODB_URI is required. Copy .env.example to .env and fill it in.');
  }
}
