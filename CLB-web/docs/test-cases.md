# Test case chấp nhận

Các trường hợp đánh dấu **Tự động** được kiểm tra bằng `node:test` và chạy qua `npm test`. Các trường hợp **Chưa chạy thủ công** cần được thực hiện trên giao diện và CSDL dành riêng cho kiểm thử; không ghi nhận là đạt trước khi có người chạy và bổ sung kết quả.

| ID | Tiền điều kiện | Các bước | Kết quả mong đợi | Kết quả thực tế |
| --- | --- | --- | --- | --- |
| TC-01 | API và CSDL hoạt động | Gọi danh sách hoạt động với `q`, `page`, `limit` | Kết quả đúng trang và có `X-Total-Count` | Đạt - tự động |
| TC-02 | API hoạt động | Gọi danh sách với `page=0` | HTTP 400, không truy vấn DB | Đạt - tự động |
| TC-03 | Có hoạt động | Mở trang chi tiết bằng ID tồn tại | Hiện đúng dữ liệu hoạt động | Chưa chạy thủ công |
| TC-04 | Không có JWT | Gọi tạo hoạt động | HTTP 401 | Chưa chạy thủ công |
| TC-05 | JWT MEMBER hợp lệ | Gọi tạo hoạt động | HTTP 403 | Đạt - tự động |
| TC-06 | JWT MEMBER hợp lệ | Gọi sửa hoạt động | HTTP 403 | Đạt - tự động |
| TC-07 | JWT MEMBER hợp lệ | Gọi xóa hoạt động | HTTP 403 | Đạt - tự động |
| TC-08 | JWT MEMBER hợp lệ, còn chỗ | Đăng ký một hoạt động | HTTP 201; danh tính lưu theo JWT | Chưa chạy thủ công |
| TC-09 | JWT MEMBER hợp lệ | Gửi email/MSSV khác trong body đăng ký | DB chỉ nhận email trong JWT | Đạt - tự động |
| TC-10 | Hoạt động hết chỗ | Đăng ký hoạt động | HTTP 409 | Chưa chạy thủ công |
| TC-11 | Đã đăng ký hoạt động | Đăng ký lần hai | HTTP 409 | Chưa chạy thủ công |
| TC-12 | JSON sai định dạng | Gửi JSON đăng ký hỏng | HTTP 400, server tiếp tục hoạt động | Đạt - tự động |
| TC-13 | JWT MEMBER hợp lệ | Xem đăng ký của hoạt động khác | HTTP 403, không truy vấn DB | Đạt - tự động |
| TC-14 | JWT MEMBER hợp lệ | Hủy đăng ký của chính mình | Chỉ xóa dòng khớp email JWT | Đạt - tự động |
| TC-15 | JWT MEMBER hợp lệ | Xem toàn bộ đăng ký | HTTP 403 | Đạt - tự động |
| TC-16 | JWT MEMBER hợp lệ | Xem toàn bộ minh chứng | HTTP 403 | Đạt - tự động |
| TC-17 | Đăng ký hoạt động, có tệp hợp lệ | Nộp JPEG/PNG/PDF dưới 5 MB | HTTP 201; tệp được lưu | Chưa chạy thủ công |
| TC-18 | Có tệp sai loại hoặc lớn hơn 5 MB | Nộp minh chứng | Từ chối với HTTP 400 | Chưa chạy thủ công |
| TC-19 | JWT MEMBER hợp lệ | Gọi API duyệt minh chứng | HTTP 403 | Đạt - tự động |
| TC-20 | JWT ADMIN hợp lệ | Duyệt/từ chối minh chứng có thật | Cập nhật trạng thái và tải lại danh sách | Chưa chạy thủ công |

**Lưu ý:** cần chạy các ca thủ công trên CSDL kiểm thử tách biệt; không dùng dữ liệu minh chứng thật chỉ để chụp bằng chứng.
