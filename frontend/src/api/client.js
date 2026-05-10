import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    timeout: 30000,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        if (err.response?.status === 402 || err.response?.status === 403) {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const user = JSON.parse(userStr);
                // Don't redirect if we're already on the destination page to avoid infinite loops
                if (user.role === 'company_admin' && !window.location.pathname.includes('/company/subscription')) {
                    window.location.href = '/company/subscription';
                } else if (user.role === 'office_staff' && window.location.pathname !== '/suspended') {
                    window.location.href = '/suspended';
                }
            }
        }
        return Promise.reject(err);
    }
);

export default api;
