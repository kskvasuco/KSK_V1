import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check authentication status on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const profile = await api.getUserProfile();
            setUser(profile);
            setIsAuthenticated(true);
        } catch {
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    const login = useCallback(async (mobile, password) => {
        const result = await api.loginOrRegister(mobile, password);
        await checkAuth();
        return result;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.logout();
        } catch {
            // Ignore logout errors
        }
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    const updateProfile = useCallback(async (data) => {
        const result = await api.updateUserProfile(data);
        await checkAuth(); // Refresh user data
        return result;
    }, []);

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        updateProfile,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
