import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';
import edgeAiHealthService, {
  EnvironmentalContext,
  VulnerabilityProfile,
  DisasterAdvisoryItem,
} from '../services/edgeAiHealthService';

export default function DisasterAlertsScreen() {
  const router = useRouter();
  const [env, setEnv] = useState<EnvironmentalContext | null>(null);
  const [vuln, setVuln] = useState<VulnerabilityProfile | null>(null);
  const [protocols, setProtocols] = useState<DisasterAdvisoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'heatwave' | 'pollution' | 'flood' | 'cyclone'>('all');
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const envData = await edgeAiHealthService.getEnvironmentalContext();
    const vulnData = await edgeAiHealthService.getVulnerability();
    const protoData = edgeAiHealthService.getDisasterProtocols();
    setEnv(envData);
    setVuln(vulnData);
    setProtocols(protoData);
  };

  const handleToggleVuln = async (key: keyof VulnerabilityProfile) => {
    if (!vuln) return;
    const updated = { ...vuln, [key]: !vuln[key] };
    setVuln(updated);
    await edgeAiHealthService.saveVulnerability(updated);
  };

  const setDisasterMode = async (type: EnvironmentalContext['disasterType']) => {
    if (!env) return;
    let temp = env.ambientTemp;
    let humidity = env.humidity;
    let aqi = env.aqi;
    let pm25 = env.pm25;
    let level: EnvironmentalContext['disasterLevel'] = 'yellow_watch';

    if (type === 'heatwave') {
      temp = 43.5;
      humidity = 48;
      aqi = 160;
      pm25 = 75;
      level = 'orange_alert';
    } else if (type === 'severe_pollution') {
      temp = 24.0;
      humidity = 68;
      aqi = 380;
      pm25 = 260;
      level = 'red_warning';
    } else if (type === 'flood_monsoon') {
      temp = 29.5;
      humidity = 92;
      aqi = 45;
      pm25 = 20;
      level = 'orange_alert';
    } else if (type === 'cyclone') {
      temp = 27.0;
      humidity = 95;
      aqi = 30;
      pm25 = 15;
      level = 'red_warning';
    } else {
      temp = 32.0;
      humidity = 55;
      aqi = 90;
      pm25 = 45;
      level = 'safe';
    }

    const heatIndex = edgeAiHealthService.calculateHeatIndex(temp, humidity);
    const updated: EnvironmentalContext = {
      ...env,
      disasterType: type,
      ambientTemp: temp,
      humidity,
      aqi,
      pm25,
      heatIndex,
      disasterLevel: level,
    };
    setEnv(updated);
    await edgeAiHealthService.saveEnvironmentalContext(updated);
  };

  if (!env || !vuln) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-500">Loading Disaster Shield...</Text>
      </SafeAreaView>
    );
  }

  const filteredProtocols =
    selectedCategory === 'all'
      ? protocols
      : protocols.filter((p) => p.category === selectedCategory);

  const getAlertColor = () => {
    if (env.disasterLevel === 'red_warning') return '#ef4444';
    if (env.disasterLevel === 'orange_alert') return '#f97316';
    if (env.disasterLevel === 'yellow_watch') return '#eab308';
    return '#10b981';
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
          <Text className="text-lg font-bold text-gray-900">Disaster Health Early Warning</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            <Text className="text-xs text-gray-500 font-medium">On-Device Edge Shield (India)</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/edge-privacy' as any)}
          className="w-10 h-10 rounded-full bg-pink-50 items-center justify-center active:opacity-70"
        >
          <Feather name="shield" size={18} color={T.pink.action} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Real-time Disaster Status Card */}
        <View
          className="rounded-3xl p-5 mb-5 shadow-sm border"
          style={{
            backgroundColor: '#ffffff',
            borderColor: getAlertColor(),
            borderWidth: 1.5,
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View
                className="px-3 py-1 rounded-full flex-row items-center mr-2"
                style={{ backgroundColor: `${getAlertColor()}15` }}
              >
                <View
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: getAlertColor() }}
                />
                <Text
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: getAlertColor() }}
                >
                  {env.disasterLevel.replace('_', ' ')}
                </Text>
              </View>
              <Text className="text-xs font-medium text-gray-500">{env.locationName}</Text>
            </View>
            <View className="flex-row items-center bg-gray-100 px-2 py-0.5 rounded-md">
              <MaterialCommunityIcons name="wifi-off" size={13} color="#6b7280" />
              <Text className="text-[11px] font-semibold text-gray-600 ml-1">Offline Active</Text>
            </View>
          </View>

          <Text className="text-2xl font-black text-gray-900 capitalize mb-1">
            {env.disasterType === 'none'
              ? 'Normal Climate Conditions'
              : env.disasterType.replace('_', ' ')}
          </Text>
          <Text className="text-sm text-gray-600 leading-5">
            {env.disasterType === 'heatwave' &&
              'IMD Heatwave Advisory: Severe thermal radiation and high wet-bulb temperature. High dehydration & heatstroke threat.'}
            {env.disasterType === 'severe_pollution' &&
              'Severe Winter Smog & Thermal Inversion: Hazardous PM2.5 levels penetrating indoor zones. High pulmonary & cardiac strain.'}
            {env.disasterType === 'flood_monsoon' &&
              'Monsoon Urban Inundation: Stagnant water vector breeding and microbial contamination alert.'}
            {env.disasterType === 'cyclone' &&
              'Coastal Cyclone Advisory: Gale-force gusts and supply chain disruption. Power and medical access limited.'}
            {env.disasterType === 'none' &&
              'Atmospheric metrics within safe physiological thresholds. Edge AI continuously monitoring sensor streams.'}
          </Text>

          {/* Environmental Sensor Gauge Bar */}
          <View className="grid grid-cols-4 flex-row gap-2 mt-4 pt-4 border-t border-gray-100">
            <View className="flex-1 bg-gray-50 rounded-2xl p-2.5 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Ambient</Text>
              <Text className="text-base font-bold text-gray-800 mt-0.5">{env.ambientTemp}°C</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl p-2.5 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Humidity</Text>
              <Text className="text-base font-bold text-gray-800 mt-0.5">{env.humidity}%</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl p-2.5 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Heat Index</Text>
              <Text
                className={`text-base font-bold mt-0.5 ${
                  env.heatIndex > 41 ? 'text-rose-600' : 'text-gray-800'
                }`}
              >
                {env.heatIndex}°C
              </Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-2xl p-2.5 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">NAQI / PM2.5</Text>
              <Text
                className={`text-base font-bold mt-0.5 ${
                  env.aqi > 200 ? 'text-amber-600' : 'text-gray-800'
                }`}
              >
                {env.aqi}
              </Text>
            </View>
          </View>
        </View>

        {/* Disaster Simulation / Preset Switcher */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="weather-lightning-rainy" size={18} color={T.pink.action} />
              <Text className="text-sm font-bold text-gray-800 ml-2">Simulate Disaster Environment</Text>
            </View>
            <Text className="text-xs text-gray-400">Edge Testing Mode</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {[
              { id: 'heatwave', label: '🔥 Heatwave', desc: '43.5°C' },
              { id: 'severe_pollution', label: '🌫️ Smog/AQI', desc: '380 AQI' },
              { id: 'flood_monsoon', label: '🌊 Flood/Monsoon', desc: '92% RH' },
              { id: 'cyclone', label: '🌀 Cyclone', desc: '95% RH' },
              { id: 'none', label: '🌿 Normal', desc: 'Safe' },
            ].map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => setDisasterMode(d.id as any)}
                className={`mr-2.5 px-3.5 py-2 rounded-xl border ${
                  env.disasterType === d.id
                    ? 'bg-pink-500 border-pink-500'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    env.disasterType === d.id ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {d.label}
                </Text>
                <Text
                  className={`text-[10px] ${
                    env.disasterType === d.id ? 'text-pink-100' : 'text-gray-400'
                  }`}
                >
                  {d.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Vulnerability Profile Section */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-row items-center">
              <Ionicons name="people" size={18} color="#6366f1" />
              <Text className="text-sm font-bold text-gray-800 ml-2">
                Personal Vulnerability Tuning
              </Text>
            </View>
            <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-indigo-600">Adaptive Edge AI</Text>
            </View>
          </View>
          <Text className="text-xs text-gray-500 mb-3">
            Edge algorithms dynamically lower vital anomaly thresholds when high vulnerability factors are present.
          </Text>

          {/* Toggles */}
          <View className="space-y-3">
            {[
              {
                key: 'isOutdoorWorker' as const,
                label: 'Outdoor Worker / Daily Commuter',
                desc: 'Increases heat-cramp & UV dehydration sensitivity by 35%',
                value: vuln.isOutdoorWorker,
              },
              {
                key: 'hasRespiratoryCondition' as const,
                label: 'Chronic Respiratory (Asthma / COPD)',
                desc: 'Triggers hypoxia alert when SpO2 drops below 96% or AQI > 150',
                value: vuln.hasRespiratoryCondition,
              },
              {
                key: 'hasCardiovascularCondition' as const,
                label: 'Cardiovascular Condition (Hypertension)',
                desc: 'Lowers tachycardia threshold to 95 bpm during heat stress',
                value: vuln.hasCardiovascularCondition,
              },
              {
                key: 'isElderly' as const,
                label: 'Elderly Citizen (60+ yrs)',
                desc: 'Activates reduced thirst sensation warnings & kinematic stability guard',
                value: vuln.isElderly,
              },
              {
                key: 'isPregnant' as const,
                label: 'Maternity / Pregnancy Mode',
                desc: 'Heightened core temperature protection and hydration cadence',
                value: vuln.isPregnant,
              },
            ].map((item) => (
              <View
                key={item.key}
                className="flex-row items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
              >
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-semibold text-gray-800">{item.label}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">{item.desc}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={() => handleToggleVuln(item.key)}
                  trackColor={{ false: '#e2e8f0', true: '#fbcfe8' }}
                  thumbColor={item.value ? T.pink.action : '#94a3b8'}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Offline Disaster Action Protocols */}
        <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Feather name="book-open" size={18} color="#059669" />
              <Text className="text-sm font-bold text-gray-800 ml-2">
                Offline Disaster Action Guidelines
              </Text>
            </View>
            <Text className="text-xs text-emerald-600 font-semibold">NDMA Aligned</Text>
          </View>

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
            {(['all', 'heatwave', 'pollution', 'flood', 'cyclone'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                className={`mr-2 px-3 py-1 rounded-full capitalize ${
                  selectedCategory === cat ? 'bg-gray-900' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selectedCategory === cat ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Protocols List */}
          {filteredProtocols.map((p) => (
            <View key={p.id} className="mb-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-base font-bold text-gray-900">{p.title}</Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${
                    p.level === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold uppercase ${
                      p.level === 'warning' ? 'text-amber-700' : 'text-blue-700'
                    }`}
                  >
                    {p.level}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-gray-600 mb-3 leading-4">{p.summary}</Text>

              {/* Action Bullet points */}
              <View className="space-y-1.5 mb-3">
                {p.actionItems.map((action, idx) => (
                  <View key={idx} className="flex-row items-start">
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color="#10b981"
                      style={{ marginTop: 2, marginRight: 6 }}
                    />
                    <Text className="text-xs text-gray-700 flex-1 leading-4">{action}</Text>
                  </View>
                ))}
              </View>

              {/* Offline Survival Tip Callout */}
              <View className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-100 flex-row items-start">
                <Ionicons name="flash" size={14} color="#059669" style={{ marginTop: 2, marginRight: 6 }} />
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                    Zero-Connectivity Survival Tip
                  </Text>
                  <Text className="text-xs text-emerald-950 mt-0.5">{p.offlineSurvivalTip}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
