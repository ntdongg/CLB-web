const originalFetch = window.fetch.bind(window);
const nativeFetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const requestUrl = input instanceof Request ? input.url : new URL(input, window.location.href).href;
    const url = new URL(requestUrl);
    if (
        url.origin === window.location.origin &&
        url.pathname.startsWith('/api/') &&
        url.pathname !== '/api/auth/login' &&
        [401, 403].includes(response.status)
    ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_session');
        if (window.location.pathname !== '/login.html') window.location.replace('/login.html');
    }
    return response;
};
const API_ORIGIN = window.location.origin;
let dashboardObserver;
let toastObserver;

window.fetch = async (input, init = {}) => {
    const requestUrl = input instanceof Request ? input.url : new URL(input, window.location.href).href;
    const url = new URL(requestUrl);
    if (url.origin !== API_ORIGIN || !url.pathname.startsWith('/api/')) {
        return nativeFetch(input, init);
    }

    const request = input instanceof Request ? input : null;
    const method = (init.method || request?.method || 'GET').toUpperCase();
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const token = localStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let body = init.body;
    if (body === undefined && request && method !== 'GET' && method !== 'HEAD') {
        body = await request.clone().text();
    }

    if (url.pathname === '/api/auth/login' && method === 'POST') {
        const credentials = JSON.parse(body || '{}');
        body = JSON.stringify({
            email: credentials.email || credentials.username,
            password: credentials.password
        });
        headers.set('Content-Type', 'application/json');
    }

    if (url.pathname === '/api/registrations/my' && method === 'GET') {
        if (!token) return jsonResponse(null, []);
        return getCurrentUserRegistrations(headers);
    }

    if (url.pathname === '/api/activities' && method === 'GET') {
        const response = await nativeFetch(input, { ...init, method, headers, body });
        if (!response.ok) return response;
        const activities = await response.clone().json();
        if (!Array.isArray(activities)) return response;

        const normalized = activities.map(activity => {
            const startAt = activity.start_at || activity.time || activity.startsAt;
            const endAt = activity.end_at || activity.ends_at || activity.endsAt || endOfStartDay(startAt);
            const count = Number(activity.registered_count || activity.registered || 0);

            return {
                ...activity,
                name: activity.name || activity.title || 'Hoạt động CLB',
                category: activity.category || 'Kỹ năng',
                time: startAt,
                startsAt: startAt,
                endsAt: endAt,
                location: activity.location || 'Đang cập nhật',
                registered: count,
                registered_count: count,
                capacity: Number(activity.capacity || 0),
                status: activity.status || activityStatus(startAt, endAt)
            };
        });
        return jsonResponse(response, normalized);
    }

    if (url.pathname === '/api/evidences' && method === 'GET') {
        const response = await nativeFetch(input, { ...init, method, headers, body });
        if (!response.ok) return response;
        const entries = await response.clone().json();
        if (!Array.isArray(entries)) return response;
        return jsonResponse(response, entries.map(entry => ({
            ...entry,
            file_path: String(entry.file_path || '').replace(/^\/+/, '')
        })));
    }

    if (url.pathname === '/api/registrations' && method === 'POST') {
        const registration = JSON.parse(body || '{}');
        const activityId = registration.activity_id;
        if (!activityId) {
            throw new Error('Thiếu mã hoạt động để đăng ký.');
        }
        const user = readSessionUser();
        if (!user) {
            return jsonResponse(null, { error: 'Vui lòng đăng nhập để đăng ký.' }, 401);
        }

        const payload = JSON.stringify({
            ...registration,
            activity_id: activityId,
            student_id: registration.student_id || user.studentId || user.username || String(user.id || ''),
            full_name: registration.full_name || user.fullName || user.username || ''
        });
        const registrationHeaders = new Headers(headers);
        registrationHeaders.set('Content-Type', 'application/json');
        const options = { method: 'POST', headers: registrationHeaders, body: payload };

        const activityRoute = `/api/activities/${encodeURIComponent(activityId)}/registrations`;
        const activityResponse = await nativeFetch(activityRoute, options);
        if (activityResponse.status !== 404) return activityResponse;
        return nativeFetch('/api/registrations', options);
    }

    if (url.pathname.startsWith('/api/activities') && ['POST', 'PUT', 'PATCH'].includes(method)) {
        const activity = JSON.parse(body || '{}');
        body = JSON.stringify({
            ...activity,
            title: activity.title || activity.name,
            description: activity.description || activity.category || '',
            start_at: activity.start_at || activity.time || activity.startsAt,
            capacity: Number(activity.capacity)
        });
        headers.set('Content-Type', 'application/json');
    }

    const actualMethod = method === 'PUT' && /^\/api\/activities\/\d+$/.test(url.pathname)
        ? 'PATCH'
        : method;

    const response = await nativeFetch(input instanceof Request ? input.url : input, {
        ...init,
        method: actualMethod,
        headers,
        ...(body !== undefined ? { body } : {})
    });
    if (url.pathname === '/api/evidences' && method === 'POST' && response.ok) {
        window.setTimeout(() => {
            refreshDashboard().catch(error =>
                console.error('Minh chứng đã gửi nhưng không thể cập nhật Dashboard:', error)
            );
        }, 0);
    }
    return response;
};

async function getCurrentUserRegistrations(headers) {
    const response = await nativeFetch('/api/registrations/my', { headers });
    if (!response.ok) throw await responseError(response, 'Không thể tải đăng ký của tài khoản');

    const entries = await response.json();
    if (!Array.isArray(entries)) {
        throw new Error('Dữ liệu đăng ký từ máy chủ không hợp lệ.');
    }
    return jsonResponse(response, entries);
}

function readSessionUser() {
    try {
        const user = JSON.parse(localStorage.getItem('user_session') || 'null');
        return user && typeof user === 'object' ? user : null;
    } catch {
        localStorage.removeItem('user_session');
        return null;
    }
}

function activityStatus(startAt, endAt) {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const now = new Date();
    if (Number.isNaN(start.getTime())) return 'upcoming';
    if (now < start) return 'upcoming';
    if (!Number.isNaN(end.getTime()) && now <= end) return 'ongoing';
    return 'completed';
}

function endOfStartDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    date.setHours(23, 59, 59, 999);
    return date.toISOString();
}

async function responseError(response, fallback) {
    let data;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    return new Error(data?.error || `${fallback} (HTTP ${response.status})`);
}

function jsonResponse(original, data, status = original?.status || 200) {
    const headers = new Headers(original?.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), {
        status,
        statusText: original?.statusText || '',
        headers
    });
}

document.addEventListener('click', event => {
    const button = event.target instanceof Element
        ? event.target.closest('.activity-table button')
        : null;
    if (!button) return;
    const action = button.textContent.trim();
    if (action !== 'Huỷ đăng ký' && action !== 'Hủy đăng ký' && action !== 'Đăng ký') return;

    const user = readSessionUser();
    if (!user || !localStorage.getItem('token')) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (action === 'Huỷ đăng ký' || action === 'Hủy đăng ký') {
        cancelFromRow(button).catch(error => window.alert(error.message));
        return;
    }
    registerFromRow(button).catch(error => window.alert(error.message));
}, true);

function observeDashboard() {
    const root = document.getElementById('root');
    if (!root || dashboardObserver) return;

    observeToast(root);
    dashboardObserver = new MutationObserver(() => {
        const tableBody = root.querySelector('.activity-table tbody');
        if (!tableBody) return;
        dashboardObserver.disconnect();
        dashboardObserver = null;
        observeActivityRows(tableBody);
        refreshDashboard().catch(error => console.error('Không thể đồng bộ Dashboard:', error));
    });
    dashboardObserver.observe(root, { childList: true, subtree: true });
}

function observeToast(root) {
    if (toastObserver) return;

    if (!document.getElementById('dashboard-toast-warning-style')) {
        const style = document.createElement('style');
        style.id = 'dashboard-toast-warning-style';
        style.textContent = '.toast__check.toast__check--warning{color:#a64e4e;background:#fbefef}';
        document.head.appendChild(style);
    }

    toastObserver = new MutationObserver(() => {
        const toast = root.querySelector('.toast');
        if (!toast || toast.dataset.iconObserverAttached) return;
        toast.dataset.iconObserverAttached = 'true';
        const updateIcon = () => setToastWarningIcon(toast);
        new MutationObserver(updateIcon).observe(toast, {
            childList: true,
            characterData: true,
            subtree: true
        });
        updateIcon();
    });
    toastObserver.observe(root, { childList: true, subtree: true });
}

function setToastWarningIcon(toast) {
    const message = toast.textContent.trim();
    const isWarning = /^Vui lòng đăng nhập\b/i.test(message);
    const type = isWarning ? 'warning' : 'success';
    if (!message) return;

    const icon = toast.querySelector('.toast__check');
    if (!icon) return;
    const expectedPath = isWarning ? 'M18 6 6 18M6 6l12 12' : 'm5 12 4 4L19 6';
    const currentPath = icon.querySelector('path')?.getAttribute('d');
    if (toast.dataset.iconType === type && currentPath === expectedPath) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', expectedPath);
    svg.appendChild(path);
    icon.replaceChildren(svg);

    icon.classList.toggle('toast__check--warning', isWarning);
    toast.setAttribute('role', isWarning ? 'alert' : 'status');
    toast.dataset.iconType = type;
}

function observeActivityRows(tableBody) {
    const observer = new MutationObserver(() => {
        refreshDashboard().catch(error => console.error('Không thể đồng bộ Dashboard:', error));
    });
    observer.observe(tableBody, { childList: true, subtree: true });
}

async function refreshDashboard() {
    const user = readSessionUser();
    const hasSession = Boolean(user && localStorage.getItem('token'));
    const [activitiesResponse, registrationsResponse] = await Promise.all([
        window.fetch('/api/activities'),
        hasSession ? window.fetch('/api/registrations/my') : Promise.resolve(jsonResponse(null, []))
    ]);
    if (!activitiesResponse.ok) throw await responseError(activitiesResponse, 'Không thể tải hoạt động');
    if (!registrationsResponse.ok) throw await responseError(registrationsResponse, 'Không thể tải đăng ký');

    const activities = await activitiesResponse.json();
    const registrations = await registrationsResponse.json();
    if (!Array.isArray(activities) || !Array.isArray(registrations)) {
        throw new Error('Dữ liệu hoạt động hoặc đăng ký không hợp lệ.');
    }

    const registeredIds = new Set(registrations.map(item => String(item.activity_id || item.id)));
    let submittedEvidenceIds = new Set();
    if (hasSession) {
        const evidenceResponse = await window.fetch('/api/evidences/my');
        if (!evidenceResponse.ok) {
            throw await responseError(evidenceResponse, 'Không thể tải trạng thái minh chứng');
        }
        const evidences = await evidenceResponse.json();
        if (!Array.isArray(evidences)) {
            throw new Error('Dữ liệu minh chứng của tài khoản không hợp lệ.');
        }
        submittedEvidenceIds = new Set(evidences.map(item => String(item.activity_id)));
    }

    const activitiesByName = new Map(activities.map(activity => [String(activity.name).trim(), activity]));
    const tableBody = document.querySelector('.activity-table tbody');

    if (tableBody) {
        for (const row of tableBody.rows) {
            const title = row.querySelector('.activity-name strong')?.textContent.trim();
            const activity = activitiesByName.get(title);
            if (!activity) continue;

            const capacityCell = row.querySelector('.capacity-cell strong');
            if (capacityCell) {
                const registeredCount = Number(activity.registered) || 0;
                if (capacityCell.firstChild?.nodeType === Node.TEXT_NODE) {
                    if (capacityCell.firstChild.nodeValue !== String(registeredCount)) {
                        capacityCell.firstChild.nodeValue = String(registeredCount);
                    }
                }
                const total = capacityCell.querySelector('span');
                if (total && total.textContent !== ` / ${activity.capacity}`) {
                    total.textContent = ` / ${activity.capacity}`;
                }
            }

            const registerButton = row.querySelector('.row-actions button');
            if (registerButton && ['Đăng ký', 'Huỷ đăng ký'].includes(registerButton.textContent.trim())) {
                const registered = registeredIds.has(String(activity.id));
                const label = registered ? 'Huỷ đăng ký' : 'Đăng ký';
                if (registerButton.textContent.trim() !== label) registerButton.textContent = label;
                registerButton.disabled = !registered &&
                    (Number(activity.registered) >= Number(activity.capacity) || activity.status === 'completed');
            }

            const evidenceButton = [...row.querySelectorAll('.row-actions button')]
                .find(button => ['Nộp minh chứng', 'Đã nộp minh chứng'].includes(button.textContent.trim()));
            if (evidenceButton) {
                const submitted = submittedEvidenceIds.has(String(activity.id));
                const label = submitted ? 'Đã nộp minh chứng' : 'Nộp minh chứng';
                if (evidenceButton.textContent.trim() !== label) evidenceButton.textContent = label;
                evidenceButton.disabled = submitted;
            }
        }
    }

    const statValues = {
        'Tổng số hoạt động': activities.length,
        'Đã đăng ký': registrations.length,
        'Chỗ trống còn lại': activities
            .filter(activity => activity.status !== 'completed')
            .reduce((total, activity) => total + Math.max(0, Number(activity.capacity) - Number(activity.registered)), 0)
    };
    for (const card of document.querySelectorAll('.stat-card')) {
        const label = card.querySelector('.stat-card__content p')?.textContent.trim();
        const value = statValues[label];
        const strong = card.querySelector('.stat-card__content strong');
        if (value !== undefined && strong && strong.textContent !== String(value)) {
            strong.textContent = String(value);
        }
    }

    if (user?.role === 'ADMIN') {
        const evidenceResponse = await window.fetch('/api/evidences?status=PENDING');
        if (!evidenceResponse.ok) throw await responseError(evidenceResponse, 'Không thể tải minh chứng chờ duyệt');
        const evidences = await evidenceResponse.json();
        if (!Array.isArray(evidences)) throw new Error('Dữ liệu minh chứng từ máy chủ không hợp lệ.');
        const pendingCard = [...document.querySelectorAll('.stat-card')]
            .find(card => card.querySelector('.stat-card__content p')?.textContent.trim() === 'Minh chứng chờ duyệt');
        const value = pendingCard?.querySelector('.stat-card__content strong');
        if (value && value.textContent !== String(evidences.length)) value.textContent = String(evidences.length);
    }
}

async function registerFromRow(button) {
    const row = button.closest('tr');
    const name = row?.querySelector('.activity-name strong')?.textContent.trim();
    if (!name) throw new Error('Không xác định được hoạt động cần đăng ký.');

    const response = await window.fetch('/api/activities');
    if (!response.ok) throw await responseError(response, 'Không thể tải hoạt động');
    const activities = await response.json();
    const activity = activities.find(item => String(item.name).trim() === name);
    if (!activity) throw new Error('Hoạt động không còn tồn tại.');
    if (Number(activity.registered) >= Number(activity.capacity)) {
        throw new Error('Hoạt động đã đủ số lượng.');
    }

    const user = readSessionUser();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.set('Authorization', `Bearer ${localStorage.getItem('token')}`);
    const body = JSON.stringify({
        activity_id: activity.id,
        student_id: user.studentId || user.username || String(user.id || ''),
        full_name: user.fullName || user.username || ''
    });
    const endpoint = `/api/activities/${encodeURIComponent(activity.id)}/registrations`;
    let result = await nativeFetch(endpoint, { method: 'POST', headers, body });
    if (result.status === 404) {
        result = await nativeFetch('/api/registrations', { method: 'POST', headers, body });
    }
    if (!result.ok) throw await responseError(result, 'Không thể đăng ký hoạt động');
    await refreshDashboard();
}

async function cancelFromRow(button) {
    const row = button.closest('tr');
    const name = row?.querySelector('.activity-name strong')?.textContent.trim();
    if (!name) throw new Error('Không xác định được hoạt động cần hủy đăng ký.');
    if (!window.confirm(`Bạn có chắc muốn hủy đăng ký hoạt động "${name}"?`)) return;

    const activitiesResponse = await window.fetch('/api/activities');
    if (!activitiesResponse.ok) throw await responseError(activitiesResponse, 'Không thể tải hoạt động');
    const activities = await activitiesResponse.json();
    const activity = activities.find(item => String(item.name).trim() === name);
    if (!activity) throw new Error('Hoạt động không còn tồn tại.');

    const registrationsResponse = await window.fetch('/api/registrations/my');
    if (!registrationsResponse.ok) {
        throw await responseError(registrationsResponse, 'Không thể tải đăng ký của bạn');
    }
    const registrations = await registrationsResponse.json();
    const activityRegistrations = registrations.filter(item =>
        String(item.activity_id) === String(activity.id)
    );
    if (activityRegistrations.length === 0) {
        await refreshDashboard();
        throw new Error('Không tìm thấy đăng ký của bạn cho hoạt động này.');
    }

    button.disabled = true;
    try {
        for (const registration of activityRegistrations) {
            const response = await window.fetch(`/api/registrations/${encodeURIComponent(registration.id)}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw await responseError(response, 'Không thể hủy đăng ký');
        }
        await refreshDashboard();
        window.alert('Đã hủy đăng ký thành công.');
    } catch (error) {
        await refreshDashboard().catch(refreshError =>
            console.error('Không thể làm mới Dashboard sau khi hủy đăng ký:', refreshError)
        );
        throw error;
    } finally {
        button.disabled = false;
    }
}

observeDashboard();
