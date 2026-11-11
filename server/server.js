import http from 'node:http';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { handleApi } from './router.js';

const PUBLIC_DIR = path.resolve('public');
const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
};

const server = http.createServer(async (req, res) => {

    if (req.url.startsWith('/uploads/')) {
        const uploadDir = path.resolve('uploads');
        let relativePath;
        try {
            relativePath = decodeURIComponent(req.url.slice('/uploads'.length));
        } catch {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            return res.end('Invalid file path');
        }
        const filePath = path.resolve(uploadDir, `.${relativePath}`);
        if (!filePath.startsWith(uploadDir + path.sep)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            return res.end('Forbidden');
        }
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('File not found');
            }
            res.writeHead(200, {
                'Content-Type': TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(data);
        });
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // Bàn giao toàn bộ đường dẫn /api/ cho router.js
    if (url.pathname.startsWith('/api/')) {
        return handleApi(req, res, url);
    }

    // Phục vụ file tĩnh
    const file = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
        res.writeHead(403);
        return res.end('Forbidden');
    }
    try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`Server chạy tại http://localhost:${port}`));