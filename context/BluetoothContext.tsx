/**
 * BluetoothContext.tsx
 * Global React Context that provides Bluetooth state and actions
 * to all screens via useBluetooth().
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import BluetoothService from '../services/BluetoothService';
import BleService from '../services/BleService';
import ApiService, { SensorReading } from '../services/ApiService';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ConnectionStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
  id: number;
}

export interface BluetoothContextValue {
  pairedDevices: BluetoothDevice[];
  discoveredDevices: BluetoothDevice[];
  connectedDevice: BluetoothDevice | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  isScanning: boolean;
  liveData: SensorReading | null;
  history: SensorReading[];
  packetCount: number;
  isDemo: boolean;
  lastCommand: (Record<string, unknown> & { sentAt: number }) | null;
  toast: ToastMessage | null;
  scan: () => Promise<void>;
  connect: (device: BluetoothDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  startDemo: () => void;
  stopDemo: () => void;
  sendCommand: (commandObj: Record<string, unknown>) => Promise<void>;
  showToast: (type: ToastMessage['type'], message: string) => void;
}

// ─── Connection status enum ────────────────────────────────────────────────────
export const CONNECTION_STATUS: Record<string, ConnectionStatus> = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// ─── Context ───────────────────────────────────────────────────────────────────
const BluetoothContext = createContext<BluetoothContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────
export function BluetoothProvider({ children }: { children: React.ReactNode }) {
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);

  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(CONNECTION_STATUS.IDLE);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);

  const [liveData, setLiveData] = useState<SensorReading | null>(null);
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [packetCount, setPacketCount] = useState(0);
  const [isDemo, setIsDemo] = useState(false);
  const [lastCommand, setLastCommand] = useState<(Record<string, unknown> & { sentAt: number }) | null>(null);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const streamingRef = useRef(false);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTickRef = useRef(0);

  // ─── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  // ─── Internal: begin polling ───────────────────────────────────────────────
  function _beginStreaming() {
    if (streamingRef.current) return;
    streamingRef.current = true;

    console.log('[BT Context] Starting streaming...');
    BluetoothService.startListening(
      (data) => {
        const raw = data as Record<string, any>;
        const tempVal = raw.temp ?? raw.temperature ?? 36.5;
        const normalized: SensorReading = {
          ...raw,
          deviceId: raw.deviceId || 'HER-COMFORT',
          temp: typeof tempVal === 'number' ? tempVal : parseFloat(tempVal) || 36.5,
          temperature: typeof tempVal === 'number' ? tempVal : parseFloat(tempVal) || 36.5,
          bpm: raw.bpm ?? 72,
          gx: raw.gx ?? 0,
          gy: raw.gy ?? 0,
          gz: raw.gz ?? 0,
          motor: Boolean(raw.motor),
          heater: Boolean(raw.heater),
          raw_analog: raw.raw_analog ?? 1700,
          timestamp: raw.timestamp ?? Date.now(),
        };
        setLiveData(normalized);
        setPacketCount((c) => c + 1);
        setHistory((prev) => {
          const next = [...prev, normalized];
          return next.length > 60 ? next.slice(-60) : next;
        });
        ApiService.postReading(normalized).catch(() => {});
      },
      (err) => {
        console.log('[BT Context] Stream ended:', err.message);
        streamingRef.current = false;
        if (err.message === 'Device disconnected') {
          setConnectedDevice(null);
          setLiveData(null);
          setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
          showToast('error', 'Her Comfort band disconnected');
        }
      }
    );
  }

  // ─── Scan ──────────────────────────────────────────────────────────────────
  const scan = useCallback(async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      setConnectionStatus(CONNECTION_STATUS.SCANNING);
      setDiscoveredDevices([]);

      // 1. Scan for BLE devices using BleService
      if (BleService.isAvailable()) {
        await BleService.requestPermissions();
        BleService.startScan(
          (bleDev) => {
            const btItem: any = {
              name: bleDev.name,
              address: bleDev.id,
              id: bleDev.id,
              rssi: bleDev.rssi,
              isBle: true,
              isHerComfort: bleDev.isHerComfort,
            };
            setDiscoveredDevices((prev) => {
              const filtered = prev.filter((d) => d.address !== bleDev.id);
              return bleDev.isHerComfort ? [btItem, ...filtered] : [...filtered, btItem];
            });
          },
          (err) => console.log('[BT Context] BLE scan notice:', err.message)
        );
      }

      // 2. Scan for paired and Classic devices as well
      const granted = await BluetoothService.requestPermissions();
      if (granted && (await BluetoothService.isEnabled())) {
        const paired = await BluetoothService.getPairedDevices();
        setPairedDevices(paired);

        try {
          const discovered = await BluetoothService.startDiscovery();
          const pairedAddresses = new Set(paired.map((d) => d.address));
          const newDevices = discovered.filter((d) => !pairedAddresses.has(d.address));
          setDiscoveredDevices((prev) => {
            const existing = new Set(prev.map((d) => d.address));
            const added = newDevices.filter((d) => !existing.has(d.address));
            return [...prev, ...added];
          });
        } catch (discErr) {
          console.log('[BT Context] Classic discovery notice:', discErr);
        }
      }
    } catch (err) {
      console.error('[BT Context] scan error:', err);
      showToast('error', `Scan failed: ${(err as Error).message}`);
    } finally {
      setIsScanning(false);
      setConnectionStatus(
        BleService.isConnected() || BluetoothService.isConnected()
          ? CONNECTION_STATUS.CONNECTED
          : CONNECTION_STATUS.IDLE
      );
    }
  }, [isScanning, showToast]);

  // ─── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async (device: BluetoothDevice) => {
    try {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      setConnectionError(null);
      streamingRef.current = false;

      const deviceId = device.address || (device as any).id;
      showToast('info', `Connecting to ${device.name || deviceId}…`);

      // 1. Try BLE GATT connection first (since ESP32 NimBLE is BLE)
      if (BleService.isAvailable()) {
        try {
          await BleService.connect(
            deviceId,
            (reading) => {
              setLiveData(reading);
              setPacketCount((c) => c + 1);
              setHistory((prev) => {
                const next = [...prev, reading];
                return next.length > 60 ? next.slice(-60) : next;
              });
              ApiService.postReading(reading).catch(() => {});
            },
            () => {
              setConnectedDevice(null);
              setLiveData(null);
              setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
              showToast('info', 'Her Comfort band disconnected');
            }
          );

          setConnectedDevice(device);
          setConnectionStatus(CONNECTION_STATUS.CONNECTED);
          showToast('success', `Connected to ${device.name || deviceId}`);
          return;
        } catch (bleErr: any) {
          console.warn('[BT Context] BLE connection failed, trying Classic BT:', bleErr?.message);
        }
      }

      // 2. Fallback to Classic Bluetooth (RFCOMM/SPP)
      const connected = await BluetoothService.connect(device.address);
      setConnectedDevice(connected);
      setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      showToast('success', `Connected to ${device.name || device.address}`);

      _beginStreaming();
    } catch (err: any) {
      console.error('[BT Context] connect error:', err);
      setConnectionStatus(CONNECTION_STATUS.ERROR);
      setConnectionError(err.message);
      showToast(
        'error',
        `Connection failed: ${err.message}. If another app (e.g. nRF Connect) is connected, disconnect it first.`
      );
    }
  }, [showToast]);

  // ─── Demo Mode Simulator ──────────────────────────────────────────────────
  const startDemo = useCallback(() => {
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    setIsDemo(true);
    setConnectionStatus(CONNECTION_STATUS.CONNECTED);
    setConnectedDevice({
      name: 'Her Comfort (ESP32)',
      address: 'ESP32:HER:COMFORT',
      id: 'ESP32:HER:COMFORT',
    } as any);
    showToast('success', 'Connected to Her Comfort (Demo Simulator)');

    demoTickRef.current = 0;
    demoTimerRef.current = setInterval(() => {
      demoTickRef.current += 1;
      const t = demoTickRef.current;
      const temp = 36.6 + Math.sin(t * 0.12) * 0.35 + (Math.random() - 0.5) * 0.08;
      const bpm = Math.round(72 + Math.sin(t * 0.2) * 5 + (Math.random() - 0.5) * 2);
      const gx = Math.sin(t * 0.25) * 1.8 + (Math.random() - 0.5) * 0.15;
      const gy = Math.cos(t * 0.25) * 1.4 + (Math.random() - 0.5) * 0.15;
      const gz = Math.sin(t * 0.1) * 0.5 + (Math.random() - 0.5) * 0.1;

      const reading: SensorReading = {
        deviceId: 'HER-COMFORT-ESP32',
        temp: parseFloat(temp.toFixed(2)),
        temperature: parseFloat(temp.toFixed(2)),
        bpm,
        gx: parseFloat(gx.toFixed(2)),
        gy: parseFloat(gy.toFixed(2)),
        gz: parseFloat(gz.toFixed(2)),
        motor: t % 20 < 10,
        heater: true,
        led: true,
        system_active: true,
        beat_detected: true,
        raw_analog: 1720 + Math.round(Math.sin(t * 0.3) * 60),
        timestamp: Date.now(),
      };

      setLiveData(reading);
      setPacketCount((c) => c + 1);
      setHistory((prev) => {
        const next = [...prev, reading];
        return next.length > 60 ? next.slice(-60) : next;
      });
    }, 400);
  }, [showToast]);

  const stopDemo = useCallback(() => {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    setIsDemo(false);
    setConnectedDevice(null);
    setLiveData(null);
    setHistory([]);
    setPacketCount(0);
    setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
    showToast('info', 'Demo disconnected');
  }, [showToast]);

  // ─── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (isDemo) {
      stopDemo();
      return;
    }
    try {
      streamingRef.current = false;
      await BleService.disconnect();
      await BluetoothService.disconnect();
      setConnectedDevice(null);
      setLiveData(null);
      setHistory([]);
      setPacketCount(0);
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      showToast('info', 'Device disconnected');
    } catch (err) {
      console.error('[BT Context] disconnect error:', err);
    }
  }, [isDemo, stopDemo, showToast]);

  // ─── Send Command ──────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (commandObj: Record<string, unknown>) => {
    try {
      if (isDemo) {
        setLiveData((prev) => prev ? ({ ...prev, ...commandObj } as SensorReading) : null);
        setLastCommand({ ...commandObj, sentAt: Date.now() });
        showToast('success', 'Command applied');
        return;
      }
      await BluetoothService.sendCommand(commandObj);
      setLastCommand({ ...commandObj, sentAt: Date.now() });
    } catch (err) {
      showToast('error', `Command failed: ${(err as Error).message}`);
      throw err;
    }
  }, [isDemo, showToast]);

  // ─── Auto-reconnect on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await BluetoothService.requestPermissions();
      if (!granted || cancelled) return;

      const enabled = await BluetoothService.isEnabled();
      if (!enabled || cancelled) return;

      const paired = await BluetoothService.getPairedDevices();
      if (!cancelled) setPairedDevices(paired);

      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      const device = await BluetoothService.autoReconnect();
      if (cancelled) return;

      if (device) {
        setConnectedDevice(device);
        setConnectionStatus(CONNECTION_STATUS.CONNECTED);
        showToast('success', `Auto-connected to ${device.name || device.address}`);
        _beginStreaming();
      } else {
        setConnectionStatus(CONNECTION_STATUS.IDLE);
      }
    })();

    return () => {
      cancelled = true;
      if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: BluetoothContextValue = {
    pairedDevices,
    discoveredDevices,
    connectedDevice,
    connectionStatus,
    connectionError,
    isScanning,
    liveData,
    history,
    packetCount,
    isDemo,
    lastCommand,
    toast,
    scan,
    connect,
    disconnect,
    startDemo,
    stopDemo,
    sendCommand,
    showToast,
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useBluetooth(): BluetoothContextValue {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return ctx;
}

export default BluetoothContext;
