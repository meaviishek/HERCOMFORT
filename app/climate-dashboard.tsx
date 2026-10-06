import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';
import edgeAiHealthService, {
  HealthVitals,
  EnvironmentalContext,
  VulnerabilityProfile,
  RiskScores,
} from '../services/edgeAiHealthService';

export default function ClimateDashboardScreen() {
  const router = useRouter();
  const [vitals, setVitals] = useState<HealthVitals | null>(null);
  const [env, setEnv] = useState<EnvironmentalContext | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScores | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const v = await edgeAiHealthService.getVitals();
    const e = await edgeAiHealthService.getEnvironmentalContext();
    const vuln = await edgeAiHealthService.getVulnerability();
    const inference = edgeAiHealthService.runLocalInference(v, e, vuln);

    setVitals(v);
    setEnv(e);
    setRiskScores(inference.riskScores);
  };

  if (!vitals || !env || !riskScores) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Calculating Climate Resilience Scores...</Text>
      </SafeAreaView>
    );
  }

  // Calculate dynamic hydration requirement based on heat index & physical exertion
  const baseWaterLiters = 2.2;
  const heatWaterBonus = env.heatIndex > 40 ? 1.4 : env.heatIndex > 35 ? 0.9 : 0.4;
  const recommendedWater = (baseWaterLiters + heatWaterBonus).toFixed(1);

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#ef4444'; // high strain
    if (score >= 45) return '#f97316'; // moderate strain
    return '#10b981'; // optimal/low
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
          <Text className="text-lg font-bold text-gray-900">Climate Resilience Dashboard</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-pink-500 mr-1.5" />
            <Text className="text-xs text-gray-500 font-medium">Daily Personal Assessment</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/disaster-alerts' as any)}
          className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center active:opacity-70"
        >
          <Feather name="alert-triangle" size={18} color="#f97316" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Composite Resilience Hero Card */}
        <View className="bg-[#0f172a] rounded-3xl p-6 mb-5 shadow-xl">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-xs font-bold text-pink-400 uppercase tracking-wider">
                Overall Vitality Index
              </Text>
              <Text className="text-white text-xl font-black mt-0.5">Disaster Resilience</Text>
            </View>
            <View className="bg-white/10 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-xs font-semibold text-white">Edge AI Certified</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-baseline">
              <Text className="text-5xl font-black text-white">
                {riskScores.compositeResilienceScore}
              </Text>
              <Text className="text-gray-400 text-base font-semibold ml-1">/100</Text>
            </View>
            <View
              className="px-3.5 py-1.5 rounded-2xl"
              style={{
                backgroundColor:
                  riskScores.compositeResilienceScore > 75
                    ? '#059669'
                    : riskScores.compositeResilienceScore > 50
                    ? '#d97706'
                    : '#dc2626',
              }}
            >
              <Text className="text-white font-bold text-xs uppercase tracking-wide">
                {riskScores.compositeResilienceScore > 75
                  ? 'High Resilience'
                  : riskScores.compositeResilienceScore > 50
                  ? 'Guarded State'
                  : 'Vulnerable Risk'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View className="h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
            <View
              className="h-full rounded-full"
              style={{
                width: `${riskScores.compositeResilienceScore}%`,
                backgroundColor:
                  riskScores.compositeResilienceScore > 75
                    ? '#10b981'
                    : riskScores.compositeResilienceScore > 50
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
          </View>

          <Text className="text-gray-400 text-xs leading-4">
            Calculated by cross-referencing resting cardiac drift, thermal regulation stability,
            ambient wet-bulb temperature, and pollution exposure.
          </Text>
        </View>

        {/* 4 Multi-Factor Risk Score Meters */}
        <Text className="text-sm font-bold text-gray-800 mb-3 px-1">
          Multi-Factor Disaster Stress Metrics
        </Text>
        <View className="space-y-3 mb-5">
          {/* Heat Stress */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2.5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-rose-50 items-center justify-center mr-2.5">
                  <Ionicons name="flame" size={18} color="#f43f5e" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Heat Stress Risk</Text>
                  <Text className="text-[11px] text-gray-400">Core vs Ambient Heat Index ({env.heatIndex}°C)</Text>
                </View>
              </View>
              <Text
                className="text-base font-black"
                style={{ color: getScoreColor(riskScores.heatStressScore) }}
              >
                {riskScores.heatStressScore}%
              </Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${riskScores.heatStressScore}%`,
                  backgroundColor: getScoreColor(riskScores.heatStressScore),
                }}
              />
            </View>
          </View>

          {/* Respiratory Risk */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2.5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-sky-50 items-center justify-center mr-2.5">
                  <MaterialCommunityIcons name="lungs" size={18} color="#0284c7" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Respiratory Compromise</Text>
                  <Text className="text-[11px] text-gray-400">SpO2 ({vitals.spo2}%) vs Ambient NAQI ({env.aqi})</Text>
                </View>
              </View>
              <Text
                className="text-base font-black"
                style={{ color: getScoreColor(riskScores.respiratoryRiskScore) }}
              >
                {riskScores.respiratoryRiskScore}%
              </Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${riskScores.respiratoryRiskScore}%`,
                  backgroundColor: getScoreColor(riskScores.respiratoryRiskScore),
                }}
              />
            </View>
          </View>

          {/* Cardiovascular Strain */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2.5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-purple-50 items-center justify-center mr-2.5">
                  <Ionicons name="pulse" size={18} color="#8b5cf6" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Cardiovascular Workload</Text>
                  <Text className="text-[11px] text-gray-400">Heart Rate ({vitals.heartRate} bpm) + Thermal Load</Text>
                </View>
              </View>
              <Text
                className="text-base font-black"
                style={{ color: getScoreColor(riskScores.cardioStrainScore) }}
              >
                {riskScores.cardioStrainScore}%
              </Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${riskScores.cardioStrainScore}%`,
                  backgroundColor: getScoreColor(riskScores.cardioStrainScore),
                }}
              />
            </View>
          </View>

          {/* Waterborne Pathogen Risk */}
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-2.5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-emerald-50 items-center justify-center mr-2.5">
                  <Ionicons name="water" size={18} color="#059669" />
                </View>
                <View>
                  <Text className="text-sm font-bold text-gray-900">Flood / Waterborne Vector Risk</Text>
                  <Text className="text-[11px] text-gray-400">Relative Humidity ({env.humidity}%) & Monsoon Status</Text>
                </View>
              </View>
              <Text
                className="text-base font-black"
                style={{ color: getScoreColor(riskScores.waterborneRiskScore) }}
              >
                {riskScores.waterborneRiskScore}%
              </Text>
            </View>
            <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${riskScores.waterborneRiskScore}%`,
                  backgroundColor: getScoreColor(riskScores.waterborneRiskScore),
                }}
              />
            </View>
          </View>
        </View>

        {/* Personalized Climate-Adaptive Recommendations */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="lightbulb-on" size={18} color="#f59e0b" />
            <Text className="text-sm font-bold text-gray-800 ml-2">
              Personalized Climate Action Plan
            </Text>
          </View>

          {/* Hydration target */}
          <View className="bg-pink-50/60 rounded-2xl p-3.5 mb-3 border border-pink-100 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View className="w-10 h-10 rounded-full bg-pink-100 items-center justify-center mr-3">
                <Ionicons name="water" size={20} color={T.pink.action} />
              </View>
              <View>
                <Text className="text-xs font-bold text-gray-900">Target Fluid Intake</Text>
                <Text className="text-[11px] text-gray-500">
                  Heat index adjusted (+{heatWaterBonus}L climate boost)
                </Text>
              </View>
            </View>
            <Text className="text-xl font-black text-pink-600">{recommendedWater} L</Text>
          </View>

          {/* Rest cadence */}
          <View className="bg-blue-50/60 rounded-2xl p-3.5 mb-3 border border-blue-100 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                <Feather name="clock" size={18} color="#0284c7" />
              </View>
              <View>
                <Text className="text-xs font-bold text-gray-900">Rest & Cooling Cadence</Text>
                <Text className="text-[11px] text-gray-500">
                  Take 15-minute breaks in shaded area every 45 mins of physical labor.
                </Text>
              </View>
            </View>
          </View>

          {/* Medical consultation */}
          <View className="bg-emerald-50/60 rounded-2xl p-3.5 border border-emerald-100 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-3">
              <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
                <MaterialCommunityIcons name="doctor" size={20} color="#059669" />
              </View>
              <View>
                <Text className="text-xs font-bold text-gray-900">Clinical Triage Guideline</Text>
                <Text className="text-[11px] text-gray-500">
                  Seek immediate physician review if pulse stays &gt;110 bpm or SpO2 stays &lt;93%.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 7-Day Trend Visualizer */}
        <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-gray-800">7-Day Resilience Trend</Text>
            <Text className="text-xs text-emerald-600 font-semibold">+6% Improvement</Text>
          </View>
          <View className="flex-row items-end justify-between h-28 pt-4 px-2">
            {[
              { day: 'Mon', score: 72 },
              { day: 'Tue', score: 68 },
              { day: 'Wed', score: 64 },
              { day: 'Thu', score: 79 },
              { day: 'Fri', score: 81 },
              { day: 'Sat', score: 77 },
              { day: 'Sun', score: riskScores.compositeResilienceScore },
            ].map((d, i) => (
              <View key={i} className="items-center flex-1">
                <View
                  className="w-5 rounded-t-lg"
                  style={{
                    height: `${d.score}%`,
                    backgroundColor: i === 6 ? T.pink.action : '#e2e8f0',
                  }}
                />
                <Text className="text-[10px] text-gray-500 font-semibold mt-1.5">{d.day}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
