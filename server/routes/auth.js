import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { readJson, sendJson } from '../router.js';

const JWT_SECRET = process.env.JWT_SECRET || 'clb_uhl_active_secret_key_2026';

// 1. POST /api/auth/login
export async function login(req, res) {
    try {
        const body = await readJson(req);
        const { email, password } = body;

        if (!email || !password) {
            return sendJson(res, 400, { error: 'Vui lòng cung cấp email và mật khẩu' });
        }

        // Tìm tài khoản theo email (Prepared statement chống SQL Injection)
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return sendJson(res, 401, { error: 'Email hoặc mật khẩu không chính xác' });
        }

        const user = rows[0];

        // So khớp mật khẩu người dùng nhập với chuỗi băm trong CSDL
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return sendJson(res, 401, { error: 'Email hoặc mật khẩu không chính xác' });
        }

        // Tạo JWT Token có thời hạn 24 giờ
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                full_name: user.full_name, 
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        sendJson(res, 200, {
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Lỗi login:', error);
        sendJson(res, 500, { error: 'Lỗi xử lý đăng nhập' });
    }
}

// 2. GET /api/auth/me (Lấy thông tin người dùng đang đăng nhập)
export async function getMe(req, res) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJson(res, 401, { error: 'Chưa đăng nhập' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        sendJson(res, 200, { user: decoded });
    } catch (err) {
        sendJson(res, 401, { error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    }
}


// Middleware kiểm tra đăng nhập và phân quyền
export function requireAuth(handler, requiredRole = null) {
    return async (req, res, context) => {
        const authHeader = req.headers['authorization'];
        
        // 1. Kiểm tra có gửi kèm Bearer Token không
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendJson(res, 401, { error: 'Vui lòng đăng nhập để thực hiện (401 Unauthorized)' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return sendJson(res, 401, { error: 'Phiên làm việc không hợp lệ hoặc đã hết hạn' });
        }

        req.user = decoded;
        if (requiredRole && decoded.role !== requiredRole) {
            return sendJson(res, 403, { error: 'Bạn không có quyền thực hiện thao tác này (403 Forbidden)' });
        }
        return handler(req, res, context);
    };
}