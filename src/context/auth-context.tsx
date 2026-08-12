import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { apiClient } from '@/lib/api-client';

// ─────────────────────────────────────────────
// Frontend User Profile
// ─────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  initials: string;
  title: string;
  location: string;
  targetRole: string;
  yearsOfExperience: number;
  headline: string;
  summary: string;
  savedJobIds: string[];
  appliedJobIds: string[];
  enrolledCourseIds: string[];
  completedCourseIds: string[];
}

// ─────────────────────────────────────────────
// Backend User Response
// ─────────────────────────────────────────────

interface BackendUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────
// Auth Context Type
// ─────────────────────────────────────────────

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (credentials: {
    email: string;
    password: string;
  }) => Promise<void>;

  signup: (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }) => Promise<void>;

  logout: () => void;
  refreshUser: () => Promise<void>;
}

// ─────────────────────────────────────────────
// Backend → Frontend User Mapper
// ─────────────────────────────────────────────

function mapBackendUser(user: BackendUser): UserProfile {
  const name = user.full_name?.trim() || 'User';

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    id: String(user.id),
    name,
    email: user.email,

    initials: initials || 'U',

    // Default profile values
    // These can be populated later from a profile endpoint.
    title: 'Career Explorer',
    location: '',
    targetRole: '',
    yearsOfExperience: 0,
    headline: '',
    summary: '',

    savedJobIds: [],
    appliedJobIds: [],
    enrolledCourseIds: [],
    completedCourseIds: [],
  };
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

// ─────────────────────────────────────────────
// Auth Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('careerlens_token')
  );

  const [isLoading, setIsLoading] = useState(true);

  // ─────────────────────────────────────────────
  // GET CURRENT USER
  // GET /api/auth/me
  // ─────────────────────────────────────────────

  const refreshUser = async () => {
    const storedToken = localStorage.getItem('careerlens_token');

    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const backendUser = await apiClient<BackendUser>('/auth/me', {
        token: storedToken,
      });

      // Convert backend user format to frontend format
      setUser(mapBackendUser(backendUser));
    } catch (error) {
      console.error('Failed to refresh user:', error);

      // Token is invalid/expired
      localStorage.removeItem('careerlens_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // RUN WHEN TOKEN CHANGES
  // ─────────────────────────────────────────────

  useEffect(() => {
    refreshUser();
  }, [token]);

  // ─────────────────────────────────────────────
  // LOGIN
  // POST /api/auth/login
  // ─────────────────────────────────────────────

  const login = async (credentials: {
    email: string;
    password: string;
  }) => {
    setIsLoading(true);

    try {
      const res = await apiClient<{
        access_token: string;
        token_type: string;
        user: BackendUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      // Save JWT token
      localStorage.setItem('careerlens_token', res.access_token);

      // Update authentication state
      setToken(res.access_token);

      // Convert backend user → frontend user
      setUser(mapBackendUser(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // SIGNUP / REGISTER
  // POST /api/auth/register
  // ─────────────────────────────────────────────

  const signup = async (data: {
    name: string;
    email: string;
    password: string;
    targetRole?: string;
  }) => {
    setIsLoading(true);

    try {
      const res = await apiClient<{
        access_token: string;
        token_type: string;
        user: BackendUser;
      }>('/auth/register', {
        method: 'POST',

        // Backend expects "full_name"
        body: JSON.stringify({
          full_name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      // Save JWT token
      localStorage.setItem('careerlens_token', res.access_token);

      // Update authentication state
      setToken(res.access_token);

      // Convert backend user → frontend user
      setUser(mapBackendUser(res.user));
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────────

  const logout = () => {
    localStorage.removeItem('careerlens_token');

    setToken(null);
    setUser(null);
  };

  // ─────────────────────────────────────────────
  // PROVIDER
  // ─────────────────────────────────────────────

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────
// useAuth Hook
// ─────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}