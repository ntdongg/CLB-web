fetch('/api/health')
  .then(res => res.json())
  .then(data => document.getElementById('status').textContent = 'Trạng thái API: ' + data.status)
  .catch(err => document.getElementById('status').textContent = 'Lỗi kết nối API!');