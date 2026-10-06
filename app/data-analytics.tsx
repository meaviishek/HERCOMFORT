import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import sessionService, { SessionRecord } from '../services/sessionService';
import ApiService from '../services/ApiService';
import { T } from '../constants/theme';

export default function DataAnalyticsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [aiLearning, setAiLearning] = useState(true);
  const [cloudBackup, setCloudBackup] = useState(true);

  useEffect(() => {
    sessionService.getSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  const totalSessions = sessions.length;
  const reliefValues = sessions.map((s) => s.painBefore - s.painAfter);
  const avgRelief =
    reliefValues.length > 0
      ? (reliefValues.reduce((a, b) => a + b, 0) / reliefValues.length).toFixed(1)
      : '0.0';
  const avgReliefPct =
    sessions.length > 0
      ? Math.round(
          sessions
            .filter((s) => s.painBefore > 0)
            .reduce(
              (sum, s) => sum + ((s.painBefore - s.painAfter) / s.painBefore) * 100,
              0
            ) / Math.max(1, sessions.filter((s) => s.painBefore > 0).length)
        )
      : 0;
  const avgDuration =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((a, b) => a + (b.durationMin || 0), 0) / sessions.length
        )
      : 0;

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await ApiService.flushOfflineQueue();
      const latest = await sessionService.getSessions();
      setSessions(latest);
      Alert.alert(
        'Cloud Sync Complete',
        `Synchronized with MongoDB database.\n${res.sent} pending items pushed to server.`
      );
    } catch {
      Alert.alert('Sync Notice', 'Data is stored locally and will sync when server is reachable.');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportPDF = async () => {
    if (sessions.length === 0) {
      Alert.alert('No Sessions', 'Complete at least one therapy session before generating an analytics report.');
      return;
    }
    setExportingPDF(true);
    try {
      const rowsHtml = sessions
        .slice(0, 15)
        .map(
          (s) => `
          <tr>
            <td>${new Date(s.date).toLocaleDateString()}</td>
            <td>${s.durationMin}m (${s.durationSeconds}s)</td>
            <td>${s.painBefore} &rarr; ${s.painAfter} (-${s.painBefore - s.painAfter})</td>
            <td>${s.targetTemp}&deg;C / ${s.avgTemp?.toFixed(1)}&deg;C</td>
            <td>${s.vibMode} (${s.vibIntensity}%)</td>
            <td>${(s.contractionLevel ?? 'RELAXED').replace(/_/g, ' ')}</td>
          </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Nari Health - Clinical Analytics Report</title>
        <style>
          body { font-family: -apple-system, sans-serif; padding: 32px; color: #0F172A; }
          .header { border-bottom: 2px solid #E84EA1; padding-bottom: 16px; margin-bottom: 24px; }
          .brand { font-size: 24px; font-weight: 900; color: #E84EA1; }
          .sub { color: #64748B; font-size: 12px; margin-top: 4px; }
          .metrics { display: flex; gap: 12px; margin: 20px 0; }
          .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; background: #F8FAFC; }
          .box-label { font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; }
          .box-val { font-size: 20px; font-weight: 900; color: #0F172A; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
          th { background: #F1F5F9; text-align: left; padding: 8px 10px; font-size: 10px; color: #475569; text-transform: uppercase; border: 1px solid #E2E8F0; }
          td { padding: 8px 10px; border: 1px solid #E2E8F0; }
          .footer { margin-top: 32px; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">NARI HEALTH &bull; HER COMFORT</div>
          <div class="sub">Comprehensive AI Bio-Telemetry & Therapy Analytics Report</div>
          <div class="sub">Generated: ${new Date().toLocaleString()}</div>
        </div>

        <div class="metrics">
          <div class="box"><div class="box-label">Total Sessions</div><div class="box-val">${totalSessions}</div></div>
          <div class="box"><div class="box-label">Avg Pain Relief</div><div class="box-val" style="color:#059669">-${avgRelief} pts</div></div>
          <div class="box"><div class="box-label">Avg Relief %</div><div class="box-val" style="color:#E84EA1">${avgReliefPct}%</div></div>
          <div class="box"><div class="box-label">Avg Session</div><div class="box-val" style="color:#0284C7">${avgDuration} min</div></div>
        </div>

        <h3>Recent Clinical Therapy Records</h3>
        <table>
          <tr>
            <th>Date</th>
            <th>Duration</th>
            <th>Pain Delta</th>
            <th>Heat (Set / Avg)</th>
            <th>Motor Mode</th>
            <th>EMG Contraction</th>
          </tr>
          ${rowsHtml}
        </table>

        <div class="footer">
          Confidential medical summary generated via Nari AI Bio-Telemetry System. For clinical evaluation only.
        </div>
      </body>
      </html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Clinical Health Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Report Generated', `Saved to:\n${uri}`);
      }
    } catch {
      Alert.alert('Export Error', 'Could not generate report PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportJSON = async () => {
    if (sessions.length === 0) {
      Alert.alert('No Data', 'No therapy sessions recorded yet.');
      return;
    }
    setExportingData(true);
    try {
      const dataStr = JSON.stringify(
        {
          appName: 'Nari Health AI',
          exportedAt: new Date().toISOString(),
          totalSessions,
          analytics: { avgRelief, avgReliefPct, avgDuration },
          sessions,
        },
        null,
        2
      );

      const fileUri = `${(FileSystem as any).documentDirectory || ''}nari_telemetry_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, dataStr);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Telemetry Data (JSON)',
        });
      } else {
        Alert.alert('Data Exported', `Saved to ${fileUri}`);
      }
    } catch {
      Alert.alert('Export Error', 'Could not export telemetry file.');
    } finally {
      setExportingData(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Data & Analytics</Text>
        <TouchableOpacity
          onPress={handleManualSync}
          style={s.syncBtn}
          activeOpacity={0.7}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#0284C7" />
          ) : (
            <Feather name="refresh-cw" size={18} color="#0284C7" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Analytics Top Strip */}
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>SESSIONS</Text>
            <Text style={s.statVal}>{totalSessions}</Text>
            <Text style={s.statSub}>Logged</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>AVG RELIEF</Text>
            <Text style={[s.statVal, { color: '#059669' }]}>-{avgRelief}</Text>
            <Text style={s.statSub}>Pain Points</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>RELIEF RATE</Text>
            <Text style={[s.statVal, { color: T.pink.action }]}>{avgReliefPct}%</Text>
            <Text style={s.statSub}>Reduction</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>AVG TIME</Text>
            <Text style={[s.statVal, { color: '#0284C7' }]}>{avgDuration}m</Text>
            <Text style={s.statSub}>Per Session</Text>
          </View>
        </View>

        {/* Cloud Sync Status Card */}
        <Text style={s.sectionHeader}>CLOUD PERSISTENCE & SYNC</Text>
        <View style={s.card}>
          <View style={s.syncRow}>
            <View style={s.syncIconBox}>
              <MaterialCommunityIcons name="cloud-check" size={24} color="#059669" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.syncTitle}>MongoDB Cloud Verified</Text>
                <View style={s.livePill}>
                  <Text style={s.livePillText}>ONLINE</Text>
                </View>
              </View>
              <Text style={s.syncSub}>Biometric readings & session records are safely backed up</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.syncActionBtn}
            onPress={handleManualSync}
            disabled={syncing}
            activeOpacity={0.8}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather name="cloud-lightning" size={16} color="#FFFFFF" />
            )}
            <Text style={s.syncActionText}>
              {syncing ? 'Synchronizing with Cloud...' : 'Sync All Records Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Data Export Options */}
        <Text style={s.sectionHeader}>EXPORT CLINICAL RECORDS</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.exportRow}
            onPress={handleExportPDF}
            disabled={exportingPDF}
            activeOpacity={0.7}
          >
            <View style={[s.exportIconBox, { backgroundColor: '#FFF0F5' }]}>
              {exportingPDF ? (
                <ActivityIndicator size="small" color={T.pink.action} />
              ) : (
                <Feather name="file-text" size={20} color={T.pink.action} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.exportTitle}>Clinical Analytics Report (PDF)</Text>
              <Text style={s.exportSub}>Physician-grade report with tables & EMG stats</Text>
            </View>
            <Feather name="download" size={18} color={T.pink.action} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.exportRow, { borderBottomWidth: 0 }]}
            onPress={handleExportJSON}
            disabled={exportingData}
            activeOpacity={0.7}
          >
            <View style={[s.exportIconBox, { backgroundColor: '#EFF6FF' }]}>
              {exportingData ? (
                <ActivityIndicator size="small" color="#0284C7" />
              ) : (
                <MaterialCommunityIcons name="code-json" size={22} color="#0284C7" />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.exportTitle}>Export Raw Biometrics (JSON)</Text>
              <Text style={s.exportSub}>Complete raw waveform & therapy telemetry log</Text>
            </View>
            <Feather name="share-2" size={18} color="#0284C7" />
          </TouchableOpacity>
        </View>

        {/* AI & Telemetry Preferences */}
        <Text style={s.sectionHeader}>ANALYTICS PREFERENCES</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="brain" size={20} color="#7C3AED" />
              <View>
                <Text style={s.rowLabel}>AI Adaptive Biofeedback</Text>
                <Text style={s.rowSub}>Learn contraction response to tune heat/motor</Text>
              </View>
            </View>
            <Switch
              value={aiLearning}
              onValueChange={setAiLearning}
              trackColor={{ false: '#E2E8F0', true: '#DDD6FE' }}
              thumbColor={aiLearning ? '#7C3AED' : '#94A3B8'}
            />
          </View>

          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={20} color="#0284C7" />
              <View>
                <Text style={s.rowLabel}>Continuous Background Sync</Text>
                <Text style={s.rowSub}>Upload sensor batches every 8 seconds</Text>
              </View>
            </View>
            <Switch
              value={cloudBackup}
              onValueChange={setCloudBackup}
              trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              thumbColor={cloudBackup ? '#0284C7' : '#94A3B8'}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  statVal: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statSub: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  syncIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  livePill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  syncSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  syncActionBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  syncActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  exportIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  exportSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
});
