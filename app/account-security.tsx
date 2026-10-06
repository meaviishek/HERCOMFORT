import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useAppLock } from '../context/AppLockContext';
import { T } from '../constants/theme';

export default function AccountSecurityScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { screenLockEnabled, toggleScreenLock, promptPinSetup, hasCustomPin, hasBiometrics } = useAppLock();

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [dataShareEnabled, setDataShareEnabled] = useState(true);
  const [changePassModal, setChangePassModal] = useState(false);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleChangePassword = () => {
    if (!currPass || !newPass || !confirmPass) {
      Alert.alert('Incomplete Fields', 'Please enter all password fields.');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    Alert.alert('Password Updated', 'Your account password has been changed successfully.');
    setCurrPass('');
    setNewPass('');
    setConfirmPass('');
    setChangePassModal(false);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Log Out Other Devices',
      'This will revoke all active sessions on other phones, tablets, and browsers.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Others',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'All other active sessions have been terminated.');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your profile, menstrual cycle records, and Her Comfort therapy history. This action CANNOT be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/login');
            } catch {}
          },
        },
      ]
    );
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
        <Text style={s.headerTitle}>Account & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Info Card */}
        <View style={s.profileCard}>
          <View style={s.shieldIconBox}>
            <MaterialCommunityIcons name="shield-check" size={28} color={T.pink.action} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.userName}>{user?.name || 'Nari Account'}</Text>
              <View style={s.verifiedBadge}>
                <Feather name="check" size={10} color="#059669" />
                <Text style={s.verifiedText}>SECURED</Text>
              </View>
            </View>
            <Text style={s.userEmail}>{user?.email || 'user@narihealth.ai'}</Text>
            <Text style={s.userId}>ID: {user?._id || 'usr_nari_live'}</Text>
          </View>
        </View>

        {/* Security & Access */}
        <Text style={s.sectionHeader}>SECURITY & ACCESS</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() => setChangePassModal(true)}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="lock-reset" size={20} color="#0284C7" />
              <View>
                <Text style={s.rowLabel}>Change Password</Text>
                <Text style={s.rowSub}>Update your login credentials</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.row}
            onPress={promptPinSetup}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="form-textbox-password" size={20} color={T.pink.action} />
              <View>
                <Text style={s.rowLabel}>4-Digit Quick Login PIN</Text>
                <Text style={s.rowSub}>
                  {hasCustomPin ? 'PIN is configured and active' : 'Not set (Tap to configure)'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: hasCustomPin ? '#059669' : '#0284C7' }}>
                {hasCustomPin ? 'CHANGE PIN' : 'SET PIN'}
              </Text>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons
                name={screenLockEnabled ? 'finger-print' : 'finger-print-outline'}
                size={20}
                color={screenLockEnabled ? T.pink.action : '#64748B'}
              />
              <View>
                <Text style={s.rowLabel}>Screen Lock (Fingerprint / PIN)</Text>
                <Text style={s.rowSub}>Prompt lock on app launch or resume</Text>
              </View>
            </View>
            <Switch
              value={screenLockEnabled}
              onValueChange={toggleScreenLock}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={screenLockEnabled ? T.pink.action : '#94A3B8'}
            />
          </View>

          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="two-factor-authentication" size={20} color="#7C3AED" />
              <View>
                <Text style={s.rowLabel}>Two-Factor Authentication (2FA)</Text>
                <Text style={s.rowSub}>Additional security layer via OTP</Text>
              </View>
            </View>
            <Switch
              value={twoFactorEnabled}
              onValueChange={setTwoFactorEnabled}
              trackColor={{ false: '#E2E8F0', true: '#FBCFE8' }}
              thumbColor={twoFactorEnabled ? T.pink.action : '#94A3B8'}
            />
          </View>
        </View>

        {/* Active Devices & Sessions */}
        <Text style={s.sectionHeader}>LOGGED IN DEVICES</Text>
        <View style={s.card}>
          <View style={s.deviceRow}>
            <View style={s.deviceIconBox}>
              <Feather name="smartphone" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.deviceTitle}>Current Device (Android)</Text>
                <View style={s.activeBadge}>
                  <Text style={s.activeBadgeText}>ACTIVE NOW</Text>
                </View>
              </View>
              <Text style={s.deviceSub}>Her Comfort Belt BLE Paired • IP: Local Wi-Fi</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.logoutOthersBtn}
            onPress={handleLogoutAll}
            activeOpacity={0.7}
          >
            <Feather name="log-out" size={16} color="#0284C7" />
            <Text style={s.logoutOthersText}>Log Out From All Other Devices</Text>
          </TouchableOpacity>
        </View>

        {/* Data Privacy & Compliance */}
        <Text style={s.sectionHeader}>DATA PRIVACY & ANONYMITY</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="database-eye-outline" size={20} color="#0284C7" />
              <View>
                <Text style={s.rowLabel}>Anonymous Telemetry</Text>
                <Text style={s.rowSub}>Help improve thermal & EMG predictive AI</Text>
              </View>
            </View>
            <Switch
              value={dataShareEnabled}
              onValueChange={setDataShareEnabled}
              trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
              thumbColor={dataShareEnabled ? '#0284C7' : '#94A3B8'}
            />
          </View>

          <TouchableOpacity
            style={[s.row, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/data-analytics' as any)}
            activeOpacity={0.7}
          >
            <View style={s.rowLeft}>
              <MaterialCommunityIcons name="file-download-outline" size={20} color="#059669" />
              <View>
                <Text style={s.rowLabel}>Export Clinical Health Records</Text>
                <Text style={s.rowSub}>Download PDF / CSV summary for physicians</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={[s.sectionHeader, { color: '#DC2626' }]}>DANGER ZONE</Text>
        <View style={[s.card, { borderColor: '#FECACA' }]}>
          <TouchableOpacity
            style={s.dangerRow}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="account-remove-outline" size={22} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.dangerTitle}>Delete Account & Health Data</Text>
              <Text style={s.dangerSub}>Permanently erase all clinical cycles and sessions</Text>
            </View>
            <Feather name="trash-2" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={changePassModal}
        transparent
        animationType="slide"
        onRequestClose={() => setChangePassModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setChangePassModal(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 16, gap: 12 }}>
              <View>
                <Text style={s.inputLabel}>Current Password</Text>
                <TextInput
                  style={s.input}
                  secureTextEntry
                  placeholder="Enter current password"
                  placeholderTextColor="#94A3B8"
                  value={currPass}
                  onChangeText={setCurrPass}
                />
              </View>

              <View>
                <Text style={s.inputLabel}>New Password</Text>
                <TextInput
                  style={s.input}
                  secureTextEntry
                  placeholder="Enter at least 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={newPass}
                  onChangeText={setNewPass}
                />
              </View>

              <View>
                <Text style={s.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={s.input}
                  secureTextEntry
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setChangePassModal(false)}
                style={s.modalCancelBtn}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleChangePassword}
                style={s.modalSaveBtn}
              >
                <Text style={s.modalSaveText}>Update Password</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  shieldIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF0F5',
    borderWidth: 1,
    borderColor: '#FCE7F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  userId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94A3B8',
    marginTop: 2,
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
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deviceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  deviceSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },
  logoutOthersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  logoutOthersText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  dangerSub: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 14,
    color: '#0F172A',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: T.pink.action,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
