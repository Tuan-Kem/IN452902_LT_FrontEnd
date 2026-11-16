// Chạy bài kiểm tra: node start.mjs
// - Mock API EduHub:  http://localhost:4000
// - Trang bài làm:    http://localhost:5500  (phục vụ thư mục site/)
// Thử xử lý lỗi:      node start.mjs --fail   (mọi request /api/... trả 503)
// Không cần npm install. Yêu cầu Node.js 22 trở lên.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createApi } from './mock-api/server.mjs';

const fail = process.argv.includes('--fail');
const ROOT = fileURLToPath(new URL('./site/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

const onError = (port) => (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Cổng ${port} đang bị chiếm. Hãy tắt cửa sổ terminal khác đang chạy "node start.mjs" (Ctrl + C) rồi chạy lại.`);
  } else {
    console.error(err);
  }
  process.exit(1);
};

createApi({ corsOrigins: '*', failRate: fail ? 1 : 0, quiet: true })
  .on('error', onError(4000))
  .listen(4000, () => console.log(`Mock API:  http://localhost:4000${fail ? '  (chế độ lỗi 503)' : ''}`));

http.createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Không tìm thấy ' + path);
  }
}).on('error', onError(5500))
  .listen(5500, () => console.log('Bài làm:   http://localhost:5500  (Ctrl + C để dừng)'));
