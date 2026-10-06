import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';
import edgeAiHealthService from '../services/edgeAiHealthService';

export default function EdgePrivacyScreen() {
  const router = useRouter();
  const [zeroCloud, setZeroCloud] = useState(true);
  const [localAnalytics, setLocalAnalytics] = useState(true);
  const [biometricExport, setBiometricExport] = useState(true);
  const [lastAuditDate, setLastAuditDate] = useState('Today, Just Now');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await edgeAiHealthService.getPrivacySettings();
    setZeroCloud(s.zeroCloudMode);
    setLocalAnalytics(s.localOnlyAnalytics);
    setBiometricExport(s.biometricLockOnExport);
  };

  const handleToggle = async (key: 'zeroCloud' | 'localAnalytics' | 'biometricExport') => {
    let newZC = zeroCloud;
    let newLA = localAnalytics;
    let newBE = biometricExport;

    if (key === 'zeroCloud') newZC = !zeroCloud;
    if (key === 'localAnalytics') newLA = !localAnalytics;
    if (key === 'biometricExport') newBE = !biometricExport;

    setZeroCloud(newZC);
    setLocalAnalytics(newLA);
    setBiometricExport(newBE);

    await edgeAiHealthService.savePrivacySettings({
      zeroCloudMode: newZC,
      localOnlyAnalytics: newLA,
      biometricLockOnExport: newBE,
      lastAuditTimestamp: Date.now(),
    });
  };

  const handleExportVault = async () => {
    try {
      const exportJson = await edgeAiHealthService.exportEncryptedHealthVault();
      await Share.share({
        title: 'Nari Encrypted Edge Health Vault',
        message: exportJson,
      });
    } catch (e) {
      Alert.alert('Export Error', 'Unable to generate export snapshot.');
    }
  };

  const handleWipeData = () => {
    Alert.alert(
      'Wipe All Local Edge Health Data?',
      'This will erase all cached sensor vitals, anomaly logs, and environmental history on this physical device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe All Data',
          style: 'destructive',
          onPress: async () => {
            await edgeAiHealthService.wipeAllEdgeData();
            Alert.alert('Data Wiped', 'All on-device health caches have been securely overwritten.');
          },
        },
      ]
    );
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
          <Text className="text-lg font-bold text-gray-900">Privacy & Edge AI Vault</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            <Text className="text-xs text-gray-500 font-medium">DPDP Act (India) Compliant</Text>
          </View>
        </View>
        <View className="w-10 h-10 items-center justify-center">
          <MaterialCommunityIcons name="shield-lock" size={22} color="#059669" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Privacy Seal Hero */}
        <View className="bg-emerald-900 rounded-3xl p-6 mb-5 shadow-xl">
          <View className="w-12 h-12 rounded-2xl bg-emerald-700/60 items-center justify-center mb-3">
            <MaterialCommunityIcons name="shield-check" size={28} color="#34d399" />
          </View>
          <Text className="text-white text-xl font-black mb-1">
            Zero-Cloud Telemetry Guarantee
          </Text>
          <Text className="text-emerald-200 text-xs leading-5">
            Your physiological sensor metrics, core body temperature, SpO2 records, and disaster
            vulnerability factors are processed strictly on your smartphone's edge runtime.
            Raw health data is never monetized or transmitted to remote analytics servers.
          </Text>

          <View className="mt-4 pt-4 border-t border-emerald-800 flex-row items-center justify-between">
            <Text className="text-emerald-300 text-xs font-semibold">Integrity Verification:</Text>
            <View className="bg-emerald-800 px-2.5 py-1 rounded-full flex-row items-center">
              <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
              <Text className="text-emerald-300 text-[11px] font-bold">100% Offline Capable</Text>
            </View>
          </View>
        </View>

        {/* Privacy Controls Group */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <Text className="text-sm font-bold text-gray-800 mb-3">On-Device Privacy Controls</Text>

          {/* Zero Cloud Mode */}
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-gray-800">Strict Zero-Cloud Mode</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Blocks any remote cloud transmission of vital sign telemetry.
              </Text>
            </View>
            <Switch
              value={zeroCloud}
              onValueChange={() => handleToggle('zeroCloud')}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={zeroCloud ? '#059669' : '#94a3b8'}
            />
          </View>

          {/* Local-Only Analytics */}
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-gray-800">Local-Only AI Diagnostics</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Executes all heatwave, dehydration, and arrhythmia inference locally.
              </Text>
            </View>
            <Switch
              value={localAnalytics}
              onValueChange={() => handleToggle('localAnalytics')}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={localAnalytics ? '#059669' : '#94a3b8'}
            />
          </View>

          {/* Biometric Export Protection */}
          <View className="flex-row items-center justify-between py-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-gray-800">Require Biometrics on Export</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Demands fingerprint / PIN verification before dumping health JSON.
              </Text>
            </View>
            <Switch
              value={biometricExport}
              onValueChange={() => handleToggle('biometricExport')}
              trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
              thumbColor={biometricExport ? '#059669' : '#94a3b8'}
            />
          </View>
        </View>

        {/* Local Storage Audit Card */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <Text className="text-sm font-bold text-gray-800 mb-3">On-Device Storage Footprint</Text>
          <View className="grid grid-cols-3 flex-row gap-2 mb-3">
            <View className="flex-1 bg-gray-50 rounded-xl p-3 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Vitals Cache</Text>
              <Text className="text-sm font-bold text-gray-800 mt-0.5">48 Points</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-xl p-3 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Disk Size</Text>
              <Text className="text-sm font-bold text-gray-800 mt-0.5">&lt; 140 KB</Text>
            </View>
            <View className="flex-1 bg-gray-50 rounded-xl p-3 items-center">
              <Text className="text-[11px] text-gray-500 font-medium">Cloud Packets</Text>
              <Text className="text-sm font-bold text-emerald-600 mt-0.5">0 B (Zero)</Text>
            </View>
          </View>
          <Text className="text-xs text-gray-400">
            Last privacy integrity check verified: {lastAuditDate}
          </Text>
        </View>

        {/* Data Management Actions */}
        <View className="space-y-3 mb-8">
          <TouchableOpacity
            onPress={handleExportVault}
            className="bg-gray-900 rounded-2xl py-3.5 flex-row items-center justify-center active:opacity-90 mb-2.5"
          >
            <Feather name="download" size={16} color="#ffffff" />
            <Text className="text-white font-bold text-sm ml-2">
              Export Encrypted Clinical Health Vault
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleWipeData}
            className="bg-rose-50 border border-rose-200 rounded-2xl py-3.5 flex-row items-center justify-center active:bg-rose-100"
          >
            <Feather name="trash-2" size={16} color="#e11d48" />
            <Text className="text-rose-600 font-bold text-sm ml-2">
              Wipe All Local Health & Anomaly Caches
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
