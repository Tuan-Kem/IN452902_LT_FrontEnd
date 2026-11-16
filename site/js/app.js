// Câu 2: viết JavaScript tại đây

const API_URL = 'http://localhost:4000';

// Hàm có sẵn: đổi giờ UTC sang giờ Việt Nam, vd "08:00 12/09/2026"
const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit', minute: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const MSG_LOADING = 'Đang tảI...';
const MSG_ERROR = 'Không thể tải dữ liệu, vui lòng thử lại.';
const MSG_NO_MATCH = 'Không có sự kiện nào khớp từ khoá.';
const MSG_BOOKING = 'Đang đặt chỗ...';
const MSG_BOOK_OK = 'Đặt chỗ thành công! Vui lòng chờ ban tổ chức xác nhận.';
const MSG_BOOK_FULL = 'Rất tiếc, sự kiện này vừa hết chỗ.';
const MSG_BOOK_ERROR = 'Đặt chỗ không thành công, vui lòng thử lại.';
const MSG_SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';

const $ = (id) => document.getElementById(id);

// Tạo phần tử: makeEl('p', { class: 'x' }, 'nội dung')
// Dữ liệu luôn gán bằng setAttribute / textContent, không dùng innerHTML
const makeEl = (tag, attrs = {}, text = '') => {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  if (text !== '') el.textContent = text;
  return el;
};

// Danh sách sự kiện đang hiển thị (id -> event), dùng để cập nhật card sau khi đặt chỗ
const eventsById = new Map();

// Token đăng nhập, chỉ giữ trong bộ nhớ (tải lại trang là mất)
let accessToken = null;
// Sự kiện đang chờ đặt chỗ sau khi người dùng đăng nhập xong
let pendingId = null;

// Câu 2a 
const isFull = (event) => event.registeredCount >= event.capacity;

const formatSeats = (event) =>
  isFull(event)
    ? 'Hết chỗ'
    : `Còn ${event.capacity - event.registeredCount}/${event.capacity} chỗ`;

// Câu 2b
const buildCard = (event) => {
  const full = isFull(event);
  const card = makeEl('article', { class: full ? 'card event-card card-full' : 'card event-card' });

  const image = makeEl('img', { src: 'img/event.svg', alt: event.name });

  const title = makeEl('h3');
  title.append(
    makeEl('a', { href: `event-detail.html?id=${encodeURIComponent(event.id)}` }, event.name)
  );

  const when = makeEl('p');
  when.append(
    makeEl('time', { datetime: event.startTime }, formatDateTime(event.startTime))
  );

  const where = makeEl('p', {}, event.location);

  const seats = makeEl('p');
  if (full) {
    seats.append(makeEl('span', { class: 'badge' }, formatSeats(event)));
  } else {
    seats.textContent = formatSeats(event);
  }

  // Nút đặt chỗ: hết chỗ thì khoá luôn, khỏi cho bấm
  const bookBtn = makeEl(
    'button',
    { type: 'button', class: 'btn-book', 'data-id': event.id },
    full ? 'Hết chỗ' : 'Đặt chỗ'
  );
  bookBtn.disabled = full;

  card.append(image, title, when, where, seats, bookBtn);
  return card;
};

const renderEvents = (events) => {
  eventsById.clear();
  events.forEach((event) => eventsById.set(String(event.id), event));
  $('event-list').replaceChildren(...events.map(buildCard));
};

// Câu 2c
const setStatus = (message) => {
  $('status').textContent = message;
};

const buildUrl = (keyword) => {
  const params = new URLSearchParams({ pageSize: '50' });
  const q = keyword.trim();
  if (q) params.set('q', q);
  return `${API_URL}/api/events?${params}`;
};

const loadEvents = async (keyword = '') => {
  setStatus(MSG_LOADING);

  try {
    const res = await fetch(buildUrl(keyword));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { items, totalCount } = await res.json();
    renderEvents(items);

    setStatus(
      totalCount === 0
        ? MSG_NO_MATCH
        : `Tìm thấy ${totalCount} sự kiện`
    );
  } catch (err) {
    renderEvents([]);
    setStatus(MSG_ERROR);
  }
};

// Đăng nhập
const loginDialog = $('login-dialog');
const loginForm = $('login-form');
const loginError = $('login-error');

const askLogin = (id) => {
  pendingId = id;
  loginError.textContent = '';
  loginDialog.showModal();
};

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('login-email').value.trim(),
        password: $('login-password').value,
      }),
    });

    if (res.status === 401) {
      loginError.textContent = 'Email hoặc mật khẩu không đúng.';
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    ({ accessToken } = await res.json());
    loginDialog.close();
    loginForm.reset();

    // Đăng nhập xong thì đặt chỗ luôn cho sự kiện người dùng vừa bấm
    const id = pendingId;
    pendingId = null;
    if (id) bookEvent(id);
  } catch (err) {
    loginError.textContent = 'Không đăng nhập được, vui lòng thử lại.';
  }
});

$('login-cancel').addEventListener('click', () => {
  pendingId = null;
  loginDialog.close();
});

// Đặt chỗ 
const findButton = (id) => document.querySelector(`.btn-book[data-id="${CSS.escape(id)}"]`);

const replaceCard = (id, event) => {
  const button = findButton(id);
  if (button) button.closest('.card').replaceWith(buildCard(event));
};

// Lấy lại số chỗ mới nhất từ server cho một sự kiện (dùng khi bị lỗi 409)
const refreshCard = async (id) => {
  try {
    const res = await fetch(`${API_URL}/api/events/${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const fresh = await res.json();
    eventsById.set(id, fresh);
    replaceCard(id, fresh);
  } catch (err) {
    // không lấy được thì thôi, giữ nguyên card hiện tại
  }
};

const bookEvent = async (id) => {
  // Chưa đăng nhập thì hiện hộp thoại đăng nhập trước
  if (!accessToken) {
    askLogin(id);
    return;
  }

  const event = eventsById.get(id);
  const button = findButton(id);
  if (!event || !button || isFull(event)) return;

  const unlock = () => {
    button.disabled = false;
    button.textContent = 'Đặt chỗ';
  };

  // Khoá nút trong lúc chờ để người dùng không bấm đúp
  button.disabled = true;
  button.textContent = 'Đang đặt…';
  setStatus(MSG_BOOKING);

  try {
    const res = await fetch(`${API_URL}/api/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ eventId: id }),
    });

    // 401: token hết hạn (15 phút) nên bắt đăng nhập lại
    if (res.status === 401) {
      accessToken = null;
      unlock();
      setStatus(MSG_SESSION_EXPIRED);
      askLogin(id);
      return;
    }

    // 409: đã đăng ký rồi hoặc vừa hết chỗ, hiện đúng lý do server trả về
    if (res.status === 409) {
      const problem = await res.json().catch(() => ({}));
      unlock();
      await refreshCard(id);
      setStatus(problem.detail ?? MSG_BOOK_FULL);
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    event.registeredCount += 1;
    replaceCard(id, event);
    setStatus(MSG_BOOK_OK);
  } catch (err) {
    // Lỗi mạng hoặc server: mở lại nút cho người dùng thử lại
    unlock();
    setStatus(MSG_BOOK_ERROR);
  }
};

// Card được vẽ lại liên tục nên gắn một listener ở danh sách cha thay vì từng nút
$('event-list').addEventListener('click', (e) => {
  const button = e.target.closest('.btn-book');
  if (button) bookEvent(button.dataset.id);
});

// Form tìm kiếm: chặn tải lại trang, cắt khoảng trắng đầu/cuối từ khoá
$('search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  loadEvents($('keyword').value.trim());
});

// Tải danh sách khi mở trang
loadEvents();