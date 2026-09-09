/**
 * AuthContext.tsx
 *
 * Provides authentication state and actions to the entire app.
 *
 * Features:
 *  - Session restore on app start (reads tokens from AsyncStorage)
 *  - axios request interceptor: attaches Bearer token to every request
 *  - axios response interceptor: auto-refreshes on 401 and retries once
 *  - Google Sign-In via @react-native-google-signin/google-signin (native module)
 *    → Sends the Google ID token to the backend for secure verification
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { InternalAxiosRequestConfig, AxiosError } from 'axios';

import authService, {
  authApi,
  getStoredTokens,
  saveTokens,
  clearTokens,
  type AuthUser,
} from '../services/authService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<AuthUser>;
  completeProfile: (profileData: {
    dateOfBirth?: string;
    age?: number;
    weight: number;
    height: number;
    bloodGroup: string;
  }) => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ref so interceptors always see the latest token without re-registering
  const tokenRef = useRef<string | null>(null);
  // Prevent double-logout from concurrent 401s
  const isRefreshingRef = useRef(false);

  // ── Apply tokens to state & ref ────────────────────────────────────────────
  function _applyTokens(token: string, userData: AuthUser): void {
    tokenRef.current = token;
    setAccessToken(token);
    setUser(userData);
  }

  // ── Logout helper (clears everything) ─────────────────────────────────────
  const _logout = useCallback(async (): Promise<void> => {
    try {
      if (tokenRef.current) {
        await authService.logout(tokenRef.current);
      }
    } catch {
      // swallow — always clear locally
    }

    tokenRef.current = null;
    setAccessToken(null);
    setUser(null);
    await clearTokens();
  }, []);

  // ── Axios interceptors ─────────────────────────────────────────────────────
  useEffect(() => {
    // Request: inject access token into every request
    const reqId = authApi.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (tokenRef.current) {
          config.headers.Authorization = `Bearer ${tokenRef.current}`;
        }
        return config;
      }
    );

    // Response: refresh token on 401 and retry once
    const resId = authApi.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalReq = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
        if (error.response?.status === 401 && !originalReq._retried && !isRefreshingRef.current) {
          originalReq._retried = true;
          isRefreshingRef.current = true;
          try {
            const { accessToken: newToken } = await authService.refreshAccessToken();
            tokenRef.current = newToken;
            setAccessToken(newToken);
            originalReq.headers.Authorization = `Bearer ${newToken}`;
            return authApi(originalReq);
          } catch {
            await _logout();
          } finally {
            isRefreshingRef.current = false;
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      authApi.interceptors.request.eject(reqId);
      authApi.interceptors.response.eject(resId);
    };
  }, [_logout]);

  // ── Session restore on mount ───────────────────────────────────────────────
  useEffect(() => {
    async function restoreSession(): Promise<void> {
      try {
        const { accessToken: storedToken, user: storedUser } = await getStoredTokens();
        if (storedToken && storedUser) {
          tokenRef.current = storedToken;
          setAccessToken(storedToken);
          setUser(storedUser);
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void restoreSession();
  }, []);

  // ── Public actions ─────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const data = await authService.login({ email, password });
    _applyTokens(data.accessToken, data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const data = await authService.register({ name, email, password });
      _applyTokens(data.accessToken, data.user);
    },
    []
  );

  /**
   * Google Sign-In is temporarily disabled.
   */
  const googleLogin = useCallback(async (): Promise<void> => {
    throw new Error('Google Sign-In is currently disabled.');
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await _logout();
  }, [_logout]);

  const verifyOtp = useCallback(
    async (email: string, otp: string): Promise<AuthUser> => {
      const data = await authService.verifyOtp({ email, otp });
      _applyTokens(data.accessToken, data.user);
      return data.user;
    },
    []
  );

  const completeProfile = useCallback(
    async (profileData: {
      dateOfBirth?: string;
      age?: number;
      weight: number;
      height: number;
      bloodGroup: string;
    }): Promise<void> => {
      const data = await authService.completeProfile(profileData);
      setUser(data.user);
    },
    []
  );

  const updateUser = useCallback((updatedUser: AuthUser): void => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        login,
        register,
        googleLogin,
        logout,
        verifyOtp,
        completeProfile,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
