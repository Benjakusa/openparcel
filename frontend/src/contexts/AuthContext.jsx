import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

function getStoredUser() {
    try {
        const stored = sessionStorage.getItem('user');
        if (stored) return JSON.parse(stored);
    } catch {}
    return null;
}

function getStoredToken() {
    try {
        return sessionStorage.getItem('token');
    } catch {}
    return null;
}

function storeSession(token, userData) {
    try {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(userData));
    } catch {}
}

function clearSession() {
    try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    } catch {}
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(getStoredUser);
    const [loading, setLoading] = useState(true);
    const [tokenExpiry, setTokenExpiry] = useState(null);

    useEffect(() => {
        const token = getStoredToken();
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp * 1000 < Date.now()) {
                    clearSession();
                    setUser(null);
                } else {
                    setTokenExpiry(payload.exp * 1000);
                }
            } catch {
                clearSession();
                setUser(null);
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback((userData, token) => {
        storeSession(token, userData);
        setUser(userData);
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setTokenExpiry(payload.exp * 1000);
        } catch {}
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setUser(null);
        setTokenExpiry(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, tokenExpiry }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
