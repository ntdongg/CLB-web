import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { pool } from '../../server/db.js';
import { listActivities, validateActivityInput } from '../../server/routes/activities.js';
import { createRegistration, deleteMyActivityRegistration } from '../../server/routes/registrations.js';
import { handleApi } from '../../server/router.js';

function createResponse() {
    return {
        status: null,
        headers: {},
        body: null,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        writeHead(status, headers) {
            this.status = status;
            Object.assign(this.headers, headers);
        },
        end(body) {
            this.body = JSON.parse(body);
        }
    };
}

function createRequest({ method, token, body, rawBody } = {}) {
    const headers = token ? { authorization: `Bearer ${token}` } : {};
    return {
        method,
        headers,
        on(event, callback) {
            if (event === 'data') callback(Buffer.from(rawBody ?? JSON.stringify(body || {})));
            if (event === 'end') callback();
        }
    };
}

async function assertMemberForbidden(method, path) {
    const originalQuery = pool.query;
    let queried = false;
    pool.query = async () => {
        queried = true;
        return [[]];
    };
    try {
        const response = createResponse();
        await handleApi(
            createRequest({ method, token: memberToken(), body: {} }),
            response,
            new URL(`http://localhost${path}`)
        );
        assert.equal(response.status, 403);
        assert.equal(queried, false);
    } finally {
        pool.query = originalQuery;
    }
}

function memberToken(overrides = {}) {
    return jwt.sign(
        { email: 'member@example.test', full_name: 'Member Test', role: 'MEMBER', ...overrides },
        process.env.JWT_SECRET || 'clb_uhl_active_secret_key_2026'
    );
}

test('GET hoạt động hỗ trợ lọc và phân trang bằng tham số SQL', async () => {
    const originalQuery = pool.query;
    const calls = [];
    pool.query = async (...args) => {
        calls.push(args);
        return calls.length === 1
            ? [[{ total: 14 }]]
            : [[{ id: 4, title: 'Web', registered_count: 2 }]];
    };

    try {
        const response = createResponse();
        await listActivities(
            {},
            response,
            { url: new URL('http://localhost/api/activities?q=Web&page=3&limit=5') }
        );

        assert.equal(response.status, 200);
        assert.equal(response.headers['x-total-count'], '14');
        assert.match(calls[1][0], /LIMIT \? OFFSET \?/);
        assert.deepEqual(calls[1][1], ['%Web%', 5, 10]);
        assert.equal(response.body[0].registered_count, 2);
    } finally {
        pool.query = originalQuery;
    }
});

test('GET hoạt động từ chối page hoặc limit không hợp lệ', async () => {
    const originalQuery = pool.query;
    let queried = false;
    pool.query = async () => {
        queried = true;
        return [[]];
    };

    try {
        const response = createResponse();
        await listActivities({}, response, {
            url: new URL('http://localhost/api/activities?page=0&limit=10')
        });
        assert.equal(response.status, 400);
        assert.equal(queried, false);
    } finally {
        pool.query = originalQuery;
    }
});

test('kiểm tra dữ liệu hoạt động bắt buộc và giới hạn độ dài', () => {
    const valid = {
        title: 'Hoạt động CLB',
        description: 'Mô tả',
        location: 'Hội trường A',
        start_at: '2026-12-01T09:00:00',
        capacity: 20
    };
    assert.equal(validateActivityInput(valid), null);
    assert.match(validateActivityInput({ ...valid, title: ' ' }), /Tên hoạt động/);
    assert.match(validateActivityInput({ ...valid, title: 'x'.repeat(256) }), /255 ký tự/);
    assert.match(validateActivityInput({ ...valid, start_at: 'ngày mai' }), /Thời gian/);
    assert.match(validateActivityInput({ ...valid, capacity: 0 }), /Sức chứa/);
    assert.match(validateActivityInput({ ...valid, capacity: 2.5 }), /Sức chứa/);
});

test('đăng ký hoạt động lấy danh tính từ JWT, không tin student_id từ body', async () => {
    const originalQuery = pool.query;
    const calls = [];
    pool.query = async (...args) => {
        calls.push(args);
        if (args[0].includes('SELECT capacity')) return [[{ capacity: 5 }]];
        if (args[0].includes('COUNT(*)')) return [[{ count: 1 }]];
        if (args[0].includes('SELECT id FROM registrations')) return [[]];
        return [{ insertId: 12 }];
    };

    try {
        const response = createResponse();
        const request = createRequest({
            body: {
                activity_id: 7,
                student_id: 'attacker@example.test',
                full_name: 'Someone Else'
            }
        });
        request.user = { email: 'member@example.test', full_name: 'Member Test' };
        await createRegistration(
            request,
            response,
            { params: ['7'] }
        );
        assert.equal(response.status, 201);
        assert.deepEqual(calls[3][1], ['7', 'member@example.test', 'Member Test']);
    } finally {
        pool.query = originalQuery;
    }
});

test('thành viên không được đọc danh sách đăng ký của hoạt động khác', async () => {
    await assertMemberForbidden('GET', '/api/activities/7/registrations');
});

test('DELETE đăng ký theo hoạt động chỉ xóa dữ liệu của email trong JWT', async () => {
    const originalQuery = pool.query;
    let query;
    pool.query = async (...args) => {
        query = args;
        return [{ affectedRows: 1 }];
    };

    try {
        const response = createResponse();
        await deleteMyActivityRegistration(
            { user: { email: 'member@example.test' } },
            response,
            { params: ['7'] }
        );
        assert.equal(response.status, 200);
        assert.match(query[0], /WHERE activity_id = \? AND student_id = \?/);
        assert.deepEqual(query[1], ['7', 'member@example.test']);
    } finally {
        pool.query = originalQuery;
    }
});

test('thành viên không được liệt kê toàn bộ đăng ký', async () => {
    await assertMemberForbidden('GET', '/api/registrations');
});

test('thành viên không được tạo hoạt động', async () => {
    await assertMemberForbidden('POST', '/api/activities');
});

test('thành viên không được sửa hoạt động', async () => {
    await assertMemberForbidden('PATCH', '/api/activities/7');
});

test('thành viên không được xóa hoạt động', async () => {
    await assertMemberForbidden('DELETE', '/api/activities/7');
});

test('thành viên không được xem minh chứng của người khác', async () => {
    await assertMemberForbidden('GET', '/api/evidences');
});

test('thành viên không được duyệt minh chứng', async () => {
    await assertMemberForbidden('PATCH', '/api/evidences/7');
});

test('request chưa xác thực không được đọc toàn bộ đăng ký', async () => {
    const response = createResponse();
    await handleApi(
        createRequest({ method: 'GET' }),
        response,
        new URL('http://localhost/api/registrations')
    );
    assert.equal(response.status, 401);
});

test('đăng ký từ chối JSON lỗi với HTTP 400', async () => {
    const response = createResponse();
    await createRegistration(
        createRequest({ rawBody: '{broken' }),
        response,
        { params: [] }
    );
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'JSON không hợp lệ');
});

test('đăng ký từ chối mã hoạt động không khớp URL', async () => {
    const originalQuery = pool.query;
    let queried = false;
    pool.query = async () => {
        queried = true;
        return [[]];
    };
    try {
        const request = createRequest({
            body: { activity_id: 8 },
            token: memberToken()
        });
        request.user = { email: 'member@example.test', full_name: 'Member Test' };
        const response = createResponse();
        await createRegistration(request, response, { params: ['7'] });
        assert.equal(response.status, 400);
        assert.equal(queried, false);
    } finally {
        pool.query = originalQuery;
    }
});
