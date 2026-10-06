import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';
import edgeAiHealthService, {
  HealthVitals,
  EnvironmentalContext,
  VulnerabilityProfile,
  AnomalyReport,
} from '../services/edgeAiHealthService';

export default function EdgeAiVitalsScreen() {
  const router = useRouter();
  const [vitals, setVitals] = useState<HealthVitals | null>(null);
  const [env, setEnv] = useState<EnvironmentalContext | null>(null);
  const [vuln, setVuln] = useState<VulnerabilityProfile | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyReport[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastInferenceTime, setLastInferenceTime] = useState<number>(Date.now());
  const [inferenceLatencyMs, setInferenceLatencyMs] = useState<number>(3);

  useEffect(() => {
    fetchDataAndRunInference();
  }, []);

  const fetchDataAndRunInference = async (customVitals?: HealthVitals) => {
    const v = customVitals || (await edgeAiHealthService.getVitals());
    const e = await edgeAiHealthService.getEnvironmentalContext();
    const p = await edgeAiHealthService.getVulnerability();

    const tStart = performance.now ? performance.now() : Date.now();
    const result = edgeAiHealthService.runLocalInference(v, e, p);
    const tEnd = performance.now ? performance.now() : Date.now();

    setVitals(v);
    setEnv(e);
    setVuln(p);
    setAnomalies(result.anomalies);
    setLastInferenceTime(Date.now());
    setInferenceLatencyMs(Math.max(1, Math.round(tEnd - tStart)));
  };

  const handleRunManualScan = async () => {
    setIsAnalyzing(true);
    setTimeout(async () => {
      await fetchDataAndRunInference();
      setIsAnalyzing(false);
      Alert.alert(
        'Edge AI Inference Complete',
        'Multi-parametric diagnostic scan evaluated on-device across 6 physiological sensors & local atmospheric telemetry.'
      );
    }, 600);
  };

  const handleSimulateCondition = async (type: 'heat_stress' | 'hypoxia' | 'tachycardia' | 'normal') => {
    if (!vitals) return;
    let newVitals = { ...vitals };
    if (type === 'heat_stress') {
      newVitals = {
        ...newVitals,
        bodyTemperature: 38.9,
        heartRate: 112,
        activityLevel: 'moderate',
      };
    } else if (type === 'hypoxia') {
      newVitals = {
        ...newVitals,
        spo2: 91,
        respiratoryRate: 24,
        heartRate: 98,
      };
    } else if (type === 'tachycardia') {
      newVitals = {
        ...newVitals,
        heartRate: 128,
        bodyTemperature: 37.1,
      };
    } else {
      newVitals = {
        ...newVitals,
        heartRate: 72,
        spo2: 98,
        bodyTemperature: 36.6,
        respiratoryRate: 15,
        activityLevel: 'light',
      };
    }
    await edgeAiHealthService.saveVitals(newVitals);
    await fetchDataAndRunInference(newVitals);
  };

  if (!vitals || !env) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={T.pink.action} />
        <Text className="text-gray-500 mt-2">Loading Edge AI Vitals...</Text>
      </SafeAreaView>
    );
  }

  const getSeverityBadge = (sev: AnomalyReport['severity']) => {
    switch (sev) {
      case 'critical':
        return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' };
      case 'high':
        return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' };
      case 'moderate':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
      default:
        return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' };
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center active:opacity-70"
        >
          <Feather name="arrow-left" size={20} color="#374151" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-lg font-bold text-gray-900">Edge AI Anomaly Monitor</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
            <Text className="text-xs text-gray-500 font-medium">100% On-Device Inference</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleRunManualScan}
          className="w-10 h-10 rounded-full bg-pink-50 items-center justify-center active:opacity-70"
        >
          <MaterialCommunityIcons name="lightning-bolt" size={20} color={T.pink.action} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Edge AI Engine Banner */}
        <View className="bg-[#0f172a] rounded-3xl p-5 mb-5 shadow-lg relative overflow-hidden">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-pink-500/20 items-center justify-center mr-2.5">
                <Ionicons name="hardware-chip-outline" size={18} color={T.pink.action} />
              </View>
              <View>
                <Text className="text-white font-bold text-base">Neural Edge Model v2.4</Text>
                <Text className="text-gray-400 text-xs">Zero Cloud Latency | Offline Active</Text>
              </View>
            </View>
            <View className="bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <Text className="text-emerald-400 text-[11px] font-bold">{inferenceLatencyMs} ms</Text>
            </View>
          </View>

          <Text className="text-gray-300 text-xs leading-4 mb-4">
            Physiological telemetry is continuously benchmarked against historical baselines and local
            India disaster strain matrices without sending unencrypted telemetry outside your device.
          </Text>

          <View className="flex-row items-center justify-between pt-3 border-t border-gray-800">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="shield-check" size={16} color="#10b981" />
              <Text className="text-emerald-400 text-xs font-semibold ml-1.5">
                Privacy Preserved (Local)
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRunManualScan}
              disabled={isAnalyzing}
              className="bg-pink-600 px-3 py-1.5 rounded-xl flex-row items-center active:opacity-80"
            >
              {isAnalyzing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={13} color="#ffffff" />
                  <Text className="text-white text-xs font-bold ml-1.5">Scan Now</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Vitals Grid */}
        <Text className="text-sm font-bold text-gray-800 mb-3 px-1">
          Real-Time Physiological Telemetry
        </Text>
        <View className="grid grid-cols-2 flex-row flex-wrap justify-between gap-y-3 mb-5">
          {/* Heart Rate */}
          <View className="w-[48%] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center">
                <Ionicons name="heart" size={18} color="#f43f5e" />
              </View>
              <Text className="text-[11px] font-semibold text-gray-400">Normal 60-100</Text>
            </View>
            <Text className="text-2xl font-black text-gray-900">{vitals.heartRate}</Text>
            <Text className="text-xs text-gray-500 font-medium">Heart Rate (BPM)</Text>
            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  vitals.heartRate > 100 || vitals.heartRate < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <Text className="text-[10px] text-gray-600">
                {vitals.heartRate > 100 ? 'Elevated Pulse' : 'Within Baseline'}
              </Text>
            </View>
          </View>

          {/* SpO2 */}
          <View className="w-[48%] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-full bg-sky-50 items-center justify-center">
                <MaterialCommunityIcons name="water-percent" size={20} color="#0284c7" />
              </View>
              <Text className="text-[11px] font-semibold text-gray-400">Normal &gt; 95%</Text>
            </View>
            <Text className="text-2xl font-black text-gray-900">{vitals.spo2}%</Text>
            <Text className="text-xs text-gray-500 font-medium">Blood Oxygen (SpO2)</Text>
            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  vitals.spo2 < 94 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              <Text className="text-[10px] text-gray-600">
                {vitals.spo2 < 94 ? 'Hypoxia Risk' : 'Adequate Saturation'}
              </Text>
            </View>
          </View>

          {/* Body Temperature */}
          <View className="w-[48%] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-full bg-amber-50 items-center justify-center">
                <Ionicons name="thermometer" size={18} color="#d97706" />
              </View>
              <Text className="text-[11px] font-semibold text-gray-400">Normal 36.5-37.5</Text>
            </View>
            <Text className="text-2xl font-black text-gray-900">{vitals.bodyTemperature}°C</Text>
            <Text className="text-xs text-gray-500 font-medium">Core Temperature</Text>
            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  vitals.bodyTemperature > 37.8 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              />
              <Text className="text-[10px] text-gray-600">
                {vitals.bodyTemperature > 37.8 ? 'Hyperthermia Alert' : 'Euthermic'}
              </Text>
            </View>
          </View>

          {/* Respiratory Rate */}
          <View className="w-[48%] bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <View className="flex-row items-center justify-between mb-2">
              <View className="w-8 h-8 rounded-full bg-teal-50 items-center justify-center">
                <MaterialCommunityIcons name="weather-windy" size={18} color="#0d9488" />
              </View>
              <Text className="text-[11px] font-semibold text-gray-400">Normal 12-20</Text>
            </View>
            <Text className="text-2xl font-black text-gray-900">{vitals.respiratoryRate}</Text>
            <Text className="text-xs text-gray-500 font-medium">Breaths / min</Text>
            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center">
              <View
                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                  vitals.respiratoryRate > 22 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <Text className="text-[10px] text-gray-600">
                {vitals.respiratoryRate > 22 ? 'Tachypnea' : 'Steady Cadence'}
              </Text>
            </View>
          </View>
        </View>

        {/* Anomaly Detection Status / Feed */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Ionicons name="warning" size={18} color={anomalies.length > 0 ? '#ef4444' : '#10b981'} />
              <Text className="text-sm font-bold text-gray-800 ml-2">
                Active Edge Anomaly Diagnostics
              </Text>
            </View>
            <View
              className={`px-2 py-0.5 rounded-full ${
                anomalies.length > 0 ? 'bg-rose-100' : 'bg-emerald-100'
              }`}
            >
              <Text
                className={`text-[10px] font-bold ${
                  anomalies.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {anomalies.length} Flagged
              </Text>
            </View>
          </View>

          {anomalies.length === 0 ? (
            <View className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-100 items-center justify-center">
              <Ionicons name="checkmark-circle" size={32} color="#10b981" />
              <Text className="text-sm font-bold text-emerald-900 mt-2">All Physiological Metrics Normal</Text>
              <Text className="text-xs text-emerald-700 text-center mt-1">
                No acute heat exhaustion, dehydration drift, or respiratory distress patterns detected by on-device intelligence.
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {anomalies.map((anom) => {
                const badge = getSeverityBadge(anom.severity);
                return (
                  <View
                    key={anom.id}
                    className={`rounded-2xl p-4 border ${badge.border} ${badge.bg}/40`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-sm font-bold text-gray-900 flex-1">{anom.title}</Text>
                      <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
                        <Text className={`text-[10px] font-bold uppercase ${badge.text}`}>
                          {anom.severity}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-xs text-gray-600 mb-2 leading-4">{anom.description}</Text>
                    <View className="bg-white/90 rounded-xl p-2.5 mb-2 border border-gray-100">
                      <Text className="text-[11px] font-semibold text-gray-500">Trigger Indicator:</Text>
                      <Text className="text-xs font-bold text-gray-800 mt-0.5">{anom.vitalTrigger}</Text>
                    </View>
                    <View className="flex-row items-start">
                      <Feather name="shield" size={13} color="#0f766e" style={{ marginTop: 2, marginRight: 5 }} />
                      <Text className="text-xs text-teal-900 flex-1 leading-4">
                        {anom.clinicalRecommendation}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Simulation Bar for Testing */}
        <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm border border-gray-100">
          <Text className="text-sm font-bold text-gray-800 mb-2">Simulate Physiological Events</Text>
          <Text className="text-xs text-gray-500 mb-3">
            Simulate sensor readings on your device to verify how on-device AI flags health risks before emergencies.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              { id: 'normal', label: '🌿 Normal Vitals' },
              { id: 'heat_stress', label: '🔥 Heat Stroke Spike' },
              { id: 'hypoxia', label: '🫁 SpO2 Hypoxia Drop' },
              { id: 'tachycardia', label: '💓 Arrhythmia Pulse' },
            ].map((sim) => (
              <TouchableOpacity
                key={sim.id}
                onPress={() => handleSimulateCondition(sim.id as any)}
                className="bg-gray-100 px-3.5 py-2 rounded-xl active:bg-pink-100"
              >
                <Text className="text-xs font-semibold text-gray-700">{sim.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
