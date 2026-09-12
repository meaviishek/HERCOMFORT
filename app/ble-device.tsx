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
import { useBluetooth, CONNECTION_STATUS } from "../context/BluetoothContext";
import { T } from "../constants/theme";

const TARGET_NAME  = "Her Comfort";
const SERVICE_UUID = "12345678-1234-1234-1234-123456789000";
const CHAR_UUID    = "12345678-1234-1234-1234-123456789001";
const GRAPH_POINTS = 60;
const { width }    = Dimensions.get("window");
const GRAPH_W      = width - 48;
const GRAPH_H      = 130;

const nativeBleAvailable = Platform.OS !== "web" && (NativeModules.RNBluetoothClassic != null || (NativeModules as any).BleClient != null);

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

function StatCard({ icon, label, value, unit, bg, accent }: {
  icon: string; label: string; value: string; unit: string; bg: string; accent: string;
}) {
  return (
    <View style={[s.statCard, { backgroundColor: bg, borderColor: accent + "30" }]}>
      <View style={{ marginBottom: 6 }}>
        <Feather name={icon as any} size={22} color={accent} />
      </View>
      <Text style={s.statLbl}>{label}</Text>
      <Text style={[s.statVal, { color: accent }]}>{value}</Text>
      <Text style={[s.statUnit, { color: accent + "99" }]}>{unit}</Text>
    </View>
  );
}

export default function BleDeviceScreen() {
  const router = useRouter();
  const {
    connectedDevice,
    connectionStatus,
    connectionError,
    isScanning,
    liveData,
    history,
    packetCount,
    scan,
    connect,
    disconnect,
    discoveredDevices,
  } = useBluetooth();

  const connected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const connecting = connectionStatus === CONNECTION_STATUS.CONNECTING;
  const scanning = isScanning;

  const pulse = useRef(new Animated.Value(1)).current;
  const [selectedDevId, setSelectedDevId] = useState<string | null>(null);

  useEffect(() => {
    if (!liveData) return;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [packetCount]);

  const handleConnectDevice = useCallback(
    async (dev: any) => {
      setSelectedDevId(dev.id || dev.address);
      try {
        await connect(dev);
      } catch (e) {
        console.error('Connection error:', e);
      } finally {
        setSelectedDevId(null);
      }
    },
    [connect]
  );

  const tempH = history.map((h) => Number(h.temp ?? h.temperature ?? 36.6));
  const gxH = history.map((h) => Number(h.gx ?? 0));
  const gyH = history.map((h) => Number(h.gy ?? 0));
  const gzH = history.map((h) => Number(h.gz ?? 0));

  const live = liveData
    ? {
        temperature: Number(liveData.temp ?? liveData.temperature ?? 36.6),
        gx: Number(liveData.gx ?? 0),
        gy: Number(liveData.gy ?? 0),
        gz: Number(liveData.gz ?? 0),
      }
    : null;


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
        {/* Native Bluetooth Environment notice banner */}
        {!nativeBleAvailable && (
          <View style={s.warnBanner}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Feather name="alert-triangle" size={20} color="#d97706" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={s.warnTitle}>Native Bluetooth Hardware</Text>
                <Text style={s.warnTxt}>
                  Bluetooth hardware requires a native build. Install the standalone APK or run native Android dev client.
                </Text>
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
              {connected
                ? `Connected — ${connectedDevice?.name ?? connectedDevice?.address ?? (connectedDevice as any)?.id}`
                : scanning
                ? "Scanning for Her Comfort…"
                : connectionError
                ? `Error: ${connectionError}`
                : "Tap Scan to find your device"}
            </Text>
          </View>
          {connected && (
            <Text style={s.rxTxt}>{packetCount} packets received</Text>
          )}
        </View>

        {/* Scan controls */}
        {!connected && (
          <>
            <TouchableOpacity onPress={scan} disabled={scanning}
              style={[s.scanBtn, { backgroundColor: scanning ? "#9ca3af" : T.pink.primary }]} activeOpacity={0.85}>
              {scanning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="bluetooth" size={18} color="#fff" />
              )}
              <Text style={s.scanBtnTxt}>{scanning ? "Scanning…" : "Scan for ESP32"}</Text>
            </TouchableOpacity>

            {(scanning || discoveredDevices.length > 0) && (
              <View>
                <Text style={s.sectionTitle}>
                  {discoveredDevices.length > 0 ? `Found ${discoveredDevices.length} device${discoveredDevices.length > 1 ? "s" : ""}` : "Searching…"}
                </Text>
                {scanning && discoveredDevices.length === 0 && (
                  <View style={s.scanRow}>
                    <ActivityIndicator size="small" color={T.pink.primary} />
                    <Text style={s.scanRowTxt}>Looking for "Her Comfort"…</Text>
                  </View>
                )}
                {discoveredDevices.map((dev: any) => {
                  const devName = dev.name || dev.localName || "";
                  const devId = dev.address || dev.id || "";
                  const isMatch =
                    Boolean(dev.isHerComfort) ||
                    devName.toLowerCase().includes("her comfort") ||
                    devName.toLowerCase().includes("hercomfort") ||
                    devName.toLowerCase().includes("esp32");

                  const title = devName && devName !== "N/A"
                    ? devName
                    : isMatch
                    ? "Her Comfort (ESP32)"
                    : "BLE Device (N/A)";

                  const isThisConnecting = connecting && selectedDevId === devId;

                  return (
                    <TouchableOpacity key={devId} onPress={() => handleConnectDevice(dev)} disabled={connecting}
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
                        <Text style={s.devId}>{devId}</Text>
                        {dev.rssi != null && (
                          <Text style={s.devRssi}>
                            {dev.rssi} dBm · {dev.rssi > -60 ? "Excellent" : dev.rssi > -75 ? "Good" : "Weak"}
                          </Text>
                        )}
                      </View>
                      {isThisConnecting
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
              <StatCard icon="thermometer" label="Temperature" value={live.temperature.toFixed(2)} unit="°C" bg="#fff0f0" accent="#ef4444" />
              <StatCard icon="activity"    label="Gyro X"      value={live.gx.toFixed(2)}          unit="°/s" bg="#fff0f4" accent={T.pink.primary} />
              <StatCard icon="navigation"  label="Gyro Y"      value={live.gy.toFixed(2)}          unit="°/s" bg="#f0f4ff" accent="#6366f1" />
              <StatCard icon="compass"     label="Gyro Z"      value={live.gz.toFixed(2)}          unit="°/s" bg="#e0f7ff" accent="#0ea5e9" />
            </View>

            <Text style={s.sectionTitle}>Temperature Telemetry</Text>
            <LineGraph data={tempH} color="#ef4444" label="Temperature" unit="°C"
              yMin={tempH.length ? Math.min(30, Math.min(...tempH) - 1) : 30}
              yMax={tempH.length ? Math.max(42, Math.max(...tempH) + 1) : 42} />

            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Gyroscope Tri-Axis</Text>
            <LineGraph data={gxH} color={T.pink.primary} label="Gyro X" unit="°/s" yMin={-10} yMax={10} />
            <LineGraph data={gyH} color="#6366f1"         label="Gyro Y" unit="°/s" yMin={-10} yMax={10} />
            <LineGraph data={gzH} color="#0ea5e9"         label="Gyro Z" unit="°/s" yMin={-10} yMax={10} />

            <Text style={[s.sectionTitle, { marginTop: 20 }]}>Raw Packet</Text>
            <View style={s.rawCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.8 }}>
                  Latest Sensor Payload
                </Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: "#22c55e" }}>{packetCount} rx</Text>
              </View>
              <Text style={s.rawJson} selectable>
                {JSON.stringify(liveData, null, 2)}
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
          <Text style={s.guideTitle}>How to connect</Text>
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
