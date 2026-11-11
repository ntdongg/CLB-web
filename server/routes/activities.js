import { pool } from '../db.js';
import { sendJson, readJson } from '../router.js';

export function validateActivityInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Dữ liệu hoạt động không hợp lệ';
    }
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 255) {
        return 'Tên hoạt động là bắt buộc và không được vượt quá 255 ký tự';
    }
    if (body.description != null && (typeof body.description !== 'string' || body.description.length > 10000)) {
        return 'Mô tả hoạt động không hợp lệ';
    }
    if (body.location != null && (typeof body.location !== 'string' || body.location.length > 255)) {
        return 'Địa điểm không hợp lệ';
    }
    if (typeof body.start_at !== 'string' || Number.isNaN(Date.parse(body.start_at))) {
        return 'Thời gian bắt đầu không hợp lệ';
    }
    if (!Number.isSafeInteger(Number(body.capacity)) || Number(body.capacity) < 1) {
        return 'Sức chứa phải là số nguyên dương';
    }
    return null;
}

export async function listActivities(req, res, { url }) {
    try {
        const q = url.searchParams.get('q') || '';
        const page = Number(url.searchParams.get('page') || 1);
        const limit = Number(url.searchParams.get('limit') || 10);
        if (q.length > 255) return sendJson(res, 400, { error: 'Từ khóa tìm kiếm không được vượt quá 255 ký tự' });
        if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
            return sendJson(res, 400, { error: 'page và limit phải là số nguyên dương' });
        }

        const pageSize = Math.min(limit, 100);
        const search = `%${q}%`;
        const [[{ total }]] = await pool.query(
            'SELECT COUNT(*) AS total FROM activities WHERE title LIKE ?',
            [search]
        );
        const [rows] = await pool.query(
            `SELECT a.*,
                    (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) AS registered_count
             FROM activities a
             WHERE a.title LIKE ?
             ORDER BY a.start_at DESC
             LIMIT ? OFFSET ?`,
            [search, pageSize, (page - 1) * pageSize]
        );
        res.setHeader('X-Total-Count', String(total));
        sendJson(res, 200, rows);
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: 'Lỗi máy chủ nội bộ' });
    }
}

export async function createActivity(req, res) {
    try {
        const body = await readJson(req);
        const validationError = validateActivityInput(body);
        if (validationError) return sendJson(res, 400, { error: validationError });
        const { title, description, location, start_at, capacity } = body;
        const createdBy = req.user?.id;
        if (!createdBy) return sendJson(res, 401, { error: 'Không xác định được quản trị viên' });

        const sql = `INSERT INTO activities (title, description, location, start_at, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await pool.query(sql, [title.trim(), description || '', location || '', start_at, Number(capacity), createdBy]);

        sendJson(res, 201, { message: 'Tạo hoạt động thành công', id: result.insertId });
    } catch (error) {
        console.error(error);
        sendJson(res, ['JSON không hợp lệ', 'Dữ liệu quá lớn'].includes(error.message) ? 400 : 500, { error: error.message || 'Lỗi máy chủ' });
    }
}

export async function getActivity(req, res, { params }) {
    try {
        const id = params[0];
        const [rows] = await pool.query(
            `SELECT a.*,
                    (SELECT COUNT(*) FROM registrations r WHERE r.activity_id = a.id) AS registered_count
             FROM activities a WHERE a.id = ?`,
            [id]
        );
        if (rows.length === 0) return sendJson(res, 404, { error: 'Không tìm thấy hoạt động' });
        sendJson(res, 200, rows[0]);
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: 'Lỗi máy chủ nội bộ' });
    }
}

export async function deleteActivity(req, res, { params }) {
    try {
        const id = params[0];
        const [result] = await pool.query('DELETE FROM activities WHERE id = ?', [id]);
        if (result.affectedRows === 0) return sendJson(res, 404, { error: 'Không tìm thấy hoạt động' });
        sendJson(res, 200, { message: 'Xóa thành công' });
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: 'Lỗi máy chủ nội bộ' });
    }
}



// Hàm cập nhật hoạt động (PATCH)
export async function updateActivity(req, res, { params }) {
    try {
        const id = params[0];
        const body = await readJson(req);
        const validationError = validateActivityInput(body);
        if (validationError) return sendJson(res, 400, { error: validationError });
        const { title, description, location, start_at, capacity } = body;

        const [existing] = await pool.query('SELECT id FROM activities WHERE id = ?', [id]);
        if (existing.length === 0) return sendJson(res, 404, { error: 'Không tìm thấy hoạt động' });

        const sql = `UPDATE activities SET title = ?, description = ?, location = ?, start_at = ?, capacity = ? WHERE id = ?`;
        await pool.query(sql, [title.trim(), description || '', location || '', start_at, Number(capacity), id]);
        sendJson(res, 200, { message: 'Cập nhật hoạt động thành công' });
    } catch (error) {
        console.error(error);
        sendJson(res, ['JSON không hợp lệ', 'Dữ liệu quá lớn'].includes(error.message) ? 400 : 500, { error: error.message || 'Lỗi máy chủ' });
    }
}
