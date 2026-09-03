/**
 * ApiService.js
 * Axios-based service that POSTs every ESP32 reading to the Node.js backend.
 *
 * Features:
 *  - Offline queue: failed POSTs are stored in AsyncStorage
 *  - Retry/flush: call flushOfflineQueue() when connectivity is restored
 *  - Queue is flushed automatically on every successful POST
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Config ───────────────────────────────────────────────────────────────────
// Replace YOUR_LOCAL_IP with your machine's LAN IP while developing,
// e.g. "192.168.1.42". In production, use the deployed server URL.
const BASE_URL = 'http://172.26.144.188:3000';
const OFFLINE_QUEUE_KEY = '@painreliefband:offlineQueue';
const MAX_QUEUE_SIZE = 500; // cap stored readings to avoid unbounded growth

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Offline Queue Helpers ────────────────────────────────────────────────────
async function loadQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue) {
  try {
    // Trim to max size before saving
    const trimmed = queue.slice(-MAX_QUEUE_SIZE);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[ApiService] saveQueue error:', err);
  }
}

async function enqueue(reading) {
  const queue = await loadQueue();
  queue.push({ ...reading, _queuedAt: Date.now() });
  await saveQueue(queue);
}

// ─── Core Methods ─────────────────────────────────────────────────────────────

/**
 * POST a single sensor reading to the backend.
 * On network failure, the reading is pushed to the offline queue.
 *
 * @param {Object} reading - ESP32 JSON payload
 * @returns {Promise<Object|null>} API response data, or null if queued offline
 */
async function postReading(reading) {
  try {
    const response = await api.post('/api/readings', reading);

    // On success, try to flush any previously queued readings
    flushOfflineQueue().catch(() => { }); // fire-and-forget

    return response.data;
  } catch (err) {
    const isNetworkError =
      !err.response || err.code === 'ECONNABORTED' || err.message === 'Network Error';

    if (isNetworkError) {
      console.warn('[ApiService] Offline — queueing reading');
      import('react-native').then(({ DeviceEventEmitter }) => {
        DeviceEventEmitter.emit('backendError', 'Backend is not connected');
      });
      await enqueue(reading);
    } else {
      // Server returned an error status — log but don't queue
      console.error('[ApiService] Server error:', err.response?.status, err.response?.data);
    }
    return null;
  }
}

/**
 * Attempt to send all queued offline readings to the backend.
 * Clears the queue incrementally as each item succeeds.
 * Safe to call even when still offline — failed items stay in the queue.
 *
 * @returns {Promise<{sent: number, failed: number}>}
 */
async function flushOfflineQueue() {
  const queue = await loadQueue();
  if (queue.length === 0) return { sent: 0, failed: 0 };

  console.log(`[ApiService] Flushing ${queue.length} offline readings...`);

  let sent = 0;
  const remaining = [];

  for (const reading of queue) {
    try {
      // Remove internal queue metadata before sending
      const { _queuedAt, ...payload } = reading;
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
 * @returns {Promise<number>}
 */
async function getQueueSize() {
  const queue = await loadQueue();
  return queue.length;
}

/**
 * Get the latest reading from the server for a specific device.
 * @param {string} deviceId
 * @returns {Promise<Object|null>}
 */
async function getLatestReading(deviceId) {
  try {
    const response = await api.get('/api/readings/latest', {
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
