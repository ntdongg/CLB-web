import { api, getStoredUser } from './api.js';
import { showEmpty, showError, showLoading } from './ui.js';

// 1. Kiểm tra quyền ADMIN trước khi tải
const token = localStorage.getItem('token');
const user = getStoredUser() || {};
if (!token || user.role !== 'ADMIN') {
    alert('Khu vực dành riêng cho Quản trị viên!');
    window.location.href = '/login.html';
}

const listBody = document.getElementById('evidenceList');
const filterStatus = document.getElementById('filterStatus');

// 2. Tải danh sách minh chứng theo trạng thái lọc
async function loadEvidences() {
    showLoading(listBody, 'Đang tải minh chứng...', 5);
    const status = filterStatus.value;

    try {
        const data = await api('GET', `/api/evidences?status=${status}`);

        if (data.length === 0) {
            showEmpty(listBody, 'Không có minh chứng nào.', 5);
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #eee';

            const tdActivity = document.createElement('td');
            tdActivity.style.padding = '12px';
            tdActivity.textContent = item.activity_title;

            const tdStudentId = document.createElement('td');
            tdStudentId.style.padding = '12px';
            tdStudentId.textContent = item.student_id;

            const tdFullName = document.createElement('td');
            tdFullName.style.padding = '12px';
            tdFullName.textContent = item.full_name;

            const tdFile = document.createElement('td');
            tdFile.style.padding = '12px';
            const fileLink = document.createElement('a');
            fileLink.href = item.file_path;
            fileLink.target = '_blank';
            fileLink.textContent = item.file_name || 'Xem tệp';
            fileLink.style.color = 'var(--primary-color)';
            tdFile.appendChild(fileLink);

            const tdAction = document.createElement('td');
            tdAction.style.padding = '12px';
            tdAction.style.textAlign = 'center';

            if (item.status === 'PENDING') {
                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Duyệt';
                approveBtn.style.padding = '6px 12px';
                approveBtn.style.marginRight = '8px';
                approveBtn.style.backgroundColor = '#10b981';
                approveBtn.onclick = () => updateStatus(item.id, 'APPROVED');

                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = 'Từ chối';
                rejectBtn.style.padding = '6px 12px';
                rejectBtn.style.backgroundColor = '#ef4444';
                rejectBtn.onclick = () => updateStatus(item.id, 'REJECTED');

                tdAction.appendChild(approveBtn);
                tdAction.appendChild(rejectBtn);
            } else {
                const statusSpan = document.createElement('span');
                statusSpan.textContent = item.status;
                statusSpan.style.fontWeight = 'bold';
                statusSpan.style.color = item.status === 'APPROVED' ? '#10b981' : '#ef4444';
                tdAction.appendChild(statusSpan);
            }

            tr.appendChild(tdActivity);
            tr.appendChild(tdStudentId);
            tr.appendChild(tdFullName);
            tr.appendChild(tdFile);
            tr.appendChild(tdAction);

            listBody.appendChild(tr);
        });
    } catch (err) {
        showError(listBody, err, 5);
    }
}

// 3. Hàm gửi yêu cầu Duyệt hoặc Từ chối
async function updateStatus(id, newStatus) {
    if (!confirm(`Bạn có chắc muốn chuyển trạng thái sang ${newStatus}?`)) return;

    try {
        await api('PATCH', `/api/evidences/${id}`, { status: newStatus });
        alert('Cập nhật thành công!');
        loadEvidences();
    } catch (err) {
        alert('Lỗi cập nhật: ' + err.message);
    }
}

filterStatus.addEventListener('change', loadEvidences);
loadEvidences();