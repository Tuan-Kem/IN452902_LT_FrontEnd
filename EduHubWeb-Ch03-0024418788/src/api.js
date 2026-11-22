// Mọi lời gọi mock API đi qua tệp này. Trang (events-page.js…) chỉ gọi
// getEvents(), registerMember()… mà không cần biết URL hay cách xử lý lỗi.
import { API_URL } from './config.js';

/** Lỗi từ API, mang theo mã HTTP và lỗi từng trường (nếu server gửi). */
export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // 0 = không kết nối được server
    this.fieldErrors = fieldErrors; // vd. { email: ['Email không hợp lệ.'] }
  }
}

/**
 * Gọi API và trả về dữ liệu JSON. Ném ApiError nếu lỗi.
 * fetch() KHÔNG tự báo lỗi khi server trả 404/409/500 — phải tự kiểm response.ok.
 */
async function request(path, { method = 'GET', body, signal } = {}) {
  // TODO(ch3-T2): cài đặt request()
  // 1. await fetch(`${API_URL}${path}`, { method, signal, headers, body }) — có body thì
  //    gửi JSON.stringify(body) kèm header 'Content-Type': 'application/json'.
  // 2. fetch ném lỗi (mất mạng, tắt mock API): nếu error.name === 'AbortError' thì ném lại nguyên trạng,
  //    ngược lại ném new ApiError(0, 'Không kết nối được máy chủ…').
  // 3. !response.ok: đọc JSON ProblemDetails { title, detail, errors } rồi ném
  //    new ApiError(response.status, detail ?? title, errors).
  // 4. Thành công: trả response.json() (204 thì trả null).
  throw new ApiError(0, `TODO(ch3-T2): chưa cài request() — ${method} ${API_URL}${path}`);
}

/** Bỏ các tham số rỗng để URL gọn: { q: '', clubId: 'x' } → "?clubId=x" */
function toQueryString(params) {
  // TODO(ch3-T2): dùng URLSearchParams, bỏ giá trị undefined/null/'' ; không có tham số nào thì trả ''
  return '';
}

/** GET /api/events → { items, totalCount, page, pageSize } */
export function getEvents({ q, clubId, page = 1, pageSize = 50 } = {}, signal) {
  return request(`/api/events${toQueryString({ q, clubId, page, pageSize })}`, { signal });
}

/** GET /api/events/{id} → EventDto (404 nếu không có) */
export function getEvent(id, signal) {
  // encodeURIComponent: id lấy từ URL do người dùng gõ, không tin được
  return request(`/api/events/${encodeURIComponent(id)}`, { signal });
}

/** GET /api/clubs → ClubDto[] */
export function getClubs(signal) {
  return request('/api/clubs', { signal });
}

/** GET /api/clubs/{id} → ClubDto */
export function getClub(id, signal) {
  return request(`/api/clubs/${encodeURIComponent(id)}`, { signal });
}

/** POST /api/auth/register → MemberDto (409 nếu email đã dùng, 400 nếu dữ liệu sai) */
export function registerMember({ studentId, name, email, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { studentId, name, email, password },
  });
}
