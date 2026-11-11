import { api } from './api.js';

const params = new URLSearchParams(window.location.search);
const activityId = params.get('id');
const registerButton = document.getElementById('registerBtn');
const evidenceForm = document.getElementById('evidenceForm');
const evidenceButton = evidenceForm?.querySelector('button[type="submit"]');
let activity;
let registered = false;

document.addEventListener('DOMContentLoaded', loadActivityDetail);

async function loadActivityDetail() {
    if (!activityId || !/^\d+$/.test(activityId)) {
        document.getElementById('activityTitle').textContent = 'Không tìm thấy mã hoạt động hợp lệ.';
        registerButton.disabled = true;
        if (evidenceButton) evidenceButton.disabled = true;
        return;
    }

    try {
        activity = await api('GET', `/api/activities/${encodeURIComponent(activityId)}`);
        document.getElementById('activityTitle').textContent = activity.title;
        document.getElementById('activityDesc').textContent = activity.description || 'Không có mô tả chi tiết';
        document.getElementById('activityLocation').textContent = activity.location || 'Chưa cập nhật';
        document.getElementById('activityTime').textContent = new Date(activity.start_at).toLocaleString('vi-VN');
        updateCapacity();

        if (localStorage.getItem('token')) {
            const registrations = await api('GET', '/api/registrations/my');
            registered = registrations.some(item => String(item.activity_id) === String(activity.id));
            const evidences = await api('GET', '/api/evidences/my');
            const submitted = evidences.some(item => String(item.activity_id) === String(activity.id));
            if (submitted) markEvidenceSubmitted();
        }

        updateRegistrationButton();
        registerButton.addEventListener('click', handleRegistration);
        evidenceForm?.addEventListener('submit', submitEvidence);
        if (evidenceButton && !registered) evidenceButton.disabled = true;
    } catch (error) {
        document.getElementById('activityTitle').textContent = `Không thể tải hoạt động: ${error.message}`;
        registerButton.disabled = true;
        if (evidenceButton) evidenceButton.disabled = true;
    }
}

function updateCapacity() {
    const count = Number(activity.registered_count || 0);
    document.getElementById('activityCapacity').textContent = `${count} / ${activity.capacity}`;
}

function updateRegistrationButton() {
    registerButton.textContent = registered ? 'Hủy đăng ký' : 'Đăng ký tham gia';
    registerButton.disabled = !registered &&
        Number(activity.registered_count || 0) >= Number(activity.capacity || 0);
    if (evidenceButton && !evidenceButton.dataset.submitted) {
        evidenceButton.disabled = !registered;
    }
}

async function handleRegistration() {
    if (!localStorage.getItem('token')) {
        alert('Vui lòng đăng nhập để đăng ký hoạt động.');
        return;
    }

    try {
        if (registered) {
            if (!window.confirm('Bạn có chắc muốn hủy đăng ký hoạt động này?')) return;
            await api('DELETE', `/api/activities/${encodeURIComponent(activityId)}/registrations/me`);
            registered = false;
            activity.registered_count = Math.max(0, Number(activity.registered_count || 0) - 1);
        } else {
            await api('POST', `/api/activities/${encodeURIComponent(activityId)}/registrations`, {});
            registered = true;
            activity.registered_count = Number(activity.registered_count || 0) + 1;
        }
        updateCapacity();
        updateRegistrationButton();
    } catch (error) {
        alert(`Không thể cập nhật đăng ký: ${error.message}`);
    }
}

async function submitEvidence(event) {
    event.preventDefault();
    if (!localStorage.getItem('token')) {
        alert('Vui lòng đăng nhập để nộp minh chứng.');
        return;
    }
    if (!registered) {
        alert('Bạn cần đăng ký hoạt động trước khi nộp minh chứng.');
        return;
    }

    const file = document.getElementById('evidenceFile').files[0];
    if (!file) {
        alert('Vui lòng chọn tệp minh chứng.');
        return;
    }

    const formData = new FormData();
    formData.append('activity_id', activityId);
    formData.append('file', file);

    try {
        await api('POST', '/api/evidences', formData);
        evidenceForm.reset();
        markEvidenceSubmitted();
        alert('Đã nộp minh chứng thành công.');
    } catch (error) {
        alert(`Lỗi nộp minh chứng: ${error.message}`);
    }
}

function markEvidenceSubmitted() {
    if (!evidenceButton) return;
    evidenceButton.textContent = 'Đã nộp minh chứng';
    evidenceButton.disabled = true;
    evidenceButton.dataset.submitted = 'true';
}
