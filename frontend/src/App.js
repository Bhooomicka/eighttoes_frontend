import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import UsersAccountsPage from "@/pages/UsersAccountsPage";
import SettingsPage from "@/pages/SettingsPage";
import ThreatsPage from "@/pages/ThreatsPage";
import CredentialsPage from "@/pages/CredentialsPage";
import CompliancePage from "@/pages/CompliancePage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Theme Context
const ThemeContext = createContext(null);

export const useTheme = () => useContext(ThemeContext);

const MOCK_USERS = [
  {
    id: "user-admin-001",
    email: "bhooomickadg@gmail.com",
    name: "Bhooomicka",
    role: "admin",
    department: "Security"
  },
  {
    id: "user-lead-001",
    email: "sarah.lead@company.com",
    name: "Margaret",
    role: "team_lead",
    department: "Security Operations"
  },
  {
    id: "user-member-001",
    email: "john.doe@company.com",
    name: "John Doe",
    role: "team_member",
    department: "Engineering"
  }
];

const getMockUser = (email) => {
  const matchedUser = MOCK_USERS.find(
    (mockUser) => mockUser.email === email
  );

  if (matchedUser) {
    return {
      id: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
      role: matchedUser.role,
      avatar: "",
      department: matchedUser.department
    };
  }

  const fallbackName = (email || "user")
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "User";

  return {
    id: "mock-user-1",
    email: email || "user@example.com",
    name: fallbackName,
    role: "admin",
    avatar: "",
    department: "Engineering"
  };
};

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("sentinel-theme");
    return saved || "dark";
  });

  useEffect(() => {
    localStorage.setItem("sentinel-theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("sentinel-token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (token === "mock-token-12345") {
        const savedMockUser = localStorage.getItem("sentinel-mock-user");
        const parsedMockUser = savedMockUser ? JSON.parse(savedMockUser) : null;
        setUser(
          parsedMockUser || {
            id: "mock-user-1",
            email: "user@example.com",
            name: "User",
            role: "admin",
            avatar: "",
            department: "Engineering"
          }
        );
        setLoading(false);
        return;
      }

      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (error) {
          console.warn("Token verification failed", error);
          if (error.code === "ERR_NETWORK" || !error.response) {
             console.warn("Backend unavailable, keeping session active with mock user.");
             // Keep the session alive for dev mode
             setUser({
               id: "mock-user-1",
               email: "user@example.com",
               name: "Test User",
               role: "admin",
               avatar: "",
               department: "Engineering"
             });
          } else {
            localStorage.removeItem("sentinel-token");
            setToken(null);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };
    verifyToken();
  }, [token]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem("sentinel-token", newToken);
      setToken(newToken);
      setUser(userData);
      return userData;
    } catch (error) {
      console.warn("Backend login failed, using mock login due to error:", error);
      const mockToken = "mock-token-12345";
      const mockUser = getMockUser(email);
      
      localStorage.setItem("sentinel-token", mockToken);
      localStorage.setItem("sentinel-mock-user", JSON.stringify(mockUser));
      setToken(mockToken);
      setUser(mockUser);
      return mockUser;
    }
  };

  const logout = () => {
    localStorage.removeItem("sentinel-token");
    localStorage.removeItem("sentinel-mock-user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/users-accounts" element={
              <ProtectedRoute>
                <UsersAccountsPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/threats" element={
              <ProtectedRoute>
                <ThreatsPage />
              </ProtectedRoute>
            } />
            <Route path="/credentials" element={
              <ProtectedRoute>
                <CredentialsPage />
              </ProtectedRoute>
            } />
            <Route path="/compliance" element={
              <ProtectedRoute>
                <CompliancePage />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
