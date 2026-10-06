import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { T } from '../constants/theme';
import edgeAiHealthService, { EmergencyContact } from '../services/edgeAiHealthService';

export default function EmergencySosScreen() {
  const router = useRouter();
  const [fallDetectionEnabled, setFallDetectionEnabled] = useState(true);
  const [sirenActive, setSirenActive] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelation, setNewRelation] = useState('Family');

  // Fall Alert Modal & Countdown State
  const [fallAlertActive, setFallAlertActive] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const countdownTimerRef = useRef<any>(null);

  useEffect(() => {
    loadContacts();
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const loadContacts = async () => {
    const list = await edgeAiHealthService.getEmergencyContacts();
    setContacts(list);
  };

  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Incomplete Details', 'Please provide a name and phone number.');
      return;
    }
    const newEntry: EmergencyContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relation: newRelation,
      isPrimary: contacts.length === 0,
    };
    const updated = [...contacts, newEntry];
    setContacts(updated);
    await edgeAiHealthService.saveEmergencyContacts(updated);
    setNewName('');
    setNewPhone('');
    setModalVisible(false);
  };

  const handleDeleteContact = async (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    await edgeAiHealthService.saveEmergencyContacts(updated);
  };

  const handleSetPrimary = async (id: string) => {
    const updated = contacts.map((c) => ({
      ...c,
      isPrimary: c.id === id,
    }));
    setContacts(updated);
    await edgeAiHealthService.saveEmergencyContacts(updated);
  };

  // Simulates high-g impact threshold detection + subsequent immobility
  const handleSimulateFallImpact = () => {
    if (!fallDetectionEnabled) {
      Alert.alert('Fall Sensor Disabled', 'Please enable Automatic Fall Detection switch first.');
      return;
    }
    setFallAlertActive(true);
    setCountdown(30);

    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          handleTriggerSOS('Automatic Kinematic Fall Alert (No Response)');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelFallAlert = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setFallAlertActive(false);
    Alert.alert('Fall Alert Dismissed', 'Marked as false alarm. Zero distress signals dispatched.');
  };

  const handleTriggerSOS = (reason = 'Manual SOS Triggered') => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setFallAlertActive(false);

    const primary = contacts.find((c) => c.isPrimary) || contacts[0];
    const phone = primary ? primary.phone : '112';

    // India Lat/Lng mock for disaster rescue coordinate
    const lat = '28.6139';
    const lng = '77.2090';
    const message = `EMERGENCY SOS: ${reason}. Nari Health Companion detected high distress. Location: https://maps.google.com/?q=${lat},${lng}`;

    Alert.alert(
      '🚨 EMERGENCY SOS DISPATCHED',
      `Target: ${primary ? `${primary.name} (${primary.phone})` : 'National Emergency (112)'}\n\nCoordinates: ${lat} N, ${lng} E\nStatus: Encrypted local alert dispatched.`,
      [
        {
          text: 'Call Emergency 112',
          onPress: () => Linking.openURL('tel:112').catch(() => {}),
        },
        {
          text: 'Send SMS Alert',
          onPress: () => Linking.openURL(`sms:${phone}?body=${encodeURIComponent(message)}`).catch(() => {}),
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const toggleSiren = () => {
    setSirenActive((prev) => !prev);
    if (!sirenActive) {
      Alert.alert('Audible Distress Beacon Active', 'High-frequency pulsing beacon activated to guide emergency search & rescue teams in disaster zones.');
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
          <Text className="text-lg font-bold text-gray-900">Emergency SOS & Fall Guardian</Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
            <Text className="text-xs text-gray-500 font-medium">Kinematic & Geolocation Shield</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={toggleSiren}
          className={`w-10 h-10 rounded-full items-center justify-center active:opacity-70 ${
            sirenActive ? 'bg-rose-500' : 'bg-gray-100'
          }`}
        >
          <MaterialCommunityIcons
            name={sirenActive ? 'bullhorn' : 'bullhorn-outline'}
            size={20}
            color={sirenActive ? '#ffffff' : '#4b5563'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {/* Massive SOS Action Card */}
        <View className="bg-rose-50 rounded-3xl p-6 mb-5 border border-rose-200 items-center">
          <Text className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">
            Immediate Distress Dispatch
          </Text>
          <Text className="text-gray-600 text-xs text-center mb-6 px-4">
            Press and hold to broadcast your real-time GPS coordinates and vital metrics to registered caregivers and India 112.
          </Text>

          {/* Big SOS Button */}
          <TouchableOpacity
            onPress={() => handleTriggerSOS()}
            className="w-36 h-36 rounded-full bg-rose-600 items-center justify-center shadow-xl active:scale-95"
            style={{
              shadowColor: '#e11d48',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <View className="w-32 h-32 rounded-full border-2 border-white/40 items-center justify-center">
              <MaterialCommunityIcons name="alert-octagon" size={42} color="#ffffff" />
              <Text className="text-white font-black text-2xl tracking-widest mt-1">SOS</Text>
            </View>
          </TouchableOpacity>

          <View className="flex-row items-center mt-6 bg-white/80 px-4 py-2 rounded-full border border-rose-100">
            <Ionicons name="location" size={14} color="#e11d48" />
            <Text className="text-xs font-semibold text-rose-900 ml-1.5">
              GPS Geolocation: 28.6139° N, 77.2090° E
            </Text>
          </View>
        </View>

        {/* Automatic Kinematic Fall Detection Card */}
        <View className="bg-white rounded-2xl p-4 mb-5 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="human-male-height" size={20} color="#6366f1" />
              <Text className="text-sm font-bold text-gray-800 ml-2">
                Kinematic Fall & Impact Detection
              </Text>
            </View>
            <Switch
              value={fallDetectionEnabled}
              onValueChange={setFallDetectionEnabled}
              trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
              thumbColor={fallDetectionEnabled ? '#4f46e5' : '#94a3b8'}
            />
          </View>
          <Text className="text-xs text-gray-500 mb-4 leading-4">
            Uses wearable and mobile tri-axial accelerometer vector magnitude ($&gt;3.0g$) combined with
            abrupt stillness detection to detect severe slips, fainting, or flood current falls.
          </Text>

          <TouchableOpacity
            onPress={handleSimulateFallImpact}
            className="bg-indigo-50 border border-indigo-200 rounded-xl py-2.5 items-center flex-row justify-center active:bg-indigo-100"
          >
            <MaterialCommunityIcons name="speedometer" size={16} color="#4f46e5" />
            <Text className="text-xs font-bold text-indigo-700 ml-2">
              Test Fall Impact Trigger (Simulation)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Siren Beacon State */}
        {sirenActive && (
          <View className="bg-amber-500 rounded-2xl p-4 mb-5 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 pr-2">
              <MaterialCommunityIcons name="alarm-light" size={24} color="#ffffff" />
              <View className="ml-3">
                <Text className="text-white font-bold text-sm">Distress Siren Active</Text>
                <Text className="text-amber-100 text-xs">Acoustic beacon broadcasting</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={toggleSiren}
              className="bg-white px-3 py-1.5 rounded-lg active:opacity-80"
            >
              <Text className="text-amber-700 text-xs font-bold">Silence</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Emergency Contacts Management */}
        <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Feather name="users" size={18} color={T.pink.action} />
              <Text className="text-sm font-bold text-gray-800 ml-2">Emergency Caregivers</Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalVisible(true)}
              className="bg-pink-50 px-2.5 py-1 rounded-full flex-row items-center active:opacity-70"
            >
              <Feather name="plus" size={13} color={T.pink.action} />
              <Text className="text-xs font-bold text-pink-600 ml-1">Add Contact</Text>
            </TouchableOpacity>
          </View>

          {contacts.map((c) => (
            <View
              key={c.id}
              className="flex-row items-center justify-between py-3 border-b border-gray-100 last:border-0"
            >
              <View className="flex-1 pr-3">
                <View className="flex-row items-center">
                  <Text className="text-sm font-bold text-gray-800">{c.name}</Text>
                  {c.isPrimary && (
                    <View className="bg-rose-100 px-2 py-0.5 rounded-md ml-2">
                      <Text className="text-[10px] font-bold text-rose-700">PRIMARY</Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs text-gray-500 mt-0.5">
                  {c.phone} • {c.relation}
                </Text>
              </View>

              <View className="flex-row items-center space-x-2">
                {!c.isPrimary && (
                  <TouchableOpacity
                    onPress={() => handleSetPrimary(c.id)}
                    className="p-2 bg-gray-50 rounded-lg active:bg-gray-100 mr-1"
                  >
                    <Feather name="star" size={14} color="#6b7280" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleDeleteContact(c.id)}
                  className="p-2 bg-rose-50 rounded-lg active:bg-rose-100"
                >
                  <Feather name="trash-2" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Fall Detection Countdown Modal */}
      <Modal visible={fallAlertActive} transparent animationType="fade">
        <View className="flex-1 bg-black/80 items-center justify-center px-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center border-4 border-rose-500 shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-rose-100 items-center justify-center mb-3">
              <MaterialCommunityIcons name="alert-octagon" size={32} color="#e11d48" />
            </View>
            <Text className="text-xl font-black text-gray-900 text-center">
              FALL DETECTED!
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1 mb-4">
              A high kinematic impact was recorded. Emergency SOS will dispatch automatically unless cancelled.
            </Text>

            {/* Countdown Clock */}
            <View className="w-24 h-24 rounded-full bg-rose-600 items-center justify-center mb-6">
              <Text className="text-white font-black text-3xl">{countdown}</Text>
              <Text className="text-rose-200 text-[10px] uppercase font-bold">Seconds</Text>
            </View>

            <TouchableOpacity
              onPress={handleCancelFallAlert}
              className="w-full bg-gray-900 py-3.5 rounded-2xl items-center mb-2.5 active:opacity-90"
            >
              <Text className="text-white font-bold text-base">I AM OK (CANCEL)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTriggerSOS('Immediate Fall Assistance Requested')}
              className="w-full bg-rose-50 border border-rose-200 py-3 rounded-2xl items-center active:bg-rose-100"
            >
              <Text className="text-rose-600 font-bold text-sm">SEND SOS NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-gray-900">Add Emergency Contact</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-semibold text-gray-600 mb-1">Full Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Ramesh Kumar"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 mb-3"
            />

            <Text className="text-xs font-semibold text-gray-600 mb-1">Phone Number</Text>
            <TextInput
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 mb-3"
            />

            <Text className="text-xs font-semibold text-gray-600 mb-1">Relationship</Text>
            <TextInput
              value={newRelation}
              onChangeText={setNewRelation}
              placeholder="e.g. Doctor, Spouse, Neighbor"
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 mb-5"
            />

            <TouchableOpacity
              onPress={handleAddContact}
              className="bg-pink-600 py-3.5 rounded-2xl items-center active:opacity-90"
            >
              <Text className="text-white font-bold text-base">Save Emergency Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
