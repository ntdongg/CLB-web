import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { pool } from '../../server/db.js';
import { deleteRegistration } from '../../server/routes/registrations.js';
import { listMyEvidences } from '../../server/routes/evidences.js';
import { handleApi } from '../../server/router.js';

function createResponse() {
    return {
        status: null,
        headers: null,
        body: null,
        writeHead(status, headers) {
            this.status = status;
            this.headers = headers;
        },
        end(body) {
            this.body = JSON.parse(body);
        }
    };
}

test('hủy đăng ký chỉ xóa bản ghi có email của user trong điều kiện SQL', async () => {
    const originalQuery = pool.query;
    let query;
    pool.query = async (...args) => {
        query = args;
        return [{ affectedRows: 1 }];
    };

    try {
        const response = createResponse();
        await deleteRegistration(
            { user: { email: 'member@example.test' } },
            response,
            { params: ['42'] }
        );

        assert.match(query[0], /WHERE id = \? AND student_id = \?/);
        assert.deepEqual(query[1], ['42', 'member@example.test']);
        assert.equal(response.status, 200);
        assert.equal(response.body.message, 'Hủy đăng ký thành công');
    } finally {
        pool.query = originalQuery;
    }
});

test('hủy đăng ký trả về 404 nếu user không sở hữu bản ghi', async () => {
    const originalQuery = pool.query;
    pool.query = async () => [{ affectedRows: 0 }];

    try {
        const response = createResponse();
        await deleteRegistration(
            { user: { email: 'other@example.test' } },
            response,
            { params: ['42'] }
        );

        assert.equal(response.status, 404);
        assert.match(response.body.error, /Không tìm thấy đăng ký/);
    } finally {
        pool.query = originalQuery;
    }
});

test('hủy đăng ký từ chối user không có email trong token', async () => {
    const originalQuery = pool.query;
    let queried = false;
    pool.query = async () => {
        queried = true;
        return [{ affectedRows: 1 }];
    };

    try {
        const response = createResponse();
        await deleteRegistration({ user: {} }, response, { params: ['42'] });

        assert.equal(queried, false);
        assert.equal(response.status, 401);
    } finally {
        pool.query = originalQuery;
    }
});

test('route DELETE yêu cầu JWT hợp lệ và chỉ xóa đăng ký của chủ sở hữu', async () => {
    const originalQuery = pool.query;
    const queries = [];
    pool.query = async (...args) => {
        queries.push(args);
        return [{ affectedRows: args[1][1] === 'member@example.test' ? 1 : 0 }];
    };

    try {
        const unauthorizedResponse = createResponse();
        await handleApi(
            { method: 'DELETE', headers: {} },
            unauthorizedResponse,
            new URL('http://localhost/api/registrations/42')
        );
        assert.equal(unauthorizedResponse.status, 401);
        assert.equal(queries.length, 0);

        const token = jwt.sign(
            { email: 'member@example.test', role: 'MEMBER' },
            process.env.JWT_SECRET || 'clb_uhl_active_secret_key_2026'
        );
        const response = createResponse();
        await handleApi(
            { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
            response,
            new URL('http://localhost/api/registrations/42')
        );

        assert.equal(response.status, 200);
        assert.deepEqual(queries[0][1], ['42', 'member@example.test']);
    } finally {
        pool.query = originalQuery;
    }
});

test('GET minh chứng của tôi chỉ trả dữ liệu thuộc email trong JWT', async () => {
    const originalQuery = pool.query;
    let query;
    pool.query = async (...args) => {
        query = args;
        return [[{ id: 8, activity_id: 3, status: 'PENDING' }]];
    };

    try {
        const response = createResponse();
        await listMyEvidences({ user: { email: 'member@example.test' } }, response);

        assert.match(query[0], /WHERE student_id = \?/);
        assert.deepEqual(query[1], ['member@example.test']);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body, [{ id: 8, activity_id: 3, status: 'PENDING' }]);
    } finally {
        pool.query = originalQuery;
    }
});

test('route minh chứng của tôi yêu cầu JWT hợp lệ', async () => {
    const originalQuery = pool.query;
    const queries = [];
    pool.query = async (...args) => {
        queries.push(args);
        return [[{ id: 8, activity_id: 3, status: 'PENDING' }]];
    };

    try {
        const unauthorizedResponse = createResponse();
        await handleApi(
            { method: 'GET', headers: {} },
            unauthorizedResponse,
            new URL('http://localhost/api/evidences/my')
        );
        assert.equal(unauthorizedResponse.status, 401);
        assert.equal(queries.length, 0);

        const token = jwt.sign(
            { email: 'member@example.test', role: 'MEMBER' },
            process.env.JWT_SECRET || 'clb_uhl_active_secret_key_2026'
        );
        const response = createResponse();
        await handleApi(
            { method: 'GET', headers: { authorization: `Bearer ${token}` } },
            response,
            new URL('http://localhost/api/evidences/my')
        );

        assert.equal(response.status, 200);
        assert.deepEqual(queries[0][1], ['member@example.test']);
        assert.deepEqual(response.body, [{ id: 8, activity_id: 3, status: 'PENDING' }]);
    } finally {
        pool.query = originalQuery;
    }
});
