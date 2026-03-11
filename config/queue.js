import Bull from 'bull';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD;

const redisAuthPart = redisPassword ? `:${redisPassword}@` : '';
const redisUrl = `redis://${redisAuthPart}${redisHost}:${redisPort}`;

export const cvProcessingQueue = new Bull('cv-processing', redisUrl);

cvProcessingQueue.on('error', (err) => {
  console.error('Queue error:', err.message);
});
