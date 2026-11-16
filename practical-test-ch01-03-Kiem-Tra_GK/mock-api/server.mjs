// Mock API EduHub — IN4529 Lập trình Front End
// Chỉ dùng module có sẵn của Node (không cần npm install).
// Chạy: node server.mjs [--port=4000] [--delay=800] [--fail-rate=0.1] [--public]
import http from 'node:http';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DB_PATH = fileURLToPath(new URL('./db.json', import.meta.url));
const ACCESS_TTL_SEC = 15 * 60; // access token 15 phút
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // refresh token 7 ngày
const PUBLIC_RESET_MS = 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_CORS = 'http://localhost:5173,http://localhost:4173,http://localhost:3000';
// --public: tự cho phép trang SV deploy trên GitHub Pages / Vercel (chỉ https)
const PUBLIC_HOSTS = /^https:\/\/[a-z0-9-]+\.(github\.io|vercel\.app)$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Lỗi theo chuẩn ProblemDetails (RFC 9457) ----------
const TITLES = {
  400: 'Dữ liệu không hợp lệ',
  401: 'Chưa đăng nhập',
  403: 'Không có quyền',
  404: 'Không tìm thấy',
  405: 'Phương thức không được hỗ trợ',
  409: 'Xung đột dữ liệu',
  413: 'Dữ liệu gửi lên quá lớn',
  500: 'Lỗi máy chủ',
  503: 'Dịch vụ tạm thời không khả dụng',
};

class HttpError extends Error {
  constructor(status, detail, errors) {
    super(detail ?? TITLES[status]);
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

// Giống ASP.NET Core: type trỏ tới mục tương ứng trong RFC 9110
const RFC_SECTIONS = { 400: '15.5.1', 401: '15.5.2', 403: '15.5.4', 404: '15.5.5', 405: '15.5.6', 409: '15.5.10', 413: '15.5.14', 500: '15.6.1', 503: '15.6.4' };

function problem(status, detail, errors) {
  return {
    type: `https://tools.ietf.org/html/rfc9110#section-${RFC_SECTIONS[status] ?? '15'}`,
    title: TITLES[status] ?? 'Lỗi',
    status,
    ...(detail ? { detail } : {}),
    ...(errors ? { errors } : {}),
  };
}

// ---------- Mật khẩu (scrypt) ----------
function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(actual, Buffer.from(hashHex, 'hex'));
}

// ---------- JWT HS256 tự ký ----------
const b64url = (input) => Buffer.from(input).toString('base64url');

function signJwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Tiện ích ----------
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Bỏ dấu tiếng Việt để tìm "hien mau" ra "Hiến máu"
const fold = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const isBlank = (v) => typeof v !== 'string' || v.trim() === '';
const isIsoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Body tối đa 1 MB.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (size === 0) return resolve({});
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(data && typeof data === 'object' ? data : {});
      } catch {
        reject(new HttpError(400, 'Body không phải JSON hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

// Thu thập lỗi validate theo dạng { field: [message] }
function validator() {
  const errors = {};
  return {
    check(cond, field, message) {
      if (!cond) (errors[field] ??= []).push(message);
    },
    throwIfAny() {
      if (Object.keys(errors).length) throw new HttpError(400, 'Có trường không hợp lệ.', errors);
    },
  };
}

// ---------- Dữ liệu ----------
function loadDb(dbPath) {
  const seed = JSON.parse(readFileSync(dbPath, 'utf8'));
  return {
    members: seed.members.map(({ password, ...m }) => ({ ...m, passwordHash: hashPassword(password), seed: true })),
    clubs: seed.clubs.map((c) => ({ ...c })),
    events: seed.events.map((e) => ({ ...e })),
    registrations: seed.registrations.map((r) => ({ ...r })),
    refreshTokens: new Map(), // token → { memberId, expiresAt }
  };
}

// ---------- Server ----------
/**
 * Tạo HTTP server mock EduHub (chưa listen).
 * @param {{ delay?: number, failRate?: number, public?: boolean, quiet?: boolean,
 *           corsOrigins?: string, dbPath?: string, jwtSecret?: string }} options
 */
export function createServer(options = {}) {
  const isPublic = Boolean(options.public);
  // --public tắt delay và fail-rate để bản công khai luôn ổn định
  const delay = isPublic ? 0 : Number(options.delay ?? 0);
  const failRate = isPublic ? 0 : Number(options.failRate ?? 0);
  const quiet = Boolean(options.quiet);
  const dbPath = options.dbPath ?? DB_PATH;
  const secret = options.jwtSecret ?? process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
  const corsList = (options.corsOrigins ?? process.env.CORS_ORIGINS ?? DEFAULT_CORS)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let db = loadDb(dbPath);

  // ----- DTO -----
  const memberDto = ({ id, studentId, name, email, role, joinedAt }) => ({ id, studentId, name, email, role, joinedAt });
  const clubDto = ({ id, name, description, presidentId, createdAt }) => ({ id, name, description, presidentId, createdAt });
  const registeredCount = (eventId) =>
    db.registrations.filter((r) => r.eventId === eventId && r.status !== 'Cancelled').length;
  const eventDto = (e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    clubId: e.clubId,
    location: e.location,
    startTime: e.startTime,
    capacity: e.capacity,
    createdAt: e.createdAt,
    registeredCount: registeredCount(e.id),
  });
  const registrationDto = ({ id, memberId, eventId, registeredAt, status, checkedInAt }) => ({
    id, memberId, eventId, registeredAt, status, checkedInAt,
  });

  const findOr404 = (list, id, what) => {
    const item = UUID_RE.test(id) ? list.find((x) => x.id === id) : undefined;
    if (!item) throw new HttpError(404, `Không tìm thấy ${what} có id ${id}.`);
    return item;
  };

  // ----- Xác thực -----
  function currentUser(req) {
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const payload = token && verifyJwt(token, secret);
    if (!payload) return null;
    return db.members.find((m) => m.id === payload.sub) ?? null;
  }

  function requireUser(ctx) {
    if (!ctx.user) throw new HttpError(401, 'Cần gửi header Authorization: Bearer <accessToken> hợp lệ.');
    return ctx.user;
  }

  function requireAdmin(ctx, { write = true } = {}) {
    const user = requireUser(ctx);
    if (user.role !== 'Admin') throw new HttpError(403, 'Chỉ Admin được thực hiện thao tác này.');
    if (isPublic && write && user.seed) {
      throw new HttpError(403, 'Server đang chạy --public: tài khoản Admin mẫu chỉ được xem. Hãy chạy mock API riêng để thử thao tác Admin.');
    }
    return user;
  }

  function issueTokens(member, res) {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = signJwt(
      { sub: member.id, email: member.email, role: member.role, iat: now, exp: now + ACCESS_TTL_SEC, jti: randomUUID() },
      secret,
    );
    const refreshToken = randomBytes(32).toString('hex');
    db.refreshTokens.set(refreshToken, { memberId: member.id, expiresAt: Date.now() + REFRESH_TTL_SEC * 1000 });
    setRefreshCookie(res, refreshToken, REFRESH_TTL_SEC);
    return { accessToken, tokenType: 'Bearer' };
  }

  function setRefreshCookie(res, value, maxAge) {
    // Khác site (Pages → Render) trình duyệt chỉ gửi cookie khi SameSite=None; Secure
    const sameSite = isPublic ? 'SameSite=None; Secure' : 'SameSite=Lax';
    res.setHeader('Set-Cookie', `refreshToken=${value}; HttpOnly; Path=/api/auth; Max-Age=${maxAge}; ${sameSite}`);
  }

  // ----- Handlers -----
  const handlers = {
    healthz: () => ({ body: { status: 'Healthy' } }),

    // Auth
    async register({ body }) {
      const v = validator();
      v.check(!isBlank(body.studentId), 'studentId', 'Mã sinh viên là bắt buộc.');
      v.check(!isBlank(body.name), 'name', 'Họ tên là bắt buộc.');
      v.check(typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email), 'email', 'Email không hợp lệ.');
      v.check(typeof body.password === 'string' && body.password.length >= 8, 'password', 'Mật khẩu tối thiểu 8 ký tự.');
      v.throwIfAny();
      const email = body.email.trim().toLowerCase();
      if (db.members.some((m) => m.email.toLowerCase() === email)) {
        throw new HttpError(409, 'Email đã được dùng để đăng ký.');
      }
      const member = {
        id: randomUUID(),
        studentId: body.studentId.trim(),
        name: body.name.trim(),
        email,
        role: 'Member', // không cho tự đăng ký Admin
        joinedAt: new Date().toISOString(),
        passwordHash: hashPassword(body.password),
        seed: false,
      };
      db.members.push(member);
      return { status: 201, body: memberDto(member), location: '/api/members/me' };
    },

    async login({ body, res }) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const member = db.members.find((m) => m.email.toLowerCase() === email);
      if (!member || typeof body.password !== 'string' || !verifyPassword(body.password, member.passwordHash)) {
        throw new HttpError(401, 'Email hoặc mật khẩu không đúng.');
      }
      return { body: issueTokens(member, res) };
    },

    async refresh({ req, res }) {
      const token = parseCookies(req.headers.cookie).refreshToken;
      const entry = token && db.refreshTokens.get(token);
      if (!entry || entry.expiresAt < Date.now()) throw new HttpError(401, 'Refresh token không hợp lệ hoặc đã hết hạn.');
      db.refreshTokens.delete(token); // xoay vòng: mỗi refresh token chỉ dùng một lần
      const member = db.members.find((m) => m.id === entry.memberId);
      if (!member) throw new HttpError(401, 'Tài khoản không còn tồn tại.');
      return { body: issueTokens(member, res) };
    },

    async logout({ req, res }) {
      const token = parseCookies(req.headers.cookie).refreshToken;
      if (token) db.refreshTokens.delete(token);
      setRefreshCookie(res, '', 0);
      return { status: 204 };
    },

    me: (ctx) => ({ body: memberDto(requireUser(ctx)) }),

    // Clubs
    listClubs: () => ({ body: db.clubs.map(clubDto) }),
    getClub: ({ params }) => ({ body: clubDto(findOr404(db.clubs, params.id, 'CLB')) }),

    createClub(ctx) {
      requireAdmin(ctx);
      const { name, description } = validateClub(ctx.body);
      const club = { id: randomUUID(), name, description, presidentId: null, createdAt: new Date().toISOString() };
      db.clubs.push(club);
      return { status: 201, body: clubDto(club), location: `/api/clubs/${club.id}` };
    },

    updateClub(ctx) {
      requireAdmin(ctx);
      const club = findOr404(db.clubs, ctx.params.id, 'CLB');
      Object.assign(club, validateClub(ctx.body));
      return { status: 204 };
    },

    deleteClub(ctx) {
      requireAdmin(ctx);
      const club = findOr404(db.clubs, ctx.params.id, 'CLB');
      if (db.events.some((e) => e.clubId === club.id)) {
        throw new HttpError(409, 'CLB còn sự kiện, hãy xoá các sự kiện trước.');
      }
      db.clubs = db.clubs.filter((c) => c !== club);
      return { status: 204 };
    },

    // Events
    listEvents({ query }) {
      const v = validator();
      const page = query.has('page') ? Number(query.get('page')) : 1;
      const pageSize = query.has('pageSize') ? Number(query.get('pageSize')) : 10;
      v.check(Number.isInteger(page) && page >= 1, 'page', 'page phải là số nguyên ≥ 1.');
      v.check(Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100, 'pageSize', 'pageSize phải từ 1 đến 100.');
      for (const key of ['from', 'to']) {
        if (query.has(key)) v.check(isIsoDate(query.get(key)), key, `${key} phải là thời gian ISO-8601.`);
      }
      v.throwIfAny();

      const clubId = query.get('clubId');
      const from = query.has('from') ? Date.parse(query.get('from')) : -Infinity;
      const to = query.has('to') ? Date.parse(query.get('to')) : Infinity;
      const q = query.get('q') ? fold(query.get('q').trim()) : '';

      const filtered = db.events
        .filter((e) => !clubId || e.clubId === clubId)
        .filter((e) => {
          const t = Date.parse(e.startTime);
          return t >= from && t <= to;
        })
        .filter((e) => !q || fold(e.name).includes(q))
        .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

      const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(eventDto);
      return { body: { items, totalCount: filtered.length, page, pageSize } };
    },

    getEvent: ({ params }) => ({ body: eventDto(findOr404(db.events, params.id, 'sự kiện')) }),

    createEvent(ctx) {
      requireAdmin(ctx);
      const data = validateEvent(ctx.body, { requireClub: true });
      const event = { id: randomUUID(), ...data, createdAt: new Date().toISOString() };
      db.events.push(event);
      return { status: 201, body: eventDto(event), location: `/api/events/${event.id}` };
    },

    updateEvent(ctx) {
      requireAdmin(ctx);
      const event = findOr404(db.events, ctx.params.id, 'sự kiện');
      // Giống IN4211: PUT không đổi clubId — có gửi cũng bỏ qua
      const data = validateEvent(ctx.body, { requireClub: false, minCapacity: registeredCount(event.id) });
      Object.assign(event, data);
      return { status: 204 };
    },

    deleteEvent(ctx) {
      requireAdmin(ctx);
      const event = findOr404(db.events, ctx.params.id, 'sự kiện');
      db.events = db.events.filter((e) => e !== event);
      db.registrations = db.registrations.filter((r) => r.eventId !== event.id);
      return { status: 204 };
    },

    // Registrations
    createRegistration(ctx) {
      const user = requireUser(ctx);
      const v = validator();
      v.check(typeof ctx.body.eventId === 'string' && UUID_RE.test(ctx.body.eventId), 'eventId', 'eventId phải là UUID.');
      v.throwIfAny();
      const event = findOr404(db.events, ctx.body.eventId, 'sự kiện');
      const existing = db.registrations.find((r) => r.eventId === event.id && r.memberId === user.id);
      if (existing && existing.status !== 'Cancelled') throw new HttpError(409, 'Bạn đã đăng ký sự kiện này.');
      if (registeredCount(event.id) >= event.capacity) throw new HttpError(409, 'Sự kiện đã hết chỗ.');

      const now = new Date().toISOString();
      let reg = existing;
      if (reg) {
        // Đăng ký lại sau khi huỷ: dùng lại bản ghi cũ
        Object.assign(reg, { status: 'Pending', registeredAt: now, checkedInAt: null, qrToken: null });
      } else {
        reg = { id: randomUUID(), memberId: user.id, eventId: event.id, registeredAt: now, status: 'Pending', checkedInAt: null, qrToken: null };
        db.registrations.push(reg);
      }
      return { status: 201, body: registrationDto(reg), location: `/api/registrations/${reg.id}` };
    },

    myRegistrations(ctx) {
      const user = requireUser(ctx);
      const list = db.registrations
        .filter((r) => r.memberId === user.id)
        .map((r) => ({ ...registrationDto(r), event: eventDto(db.events.find((e) => e.id === r.eventId)) }))
        .sort((a, b) => Date.parse(a.event.startTime) - Date.parse(b.event.startTime));
      return { body: list };
    },

    eventRegistrations(ctx) {
      requireAdmin(ctx, { write: false });
      const event = findOr404(db.events, ctx.params.eventId, 'sự kiện');
      const list = db.registrations
        .filter((r) => r.eventId === event.id)
        .map((r) => ({ ...registrationDto(r), member: memberDto(db.members.find((m) => m.id === r.memberId)) }));
      return { body: list };
    },

    cancelRegistration(ctx) {
      const user = requireUser(ctx);
      const reg = findOr404(db.registrations, ctx.params.id, 'đăng ký');
      if (reg.memberId !== user.id) throw new HttpError(403, 'Chỉ người đăng ký mới được huỷ.');
      reg.status = 'Cancelled';
      return { status: 204 };
    },

    confirmRegistration(ctx) {
      requireAdmin(ctx);
      const reg = findOr404(db.registrations, ctx.params.id, 'đăng ký');
      if (reg.status === 'Cancelled') throw new HttpError(409, 'Đăng ký đã bị huỷ, không thể xác nhận.');
      reg.status = 'Confirmed';
      return { status: 204 };
    },

    // Check-in
    issueQr(ctx) {
      const user = requireUser(ctx);
      const reg = findOr404(db.registrations, ctx.params.registrationId, 'đăng ký');
      if (reg.memberId !== user.id) throw new HttpError(403, 'Chỉ người đăng ký mới lấy được mã check-in.');
      if (reg.status === 'Cancelled') throw new HttpError(409, 'Đăng ký đã bị huỷ.');
      reg.qrToken ??= randomBytes(16).toString('hex'); // giống Guid.ToString("N") của IN4211
      return { body: { qrToken: reg.qrToken } };
    },

    verifyQr(ctx) {
      requireAdmin(ctx);
      const reg = db.registrations.find((r) => r.qrToken && r.qrToken === ctx.params.qrToken);
      if (!reg) throw new HttpError(404, 'Mã check-in không tồn tại.');
      if (reg.checkedInAt) throw new HttpError(409, `Đăng ký này đã check-in lúc ${reg.checkedInAt}.`);
      reg.checkedInAt = new Date().toISOString();
      return { body: { registrationId: reg.id, checkedInAt: reg.checkedInAt } };
    },
  };

  function validateClub(body) {
    const v = validator();
    v.check(!isBlank(body.name), 'name', 'Tên CLB là bắt buộc.');
    v.check(isBlank(body.name) || body.name.trim().length <= 200, 'name', 'Tên CLB tối đa 200 ký tự.');
    v.check(body.description === undefined || typeof body.description === 'string', 'description', 'Mô tả phải là chuỗi.');
    v.throwIfAny();
    return { name: body.name.trim(), description: (body.description ?? '').trim() };
  }

  function validateEvent(body, { requireClub, minCapacity = 0 }) {
    const v = validator();
    v.check(!isBlank(body.name), 'name', 'Tên sự kiện là bắt buộc.');
    v.check(isBlank(body.name) || body.name.trim().length <= 200, 'name', 'Tên sự kiện tối đa 200 ký tự.');
    v.check(body.description === undefined || typeof body.description === 'string', 'description', 'Mô tả phải là chuỗi.');
    v.check(!isBlank(body.location), 'location', 'Địa điểm là bắt buộc.');
    v.check(isIsoDate(body.startTime), 'startTime', 'startTime phải là thời gian ISO-8601.');
    v.check(Number.isInteger(body.capacity) && body.capacity > 0, 'capacity', 'Sức chứa phải là số nguyên dương.');
    v.check(!(Number.isInteger(body.capacity) && body.capacity < minCapacity), 'capacity', `Sức chứa không được nhỏ hơn số đã đăng ký (${minCapacity}).`);
    if (requireClub) {
      v.check(typeof body.clubId === 'string' && db.clubs.some((c) => c.id === body.clubId), 'clubId', 'clubId không tồn tại.');
    }
    v.throwIfAny();
    const data = {
      name: body.name.trim(),
      description: (body.description ?? '').trim(),
      location: body.location.trim(),
      startTime: new Date(body.startTime).toISOString(),
      capacity: body.capacity,
    };
    if (requireClub) data.clubId = body.clubId;
    return data;
  }

  // ----- Bảng định tuyến: [method, regex, handler, cần đọc body?] -----
  const ID = '([^/]+)';
  const routes = [
    ['GET', /^\/healthz$/, handlers.healthz],
    ['POST', /^\/api\/auth\/register$/, handlers.register, true],
    ['POST', /^\/api\/auth\/login$/, handlers.login, true],
    ['POST', /^\/api\/auth\/refresh$/, handlers.refresh],
    ['POST', /^\/api\/auth\/logout$/, handlers.logout],
    ['GET', /^\/api\/members\/me$/, handlers.me],
    ['GET', /^\/api\/clubs$/, handlers.listClubs],
    ['POST', /^\/api\/clubs$/, handlers.createClub, true],
    ['GET', new RegExp(`^/api/clubs/${ID}$`), handlers.getClub, false, ['id']],
    ['PUT', new RegExp(`^/api/clubs/${ID}$`), handlers.updateClub, true, ['id']],
    ['DELETE', new RegExp(`^/api/clubs/${ID}$`), handlers.deleteClub, false, ['id']],
    ['GET', /^\/api\/events$/, handlers.listEvents],
    ['POST', /^\/api\/events$/, handlers.createEvent, true],
    ['GET', new RegExp(`^/api/events/${ID}$`), handlers.getEvent, false, ['id']],
    ['PUT', new RegExp(`^/api/events/${ID}$`), handlers.updateEvent, true, ['id']],
    ['DELETE', new RegExp(`^/api/events/${ID}$`), handlers.deleteEvent, false, ['id']],
    ['POST', /^\/api\/registrations$/, handlers.createRegistration, true],
    ['GET', /^\/api\/registrations\/me$/, handlers.myRegistrations],
    ['GET', new RegExp(`^/api/registrations/event/${ID}$`), handlers.eventRegistrations, false, ['eventId']],
    ['DELETE', new RegExp(`^/api/registrations/${ID}$`), handlers.cancelRegistration, false, ['id']],
    ['POST', new RegExp(`^/api/registrations/${ID}/confirm$`), handlers.confirmRegistration, false, ['id']],
    ['POST', new RegExp(`^/api/checkins/verify/${ID}$`), handlers.verifyQr, false, ['qrToken']],
    ['POST', new RegExp(`^/api/checkins/${ID}$`), handlers.issueQr, false, ['registrationId']],
  ];

  function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && (corsList.includes('*') || corsList.includes(origin) || (isPublic && PUBLIC_HOSTS.test(origin)))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', 'Location');
    }
    res.setHeader('Vary', 'Origin');
  }

  function send(res, status, body, extraHeaders = {}) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
    if (body === undefined || status === 204) {
      res.writeHead(status);
      return res.end();
    }
    const type = status >= 400 ? 'application/problem+json' : 'application/json';
    res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
    res.end(JSON.stringify(body));
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      return send(res, 204, undefined, {
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization',
        'Access-Control-Max-Age': '600',
      });
    }

    if (path !== '/healthz') {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (failRate > 0 && Math.random() < failRate) {
        return send(res, 503, problem(503, `Lỗi giả lập (--fail-rate=${failRate}). Hãy thử lại.`));
      }
    }

    const sameMethod = routes.filter(([m]) => m === req.method);
    let matched;
    for (const route of sameMethod) {
      const m = route[1].exec(path);
      if (m) {
        matched = { route, m };
        break;
      }
    }
    if (!matched) {
      const otherMethod = routes.some(([, re]) => re.test(path));
      return otherMethod
        ? send(res, 405, problem(405, `${req.method} không áp dụng cho ${path}.`))
        : send(res, 404, problem(404, `Không có endpoint ${req.method} ${path}.`));
    }

    const [, , handler, needsBody, paramNames = []] = matched.route;
    const params = Object.fromEntries(paramNames.map((n, i) => [n, decodeURIComponent(matched.m[i + 1])]));
    try {
      const body = needsBody ? await readBody(req) : {};
      const ctx = { req, res, params, query: url.searchParams, body, user: currentUser(req) };
      const result = await handler(ctx);
      const headers = result.location ? { Location: result.location } : {};
      send(res, result.status ?? 200, result.body, headers);
    } catch (err) {
      if (err instanceof HttpError) {
        const headers = err.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {};
        return send(res, err.status, problem(err.status, err.detail, err.errors), headers);
      }
      console.error(err);
      send(res, 500, problem(500, 'Lỗi không mong muốn, xem log server.'));
    }
  }

  const server = http.createServer((req, res) => {
    const started = performance.now();
    if (!quiet) {
      res.on('finish', () => {
        const ms = Math.round(performance.now() - started);
        console.log(`${new Date().toISOString()} ${req.method} ${req.url} → ${res.statusCode} (${ms} ms)`);
      });
    }
    handle(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) send(res, 500, problem(500));
    });
  });

  // Bản công khai tự reset dữ liệu mỗi 24 giờ
  if (isPublic) {
    const timer = setInterval(() => {
      db = loadDb(dbPath);
      if (!quiet) console.log('[--public] Đã reset dữ liệu về seed.');
    }, PUBLIC_RESET_MS);
    timer.unref();
    server.on('close', () => clearInterval(timer));
  }

  return server;
}

// ---------- Chạy trực tiếp: node server.mjs ----------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    let value = m[2];
    if (value === undefined && argv[i + 1] && !argv[i + 1].startsWith('--')) value = argv[++i];
    out[m[1]] = value ?? true;
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port ?? process.env.PORT ?? 4000);
  const options = {
    delay: Number(args.delay ?? 0),
    failRate: Number(args['fail-rate'] ?? 0),
    public: args.public === true || args.public === 'true',
  };
  const server = createServer(options);
  server.listen(port, () => {
    console.log(`EduHub mock API: http://localhost:${port}`);
    console.log(`  delay=${options.public ? 0 : options.delay}ms  fail-rate=${options.public ? 0 : options.failRate}  public=${options.public}`);
    console.log('  Tài khoản: admin@dthu.edu.vn / Admin@123 · sv1@dthu.edu.vn / Member@123');
  });
}
