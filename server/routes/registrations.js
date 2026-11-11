import { pool } from '../db.js';
import { sendJson, readJson } from '../router.js';

// Hàm 1: Tạo đơn đăng ký mới
export async function createRegistration(req, res, { params = [] } = {}) {
    try {
        const body = await readJson(req);
        const activity_id = params[0] || body.activity_id;
        const student_id = req.user?.email;
        const full_name = req.user?.full_name;

        if (params[0] && body.activity_id && String(body.activity_id) !== String(params[0])) {
            return sendJson(res, 400, { error: 'Mã hoạt động trong URL và nội dung không khớp' });
        }
        if (!Number.isSafeInteger(Number(activity_id)) || Number(activity_id) < 1) {
            return sendJson(res, 400, { error: 'Mã hoạt động không hợp lệ' });
        }
        if (!student_id || !full_name) {
            return sendJson(res, 400, { error: 'Thiếu thông tin bắt buộc' });
        }

        // 2. Kiểm tra sức chứa của hoạt động
        const [activity] = await pool.query('SELECT capacity FROM activities WHERE id = ?', [activity_id]);
        if (activity.length === 0) {
            return sendJson(res, 404, { error: 'Không tìm thấy hoạt động' });
        }
        
        const [currentRegs] = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE activity_id = ?', [activity_id]);
        if (currentRegs[0].count >= activity[0].capacity) {
            return sendJson(res, 409, { error: 'Hoạt động đã đủ số lượng' });
        }

        // 3. Kiểm tra đăng ký trùng (1 sinh viên chỉ đăng ký 1 lần/hoạt động)
        const [existing] = await pool.query('SELECT id FROM registrations WHERE activity_id = ? AND student_id = ?', [activity_id, student_id]);
        if (existing.length > 0) {
            return sendJson(res, 409, { error: 'Bạn đã đăng ký hoạt động này rồi' });
        }

        // 4. Lưu đăng ký
        const sql = `INSERT INTO registrations (activity_id, student_id, full_name) VALUES (?, ?, ?)`;
        const [result] = await pool.query(sql, [activity_id, student_id, full_name]);

        sendJson(res, 201, { message: 'Đăng ký thành công', id: result.insertId });
    } catch (error) {
        const invalidRequest = ['JSON không hợp lệ', 'Dữ liệu quá lớn'].includes(error.message);
        if (!invalidRequest) console.error(error);
        sendJson(res, invalidRequest ? 400 : 500, {
            error: invalidRequest ? error.message : 'Lỗi máy chủ'
        });
    }
}

// Hàm 2: Lấy danh sách tất cả đăng ký
export async function listRegistrations(req, res) {
    try {
        const sql = `SELECT * FROM registrations`;
        const [rows] = await pool.query(sql);
        sendJson(res, 200, rows);
    } catch (error) {
        console.error(error);
        sendJson(res, 500, { error: 'Lỗi máy chủ' });
    }
}

export async function listMyRegistrations(req, res) {
    const userEmail = req.user?.email;
    if (!userEmail) {
        return sendJson(res, 401, { error: 'Không xác định được tài khoản đăng nhập' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM registrations WHERE student_id = ? ORDER BY created_at DESC',
            [userEmail]
        );
        sendJson(res, 200, rows);
    } catch (error) {
        console.error('Lỗi tải đăng ký của thành viên:', error);
        sendJson(res, 500, { error: 'Lỗi máy chủ khi tải đăng ký' });
    }
}

export async function listActivityRegistrations(req, res, { params }) {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM registrations WHERE activity_id = ? ORDER BY created_at DESC',
            [params[0]]
        );
        sendJson(res, 200, rows);
    } catch (error) {
        console.error('Lỗi tải danh sách đăng ký hoạt động:', error);
        sendJson(res, 500, { error: 'Lỗi máy chủ khi tải danh sách đăng ký' });
    }
}

export async function deleteMyActivityRegistration(req, res, { params }) {
    const userEmail = req.user?.email;
    if (!userEmail) {
        return sendJson(res, 401, { error: 'Không xác định được tài khoản đăng nhập' });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM registrations WHERE activity_id = ? AND student_id = ?',
            [params[0], userEmail]
        );
        if (result.affectedRows === 0) {
            return sendJson(res, 404, { error: 'Bạn chưa đăng ký hoạt động này' });
        }
        sendJson(res, 200, { message: 'Hủy đăng ký thành công' });
    } catch (error) {
        console.error('Lỗi hủy đăng ký hoạt động:', error);
        sendJson(res, 500, { error: 'Lỗi máy chủ khi hủy đăng ký' });
    }
}

export async function deleteRegistration(req, res, { params }) {
    const userEmail = req.user?.email;
    if (!userEmail) {
        return sendJson(res, 401, { error: 'Không xác định được tài khoản đăng nhập' });
    }

    try {
        const [result] = await pool.query(
            'DELETE FROM registrations WHERE id = ? AND student_id = ?',
            [params[0], userEmail]
        );
        if (result.affectedRows === 0) {
            return sendJson(res, 404, { error: 'Không tìm thấy đăng ký của tài khoản này' });
        }
        sendJson(res, 200, { message: 'Hủy đăng ký thành công' });
    } catch (error) {
        console.error('Lỗi hủy đăng ký:', error);
        sendJson(res, 500, { error: 'Lỗi máy chủ khi hủy đăng ký' });
    }
}