/**
 * ble-device.tsx
 * BLE Scanner + Live Dashboard for the "Her Comfort" ESP32 device.
 *
 * ESP32 BLE spec:
 *   Device name:  "Her Comfort"
 *   Service UUID: 12345678-1234-1234-1234-123456789000
 *   Char UUID:    12345678-1234-1234-1234-123456789001
 *   Payload:      JSON {"temperature":36.5,"gx":0.12,"gy":-0.05,"gz":0.03}
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  NativeModules, PermissionsAndroid, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline, Line } from "react-native-svg";
import { BleManager, Device, State } from "react-native-ble-plx";
import { T } from "../constants/theme";

const TARGET_NAME  = "Her Comfort";
const SERVICE_UUID = "12345678-1234-1234-1234-123456789000";
const CHAR_UUID    = "12345678-1234-1234-1234-123456789001";
const GRAPH_POINTS = 60;
const { width }    = Dimensions.get("window");
const GRAPH_W      = width - 48;
const GRAPH_H      = 130;

interface EspPayload { temperature: number; gx: number; gy: number; gz: number; }
interface HistPoint extends EspPayload { ts: number; }

function LineGraph({ data, color, label, unit, yMin, yMax }: {
  data: number[]; color: string; label: string; unit: string; yMin: number; yMax: number;
}) {
  const pts   = data.slice(-GRAPH_POINTS);
  const range = yMax - yMin || 1;
  const toY   = (v: number) => GRAPH_H - ((v - yMin) / range) * GRAPH_H;
  const points = pts.map((v, i) =>
    `${((i / Math.max(pts.length - 1, 1)) * GRAPH_W).toFixed(1)},${toY(v).toFixed(1)}`
  ).join(" ");
  const cur = pts[pts.length - 1] ?? 0;
  return (
    <View style={s.graphCard}>
      <View style={s.graphRow}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={s.graphLbl}>{label}</Text>
        <Text style={[s.graphVal, { color }]}>{cur.toFixed(2)} {unit}</Text>
      </View>
      <Svg width={GRAPH_W} height={GRAPH_H}>
        {yMin < 0 && (
          <Line x1="0" y1={toY(0).toFixed(1)} x2={String(GRAPH_W)} y2={toY(0).toFixed(1)}
            stroke={color + "40"} strokeWidth="1" strokeDasharray="4 4" />
        )}
        {pts.length > 1 && (
          <Polyline points={points} fill="none" stroke={color}
            strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}
      </Svg>
    </View>
  );
}

function StatCard({ emoji, label, value, unit, bg, accent }: {
  emoji: string; label: string; value: string; unit: string; bg: string; accent: string;
}) {
  return (
    <View style={[s.statCard, { backgroundColor: bg, borderColor: accent + "30" }]}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={s.statLbl}>{label}</Text>
      <Text style={[s.statVal, { color: accent }]}>{value}</Text>
      <Text style={[s.statUnit, { color: accent + "99" }]}>{unit}</Text>
    </View>
  );
}

export default function BleDeviceScreen() {
  const router = useRouter();
  const [nativeBleAvailable, setNativeBleAvailable] = useState(true);
  const [isDemo,             setIsDemo]             = useState(false);
  const [bleReady,           setBleReady]           = useState(false);
  const [scanning,           setScanning]           = useState(false);
  const [found,              setFound]              = useState<Device[]>([]);
  const [connected,          setConnected]          = useState(false);
  const [device,             setDevice]             = useState<Device | null>(null);
  const [connecting,         setConnecting]         = useState(false);
  const [statusMsg,          setStatusMsg]          = useState("Tap Scan to find your device");
  const [live,               setLive]               = useState<EspPayload | null>(null);
  const [rawJson,            setRawJson]            = useState("");
  const [history,            setHistory]            = useState<HistPoint[]>([]);
  const [rxCount,            setRxCount]            = useState(0);
  const [lastRx,             setLastRx]             = useState<Date | null>(null);

  const pulse           = useRef(new Animated.Value(1)).current;
  const managerRef      = useRef<BleManager | null>(null);
  const subRef          = useRef<{ remove: () => void } | null>(null);
  const devRef          = useRef<Device | null>(null);
  const foundIds        = useRef(new Set<string>());
  const scanTimeout     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTickRef     = useRef(0);

  // Lazily and safely create BleManager (returns null if native module is absent, e.g. in Expo Go)
  function getBleManager(): BleManager | null {
    if (managerRef.current) return managerRef.current;
    if (!NativeModules?.BlePlx && !NativeModules?.BleClientManager) return null;
    try {
      managerRef.current = new BleManager();
      return managerRef.current;
    } catch (e) {
      console.warn("[BLE] Native BleManager init failed:", e);
      return null;
    }
  }

  useEffect(() => { devRef.current = device; }, [device]);

  useEffect(() => {
    if (!live) return;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0,  duration: 200, useNativeDriver: true }),
    ]).start();
  }, [rxCount]);

  useEffect(() => {
    const mgr = getBleManager();
    if (!mgr) {
      setNativeBleAvailable(false);
      setBleReady(false);
      setStatusMsg("Expo Go detected. Native BLE unavailable. Use Demo Simulator.");
      return;
    }
    setNativeBleAvailable(true);
    let sub: { remove: () => void } | null = null;
    try {
      sub = mgr.onStateChange((st) => setBleReady(st === State.PoweredOn), true);
    } catch (e) {
      console.warn("[BLE] onStateChange error:", e);
      setNativeBleAvailable(false);
    }
    return () => {
      try { sub?.remove(); } catch {}
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scanTimeout.current) clearTimeout(scanTimeout.current);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      try {
        managerRef.current?.stopDeviceScan();
        subRef.current?.remove();
        devRef.current?.cancelConnection().catch(() => {});
        managerRef.current?.destroy();
      } catch {}
      managerRef.current = null;
    };
  }, []);

  // ─── Demo Mode Simulation ──────────────────────────────────────────────────
  const startDemo = useCallback(() => {
    if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    setIsDemo(true);
    setConnected(true);
    setConnecting(false);
    setScanning(false);
    setDevice({ id: "ESP32-DEMO-SIM", name: "Her Comfort (Demo ESP32)" } as any);
    setStatusMsg("Connected — Her Comfort (Demo Simulator)");

    demoTickRef.current = 0;
    demoIntervalRef.current = setInterval(() => {
      demoTickRef.current += 1;
      const t = demoTickRef.current;
      // Realistic simulation: body temp ~ 36.6°C ± 0.4°C with slight sine fluctuation
      const temp = 36.6 + Math.sin(t * 0.15) * 0.35 + (Math.random() - 0.5) * 0.08;
      const gx = Math.sin(t * 0.25) * 1.8 + (Math.random() - 0.5) * 0.15;
      const gy = Math.cos(t * 0.25) * 1.4 + (Math.random() - 0.5) * 0.15;
      const gz = Math.sin(t * 0.1) * 0.5 + (Math.random() - 0.5) * 0.1;

      const payload: EspPayload = {
        temperature: parseFloat(temp.toFixed(2)),
        gx: parseFloat(gx.toFixed(2)),
        gy: parseFloat(gy.toFixed(2)),
        gz: parseFloat(gz.toFixed(2)),
      };
      const jsonStr = JSON.stringify(payload);

      setLive(payload);
      setRawJson(jsonStr);
      setRxCount(c => c + 1);
      setLastRx(new Date());
      setHistory(prev => {
        const next = [...prev, { ...payload, ts: Date.now() }];
        return next.length > GRAPH_POINTS * 2 ? next.slice(-GRAPH_POINTS * 2) : next;
      });
    }, 400);
  }, []);

  const stopDemo = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setIsDemo(false);
    setConnected(false);
    setDevice(null);
    setLive(null);
    setHistory([]);
    setRxCount(0);
    setStatusMsg("Demo stopped. Tap below to simulate or scan.");
  }, []);

  async function reqPerms() {
    if (Platform.OS !== "android") return true;
    try {
      if ((Platform.Version as number) >= 31) {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
      }
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return r === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  }

  const startScan = useCallback(async () => {
    if (scanning || connected) return;

    const mgr = getBleManager();
    if (!mgr) {
      Alert.alert(
        "Expo Go Limitation",
        "react-native-ble-plx requires native code not included in Expo Go.\n\nTo connect physical ESP32 hardware, run:\nnpx expo run:android\n\nWould you like to start Demo Simulator to test graphs and telemetry now?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start Demo Mode", onPress: startDemo },
        ]
      );
      return;
    }

    if (!bleReady) { Alert.alert("Bluetooth Off", "Enable Bluetooth first."); return; }
    if (!(await reqPerms())) { Alert.alert("Permission Denied", "Location required for BLE scan."); return; }
    setFound([]); foundIds.current.clear();
    setScanning(true);
    setStatusMsg('Scanning for "Her Comfort"…');

    try {
      mgr.startDeviceScan(null, { allowDuplicates: false }, (err, dev) => {
        if (err) { setScanning(false); setStatusMsg("Scan error: " + err.message); return; }
        if (!dev) return;

        if (!foundIds.current.has(dev.id)) {
          foundIds.current.add(dev.id);

          const devName = dev.name || dev.localName || "";
          const hasService = (dev.serviceUUIDs || []).some(
            (u) => u.toLowerCase() === SERVICE_UUID.toLowerCase()
          );
          const isTarget =
            hasService ||
            devName.toLowerCase().includes("her comfort") ||
            devName.toLowerCase().includes("hercomfort") ||
            devName.toLowerCase().includes("esp32");

          // Put matching ESP32 devices at the top of the list!
          setFound((prev) => (isTarget ? [dev, ...prev] : [...prev, dev]));
        }
      });
      scanTimeout.current = setTimeout(() => {
        try { mgr.stopDeviceScan(); } catch {}
        setScanning(false);
        setStatusMsg(foundIds.current.size === 0
          ? "No device found. Make sure ESP32 is powered on."
          : "Scan done. Tap a device to connect.");
      }, 10_000);
    } catch (e: any) {
      setScanning(false);
      setStatusMsg("Scan failed: " + (e?.message ?? "Unknown error"));
    }
  }, [scanning, connected, bleReady, startDemo]);

  const stopScan = useCallback(() => {
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    try { getBleManager()?.stopDeviceScan(); } catch {}
    setScanning(false);
    setStatusMsg("Scan stopped.");
  }, []);

  const connectDevice = useCallback(async (dev: Device) => {
    try { getBleManager()?.stopDeviceScan(); } catch {}
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    setScanning(false);
    setConnecting(true);
    const targetName = dev.name || dev.localName || dev.id;
    setStatusMsg("Connecting to " + targetName + "…");

    // Android BLE stack requires ~250ms after stopping scan before initiating GATT connect
    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      let conn: Device;
      try {
        conn = await dev.connect({ autoConnect: false });
      } catch (firstErr: any) {
        console.warn("[BLE] First connection attempt failed, retrying in 400ms:", firstErr);
        await new Promise((resolve) => setTimeout(resolve, 400));
        conn = await dev.connect({ autoConnect: false });
      }

      // Small pause before MTU request
      await new Promise((resolve) => setTimeout(resolve, 150));

      try {
        await conn.requestMTU(256);
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (mtuErr) {
        console.log("[BLE] MTU request skipped/unsupported:", mtuErr);
      }

      await conn.discoverAllServicesAndCharacteristics();
      setDevice(conn);
      setConnected(true);
      setStatusMsg("Connected to " + (conn.name || conn.localName || conn.id));

      // Find target service & char case-insensitively
      const services = await conn.services();
      let serviceUuid = SERVICE_UUID;
      let charUuid = CHAR_UUID;

      const matchedService = services.find(
        (s) => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()
      );
      if (matchedService) {
        serviceUuid = matchedService.uuid;
        const chars = await matchedService.characteristics();
        const matchedChar = chars.find(
          (c) => c.uuid.toLowerCase() === CHAR_UUID.toLowerCase()
        );
        if (matchedChar) {
          charUuid = matchedChar.uuid;
        }
      }

      // Read initial characteristic value immediately
      try {
        const initChar = await conn.readCharacteristicForService(serviceUuid, charUuid);
        if (initChar?.value) {
          const decoded = atob(initChar.value);
          const parsed: EspPayload = JSON.parse(decoded);
          setLive(parsed);
          setRawJson(decoded);
          setRxCount((c) => c + 1);
          setLastRx(new Date());
          setHistory((prev) => [...prev, { ...parsed, ts: Date.now() }].slice(-GRAPH_POINTS * 2));
        }
      } catch (readErr) {
        console.log("[BLE] Initial read error (will await notification):", readErr);
      }

      const sub = conn.monitorCharacteristicForService(serviceUuid, charUuid, (err, char) => {
        if (err) {
          console.warn("[BLE] Monitor error:", err.message);
          return;
        }
        if (!char?.value) return;
        try {
          const decoded = atob(char.value);
          const parsed: EspPayload = JSON.parse(decoded);
          setLive(parsed);
          setRawJson(decoded);
          setRxCount((c) => c + 1);
          setLastRx(new Date());
          setHistory((prev) => {
            const next = [...prev, { ...parsed, ts: Date.now() }];
            return next.length > GRAPH_POINTS * 2 ? next.slice(-GRAPH_POINTS * 2) : next;
          });
        } catch {}
      });
      subRef.current = sub;
      conn.onDisconnected(() => {
        subRef.current?.remove();
        setConnected(false); setDevice(null); setLive(null);
        setStatusMsg("Disconnected. Tap Scan to reconnect.");
      });
    } catch (e: any) {
      console.error("[BLE] Connect failed:", e);
      Alert.alert(
        "Connection Failed",
        (e?.message ?? "Could not connect to device.") +
          "\n\n⚠️ IMPORTANT: ESP32 NimBLE allows only 1 connection at a time. If nRF Connect (or another BLE app) is currently connected to the device, please tap DISCONNECT in that app first, then try again here."
      );
      setStatusMsg("Connection failed: " + (e?.message ?? "Try again"));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (isDemo) {
      stopDemo();
      return;
    }
    subRef.current?.remove();
    try { await devRef.current?.cancelConnection(); } catch {}
    setConnected(false); setDevice(null); setLive(null);
    setHistory([]); setRxCount(0); setFound([]); foundIds.current.clear();
    setStatusMsg("Disconnected. Tap Scan to reconnect.");
  }, [isDemo, stopDemo]);

  const tempH = history.map(h => h.temperature);
  const gxH   = history.map(h => h.gx);
  const gyH   = history.map(h => h.gy);
  const gzH   = history.map(h => h.gz);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 4 }}>
          <Feather name="arrow-left" size={22} color={T.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Her Comfort</Text>
          <Text style={s.headerSub}>ESP32 BLE Sensor Dashboard</Text>
        </View>
        {connected && (
          <TouchableOpacity onPress={disconnect} style={s.discBtn}>
            <Feather name="x" size={14} color="#ef4444" />
            <Text style={s.discTxt}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Expo Go notice banner */}
        {!nativeBleAvailable && (
          <View style={s.warnBanner}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Feather name="alert-triangle" size={20} color="#d97706" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.warnTitle}>Expo Go: Native BLE Not Bundled</Text>
                <Text style={s.warnTxt}>
                  Bluetooth hardware requires a native build (<Text style={{ fontFamily: "monospace", fontWeight: "700" }}>npx expo run:android</Text>).
                  You can use Demo Simulator to test all charts, live telemetry, and UI right now in Expo Go!
                </Text>
                <TouchableOpacity
                  style={[s.demoBtn, { backgroundColor: isDemo ? "#ef4444" : T.pink.primary }]}
                  onPress={isDemo ? stopDemo : startDemo}
                  activeOpacity={0.85}
                >
                  <Feather name={isDemo ? "stop-circle" : "play-circle"} size={16} color="#fff" />
                  <Text style={s.demoBtnTxt}>{isDemo ? "Stop Demo Simulator" : "⚡ Start ESP32 Demo Simulator"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Status */}
        <View style={[s.statusCard, { borderColor: connected ? "#22c55e40" : T.pink.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Animated.View style={[s.statusDot, {
              backgroundColor: connected ? "#22c55e" : scanning ? "#f59e0b" : "#d1d5db",
              transform: [{ scale: pulse }],
            }]} />
            <Text style={s.statusTxt}>
              {connected ? `Connected — ${device?.name ?? device?.id}` : scanning ? "Scanning…" : statusMsg}
            </Text>
          </View>
          {connected && lastRx && (
            <Text style={s.rxTxt}>{rxCount} packets · Last: {lastRx.toLocaleTimeString()}</Text>
          )}
        </View>

        {/* Scan controls */}
        {!connected && (
          <>
            <TouchableOpacity onPress={scanning ? stopScan : startScan}
              style={[s.scanBtn, { backgroundColor: scanning ? "#ef4444" : T.pink.primary }]} activeOpacity={0.85}>
              <Feather name={scanning ? "x-circle" : "bluetooth"} size={18} color="#fff" />
              <Text style={s.scanBtnTxt}>{scanning ? "Stop Scan" : "Scan for ESP32"}</Text>
            </TouchableOpacity>

            {(scanning || found.length > 0) && (
              <View>
                <Text style={s.sectionTitle}>
                  {found.length > 0 ? `Found ${found.length} device${found.length > 1 ? "s" : ""}` : "Searching…"}
                </Text>
                {scanning && found.length === 0 && (
                  <View style={s.scanRow}>
                    <ActivityIndicator size="small" color={T.pink.primary} />
                    <Text style={s.scanRowTxt}>Looking for "Her Comfort"…</Text>
                  </View>
                )}
                {found.map(dev => {
                  const devName = dev.name || dev.localName || "";
                  const hasService = (dev.serviceUUIDs || []).some(
                    (u) => u.toLowerCase() === SERVICE_UUID.toLowerCase()
                  );
                  const isMatch =
                    hasService ||
                    devName.toLowerCase().includes("her comfort") ||
                    devName.toLowerCase().includes("hercomfort") ||
                    devName.toLowerCase().includes("esp32");

                  const title = devName && devName !== "N/A"
                    ? devName
                    : isMatch
                    ? "Her Comfort (ESP32)"
                    : "BLE Device (N/A)";

                  return (
                    <TouchableOpacity key={dev.id} onPress={() => connectDevice(dev)} disabled={connecting}
                      style={[s.devCard, isMatch && { borderColor: T.pink.primary, backgroundColor: "#fff5f8" }]} activeOpacity={0.8}>
                      <View style={[s.devIcon, isMatch && { backgroundColor: T.pink.primary + "20" }]}>
                        <Feather name={isMatch ? "activity" : "cpu"} size={22} color={T.pink.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={s.devName}>{title}</Text>
                          {isMatch && (
                            <View style={{ backgroundColor: "#fce7f3", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: T.pink.primary, fontSize: 9, fontWeight: "800" }}>MATCH</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.devId}>{dev.id}</Text>
                        {dev.rssi != null && (
                          <Text style={s.devRssi}>
                            {dev.rssi} dBm · {dev.rssi > -60 ? "Excellent" : dev.rssi > -75 ? "Good" : "Weak"}
                          </Text>
                        )}
                      </View>
                      {connecting
                        ? <ActivityIndicator size="small" color={T.pink.primary} />
                        : <View style={[s.connBtn, isMatch && { backgroundColor: T.pink.primary }]}><Text style={s.connBtnTxt}>Connect</Text></View>
                      }
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Dashboard */}
        {connected && live && (
          <>
            <View style={s.statsRow}>
              <StatCard emoji="🌡️" label="Temperature" value={live.temperature.toFixed(2)} unit="°C" bg="#fff0f0" accent="#ef4444" />
              <StatCard emoji="🔄" label="Gyro X"      value={live.gx.toFixed(2)}          unit="°/s" bg="#fff0f4" accent={T.pink.primary} />
              <StatCard emoji="⬆️" label="Gyro Y"      value={live.gy.toFixed(2)}          unit="°/s" bg="#f0f4ff" accent="#6366f1" />
              <StatCard emoji="↙️" label="Gyro Z"      value={live.gz.toFixed(2)}          unit="°/s" bg="#e0f7ff" accent="#0ea5e9" />
            </View>

            <Text style={s.sectionTitle}>🌡️ Temperature</Text>
            <LineGraph data={tempH} color="#ef4444" label="Temperature" unit="°C"
              yMin={tempH.length ? Math.min(30, Math.min(...tempH) - 1) : 30}
              yMax={tempH.length ? Math.max(42, Math.max(...tempH) + 1) : 42} />

            <Text style={[s.sectionTitle, { marginTop: 20 }]}>📊 Gyroscope</Text>
            <LineGraph data={gxH} color={T.pink.primary} label="Gyro X" unit="°/s" yMin={-10} yMax={10} />
            <LineGraph data={gyH} color="#6366f1"         label="Gyro Y" unit="°/s" yMin={-10} yMax={10} />
            <LineGraph data={gzH} color="#0ea5e9"         label="Gyro Z" unit="°/s" yMin={-10} yMax={10} />

            <Text style={[s.sectionTitle, { marginTop: 20 }]}>📡 Raw Packet</Text>
            <View style={s.rawCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Latest BLE payload
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#22c55e" }}>{rxCount} rx</Text>
              </View>
              <Text style={s.rawJson} selectable>
                {(() => { try { return JSON.stringify(JSON.parse(rawJson), null, 2); } catch { return rawJson; } })()}
              </Text>
            </View>
          </>
        )}

        {connecting && (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={T.pink.primary} />
            <Text style={s.centerTitle}>Connecting…</Text>
            <Text style={s.centerSub}>Discovering GATT services</Text>
          </View>
        )}
        {connected && !live && !connecting && (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={T.pink.primary} />
            <Text style={s.centerTitle}>Waiting for data…</Text>
            <Text style={s.centerSub}>Device sends packets every 50 ms</Text>
          </View>
        )}

        <View style={s.guide}>
          <Text style={s.guideTitle}>ℹ️ How to connect</Text>
          <Text style={s.guideStep}>1. Power on the ESP32 device</Text>
          <Text style={s.guideStep}>2. Tap "Scan for ESP32" above</Text>
          <Text style={s.guideStep}>3. Select "Her Comfort" from the list</Text>
          <Text style={s.guideStep}>4. Live graphs appear automatically</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: T.bg.screen },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14,
                 borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTitle: { fontSize: 20, fontWeight: "900", color: T.text.primary },
  headerSub:   { fontSize: 12, color: T.text.muted, fontWeight: "500", marginTop: 1 },
  discBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#fef2f2",
                 paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                 borderWidth: 1, borderColor: "#fca5a5" },
  discTxt:     { fontSize: 12, fontWeight: "700", color: "#ef4444" },
  scroll:      { padding: 20, paddingBottom: 60 },
  statusCard:  { backgroundColor: T.bg.soft, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
  statusDot:   { width: 12, height: 12, borderRadius: 6 },
  statusTxt:   { fontSize: 14, fontWeight: "700", color: T.text.primary, flex: 1 },
  rxTxt:       { fontSize: 11, color: T.text.muted, marginTop: 6, fontWeight: "500" },
  warnBanner:  { backgroundColor: "#fffbeb", borderRadius: 20, padding: 16, marginBottom: 16,
                 borderWidth: 1, borderColor: "#fde68a" },
  warnTitle:   { fontSize: 14, fontWeight: "800", color: "#92400e", marginBottom: 4 },
  warnTxt:     { fontSize: 12, color: "#78350f", lineHeight: 18, marginBottom: 10 },
  demoBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                 paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14, alignSelf: "flex-start" },
  demoBtnTxt:  { color: "#fff", fontSize: 13, fontWeight: "800" },
  scanBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
                 paddingVertical: 16, borderRadius: 20, marginBottom: 16,
                 shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 4 },
                 shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  scanBtnTxt:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  sectionTitle:{ fontSize: 17, fontWeight: "900", color: T.text.primary, marginBottom: 12 },
  scanRow:     { flexDirection: "row", alignItems: "center", gap: 10, padding: 16,
                 backgroundColor: T.bg.soft, borderRadius: 16, marginBottom: 8 },
  scanRowTxt:  { fontSize: 13, color: T.text.muted, fontWeight: "600" },
  devCard:     { flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
                 borderRadius: 20, padding: 16, marginBottom: 10,
                 borderWidth: 1, borderColor: T.pink.border, gap: 14,
                 shadowColor: T.pink.primary, shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  devIcon:     { width: 48, height: 48, borderRadius: 24, backgroundColor: T.pink.bg,
                 alignItems: "center", justifyContent: "center" },
  devName:     { fontSize: 15, fontWeight: "800", color: T.text.primary, marginBottom: 2 },
  devId:       { fontSize: 11, color: T.text.muted, marginBottom: 2 },
  devRssi:     { fontSize: 11, color: "#22c55e", fontWeight: "600" },
  connBtn:     { backgroundColor: T.pink.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  connBtnTxt:  { color: "#fff", fontSize: 13, fontWeight: "700" },
  statsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  statCard:    { width: (width - 64) / 2, borderRadius: 20, padding: 16, borderWidth: 1,
                 alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statEmoji:   { fontSize: 28, marginBottom: 6 },
  statLbl:     { fontSize: 11, fontWeight: "700", color: "#6b7280", marginBottom: 4,
                 textTransform: "uppercase", letterSpacing: 0.5 },
  statVal:     { fontSize: 26, fontWeight: "900" },
  statUnit:    { fontSize: 11, fontWeight: "600", marginTop: 2 },
  graphCard:   { backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 12,
                 borderWidth: 1, borderColor: "#f3f4f6",
                 shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
                 shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  graphRow:    { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  dot:         { width: 10, height: 10, borderRadius: 5 },
  graphLbl:    { flex: 1, fontSize: 13, fontWeight: "700", color: T.text.primary },
  graphVal:    { fontSize: 16, fontWeight: "900" },
  rawCard:     { backgroundColor: "#0f172a", borderRadius: 20, padding: 16, marginBottom: 8 },
  rawJson:     { fontFamily: "monospace", fontSize: 13, color: "#e2e8f0", lineHeight: 20 },
  centerBox:   { alignItems: "center", paddingVertical: 40, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: "800", color: T.text.primary },
  centerSub:   { fontSize: 13, color: T.text.muted },
  guide:       { marginTop: 16, backgroundColor: T.bg.soft, borderRadius: 20, padding: 20,
                 borderWidth: 1, borderColor: T.pink.border },
  guideTitle:  { fontSize: 15, fontWeight: "800", color: T.text.primary, marginBottom: 10 },
  guideStep:   { fontSize: 13, color: T.text.muted, fontWeight: "500", lineHeight: 22 },
});
