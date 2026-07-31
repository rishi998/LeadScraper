import dns from 'node:dns';
import mongoose, { type Connection } from 'mongoose';

let connecting: Promise<typeof mongoose> | null = null;

export function prepareMongoDns(): void {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    /* Node < 17 */
  }
  try {
    // Do not keep 127.0.0.1 / link-local resolvers — they often refuse SRV (mongodb+srv).
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  } catch {
    /* ignore */
  }
}

export function mongoConnectOptions() {
  return {
    dbName: process.env.MONGODB_DB_NAME || undefined,
    family: 4 as const,
    serverSelectionTimeoutMS: 20_000,
  };
}

export async function connectMongo(uri = process.env.MONGODB_URI): Promise<typeof mongoose> {
  prepareMongoDns();
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connecting) {
    connecting = mongoose.connect(uri, mongoConnectOptions());
  }
  try {
    await connecting;
    await Promise.all(
      mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()),
    ).catch(() => undefined);
    return mongoose;
  } finally {
    connecting = null;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getConnection(): Connection {
  return mongoose.connection;
}

export { mongoose };
