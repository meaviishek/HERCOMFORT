/**
 * BluetoothService.js
 * Singleton wrapper around react-native-bluetooth-classic.
 *
 * Uses a polling interval to read data from the device, because the
 * onDataReceived event in react-native-bluetooth-classic can be unreliable
 * for streaming — availability() + read() is the recommended pattern.
 *
 * JSON is parsed with a resilient greedy-match so trailing serial garbage
 * like "json" won't cause dropped frames.
 */

import RNBluetoothClassic from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_DEVICE_KEY = '@painreliefband:lastDevice';
const POLL_INTERVAL_MS = 200; // check for new data every 200 ms

class BluetoothService {
  constructor() {
    this._device = null;
    this._dataBuffer = '';
    this._pollTimer = null;
    this._onDataCallback = null;
    this._onErrorCallback = null;
  }

  // ─── Permissions ─────────────────────────────────────────────────────────────

  async requestPermissions() {
    if (Platform.OS !== 'android') return true;
    const sdkInt = Platform.Version;
    try {
      if (sdkInt >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(results).every(
          (r) => r === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Required',
            message: 'Nari needs location access to discover Bluetooth devices.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('[BT] Permission error:', err);
      return false;
    }
  }

  // ─── Bluetooth State ─────────────────────────────────────────────────────────

  async isEnabled() {
    try {
      return await RNBluetoothClassic.isBluetoothEnabled();
    } catch {
      return false;
    }
  }

  async enableBluetooth() {
    try {
      return await RNBluetoothClassic.requestBluetoothEnabled();
    } catch (err) {
      console.warn('[BT] Enable BT error:', err);
      return false;
    }
  }

  // ─── Device Discovery ────────────────────────────────────────────────────────

  async getPairedDevices() {
    try {
      const devices = await RNBluetoothClassic.getBondedDevices();
      return devices || [];
    } catch (err) {
      console.warn('[BT] getPairedDevices error:', err);
      return [];
    }
  }

  async startDiscovery() {
    try {
      const discovered = await RNBluetoothClassic.startDiscovery();
      return discovered || [];
    } catch (err) {
      console.warn('[BT] startDiscovery error:', err);
      return [];
    }
  }

  async stopDiscovery() {
    try {
      await RNBluetoothClassic.cancelDiscovery();
    } catch {
      // ignore
    }
  }

  // ─── Connection ──────────────────────────────────────────────────────────────

  async connect(address) {
    try {
      if (this._device) {
        await this.disconnect();
      }
      console.log('[BT] Connecting to', address);
      const device = await RNBluetoothClassic.connectToDevice(address);
      this._device = device;
      console.log('[BT] Connected to', device.name);
      await AsyncStorage.setItem(
        LAST_DEVICE_KEY,
        JSON.stringify({ address, name: device.name || address })
      );
      return device;
    } catch (err) {
      console.error('[BT] connect error:', err);
      throw err;
    }
  }

  async disconnect() {
    try {
      this._stopPolling();
      if (this._device) {
        await this._device.disconnect();
        this._device = null;
      }
    } catch (err) {
      console.warn('[BT] disconnect error:', err);
      this._device = null;
    }
  }

  isConnected() {
    return this._device !== null;
  }

  getConnectedDevice() {
    return this._device;
  }

  // ─── Auto-reconnect ──────────────────────────────────────────────────────────

  async getLastDevice() {
    try {
      const raw = await AsyncStorage.getItem(LAST_DEVICE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async autoReconnect() {
    const last = await this.getLastDevice();
    if (!last?.address) return null;
    try {
      return await this.connect(last.address);
    } catch {
      return null;
    }
  }

  // ─── JSON parsing helper ─────────────────────────────────────────────────────

  /**
   * Try to extract and parse all { ... } JSON objects from a string.
   * Handles partial frames by returning leftover suffix.
   * Returns { objects: [...], remaining: string }
   */
  _extractJsonObjects(str) {
    const objects = [];
    let remaining = str;

    while (true) {
      // Find start of a JSON object
      const start = remaining.indexOf('{');
      if (start === -1) {
        // No opening brace — discard everything before any potential next frame
        remaining = '';
        break;
      }

      // Find the matching closing brace
      let depth = 0;
      let end = -1;
      for (let i = start; i < remaining.length; i++) {
        if (remaining[i] === '{') depth++;
        else if (remaining[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }

      if (end === -1) {
        // Incomplete object — keep from the opening brace onward in buffer
        remaining = remaining.slice(start);
        break;
      }

      // We have a complete { ... } span
      const candidate = remaining.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        objects.push(parsed);
      } catch {
        // Malformed — skip this span and continue
        console.warn('[BT] Malformed JSON span skipped:', candidate.slice(0, 60));
      }

      // Move past this object
      remaining = remaining.slice(end + 1);
    }

    return { objects, remaining };
  }

  // ─── Data Streaming — polling approach ───────────────────────────────────────

  /**
   * Start polling the connected device for data every POLL_INTERVAL_MS ms.
   * @param {function(Object): void} onData
   * @param {function(Error): void} [onError]
   */
  startListening(onData, onError) {
    if (!this._device) {
      console.warn('[BT] Cannot listen — no device connected.');
      return;
    }

    this._stopPolling();
    this._dataBuffer = '';
    this._onDataCallback = onData;
    this._onErrorCallback = onError;

    console.log('[BT] Starting data poll at', POLL_INTERVAL_MS, 'ms intervals');

    this._pollTimer = setInterval(async () => {
      try {
        if (!this._device) {
          this._stopPolling();
          return;
        }

        // Check how many bytes are available
        const available = await this._device.available();
        if (!available || available <= 0) return;

        // Read all available data as a string
        const chunk = await this._device.read();
        if (!chunk) return;

        console.log('[BT] Raw chunk received:', chunk.slice(0, 80));

        // Append to buffer and extract complete JSON objects
        this._dataBuffer += chunk;
        const { objects, remaining } = this._extractJsonObjects(this._dataBuffer);
        this._dataBuffer = remaining;

        for (const obj of objects) {
          console.log('[BT] Parsed frame:', JSON.stringify(obj));
          this._onDataCallback(obj);
        }
      } catch (err) {
        const msg = err.message || String(err);
        // "Not connected" means the device dropped — stop polling immediately
        if (msg.includes('Not connected') || msg.includes('not connected')) {
          console.log('[BT] Device disconnected — stopping poll.');
          this._stopPolling();
          if (this._onErrorCallback) {
            this._onErrorCallback(new Error('Device disconnected'));
          }
        } else {
          console.warn('[BT] Poll read error:', msg);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._dataBuffer = '';
    this._onDataCallback = null;
    this._onErrorCallback = null;
  }

  // ─── Command Sending ─────────────────────────────────────────────────────────

  /**
   * Send a JSON command to the ESP32.
   * Supported shapes:
   *   { mode: 'auto' | 'manual' }
   *   { motor: 0 | 1 }
   *   { heater: 0 | 1 }
   */
  async sendCommand(commandObj) {
    if (!this._device) {
      throw new Error('No device connected');
    }
    try {
      const payload = JSON.stringify(commandObj) + '\n';
      console.log('[BT] Sending command:', payload.trim());
      await this._device.write(payload);
      return true;
    } catch (err) {
      console.error('[BT] sendCommand error:', err);
      throw err;
    }
  }
}

export default new BluetoothService();
