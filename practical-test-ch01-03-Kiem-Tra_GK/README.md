# Bài kiểm tra thực hành IN4529 (Chương 1–3)

Đọc hết hướng dẫn này **trước khi làm bài**. Cài đặt chỉ mất khoảng 2 phút và **không cần Internet**.

## 1. Kiểm tra Node.js

Bài cần **Node.js 22 trở lên**. Mở terminal và gõ:

```bash
node -v
```

- Hiện `v22.x.x` trở lên (vd `v24.11.0`): đạt, sang bước 2.
- Hiện số nhỏ hơn 22, hoặc báo `'node' is not recognized` / `command not found`: **giơ tay báo cán bộ coi thi**, đừng tự tải Node.

## 2. Mở thư mục bài làm

1. Giải nén `practical-test-ch01-03.zip` ra Desktop (hoặc ổ D:). **Không làm bài ngay trong file zip.**
2. Mở VS Code → **File → Open Folder…** → chọn thư mục `practical-test-ch01-03`.
3. Mở terminal trong VS Code: **Terminal → New Terminal** (hoặc `` Ctrl + ` ``). Terminal sẽ đứng sẵn ở đúng thư mục.

Cấu trúc thư mục:

```
practical-test-ch01-03/
├── de-kiem-tra-thuc-hanh-ch01-03.pdf ← đề bài
├── start.mjs           ← lệnh chạy bài (KHÔNG sửa)
├── mock-api/           ← server dữ liệu giả lập (KHÔNG sửa)
└── site/               ← CHỈ LÀM BÀI TRONG THƯ MỤC NÀY
    ├── index.html      ← Câu 1a
    ├── css/style.css   ← Câu 1b
    ├── js/app.js       ← Câu 2 (đã có sẵn API_URL và formatDateTime)
    └── img/event.svg   ← ảnh minh hoạ cho card
```

## 3. Chạy bài

Trong terminal gõ:

```bash
node start.mjs
```

Thấy hai dòng sau là chạy đúng:

```
Mock API:  http://localhost:4000
Bài làm:   http://localhost:5500  (Ctrl + C để dừng)
```

- Mở trình duyệt vào **http://localhost:5500** để xem trang của mình.
- Kiểm tra API: mở http://localhost:4000/api/events?pageSize=50, thấy dữ liệu JSON là được.
- **Để nguyên terminal này chạy suốt giờ làm bài.** Sửa file xong chỉ cần lưu (`Ctrl + S`) rồi tải lại trang (`F5`), không phải chạy lại lệnh.
- Bật **DevTools** (`F12`) → tab **Console** để xem lỗi JavaScript, tab **Network** để xem request gửi tới API.

## 4. Thử trường hợp lỗi (Câu 2c)

Dừng server bằng `Ctrl + C`, rồi chạy:

```bash
node start.mjs --fail
```

Lúc này mọi request tới API đều trả lỗi 503; trang phải hiện “Không tải được dữ liệu, vui lòng thử lại.”. Thử xong thì `Ctrl + C` và chạy lại `node start.mjs` như bình thường.

## 5. Nộp bài

1. Lưu hết các file.
2. Nén **thư mục `site/`** (không cần nén `mock-api`) thành `StudentID_FullName.zip`, vd `0023412345_NguyenVanA.zip`.
3. Nộp theo hướng dẫn của cán bộ coi thi. Trước khi nộp, mở lại file zip xem có đủ `index.html`, `css/`, `js/` chưa.

## Gặp lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `Cổng 4000 (hoặc 5500) đang bị chiếm` | Còn một terminal khác đang chạy `node start.mjs`. Vào terminal đó bấm `Ctrl + C`, hoặc đóng hết terminal rồi chạy lại. |
| `Cannot find module ... start.mjs` | Terminal đang đứng sai thư mục. Gõ `cd` tới thư mục `practical-test-ch01-03` rồi chạy lại (dùng `ls` hoặc `dir` để thấy file `start.mjs`). |
| Trang trắng, Console báo `Failed to fetch` | Server chưa chạy hoặc đã bị tắt. Xem lại terminal, chạy lại `node start.mjs`. |
| Mở file bằng cách nhấp đúp `index.html` (địa chỉ bắt đầu bằng `file://`) | Không làm vậy. Luôn mở qua **http://localhost:5500**. Không cần Live Server. |
| Sửa CSS/JS mà trang không đổi | Kiểm tra đã lưu file chưa; bấm `Ctrl + F5` để tải lại hẳn. |
| Console báo `Cannot read properties of null` | JavaScript chạy trước khi HTML có phần tử. Đặt `<script src="js/app.js"></script>` ở cuối `<body>`, hoặc thêm `defer`. Kiểm tra lại `id` trong HTML có khớp với `querySelector` không. |
| Dữ liệu đăng ký bị thay đổi lạ | Tắt và chạy lại `node start.mjs`, dữ liệu sẽ về như ban đầu. |

Không tự xử lý được thì giơ tay báo cán bộ coi thi, **đừng xoá hay sửa** `start.mjs` và `mock-api/`.
