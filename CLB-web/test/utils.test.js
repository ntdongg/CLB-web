import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatDate,
    isValidEmail,
    isValidPassword,
    buildQueryString,
    calculateRemainingSeats
} from '../../public/js/utils.js';

test('formatDate định dạng ngày hợp lệ và bỏ qua ngày sai', () => {
    assert.equal(formatDate('2026-12-01T09:00:00'), '01/12/2026');
    assert.equal(formatDate('invalid'), '');
    assert.equal(formatDate(''), '');
});

test('isValidEmail kiểm tra email và khoảng trắng', () => {
    assert.equal(isValidEmail(' admin@clb.vn '), true);
    assert.equal(isValidEmail('invalid-email'), false);
    assert.equal(isValidEmail(null), false);
});

test('isValidPassword yêu cầu tối thiểu sáu ký tự', () => {
    assert.equal(isValidPassword('123456'), true);
    assert.equal(isValidPassword('12345'), false);
    assert.equal(isValidPassword(null), false);
});

test('buildQueryString bỏ giá trị rỗng và mã hóa nội dung', () => {
    assert.equal(buildQueryString({ q: 'hoạt động CLB', page: 2, empty: '' }), '?q=ho%E1%BA%A1t+%C4%91%E1%BB%99ng+CLB&page=2');
    assert.equal(buildQueryString({}), '');
});

test('calculateRemainingSeats không trả về số âm', () => {
    assert.equal(calculateRemainingSeats(10, 4), 6);
    assert.equal(calculateRemainingSeats(10, 12), 0);
    assert.equal(calculateRemainingSeats(10, 'invalid'), 10);
});
