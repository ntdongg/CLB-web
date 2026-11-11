import bcrypt from 'bcryptjs';
import { pool } from './server/db.js';

async function updatePasswords() {
    try {
        // 1. Tự động sinh mã băm chuẩn xác cho mật khẩu '123456'
        const hash = await bcrypt.hash('123456', 10);
        
        // 2. Cập nhật mã băm vào toàn bộ tài khoản
        await pool.query('UPDATE users SET password_hash = ?', [hash]);
        console.log('✅ Đã cập nhật mật khẩu 123456 cho toàn bộ tài khoản!');

        // 3. In ra danh sách tài khoản thực tế đang có trong CSDL
        const [users] = await pool.query('SELECT id, email, full_name, role FROM users');
        console.log('\n📋 Danh sách tài khoản trong CSDL để bạn đăng nhập:');
        console.table(users);

        process.exit(0);
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    }
}

updatePasswords();