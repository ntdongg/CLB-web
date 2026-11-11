document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Vui lòng nhập đầy đủ email và mật khẩu!');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const res = await response.json();
        if (!response.ok) {
            throw new Error(res.error || 'Đăng nhập thất bại');
        }
        if (!res.token || !res.user) {
            throw new Error('Máy chủ không trả về thông tin phiên hợp lệ.');
        }

        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        localStorage.setItem('user_session', JSON.stringify({
            id: res.user.id,
            username: res.user.email || email,
            role: res.user.role,
            studentId: res.user.student_id || res.user.email || email,
            fullName: res.user.full_name || email
        }));
        window.location.assign('/');
    } catch (error) {
        alert('Đăng nhập thất bại: ' + error.message);
    }
});