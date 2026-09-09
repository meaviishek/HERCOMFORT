/**
 * BluetoothService.ts
 * Singleton wrapper around react-native-bluetooth-classic.
 */

import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_DEVICE_KEY = '@painreliefband:lastDevice';
const POLL_INTERVAL_MS = 200;

type DataCallback = (data: Record<string, unknown>) => void;
type ErrorCallback = (err: Error) => void;

interface LastDevice {
  address: string;
  name: string;
}

interface ExtractResult {
  objects: Record<string, unknown>[];
  remaining: string;
}

class BluetoothService {
  private _device: BluetoothDevice | null = null;
  private _dataBuffer: string = '';
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _onDataCallback: DataCallback | null = null;
  private _onErrorCallback: ErrorCallback | null = null;

  // ─── Permissions ───────────────────────────────────────────────────────────

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const sdkInt = Platform.Version as number;
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

  // ─── Bluetooth State ───────────────────────────────────────────────────────

  async isEnabled(): Promise<boolean> {
    try {
      return await RNBluetoothClassic.isBluetoothEnabled();
    } catch {
      return false;
    }
  }

  async enableBluetooth(): Promise<boolean> {
    try {
      return await RNBluetoothClassic.requestBluetoothEnabled();
    } catch (err) {
      console.warn('[BT] Enable BT error:', err);
      return false;
    }
  }

  // ─── Device Discovery ──────────────────────────────────────────────────────

  async getPairedDevices(): Promise<BluetoothDevice[]> {
    try {
      const devices = await RNBluetoothClassic.getBondedDevices();
      return devices || [];
    } catch (err) {
      console.warn('[BT] getPairedDevices error:', err);
      return [];
    }
  }

  async startDiscovery(): Promise<BluetoothDevice[]> {
    try {
      const discovered = await RNBluetoothClassic.startDiscovery();
      return discovered || [];
    } catch (err) {
      console.warn('[BT] startDiscovery error:', err);
      return [];
    }
  }

  async stopDiscovery(): Promise<void> {
    try {
      await RNBluetoothClassic.cancelDiscovery();
    } catch {
      // ignore
    }
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  async connect(address: string): Promise<BluetoothDevice> {
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

  async disconnect(): Promise<void> {
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

  isConnected(): boolean {
    return this._device !== null;
  }

  getConnectedDevice(): BluetoothDevice | null {
    return this._device;
  }

  // ─── Auto-reconnect ────────────────────────────────────────────────────────

  async getLastDevice(): Promise<LastDevice | null> {
    try {
      const raw = await AsyncStorage.getItem(LAST_DEVICE_KEY);
      return raw ? (JSON.parse(raw) as LastDevice) : null;
    } catch {
      return null;
    }
  }

  async autoReconnect(): Promise<BluetoothDevice | null> {
    const last = await this.getLastDevice();
    if (!last?.address) return null;
    try {
      return await this.connect(last.address);
    } catch {
      return null;
    }
  }

  // ─── JSON parsing helper ───────────────────────────────────────────────────

  private _extractJsonObjects(str: string): ExtractResult {
    const objects: Record<string, unknown>[] = [];
    let remaining = str;

    while (true) {
      const start = remaining.indexOf('{');
      if (start === -1) {
        remaining = '';
        break;
      }

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
        remaining = remaining.slice(start);
        break;
      }

      const candidate = remaining.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate) as Record<string, unknown>;
        objects.push(parsed);
      } catch {
        console.warn('[BT] Malformed JSON span skipped:', candidate.slice(0, 60));
      }

      remaining = remaining.slice(end + 1);
    }

    return { objects, remaining };
  }

  // ─── Data Streaming — polling approach ────────────────────────────────────

  startListening(onData: DataCallback, onError?: ErrorCallback): void {
    if (!this._device) {
      console.warn('[BT] Cannot listen — no device connected.');
      return;
    }

    this._stopPolling();
    this._dataBuffer = '';
    this._onDataCallback = onData;
    this._onErrorCallback = onError ?? null;

    console.log('[BT] Starting data poll at', POLL_INTERVAL_MS, 'ms intervals');

    this._pollTimer = setInterval(async () => {
      try {
        if (!this._device) {
          this._stopPolling();
          return;
        }

        const available = await this._device.available();
        if (!available || available <= 0) return;

        const chunk = await this._device.read();
        if (!chunk) return;

        console.log('[BT] Raw chunk received:', chunk.slice(0, 80));

        this._dataBuffer += chunk;
        const { objects, remaining } = this._extractJsonObjects(this._dataBuffer);
        this._dataBuffer = remaining;

        for (const obj of objects) {
          console.log('[BT] Parsed frame:', JSON.stringify(obj));
          this._onDataCallback?.(obj);
        }
      } catch (err) {
        const msg = (err as Error).message || String(err);
        if (msg.includes('Not connected') || msg.includes('not connected')) {
          console.log('[BT] Device disconnected — stopping poll.');
          this._stopPolling();
          this._onErrorCallback?.(new Error('Device disconnected'));
        } else {
          console.warn('[BT] Poll read error:', msg);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._dataBuffer = '';
    this._onDataCallback = null;
    this._onErrorCallback = null;
  }

  // ─── Command Sending ───────────────────────────────────────────────────────

  async sendCommand(commandObj: Record<string, unknown>): Promise<boolean> {
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
