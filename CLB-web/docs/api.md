# Tài liệu API - Quản lý CLB

Các endpoint cần xác thực dùng header `Authorization: Bearer <token>`. JWT được cấp qua API đăng nhập. Danh tính thành viên lấy từ token; API không tin `student_id` hoặc `full_name` do client tự gửi.

## Xác thực

| Method | URL | Quyền | Nội dung |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Công khai | Body: `{"email":"member@example.test","password":"..."}` |
| GET | `/api/auth/me` | Bearer token | Trả về người dùng trong JWT |

Đăng nhập thành công trả `200` với `{ "token": "...", "user": { "id": 1, "email": "...", "full_name": "...", "role": "MEMBER" } }`.

## Hoạt động

| Method | URL | Quyền | Nội dung |
| --- | --- | --- | --- |
| GET | `/api/activities?q=web&page=1&limit=10` | Công khai | Tìm tên, phân trang; trả mảng JSON và header `X-Total-Count`; `limit` tối đa 100 |
| GET | `/api/activities/:id` | Công khai | Chi tiết hoạt động |
| POST | `/api/activities` | ADMIN | Body: `title`, `description`, `location`, `start_at`, `capacity` |
| PATCH | `/api/activities/:id` | ADMIN | Cùng các trường tạo mới |
| DELETE | `/api/activities/:id` | ADMIN | Xóa hoạt động |

Ví dụ tạo mới:

```json
{
  "title": "Sinh hoạt CLB",
  "description": "Sinh hoạt định kỳ",
  "location": "Hội trường A",
  "start_at": "2026-12-01 09:00:00",
  "capacity": 40
}
```

Mỗi hoạt động trả về có trường `registered_count`. Phân trang không hợp lệ trả `400`; không tìm thấy hoạt động trả `404`.

## Đăng ký

| Method | URL | Quyền | Nội dung |
| --- | --- | --- | --- |
| POST | `/api/activities/:id/registrations` | MEMBER hoặc ADMIN | Tạo đăng ký bằng danh tính JWT |
| GET | `/api/activities/:id/registrations` | ADMIN | Xem người đăng ký của một hoạt động |
| DELETE | `/api/activities/:id/registrations/me` | Người đăng ký | Hủy đăng ký của tài khoản hiện tại |
| GET | `/api/registrations/my` | Bearer token | Chỉ trả đăng ký của tài khoản hiện tại |
| GET | `/api/registrations` | ADMIN | Xem toàn bộ đăng ký |
| POST | `/api/registrations` | MEMBER hoặc ADMIN | Endpoint tương thích cũ; body có `activity_id` |
| DELETE | `/api/registrations/:id` | Chủ đăng ký | Hủy đăng ký theo ID, chỉ khi email khớp JWT |

Đăng ký thành công trả `201`; đăng ký trùng hoặc hết chỗ trả `409`; không tồn tại trả `404`.

## Minh chứng

| Method | URL | Quyền | Nội dung |
| --- | --- | --- | --- |
| POST | `/api/evidences` | Bearer token | multipart/form-data gồm `activity_id`, `file`; JPEG, PNG hoặc PDF tối đa 5 MB |
| GET | `/api/evidences/my` | Bearer token | Chỉ trả minh chứng của tài khoản hiện tại |
| GET | `/api/evidences?status=PENDING` | ADMIN | Liệt kê minh chứng theo trạng thái |
| PATCH | `/api/evidences/:id` | ADMIN | Body: `{"status":"APPROVED"}` hoặc `{"status":"REJECTED"}` |

## Sự cố và mã trạng thái

`400` dữ liệu không hợp lệ; `401` chưa đăng nhập hoặc JWT không hợp lệ; `403` không đủ quyền; `404` không tìm thấy tài nguyên; `409` đăng ký trùng hoặc hết chỗ; `500` lỗi máy chủ.
