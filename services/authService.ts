/**
 * authService.ts
 * Handles all auth API calls and token persistence in AsyncStorage.
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface UserProfile {
  dateOfBirth?: string | Date | null;
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  bloodGroup?: string | null;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string | null;
  googleId?: string | null;
  isVerified?: boolean;
  profileComplete?: boolean;
  profile?: UserProfile;
}

export interface AuthTokens {
  accessToken: string;
  user: AuthUser;
}

export interface StoredSession {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

// ─── Config ────────────────────────────────────────────────────────────────────
// EXPO_PUBLIC_API_URL is read from .env at build time.
// On Android physical device, use your PC's LAN IP (not localhost).
// Example: EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://172.26.144.188:3000';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@nari:accessToken',
  REFRESH_TOKEN: '@nari:refreshToken',
  USER: '@nari:user',
} as const;

// ─── Axios instance ────────────────────────────────────────────────────────────
export const authApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Token helpers ─────────────────────────────────────────────────────────────

export async function saveTokens(data: {
  accessToken: string;
  refreshToken?: string;
  user?: AuthUser;
}): Promise<void> {
  const tasks: Promise<void>[] = [
    AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken),
  ];
  if (data.refreshToken) {
    tasks.push(AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken));
  }
  if (data.user) {
    tasks.push(AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user)));
  }
  await Promise.all(tasks);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.removeItem(STORAGE_KEYS.USER),
  ]);
}

export async function getStoredTokens(): Promise<StoredSession> {
  const [accessToken, refreshToken, userRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
    AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
    AsyncStorage.getItem(STORAGE_KEYS.USER),
  ]);
  const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
  return { accessToken, refreshToken, user };
}

// ─── Auth API calls ────────────────────────────────────────────────────────────

export async function register(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const { data } = await authApi.post<AuthTokens>('/api/auth/register', payload);
  await saveTokens(data);
  return data;
}

export async function login(payload: {
  email: string;
  password: string;
}): Promise<AuthTokens> {
  const { data } = await authApi.post<AuthTokens>('/api/auth/login', payload);
  await saveTokens(data);
  return data;
}

export async function googleLogin(idToken: string): Promise<AuthTokens> {
  const { data } = await authApi.post<AuthTokens>('/api/auth/google/mobile', { idToken });
  await saveTokens(data);
  return data;
}

// ─── OTP Registration ──────────────────────────────────────────────────────────

/**
 * Step 1: Submit registration form → sends OTP email.
 * Does NOT log the user in yet.
 */
export async function sendOtp(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<{ message: string }> {
  const { data } = await authApi.post<{ success: boolean; message: string }>(
    '/api/auth/register/send-otp',
    payload
  );
  return { message: data.message };
}

/**
 * Resend OTP to email address for a pending registration.
 */
export async function resendOtp(email: string): Promise<{ message: string }> {
  const { data } = await authApi.post<{ success: boolean; message: string }>(
    '/api/auth/register/resend-otp',
    { email }
  );
  return { message: data.message };
}

/**
 * Step 2: Submit the 6-digit OTP → returns tokens on success.
 * The user is now registered and logged in.
 */
export async function verifyOtp(payload: {
  email: string;
  otp: string;
}): Promise<AuthTokens> {
  const { data } = await authApi.post<AuthTokens>(
    '/api/auth/register/verify-otp',
    payload
  );
  await saveTokens(data);
  return data;
}

// ─── Profile Completion ────────────────────────────────────────────────────────

/**
 * Save health profile data after OTP verification.
 * Requires a valid access token (sent via axios interceptor from AuthContext).
 */
export async function completeProfile(payload: {
  dateOfBirth?: string;
  age?: number;
  weight: number;
  height: number;
  bloodGroup: string;
}): Promise<AuthTokens> {
  const { data } = await authApi.post<{ success: boolean; user: AuthUser }>(
    '/api/auth/complete-profile',
    payload
  );
  // Update stored user with completed profile
  const stored = await getStoredTokens();
  if (stored.accessToken) {
    await saveTokens({ accessToken: stored.accessToken, user: data.user });
  }
  return { accessToken: stored.accessToken!, user: data.user };
}

// ─── Token / Session ──────────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<AuthTokens> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) throw new Error('No refresh token stored.');

  const { data } = await authApi.post<AuthTokens>('/api/auth/refresh', { refreshToken });
  await saveTokens(data);
  return data;
}

export async function logout(accessToken: string): Promise<void> {
  try {
    await authApi.post(
      '/api/auth/logout',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    // Best-effort — always clear locally
  }
  await clearTokens();
}

export async function fetchMe(accessToken: string): Promise<AuthUser> {
  const { data } = await authApi.get<{ user: AuthUser }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data.user;
}

export default {
  register,
  login,
  googleLogin,
  sendOtp,
  resendOtp,
  verifyOtp,
  completeProfile,
  refreshAccessToken,
  logout,
  fetchMe,
  saveTokens,
  clearTokens,
  getStoredTokens,
  BASE_URL,
};
