-- Thêm người dùng (mật khẩu tạm để là chuỗi '123456', sang tuần 5 sẽ học băm mật khẩu)
INSERT INTO users (email, full_name, password_hash, role) VALUES 
('admin@clb.test', 'Nguyen Van Admin', '123456', 'ADMIN'),
('thanhvien@clb.test', 'Tran Thi Member', '123456', 'MEMBER');

-- Thêm hoạt động
INSERT INTO activities (title, description, location, start_at, capacity, created_by) VALUES 
('Hiến máu tháng 11', 'Hiến máu nhân đạo', 'Sân trường', '2026-11-20 08:00:00', 100, 1);