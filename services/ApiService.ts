/**
 * ApiService.ts
 * Axios-based service that POSTs every ESP32 reading to the Node.js backend.
 *
 * Features:
 *  - Offline queue: failed POSTs are stored in AsyncStorage
 *  - Retry/flush: call flushOfflineQueue() when connectivity is restored
 *  - Queue is flushed automatically on every successful POST
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface SensorReading {
  deviceId: string;
  temp: number;
  temperature?: number;
  bpm: number;
  gx?: number;
  gy?: number;
  gz?: number;
  motor?: boolean;
  heater?: boolean;
  led?: boolean;
  raw_analog?: number;
  system_active?: boolean;
  beat_detected?: boolean;
  autoMode?: boolean;
  active?: boolean;
  sensorError?: boolean;
  timestamp?: number;
  [key: string]: any;
}

interface QueuedReading extends SensorReading {
  _queuedAt: number;
}

interface FlushResult {
  sent: number;
  failed: number;
}

// ─── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.26.144.188:3000';
const OFFLINE_QUEUE_KEY = '@painreliefband:offlineQueue';
const MAX_QUEUE_SIZE = 500;

// ─── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Offline Queue Helpers ─────────────────────────────────────────────────────
async function loadQueue(): Promise<QueuedReading[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedReading[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedReading[]): Promise<void> {
  try {
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[ApiService] saveQueue error:', err);
  }
}

async function enqueue(reading: SensorReading): Promise<void> {
  const queue = await loadQueue();
  queue.push({ ...reading, _queuedAt: Date.now() });
  await saveQueue(queue);
}

// ─── Core Methods ──────────────────────────────────────────────────────────────

/**
 * POST a single sensor reading to the backend.
 * On network failure, the reading is pushed to the offline queue.
 */
async function postReading(reading: SensorReading): Promise<unknown | null> {
  try {
    const response = await api.post('/api/readings', reading);
    flushOfflineQueue().catch(() => {});
    return response.data;
  } catch (err) {
    const axiosErr = err as { response?: unknown; code?: string; message?: string };
    const isNetworkError =
      !axiosErr.response ||
      axiosErr.code === 'ECONNABORTED' ||
      axiosErr.message === 'Network Error';

    if (isNetworkError) {
      console.warn('[ApiService] Offline — queueing reading');
      import('react-native').then(({ DeviceEventEmitter }) => {
        DeviceEventEmitter.emit('backendError', 'Backend is not connected');
      });
      await enqueue(reading);
    } else {
      const e = err as { response?: { status?: number; data?: unknown } };
      console.error('[ApiService] Server error:', e.response?.status, e.response?.data);
    }
    return null;
  }
}

/**
 * Attempt to send all queued offline readings to the backend.
 */
async function flushOfflineQueue(): Promise<FlushResult> {
  const queue = await loadQueue();
  if (queue.length === 0) return { sent: 0, failed: 0 };

  console.log(`[ApiService] Flushing ${queue.length} offline readings...`);

  let sent = 0;
  const remaining: QueuedReading[] = [];

  for (const reading of queue) {
    try {
      const { _queuedAt, ...payload } = reading;
      void _queuedAt; // consumed — suppress unused var lint
      await api.post('/api/readings', payload);
      sent++;
    } catch {
      remaining.push(reading);
    }
  }

  await saveQueue(remaining);
  console.log(`[ApiService] Flush complete — sent: ${sent}, failed: ${remaining.length}`);
  return { sent, failed: remaining.length };
}

/**
 * Get the current count of queued offline readings.
 */
async function getQueueSize(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

/**
 * Get the latest reading from the server for a specific device.
 */
async function getLatestReading(deviceId: string): Promise<SensorReading | null> {
  try {
    const response = await api.get<{ data: SensorReading }>('/api/readings/latest', {
      params: { deviceId },
    });
    return response.data?.data || null;
  } catch {
    return null;
  }
}

export default {
  postReading,
  flushOfflineQueue,
  getQueueSize,
  getLatestReading,
};
