import { listActivities, createActivity, getActivity, deleteActivity, updateActivity } from './routes/activities.js';
import {
    createRegistration,
    listRegistrations,
    listMyRegistrations,
    listActivityRegistrations,
    deleteMyActivityRegistration,
    deleteRegistration
} from './routes/registrations.js';
import { login, getMe, requireAuth } from './routes/auth.js';
import { uploadEvidence, listMyEvidences, listEvidences, reviewEvidence } from './routes/evidences.js';
export function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export async function readJson(req) {
    return new Promise((resolve, reject) => {
        let body = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > 102400) {
                req.destroy();
                reject(new Error('Dữ liệu quá lớn'));
            }
            body.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(body).toString()));
            } catch (err) {
                reject(new Error('JSON không hợp lệ'));
            }
        });
    });
}

const routes = [
    
    // 1. Auth routes
    { method: 'POST', pattern: /^\/api\/auth\/login$/, handler: login },
    { method: 'GET',  pattern: /^\/api\/auth\/me$/,    handler: getMe },

    // 2. Health check
    { method: 'GET',  pattern: /^\/api\/health$/, handler: (req, res) => sendJson(res, 200, { status: 'ok' }) },

    // 3. Activities: Khách/Thành viên chỉ được XEM (GET), chỉ ADMIN mới được TẠO / SỬA / XÓA
    { method: 'GET',    pattern: /^\/api\/activities$/, handler: listActivities },
    { method: 'GET',    pattern: /^\/api\/activities\/(\d+)$/, handler: getActivity },
    { method: 'POST',   pattern: /^\/api\/activities$/, handler: requireAuth(createActivity, 'ADMIN') },
    { method: 'PATCH',  pattern: /^\/api\/activities\/(\d+)$/, handler: requireAuth(updateActivity, 'ADMIN') },
    { method: 'DELETE', pattern: /^\/api\/activities\/(\d+)$/, handler: requireAuth(deleteActivity, 'ADMIN') },

    // 4. Registrations
    { method: 'POST', pattern: /^\/api\/registrations$/, handler: requireAuth(createRegistration) },
    { method: 'GET', pattern: /^\/api\/registrations\/my$/, handler: requireAuth(listMyRegistrations) },
    { method: 'GET',  pattern: /^\/api\/registrations$/, handler: requireAuth(listRegistrations, 'ADMIN') },
    { method: 'DELETE', pattern: /^\/api\/registrations\/(\d+)$/, handler: requireAuth(deleteRegistration) },
    { method: 'POST', pattern: /^\/api\/activities\/(\d+)\/registrations$/, handler: requireAuth(createRegistration) },
    { method: 'GET', pattern: /^\/api\/activities\/(\d+)\/registrations$/, handler: requireAuth(listActivityRegistrations, 'ADMIN') },
    { method: 'DELETE', pattern: /^\/api\/activities\/(\d+)\/registrations\/me$/, handler: requireAuth(deleteMyActivityRegistration) },
    { method: 'POST',  pattern: /^\/api\/evidences$/, handler: requireAuth(uploadEvidence) },

    { method: 'GET', pattern: /^\/api\/evidences\/my$/, handler: requireAuth(listMyEvidences) },
    { method: 'GET',   pattern: /^\/api\/evidences$/, handler: requireAuth(listEvidences, 'ADMIN') },
    { method: 'PATCH', pattern: /^\/api\/evidences\/(\d+)$/, handler: requireAuth(reviewEvidence, 'ADMIN') },
];

export async function handleApi(req, res, url) {
    for (const r of routes) {
        const m = url.pathname.match(r.pattern);
        if (req.method === r.method && m) {
            return r.handler(req, res, { url, params: m.slice(1) });
        }
    }
    sendJson(res, 404, { error: 'Không tìm thấy API' });
}