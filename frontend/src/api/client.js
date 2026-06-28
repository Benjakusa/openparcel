import axios from 'axios';

function getToken() {
    try {
        return sessionStorage.getItem('token');
    } catch {}
    return null;
}

function clearSession() {
    try {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    } catch {}
}

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
    headers: {
        'X-Requested-With': 'XMLHttpRequest',
    },
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            clearSession();
            window.location.href = '/login';
        }
        if (err.response?.status === 402 || err.response?.status === 403) {
            const userStr = sessionStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user.role === 'company_admin' && !window.location.pathname.includes('/company/subscription')) {
                        window.location.href = '/company/subscription';
                    } else if (user.role === 'office_staff' && window.location.pathname !== '/suspended') {
                        window.location.href = '/suspended';
                    }
                } catch {}
            }
        }
        return Promise.reject(err);
    }
);

export default api;
