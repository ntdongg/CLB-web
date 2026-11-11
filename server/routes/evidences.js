import formidable from 'formidable';
import path from 'path';
import fs from 'fs';
import { pool } from '../db.js';
import { sendJson, readJson } from '../router.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 1. POST /api/evidences - Nộp minh chứng (Multipart/form-data)
export async function uploadEvidence(req, res) {
    const form = formidable({
        uploadDir: UPLOAD_DIR,
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024, // Giới hạn tối đa 5MB
        filter: ({ mimetype }) => {
            return ['image/jpeg', 'image/png', 'application/pdf'].includes(mimetype);
        }
    });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return sendJson(res, 400, { error: 'Tệp tải lên không hợp lệ hoặc vượt quá dung lượng 5MB' });
        }

        const activityId = Array.isArray(fields.activity_id) ? fields.activity_id[0] : fields.activity_id;
        const studentId = req.user.email;
        const fullName = req.user.full_name;
        const file = Array.isArray(files.file) ? files.file[0] : files.file;

        if (!activityId || !studentId || !fullName || !file) {
            if (file?.filepath) fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 400, { error: 'Vui lòng điền đủ thông tin và chọn tệp minh chứng' });
        }

        let registrations;
        try {
            [registrations] = await pool.query(
                'SELECT id FROM registrations WHERE activity_id = ? AND student_id = ?',
                [activityId, studentId]
            );
        } catch (error) {
            console.error('Lỗi xác minh đăng ký trước khi nộp minh chứng:', error);
            fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 500, { error: 'Không thể xác minh đăng ký hoạt động' });
        }
        if (registrations.length === 0) {
            fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 403, { error: 'Bạn cần đăng ký hoạt động trước khi nộp minh chứng' });
        }

        let signature;
        try {
            signature = fs.readFileSync(file.filepath).subarray(0, 8);
        } catch (error) {
            console.error('Lỗi đọc tệp minh chứng:', error);
            fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 500, { error: 'Không thể đọc tệp minh chứng' });
        }
        const fileType = signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
            ? { mime: 'image/jpeg', ext: '.jpg' }
            : signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
                ? { mime: 'image/png', ext: '.png' }
                : signature.subarray(0, 5).toString() === '%PDF-'
                    ? { mime: 'application/pdf', ext: '.pdf' }
                    : null;
        if (!fileType || fileType.mime !== file.mimetype) {
            fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 400, { error: 'Nội dung tệp không khớp với ảnh JPEG, PNG hoặc PDF được hỗ trợ' });
        }

        const ext = fileType.ext;
        const safeFileName = `evidence_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        const finalPath = path.join(UPLOAD_DIR, safeFileName);

        try {
            fs.renameSync(file.filepath, finalPath);
        } catch (error) {
            console.error('Lỗi lưu tệp minh chứng:', error);
            fs.rmSync(file.filepath, { force: true });
            return sendJson(res, 500, { error: 'Không thể lưu tệp minh chứng' });
        }

        try {
            const sql = `INSERT INTO evidences (activity_id, student_id, full_name, file_path, file_name) VALUES (?, ?, ?, ?, ?)`;
            await pool.query(sql, [activityId, studentId, fullName, `/uploads/${safeFileName}`, file.originalFilename]);

            sendJson(res, 201, { message: 'Nộp minh chứng thành công, vui lòng chờ duyệt!' });
        } catch (dbErr) {
            console.error(dbErr);
            fs.rmSync(finalPath, { force: true });
            sendJson(res, 500, { error: 'Lỗi ghi dữ liệu minh chứng' });
        }
    });
}

export async function listMyEvidences(req, res) {
    const userEmail = req.user?.email;
    if (!userEmail) {
        return sendJson(res, 401, { error: 'Không xác định được tài khoản đăng nhập' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT id, activity_id, status, created_at FROM evidences WHERE student_id = ? ORDER BY created_at DESC',
            [userEmail]
        );
        sendJson(res, 200, rows);
    } catch (error) {
        console.error('Lỗi tải minh chứng của thành viên:', error);
        sendJson(res, 500, { error: 'Lỗi máy chủ khi tải minh chứng' });
    }
}

// 2. GET /api/evidences - Xem danh sách minh chứng (Yêu cầu quyền ADMIN)
export async function listEvidences(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const status = url.searchParams.get('status') || 'PENDING';
        if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
            return sendJson(res, 400, { error: 'Trạng thái minh chứng không hợp lệ' });
        }

        const sql = `
            SELECT e.*, a.title AS activity_title 
            FROM evidences e 
            JOIN activities a ON e.activity_id = a.id 
            WHERE e.status = ?
            ORDER BY e.created_at DESC
        `;
        const [rows] = await pool.query(sql, [status]);
        sendJson(res, 200, rows);
    } catch (err) {
        console.error('❌ Lỗi SQL chi tiết tại listEvidences:', err);
        sendJson(res, 500, { error: err.message });
    }
}

// 3. PATCH /api/evidences/:id - Duyệt hoặc từ chối minh chứng (Yêu cầu quyền ADMIN)
export async function reviewEvidence(req, res, { params }) {
    try {
        const id = params[0];
        const body = await readJson(req);
        const { status } = body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return sendJson(res, 400, { error: 'Trạng thái duyệt không hợp lệ' });
        }

        const sql = `UPDATE evidences SET status = ? WHERE id = ?`;
        const [result] = await pool.query(sql, [status, id]);
        if (result.affectedRows === 0) {
            const [rows] = await pool.query('SELECT id FROM evidences WHERE id = ?', [id]);
            if (rows.length === 0) return sendJson(res, 404, { error: 'Không tìm thấy minh chứng' });
        }

        sendJson(res, 200, { message: `Đã cập nhật trạng thái minh chứng thành công (${status})` });
    } catch (err) {
        console.error('❌ Lỗi SQL chi tiết tại listEvidences:', err);
        const invalidRequest = ['JSON không hợp lệ', 'Dữ liệu quá lớn'].includes(err.message);
        sendJson(res, invalidRequest ? 400 : 500, {
            error: invalidRequest ? err.message : 'Lỗi máy chủ khi cập nhật minh chứng'
        });
    }
}