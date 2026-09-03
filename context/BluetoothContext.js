/**
 * BluetoothContext.js
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
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';

// ─── Context ──────────────────────────────────────────────────────────────────
const BluetoothContext = createContext(null);

// ─── Connection status enum ───────────────────────────────────────────────────
export const CONNECTION_STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function BluetoothProvider({ children }) {
  const [pairedDevices, setPairedDevices] = useState([]);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);

  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(CONNECTION_STATUS.IDLE);
  const [connectionError, setConnectionError] = useState(null);

  const [isScanning, setIsScanning] = useState(false);

  const [liveData, setLiveData] = useState(null);
  const [lastCommand, setLastCommand] = useState(null);

  const [toast, setToast] = useState(null);

  // track if we already started the poll so we don't double-start
  const streamingRef = useRef(false);

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((type, message) => {
    setToast({ type, message, id: Date.now() });
  }, []);

  // ─── Internal: begin polling ──────────────────────────────────────────────────
  // Note: this is NOT a useCallback — it reads live BluetoothService state
  // so it should be called directly after a successful connect().
  function _beginStreaming() {
    if (streamingRef.current) return;
    streamingRef.current = true;

    console.log('[BT Context] Starting streaming...');
    BluetoothService.startListening(
      (data) => {
        // data is a fully parsed JS object from the ESP32
        setLiveData(data);
        // Fire-and-forget POST to backend
        ApiService.postReading(data).catch(() => {});
      },
      (err) => {
        console.log('[BT Context] Stream ended:', err.message);
        streamingRef.current = false;
        // If device dropped, reflect in UI
        if (err.message === 'Device disconnected') {
          setConnectedDevice(null);
          setLiveData(null);
          setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
          showToast('error', 'PainReliefBand disconnected');
        }
      }
    );
  }

  // ─── Scan ────────────────────────────────────────────────────────────────────
  const scan = useCallback(async () => {
    if (isScanning) return;
    try {
      setIsScanning(true);
      setConnectionStatus(CONNECTION_STATUS.SCANNING);
      setDiscoveredDevices([]);

      const granted = await BluetoothService.requestPermissions();
      if (!granted) {
        showToast('error', 'Bluetooth permissions denied.');
        return;
      }

      const enabled = await BluetoothService.isEnabled();
      if (!enabled) {
        const turned = await BluetoothService.enableBluetooth();
        if (!turned) {
          showToast('error', 'Please enable Bluetooth to scan for devices.');
          return;
        }
      }

      const paired = await BluetoothService.getPairedDevices();
      setPairedDevices(paired);

      const discovered = await BluetoothService.startDiscovery();
      const pairedAddresses = new Set(paired.map((d) => d.address));
      const newDevices = discovered.filter((d) => !pairedAddresses.has(d.address));
      setDiscoveredDevices(newDevices);

      showToast('success', `Found ${discovered.length + paired.length} device(s)`);
    } catch (err) {
      console.error('[BT Context] scan error:', err);
      showToast('error', `Scan failed: ${err.message}`);
    } finally {
      setIsScanning(false);
      setConnectionStatus(
        BluetoothService.isConnected() ? CONNECTION_STATUS.CONNECTED : CONNECTION_STATUS.IDLE
      );
    }
  }, [isScanning, showToast]);

  // ─── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async (device) => {
    try {
      setConnectionStatus(CONNECTION_STATUS.CONNECTING);
      setConnectionError(null);
      streamingRef.current = false; // reset so _beginStreaming can fire

      const connected = await BluetoothService.connect(device.address);
      setConnectedDevice(connected);
      setConnectionStatus(CONNECTION_STATUS.CONNECTED);
      showToast('success', `Connected to ${device.name || device.address}`);

      // Start polling immediately after connection
      _beginStreaming();
    } catch (err) {
      console.error('[BT Context] connect error:', err);
      setConnectionStatus(CONNECTION_STATUS.ERROR);
      setConnectionError(err.message);
      showToast('error', `Connection failed: ${err.message}`);
    }
  }, [showToast]);

  // ─── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      streamingRef.current = false;
      await BluetoothService.disconnect();
      setConnectedDevice(null);
      setLiveData(null);
      setConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      showToast('info', 'Device disconnected');
    } catch (err) {
      console.error('[BT Context] disconnect error:', err);
    }
  }, [showToast]);

  // ─── Send Command ─────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (commandObj) => {
    try {
      await BluetoothService.sendCommand(commandObj);
      setLastCommand({ ...commandObj, sentAt: Date.now() });
    } catch (err) {
      showToast('error', `Command failed: ${err.message}`);
      throw err;
    }
  }, [showToast]);

  // ─── Auto-reconnect on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await BluetoothService.requestPermissions();
      if (!granted || cancelled) return;

      const enabled = await BluetoothService.isEnabled();
      if (!enabled || cancelled) return;

      // Load paired devices silently
      const paired = await BluetoothService.getPairedDevices();
      if (!cancelled) setPairedDevices(paired);

      // Attempt auto-reconnect to last device
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Context value ────────────────────────────────────────────────────────────
  const value = {
    pairedDevices,
    discoveredDevices,
    connectedDevice,
    connectionStatus,
    connectionError,
    isScanning,
    liveData,
    lastCommand,
    toast,
    scan,
    connect,
    disconnect,
    sendCommand,
    showToast,
  };

  return (
    <BluetoothContext.Provider value={value}>
      {children}
    </BluetoothContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBluetooth() {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return ctx;
}

export default BluetoothContext;
