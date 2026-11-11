# Ma trận phân quyền

Quyền được xác minh ở backend bằng JWT. Trạng thái vai trò trong `localStorage` chỉ phục vụ hiển thị và không cấp quyền.

| Chức năng | Khách | MEMBER | ADMIN |
| --- | --- | --- | --- |
| Xem, tìm kiếm, phân trang hoạt động | Được | Được | Được |
| Xem chi tiết hoạt động | Được | Được | Được |
| Tạo, sửa, xóa hoạt động | Không | Không | Được |
| Đăng ký hoạt động | Không | Được (danh tính từ JWT) | Được |
| Xem đăng ký của chính mình | Không | Được | Được |
| Hủy đăng ký của chính mình | Không | Được | Được |
| Xem danh sách đăng ký của thành viên | Không | Không | Được |
| Nộp minh chứng hoạt động đã đăng ký | Không | Được | Được |
| Xem minh chứng của chính mình | Không | Được | Được |
| Xem, duyệt hoặc từ chối mọi minh chứng | Không | Không | Được |

Các endpoint có quyền ADMIN dùng `requireAuth(..., 'ADMIN')`. API đăng ký và minh chứng lấy email/tên người dùng từ JWT, không tin các trường định danh do client gửi.

## Kiểm thử quyền

`npm test` kiểm tra các endpoint tạo/sửa/xóa hoạt động, xem đăng ký của người khác, xem toàn bộ minh chứng và duyệt minh chứng đều trả `403` cho MEMBER; endpoint cần đăng nhập trả `401` khi không có JWT.
