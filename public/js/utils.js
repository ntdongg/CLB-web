export function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email.trim());
}

export function isValidPassword(password) {
    return typeof password === 'string' && password.length >= 6;
}

export function buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, value);
        }
    }
    const qs = searchParams.toString();
    return qs ? `?${qs}` : '';
}

export function calculateRemainingSeats(capacity, registeredCount) {
    const cap = Number(capacity) || 0;
    const reg = Number(registeredCount) || 0;
    const remaining = cap - reg;
    return remaining > 0 ? remaining : 0;
}