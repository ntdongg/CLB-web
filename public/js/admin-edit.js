import { api, getStoredUser } from './api.js';

// Kiểm tra quyền Admin trước khi tải trang
const token = localStorage.getItem('token');
const currentUser = getStoredUser() || {};

if (!token || currentUser.role !== 'ADMIN') {
    alert('Khu vực dành riêng cho Quản trị viên!');
    window.location.href = '/login.html';
}



const params = new URLSearchParams(window.location.search);
const activityId = params.get('id');

if (!activityId) {
    alert('Không tìm thấy mã hoạt động cần sửa!');
    window.location.href = '/admin.html';
}

document.addEventListener('DOMContentLoaded', loadCurrentData);

// Tải thông tin cũ đổ vào Form
async function loadCurrentData() {
    try {
        const activity = await api('GET', `/api/activities/${activityId}`);
        
        document.getElementById('title').value = activity.title;
        document.getElementById('description').value = activity.description || '';
        document.getElementById('location').value = activity.location || '';
        document.getElementById('capacity').value = activity.capacity;

        // Định dạng thời gian sang format YYYY-MM-DDTHH:mm cho input datetime-local
        if (activity.start_at) {
            const date = new Date(activity.start_at);
            const formatted = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('start_at').value = formatted;
        }
    } catch (error) {
        alert('Lỗi tải dữ liệu: ' + error.message);
        window.location.href = '/admin.html';
    }
}

// Bắt sự kiện bấm Cập nhật
document.getElementById('editActivityForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedData = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        location: document.getElementById('location').value,
        start_at: document.getElementById('start_at').value.replace('T', ' ') + ':00',
        capacity: parseInt(document.getElementById('capacity').value)
    };

    try {
        await api('PATCH', `/api/activities/${activityId}`, updatedData);
        alert('Cập nhật hoạt động thành công!');
        window.location.href = '/admin.html';
    } catch (error) {
        alert('Lỗi cập nhật: ' + error.message);
    }
});