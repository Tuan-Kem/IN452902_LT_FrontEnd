# EduHub Web — Ch03 (starter)

Bài thực hành chương 3 môn **IN4529 — Lập trình Front End**: nối giao diện EduHub Web của Ch02 với **mock API EduHub** bằng JavaScript thuần — tải danh sách sự kiện, tìm và lọc, xem chi tiết, tạo tài khoản thành viên. Dự án dùng **Vite 8** để chạy và đóng gói, **ESLint 10** để bắt lỗi, và một tệp **TypeScript** nhập môn.

HTML và CSS đã xong. Em **chỉ viết JavaScript/TypeScript** trong thư mục `src/`, theo các dòng `// TODO(ch3-Tk)`.

## Yêu cầu

Node.js 22 trở lên (khuyến nghị Node 24 LTS). Kiểm tra: `node -v`.

## Chạy

Mở **hai** cửa sổ terminal trong thư mục này:

```bash
npm install        # lần đầu: cài Vite, ESLint, TypeScript vào node_modules/
npm run api        # terminal 1: mock API ở http://localhost:4000 (không cần cài gì thêm)
npm run dev        # terminal 2: trang web ở http://localhost:5173
```

Mở <http://localhost:5173/events.html>. Lúc đầu trang hiện các dòng chữ `TODO(ch3-…)` thay cho dữ liệu — đó là bình thường.

Thử API bằng trình duyệt: <http://localhost:4000/api/events?q=hien%20mau>. Danh sách endpoint, tài khoản mẫu và cờ `--delay`, `--fail-rate`: xem `mock-api/README.md`.

```bash
node mock-api/server.mjs --delay=800      # mỗi request chậm 0,8 giây — thấy "Đang tải…"
node mock-api/server.mjs --fail-rate=0.3  # 30% request lỗi 503 — luyện xử lý lỗi
```

**Lưu ý CORS:** mock API chỉ cho trang ở `http://localhost:5173` gọi tới. Nếu Vite báo *Port 5173 is already in use*, tắt tiến trình đang chiếm cổng (một `npm run dev` khác) rồi chạy lại.

## Thứ tự làm gợi ý

1. `ch3-T1` — `src/utils/format.ts` (TypeScript). Kiểm bằng `npm run typecheck`.
2. `ch3-T2` — `src/api.js`: hàm `request()` và `toQueryString()`. Sau bước này trang sự kiện đã hiện chữ TODO của T3 thay vì lỗi.
3. `ch3-T3` — `src/render.js`: tạo card sự kiện bằng DOM.
4. `ch3-T4` — `src/events-page.js`: lọc CLB, tìm kiếm có debounce, URL, loading/empty/error, `AbortController`.
5. `ch3-T5` — `src/event-detail-page.js`: trang chi tiết theo `?id=`.
6. `ch3-T6` — `src/register-page.js`: kiểm form và gửi `POST /api/auth/register`.
7. (Challenge) `ch3-T7` — `src/register-draft.js`: lưu nháp form vào `localStorage`.

Tìm nhanh mọi việc cần làm: VS Code → Ctrl+Shift+F → `TODO(ch3-`.

## Kiểm tra

```bash
npm run lint        # ESLint: không in lỗi
npm run typecheck   # tsc kiểm kiểu format.ts: không in lỗi
npm run build       # đóng gói 4 trang vào dist/
npm run preview     # xem bản dist/ ở http://localhost:5173 (tắt npm run dev trước)
```

- Thử email đã có (`sv1@dthu.edu.vn`) ở trang đăng ký → phải thấy lỗi "Email đã được dùng…".
- DevTools → **Network**: gõ tìm kiếm nhanh chỉ sinh 1 request sau khi ngừng gõ.
- DevTools → **Console**: không có lỗi đỏ (trừ 404/409 em cố ý thử).

## Địa chỉ API

`src/config.js` đọc biến `VITE_API_URL`, mặc định `http://localhost:4000`. Muốn đổi (vd. khi deploy GitHub Pages trỏ tới mock API công khai của giảng viên): chép `.env.example` thành `.env.local`, sửa giá trị, chạy lại `npm run dev` / `npm run build`.

## Cấu trúc

```
starter/
├── index.html, events.html, event-detail.html, register.html   # đã xong, không cần sửa
├── css/                    # đã xong (CSS Ch02 + phần Ch03 cuối components.css)
├── assets/                 # Ảnh SVG
├── public/assets/          # Ảnh Open Graph, chép nguyên vào dist/
├── src/
│   ├── config.js           # có sẵn: API_URL
│   ├── api.js              # ch3-T2
│   ├── render.js           # ch3-T3 (el() và renderStatus() có sẵn)
│   ├── club-images.js      # có sẵn: id CLB → ảnh
│   ├── events-page.js      # ch3-T4
│   ├── event-detail-page.js# ch3-T5
│   ├── register-page.js    # ch3-T6
│   ├── register-draft.js   # ch3-T7 (challenge)
│   └── utils/
│       ├── format.ts       # ch3-T1 (TypeScript)
│       └── debounce.js     # có sẵn
├── mock-api/               # Mock API EduHub — không sửa
├── vite.config.js          # Vite multi-page (4 trang)
├── eslint.config.js        # ESLint 10 flat config
├── tsconfig.json
└── package.json
```

## Nộp bài

Chép thư mục `starter/` thành repo mới **`EduHubWeb-Ch03-<MSSV>`** (public), commit ≥ 3 lần với message rõ nghĩa. Không nộp `node_modules/`, `dist/`, `.env.local` (đã có trong `.gitignore`).
