// public/js/api.js

export function getStoredUser() {
    for (const key of ['user_session', 'user']) {
        try {
            const user = JSON.parse(localStorage.getItem(key) || 'null');
            if (user && typeof user === 'object' && user.role) return user;
        } catch {
            localStorage.removeItem(key);
        }
    }
    return null;
}

export async function api(method, path, body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    // Tự động lấy token từ localStorage (nếu có) để gắn vào header
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body instanceof FormData) {
        delete headers['Content-Type'];
        options.body = body;
    } else if (body !== null && body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        // Nếu token hết hạn hoặc chưa đăng nhập mà truy cập API yêu cầu xác thực
        if ([401, 403].includes(response.status) && window.location.pathname !== '/login.html') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('user_session');
            window.location.replace('/login.html');
        }
        throw new Error(data.error || 'Có lỗi xảy ra từ máy chủ');
    }

    return data;
}