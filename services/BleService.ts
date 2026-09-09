/**
 * BleService.ts
 * BLE GATT Service wrapper using react-native-ble-plx for the "Her Comfort" ESP32 band.
 *
 * Target ESP32 hardware spec:
 *  - Service UUID:        12345678-1234-1234-1234-123456789000
 *  - Characteristic UUID: 12345678-1234-1234-1234-123456789001 (READ, NOTIFY)
 *  - Telemetry format:    {"temperature":36.88,"gx":-29.60,"gy":25.96,"gz":8.49}
 */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { SensorReading } from './ApiService';

export const BLE_SERVICE_UUID = '12345678-1234-1234-1234-123456789000';
export const BLE_CHAR_UUID    = '12345678-1234-1234-1234-123456789001';

export interface BleDiscoveredDevice {
  id: string;
  name: string;
  rssi?: number;
  isHerComfort: boolean;
  rawDevice: Device;
}

// ─── Robust Base64 Decoder ───────────────────────────────────────────────────
function decodeBase64(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
  } catch {}
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    let i = 0;
    const cleanB64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
    while (i < cleanB64.length) {
      const enc1 = chars.indexOf(cleanB64.charAt(i++));
      const enc2 = chars.indexOf(cleanB64.charAt(i++));
      const enc3 = chars.indexOf(cleanB64.charAt(i++));
      const enc4 = chars.indexOf(cleanB64.charAt(i++));
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      str += String.fromCharCode(chr1);
      if (enc3 !== 64) str += String.fromCharCode(chr2);
      if (enc4 !== 64) str += String.fromCharCode(chr3);
    }
    return str;
  } catch {
    return '';
  }
}

class BleService {
  private _manager: BleManager | null = null;
  private _connectedDevice: Device | null = null;
  private _monitorSubscription: Subscription | null = null;
  private _onDataCallback: ((data: SensorReading, rawJson: string) => void) | null = null;
  private _onDisconnectCallback: (() => void) | null = null;

  // ─── Initialize BleManager safely ──────────────────────────────────────────
  getManager(): BleManager | null {
    if (this._manager) return this._manager;
    // Verify native module exists (e.g. absent in Expo Go)
    if (!NativeModules?.BlePlx && !NativeModules?.BleClientManager) {
      return null;
    }
    try {
      this._manager = new BleManager();
      return this._manager;
    } catch (e) {
      console.warn('[BLE] Native BleManager init failed:', e);
      return null;
    }
  }

  isAvailable(): boolean {
    return Boolean(NativeModules?.BlePlx || NativeModules?.BleClientManager);
  }

  // ─── Permissions ───────────────────────────────────────────────────────────
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      const sdkInt = Platform.Version as number;
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
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location & Bluetooth Access',
            message: 'Nari needs location permission to scan and connect to your Her Comfort band.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('[BLE] Permission request error:', err);
      return false;
    }
  }

  // ─── Scan for BLE Devices ──────────────────────────────────────────────────
  startScan(
    onDevice: (device: BleDiscoveredDevice) => void,
    onError?: (err: Error) => void
  ): boolean {
    const mgr = this.getManager();
    if (!mgr) {
      if (onError) onError(new Error('Native BLE module not available (Expo Go).'));
      return false;
    }

    try {
      mgr.stopDeviceScan();
    } catch {}

    const seenIds = new Set<string>();

    try {
      mgr.startDeviceScan(null, { allowDuplicates: false }, (err, dev) => {
        if (err) {
          if (onError) onError(err);
          return;
        }
        if (!dev) return;

        if (!seenIds.has(dev.id)) {
          seenIds.add(dev.id);

          const devName = dev.name || dev.localName || '';
          const hasMatchingService = (dev.serviceUUIDs || []).some(
            (u) => u.toLowerCase() === BLE_SERVICE_UUID.toLowerCase()
          );
          const isNameMatch =
            devName.toLowerCase().includes('her comfort') ||
            devName.toLowerCase().includes('hercomfort') ||
            devName.toLowerCase().includes('esp32');

          const isHerComfort = isNameMatch || hasMatchingService;

          onDevice({
            id: dev.id,
            name: devName || (isHerComfort ? 'Her Comfort (ESP32)' : 'BLE Device (N/A)'),
            rssi: dev.rssi ?? undefined,
            isHerComfort,
            rawDevice: dev,
          });
        }
      });
      return true;
    } catch (e: any) {
      if (onError) onError(e);
      return false;
    }
  }

  stopScan(): void {
    try {
      this._manager?.stopDeviceScan();
    } catch {}
  }

  // ─── Connect to Device ─────────────────────────────────────────────────────
  async connect(
    deviceId: string,
    onData: (data: SensorReading, rawJson: string) => void,
    onDisconnect?: () => void
  ): Promise<Device> {
    const mgr = this.getManager();
    if (!mgr) throw new Error('BLE Manager unavailable.');

    // 1. Stop scanning first
    this.stopScan();

    // 2. Wait 250ms for Android BLE stack to finish stopping scan
    await new Promise((resolve) => setTimeout(resolve, 250));

    this._onDataCallback = onData;
    this._onDisconnectCallback = onDisconnect || null;

    console.log(`[BLE] Connecting to ${deviceId}…`);

    // 3. Connect (autoConnect: false is required for reliable ESP32 NimBLE connections on Android)
    let conn: Device;
    try {
      conn = await mgr.connectToDevice(deviceId, { autoConnect: false });
    } catch (firstErr: any) {
      console.warn(`[BLE] Initial connection attempt failed, retrying in 400ms:`, firstErr);
      await new Promise((resolve) => setTimeout(resolve, 400));
      conn = await mgr.connectToDevice(deviceId, { autoConnect: false });
    }

    this._connectedDevice = conn;

    // 4. Wait 150ms before requesting MTU or service discovery
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 5. Try requesting higher MTU (up to 256 bytes for JSON packets)
    try {
      await conn.requestMTU(256);
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (mtuErr) {
      console.log('[BLE] MTU request skipped/unsupported:', mtuErr);
    }

    // 6. Discover all services and characteristics
    console.log(`[BLE] Discovering services for ${conn.name || conn.id}…`);
    await conn.discoverAllServicesAndCharacteristics();

    // 7. Find our custom service & characteristic (case-insensitively!)
    const services = await conn.services();
    let serviceUuid = BLE_SERVICE_UUID;
    let charUuid = BLE_CHAR_UUID;

    const matchedService = services.find(
      (s) => s.uuid.toLowerCase() === BLE_SERVICE_UUID.toLowerCase()
    );

    if (matchedService) {
      serviceUuid = matchedService.uuid;
      const chars = await matchedService.characteristics();
      const matchedChar = chars.find(
        (c) => c.uuid.toLowerCase() === BLE_CHAR_UUID.toLowerCase()
      );
      if (matchedChar) {
        charUuid = matchedChar.uuid;
      }
    }

    console.log(`[BLE] Using Service: ${serviceUuid}, Char: ${charUuid}`);

    // 8. Immediately read the initial packet so the app displays live data without waiting for the first notification
    try {
      const initChar = await conn.readCharacteristicForService(serviceUuid, charUuid);
      if (initChar?.value) {
        this._handleIncomingPacket(initChar.value);
      }
    } catch (readErr) {
      console.log('[BLE] Initial read error (will await notification):', readErr);
    }

    // 9. Monitor characteristic for live NOTIFY stream
    this._monitorSubscription?.remove();
    this._monitorSubscription = conn.monitorCharacteristicForService(
      serviceUuid,
      charUuid,
      (err, char) => {
        if (err) {
          console.warn('[BLE] Notification error:', err.message);
          return;
        }
        if (char?.value) {
          this._handleIncomingPacket(char.value);
        }
      }
    );

    // 10. Handle disconnection
    conn.onDisconnected(() => {
      console.log(`[BLE] Device disconnected: ${conn.id}`);
      this._cleanup();
      if (this._onDisconnectCallback) {
        this._onDisconnectCallback();
      }
    });

    return conn;
  }

  // ─── Process Incoming Base64 Packet ────────────────────────────────────────
  private _handleIncomingPacket(base64Val: string): void {
    try {
      const decoded = decodeBase64(base64Val);
      if (!decoded) return;

      const parsed = JSON.parse(decoded);
      const temp = parsed.temp ?? parsed.temperature ?? 36.5;

      const reading: SensorReading = {
        deviceId: this._connectedDevice?.id || 'HER-COMFORT-ESP32',
        temp: typeof temp === 'number' ? temp : parseFloat(temp) || 36.5,
        temperature: typeof temp === 'number' ? temp : parseFloat(temp) || 36.5,
        bpm: parsed.bpm ?? 72,
        gx: parsed.gx != null ? parseFloat(parsed.gx) : 0,
        gy: parsed.gy != null ? parseFloat(parsed.gy) : 0,
        gz: parsed.gz != null ? parseFloat(parsed.gz) : 0,
        motor: Boolean(parsed.motor),
        heater: Boolean(parsed.heater),
        system_active: true,
        beat_detected: true,
        raw_analog: parsed.raw_analog ?? 1720,
        timestamp: Date.now(),
      };

      if (this._onDataCallback) {
        this._onDataCallback(reading, decoded);
      }
    } catch (err) {
      console.warn('[BLE] Failed to parse packet:', err);
    }
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────
  async disconnect(): Promise<void> {
    this._cleanup();
    if (this._connectedDevice) {
      try {
        await this._connectedDevice.cancelConnection();
      } catch {}
      this._connectedDevice = null;
    }
  }

  private _cleanup(): void {
    try {
      this._monitorSubscription?.remove();
    } catch {}
    this._monitorSubscription = null;
    this._connectedDevice = null;
  }

  isConnected(): boolean {
    return this._connectedDevice !== null;
  }

  getConnectedDevice(): Device | null {
    return this._connectedDevice;
  }
}

export default new BleService();
