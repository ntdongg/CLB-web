import { getStoredUser, api } from './api.js';
import { showEmpty, showError, showLoading } from './ui.js';

const token = localStorage.getItem('token');
const currentUser = getStoredUser() || {};

        if (!token || currentUser.role !== 'ADMIN') {
            alert('Khu vực dành riêng cho Quản trị viên!');
            window.location.href = '/login.html';
        }


        
document.addEventListener('DOMContentLoaded', () => {
    fetchAdminActivities();
    document.getElementById('createActivityForm').addEventListener('submit', createActivity);
});

async function createActivity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const activity = {
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        location: document.getElementById('location').value.trim(),
        start_at: document.getElementById('start_at').value.replace('T', ' ') + ':00',
        capacity: Number(document.getElementById('capacity').value)
    };

    try {
        await api('POST', '/api/activities', activity);
        form.reset();
        alert('Tạo hoạt động thành công!');
        await fetchAdminActivities();
    } catch (error) {
        alert(`Không thể tạo hoạt động: ${error.message}`);
    }
}

// Hàm lấy dữ liệu và đổ ra bảng
async function fetchAdminActivities() {
    const tbody = document.getElementById('adminActivityList');
    showLoading(tbody, 'Đang tải hoạt động...', 3);
    try {
        
        const activities = await api('GET', '/api/activities');
        tbody.replaceChildren();

        activities.forEach(act => {
            const tr = document.createElement('tr');
            const title = document.createElement('td');
            title.style.cssText = 'padding:10px;border-bottom:1px solid #ccc';
            title.textContent = act.title;
            const capacity = document.createElement('td');
            capacity.style.cssText = 'padding:10px;border-bottom:1px solid #ccc';
            capacity.textContent = String(act.capacity);
            const actions = document.createElement('td');
            actions.style.cssText = 'padding:10px;border-bottom:1px solid #ccc';
            const edit = document.createElement('a');
            edit.href = `/admin-edit.html?id=${encodeURIComponent(act.id)}`;
            edit.textContent = 'Sửa';
            edit.style.cssText = 'margin-right:8px;text-decoration:none;padding:6px 12px;background:#eab308;color:white;border-radius:4px;font-weight:bold;font-size:13px';
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Xóa';
            remove.style.cssText = 'background-color:#ef4444;padding:6px 12px;font-size:13px';
            remove.addEventListener('click', () => deleteActivity(act.id));
            actions.append(edit, remove);
            tr.append(title, capacity, actions);
            tbody.appendChild(tr);
        });
        if (activities.length === 0) {
            showEmpty(tbody, 'Chưa có hoạt động nào.', 3);
        }
    } catch (error) {
        showError(tbody, error, 3);
    }
}

// Hàm Xóa hoạt động
async function deleteActivity(id) {
    // Hiện hộp thoại xác nhận trước khi xóa
    if (!confirm('Bạn có chắc chắn muốn xóa hoạt động này?')) return;
    
    try {
        await api('DELETE', `/api/activities/${id}`);
        alert('Đã xóa thành công!');
        await fetchAdminActivities();
    } catch (error) {
        alert('Lỗi khi xóa hoạt động: ' + error.message);
    }
}