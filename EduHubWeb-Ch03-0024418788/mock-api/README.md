# Mock API EduHub

Server giả lập backend EduHub cho môn **IN4529 — Lập trình Front End**. Front end (Ch3, Ch5, Ch6, đồ án) gọi vào đây thay cho backend .NET của IN4211. Contract (đường dẫn, kiểu dữ liệu, mã lỗi) giữ đúng như backend thật, nên sau này đổi sang EduHub .NET chỉ cần đổi URL.

- Chỉ dùng module có sẵn của Node: **không cần `npm install`**.
- Dữ liệu nằm trong bộ nhớ, nạp từ `db.json` mỗi lần khởi động. Tắt server là mọi thay đổi mất, dữ liệu quay về ban đầu.

## Yêu cầu

Node.js 22 trở lên (khuyến nghị Node 24 LTS). Kiểm tra: `node -v`.

## Chạy

```bash
node server.mjs                 # http://localhost:4000
npm start                       # tương đương
node server.mjs --delay=800     # mỗi request chậm 0,8 giây — luyện hiển thị loading
node server.mjs --fail-rate=0.1 # 10% request trả 503 — luyện xử lý lỗi
node server.mjs --port=4001     # đổi cổng
```

Trong starter của các chương, chạy bằng `npm run api` (script trỏ tới `node mock-api/server.mjs`).

Kiểm tra nhanh: `curl http://localhost:4000/healthz` → `{"status":"Healthy"}`.

## Cờ và biến môi trường

| Cờ / biến | Mặc định | Ý nghĩa |
|---|---|---|
| `--port=<số>` hoặc `PORT` | `4000` | Cổng lắng nghe |
| `--delay=<ms>` | `0` | Làm chậm mọi request `/api/...` |
| `--fail-rate=<0..1>` | `0` | Tỉ lệ request `/api/...` trả `503` (ProblemDetails) |
| `--public` | tắt | Chế độ deploy công khai (xem bên dưới) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173,http://localhost:3000` (Vite dev, Vite preview, Next) | Danh sách origin được gọi API, cách nhau bằng dấu phẩy; `*` = mọi origin |
| `JWT_SECRET` | ngẫu nhiên mỗi lần chạy | Khoá ký JWT. Không đặt thì khởi động lại là token cũ hết hiệu lực |

`/healthz` và preflight `OPTIONS` không bị ảnh hưởng bởi `--delay`, `--fail-rate`.

## Tài khoản có sẵn

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@dthu.edu.vn` | `Admin@123` |
| Member | `sv1@dthu.edu.vn` | `Member@123` |
| Member | `sv2@dthu.edu.vn` … `sv8@dthu.edu.vn` | `Member@123` |

Tài khoản tự đăng ký qua `/api/auth/register` luôn là Member.

## Dữ liệu mẫu (`db.json`)

- 6 CLB: Tin học, Tình nguyện, Tiếng Anh, Âm nhạc, Bóng đá, Kỹ năng mềm.
- 24 sự kiện từ 09/2026 đến 01/2027 (giờ lưu theo UTC; giờ Việt Nam = UTC+7). Có sẵn để luyện badge:
  - **Đã hết chỗ:** "Hackathon EduHub 24 giờ" (5/5), "Halloween English Night" (4/4).
  - **Gần hết chỗ:** "Xuân yêu thương…" (5/6), "Đêm nhạc Giáng sinh acoustic" (7/8), "Viết CV và phỏng vấn xin việc" (4/5).
- 35 đăng ký mẫu; `sv1` có đăng ký đã check-in, đang chờ, đã xác nhận và đã huỷ.
- Mọi id là UUID cố định, dễ nhận ra theo tiền tố: CLB `11111111-…`, sự kiện `22222222-…`, thành viên `33333333-…`, đăng ký `44444444-…`.

Dữ liệu mẫu không phụ thuộc ngày chạy: server không chặn đăng ký sự kiện đã qua. Muốn chỉ hiện sự kiện sắp tới, front end tự gửi `from=<thời điểm hiện tại>`.

## Quy ước chung

- JSON dùng camelCase; id là chuỗi UUID; thời gian là chuỗi ISO-8601 UTC (`2026-12-19T01:00:00.000Z`).
- Gửi token: header `Authorization: Bearer <accessToken>`. Access token (JWT HS256) sống 15 phút.
- Refresh token nằm trong cookie `refreshToken` (httpOnly, `Path=/api/auth`, 7 ngày, `SameSite=Lax`). Mỗi refresh token chỉ dùng được một lần, lần refresh sau nhận cookie mới. Gọi từ trình duyệt nhớ bật `withCredentials: true` (axios) hoặc `credentials: 'include'` (fetch).
- Lỗi trả `Content-Type: application/problem+json`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "Dữ liệu không hợp lệ",
  "status": 400,
  "detail": "Có trường không hợp lệ.",
  "errors": { "name": ["Tên sự kiện là bắt buộc."] }
}
```

`401` là chưa đăng nhập hoặc token sai/hết hạn; `403` là đã đăng nhập nhưng không đủ quyền.

## Endpoint

| Method | Đường dẫn | Quyền | Thành công | Lỗi thường gặp |
|---|---|---|---|---|
| GET | `/healthz` | Khách | 200 `{ status: "Healthy" }` | |
| POST | `/api/auth/register` `{ studentId, name, email, password }` | Khách | 201 MemberDto | 400, 409 trùng email |
| POST | `/api/auth/login` `{ email, password }` | Khách | 200 `{ accessToken, tokenType }` + cookie | 401 |
| POST | `/api/auth/refresh` | Cookie refresh | 200 `{ accessToken, tokenType }` + cookie mới | 401 |
| POST | `/api/auth/logout` | — | 204, xoá cookie | |
| GET | `/api/members/me` | Đăng nhập | 200 MemberDto | 401 |
| GET | `/api/clubs` | Khách | 200 ClubDto[] (không phân trang) | |
| GET | `/api/clubs/{id}` | Khách | 200 ClubDto | 404 |
| POST | `/api/clubs` `{ name, description }` | Admin | 201 ClubDto | 400, 401, 403 |
| PUT | `/api/clubs/{id}` `{ name, description }` | Admin | 204 | 400, 403, 404 |
| DELETE | `/api/clubs/{id}` | Admin | 204 | 403, 404, 409 CLB còn sự kiện |
| GET | `/api/events?clubId&from&to&q&page&pageSize` | Khách | 200 Paged&lt;EventDto&gt; | 400 tham số sai |
| GET | `/api/events/{id}` | Khách | 200 EventDto | 404 |
| POST | `/api/events` `{ name, description, clubId, location, startTime, capacity }` | Admin | 201 EventDto | 400, 401, 403 |
| PUT | `/api/events/{id}` (cùng body, `clubId` bị bỏ qua) | Admin | 204 | 400, 403, 404 |
| DELETE | `/api/events/{id}` | Admin | 204 (xoá luôn các đăng ký) | 403, 404 |
| POST | `/api/registrations` `{ eventId }` | Đăng nhập | 201 RegistrationDto | 400, 401, 404, 409 đã đăng ký / hết chỗ |
| GET | `/api/registrations/me` | Đăng nhập | 200 RegistrationDto[] kèm `event` | 401 |
| GET | `/api/registrations/event/{eventId}` | Admin | 200 RegistrationDto[] kèm `member` | 403, 404 |
| DELETE | `/api/registrations/{id}` | Chủ đăng ký | 204 (status → `Cancelled`) | 403, 404 |
| POST | `/api/registrations/{id}/confirm` | Admin | 204 (status → `Confirmed`) | 403, 404, 409 đã huỷ |
| POST | `/api/checkins/{registrationId}` | Chủ đăng ký | 200 `{ qrToken }` | 403, 404, 409 đã huỷ |
| POST | `/api/checkins/verify/{qrToken}` | Admin | 200 `{ registrationId, checkedInAt }` | 403, 404, 409 đã check-in |

Chi tiết tham số `GET /api/events`:

- `page` mặc định 1, `pageSize` mặc định 10 (tối đa 100). Kết quả sắp theo `startTime` tăng dần.
- `from`, `to`: thời gian ISO-8601, lọc `from ≤ startTime ≤ to`.
- `q`: tìm trong tên sự kiện, không phân biệt hoa thường và dấu (`hien mau` tìm ra "Hiến máu…").
- `clubId`: chỉ lấy sự kiện của một CLB.

Huỷ rồi đăng ký lại cùng sự kiện: server dùng lại bản ghi cũ (cùng `id`), đặt lại status `Pending`.

## Kiểu dữ liệu

```ts
type ClubDto = { id: string; name: string; description: string; presidentId: string | null; createdAt: string };
type EventDto = {
  id: string; name: string; description: string; clubId: string; location: string;
  startTime: string; capacity: number; createdAt: string;
  registeredCount: number; // số đăng ký chưa huỷ — trường tính thêm của mock
};
type Paged<T> = { items: T[]; totalCount: number; page: number; pageSize: number };
type MemberDto = { id: string; studentId: string; name: string; email: string; role: 'Member' | 'Admin'; joinedAt: string };
type RegistrationDto = {
  id: string; memberId: string; eventId: string; registeredAt: string;
  status: 'Pending' | 'Confirmed' | 'Cancelled';
  checkedInAt: string | null;
  event?: EventDto;   // chỉ có ở /api/registrations/me
  member?: MemberDto; // chỉ có ở /api/registrations/event/{eventId}
};
type ProblemDetails = { type: string; title: string; status: number; detail?: string; errors?: Record<string, string[]> };
```

## Chế độ `--public` (bản deploy công khai)

Giảng viên deploy một bản lên dịch vụ Node miễn phí (Render hoặc tương đương) để trang GitHub Pages (Ch3) và Vercel (Ch6) gọi tới:

```bash
CORS_ORIGINS="https://<user>.github.io,https://<app>.vercel.app" JWT_SECRET="<chuỗi bí mật>" node server.mjs --public
```

Khi bật `--public`:

- Tự cho phép mọi origin `https://<tên>.github.io` và `https://<tên>.vercel.app` (trang SV deploy) — không cần thêm từng địa chỉ vào `CORS_ORIGINS`.

- `--delay` và `--fail-rate` bị bỏ qua.
- Tài khoản Admin mẫu chỉ được **xem**; mọi thao tác ghi của Admin (tạo/sửa/xoá CLB, sự kiện, xác nhận đăng ký, verify check-in) trả `403`. Muốn thử chức năng Admin, nhóm tự chạy mock API riêng.
- Member vẫn đăng ký, huỷ, lấy mã check-in bình thường.
- Dữ liệu tự reset về `db.json` mỗi 24 giờ.
- Cookie refresh có `SameSite=None; Secure` để gửi được khi front end khác site. Một số trình duyệt vẫn chặn cookie bên thứ ba, nên luồng refresh chỉ bắt buộc chạy được ở local.

## Test

```bash
node --test   # hoặc npm test
```

`server.test.mjs` khởi server ở cổng ngẫu nhiên và kiểm từng dòng của contract.

## Dùng trong code

```js
import { createServer } from './server.mjs';
const server = createServer({ delay: 0, failRate: 0, public: false, quiet: true });
server.listen(4000);
```

## Sửa mock API

Bản gốc nằm ở `2026-2027/02_Projects/mock-api/`. Không sửa bản chép trong starter/solution; sửa bản gốc rồi chạy `bash _CORE/scripts/sync-mock-api.sh`.
