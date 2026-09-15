/**
 * AppLockContext.tsx
 *
 * Provides biometric / 4-digit PIN screen lock functionality.
 *
 * Designed to be resilient:
 * - Dynamically checks for `expo-local-authentication` native module.
 *   If not compiled into the current development build, it safely falls
 *   back to a 4-digit PIN keypad without crashing the app at launch.
 * - Supports biometric authentication (fingerprint / FaceID) if linked.
 * - Supports a custom 4-digit PIN fallback.
 * - Persists "screen lock enabled" preference and PIN in AsyncStorage.
 * - 15-second grace period when returning from background.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  AppStateStatus,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';

// ─── Safe Dynamic Import for Expo Local Authentication ───────────────────────
// In custom dev client builds where native modules have not yet been rebuilt,
// static imports throw immediately on bundle load. Dynamic require prevents this.
let LocalAuthModule: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthModule = require('expo-local-authentication');
} catch {
  LocalAuthModule = null;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SCREEN_LOCK_KEY = '@nari:screenLock';
const LOCK_PIN_KEY = '@nari:lockPin';
const DEFAULT_PIN = '1234';
const LOCK_GRACE_MS = 15_000;

// ─── Types ───────────────────────────────────────────────────────────────────
interface AppLockContextValue {
  screenLockEnabled: boolean;
  isLocked: boolean;
  hasBiometrics: boolean;
  toggleScreenLock: () => Promise<void>;
  unlockNow: () => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside <AppLockProvider>');
  return ctx;
}

// ─── Helper: Check Biometrics ────────────────────────────────────────────────
async function checkBiometrics(): Promise<boolean> {
  if (!LocalAuthModule) return false;
  try {
    const hasHardware = await LocalAuthModule.hasHardwareAsync();
    const isEnrolled = await LocalAuthModule.isEnrolledAsync();
    return Boolean(hasHardware && isEnrolled);
  } catch {
    return false;
  }
}

// ─── Full-screen Lock Component ──────────────────────────────────────────────
function LockScreen({
  storedPin,
  hasBiometrics,
  onUnlock,
}: {
  storedPin: string;
  hasBiometrics: boolean;
  onUnlock: () => void;
}) {
  const [pinInput, setPinInput] = useState('');
  const [isError, setIsError] = useState(false);

  const attemptBiometric = useCallback(async () => {
    if (!LocalAuthModule || !hasBiometrics) return;
    try {
      const result = await LocalAuthModule.authenticateAsync({
        promptMessage: 'Unlock Her Comfort',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
        cancelLabel: 'Use PIN',
      });
      if (result.success) {
        onUnlock();
      }
    } catch {
      // User can still use PIN
    }
  }, [hasBiometrics, onUnlock]);

  // Prompt biometrics on appearance once if available
  useEffect(() => {
    if (hasBiometrics) {
      attemptBiometric();
    }
  }, [hasBiometrics, attemptBiometric]);

  const handleDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    setIsError(false);

    if (next.length === 4) {
      if (next === storedPin) {
        onUnlock();
      } else {
        setIsError(true);
        setTimeout(() => {
          setPinInput('');
          setIsError(false);
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setIsError(false);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <View style={styles.lockIconRing}>
        <Ionicons name="lock-closed" size={36} color="#E84EA1" />
      </View>

      <Text style={styles.appName}>Her Comfort</Text>
      <Text style={styles.subtitle}>Session is locked</Text>
      <Text style={styles.hint}>
        {hasBiometrics
          ? 'Use your fingerprint or enter your 4-digit PIN'
          : 'Enter your 4-digit PIN to unlock'}
      </Text>

      {/* PIN Dots */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map((i) => {
          const filled = i < pinInput.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled && styles.dotFilled,
                isError && styles.dotError,
              ]}
            />
          );
        })}
      </View>

      {isError && (
        <Text style={styles.errorText}>Incorrect PIN. Please try again.</Text>
      )}

      {/* Numeric Keypad */}
      <View style={styles.keypad}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
          <View key={rIdx} style={styles.keypadRow}>
            {row.map((num) => (
              <TouchableOpacity
                key={num}
                style={styles.key}
                activeOpacity={0.7}
                onPress={() => handleDigit(num)}
              >
                <Text style={styles.keyText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <View style={styles.keypadRow}>
          {hasBiometrics ? (
            <TouchableOpacity
              style={styles.keyIcon}
              activeOpacity={0.7}
              onPress={attemptBiometric}
            >
              <Ionicons name="finger-print" size={28} color="#E84EA1" />
            </TouchableOpacity>
          ) : (
            <View style={styles.keyEmpty} />
          )}

          <TouchableOpacity
            style={styles.key}
            activeOpacity={0.7}
            onPress={() => handleDigit('0')}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.keyIcon}
            activeOpacity={0.7}
            onPress={handleDelete}
          >
            <Ionicons name="backspace-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Provider Component ──────────────────────────────────────────────────────
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [screenLockEnabled, setScreenLockEnabled] = useState(false);
  const [storedPin, setStoredPin] = useState(DEFAULT_PIN);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // PIN Setup Modal
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const backgroundedAt = useRef<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Load preferences
  useEffect(() => {
    async function init() {
      try {
        const [lockVal, pinVal] = await Promise.all([
          AsyncStorage.getItem(SCREEN_LOCK_KEY),
          AsyncStorage.getItem(LOCK_PIN_KEY),
        ]);
        setScreenLockEnabled(lockVal === 'true');
        if (pinVal) setStoredPin(pinVal);

        const bio = await checkBiometrics();
        setHasBiometrics(bio);
      } catch {
        // Safe fallback
      } finally {
        setIsReady(true);
      }
    }
    void init();
  }, []);

  // AppState listener for background/foreground lock
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prevState = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (nextState === 'active') {
        const now = Date.now();
        const bgDuration =
          backgroundedAt.current != null ? now - backgroundedAt.current : Infinity;

        if (screenLockEnabled && isAuthenticated && bgDuration > LOCK_GRACE_MS) {
          setIsLocked(true);
        }
        backgroundedAt.current = null;
      }
    });

    return () => sub.remove();
  }, [screenLockEnabled, isAuthenticated]);

  // Unlock when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLocked(false);
    }
  }, [isAuthenticated]);

  // Toggle Screen Lock
  const toggleScreenLock = useCallback(async () => {
    if (screenLockEnabled) {
      // Disabling lock
      setScreenLockEnabled(false);
      await AsyncStorage.setItem(SCREEN_LOCK_KEY, 'false');
      Alert.alert('Screen Lock Disabled', 'You can re-enable screen lock at any time.');
      return;
    }

    // Enabling lock: if biometrics available, verify and enable
    const bioAvailable = await checkBiometrics();
    setHasBiometrics(bioAvailable);

    if (bioAvailable && LocalAuthModule) {
      try {
        const res = await LocalAuthModule.authenticateAsync({
          promptMessage: 'Authenticate to enable Screen Lock',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false,
        });
        if (res.success) {
          setScreenLockEnabled(true);
          await AsyncStorage.setItem(SCREEN_LOCK_KEY, 'true');
          Alert.alert('Screen Lock Enabled', 'Biometric / PIN lock is now active.');
          return;
        }
      } catch {
        // Fall through to PIN setup
      }
    }

    // Biometrics unavailable or not enrolled -> offer 4-digit PIN setup
    setNewPin('');
    setConfirmPin('');
    setShowPinSetup(true);
  }, [screenLockEnabled]);

  const handleSavePin = async () => {
    if (newPin.length !== 4) {
      Alert.alert('Invalid PIN', 'Please enter a 4-digit numeric PIN.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('PIN Mismatch', 'The confirmation PIN does not match.');
      return;
    }

    setStoredPin(newPin);
    setScreenLockEnabled(true);
    await AsyncStorage.setItem(LOCK_PIN_KEY, newPin);
    await AsyncStorage.setItem(SCREEN_LOCK_KEY, 'true');
    setShowPinSetup(false);
    Alert.alert('Screen Lock Enabled', 'Your 4-digit PIN has been set successfully.');
  };

  const unlockNow = useCallback(async () => {
    setIsLocked(false);
  }, []);

  return (
    <AppLockContext.Provider
      value={{ screenLockEnabled, isLocked, hasBiometrics, toggleScreenLock, unlockNow }}
    >
      {children}

      {/* Full-screen Lock Overlay */}
      {isLocked && isReady && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <LockScreen
            storedPin={storedPin}
            hasBiometrics={hasBiometrics}
            onUnlock={() => setIsLocked(false)}
          />
        </View>
      )}

      {/* PIN Setup Modal */}
      <Modal visible={showPinSetup} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set 4-Digit Passcode</Text>
            <Text style={styles.modalSub}>
              Create a PIN to secure your app session.
            </Text>

            <Text style={styles.inputLabel}>Enter 4-digit PIN</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.inputLabel}>Confirm 4-digit PIN</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowPinSetup(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePin}>
                <Text style={styles.saveBtnText}>Enable Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppLockContext.Provider>
  );
}

export default AppLockContext;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: '#FFF0F7',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '10%',
    backgroundColor: '#FFF0F7',
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
  },
  lockIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F7',
    borderWidth: 2.5,
    borderColor: '#FBCFE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#E84EA1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#E84EA1',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#E84EA1',
    borderColor: '#E84EA1',
  },
  dotError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
    marginBottom: 8,
  },
  keypad: {
    width: 260,
    marginTop: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  keyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 64,
    height: 64,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  pinInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    color: '#111827',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E84EA1',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
