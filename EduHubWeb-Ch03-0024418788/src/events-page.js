// Trang lịch sự kiện: tải danh sách từ API, tìm theo tên, lọc theo CLB.
// Bộ lọc được ghi lên URL (?q=…&clubId=…) để tải lại trang hay gửi link cho bạn vẫn giữ kết quả.
import { getClubs, getEvents } from './api.js';
import { el, renderEventList, renderStatus } from './render.js';
// TODO(ch3-T4): import thêm el (từ './render.js') và debounce (từ './utils/debounce.js'),
// rồi khai báo hằng số thời gian chờ gõ: const SEARCH_DELAY_MS = 300;
import { debounce } from './utils/debounce.js';


const SEARCH_DELAY_MS = 300;

const filterForm = document.querySelector('.filters');
const searchInput = document.querySelector('#search');
const clubSelect = document.querySelector('#club-filter');
const eventList = document.querySelector('#event-list');
const resultCount = document.querySelector('#result-count');

/** id CLB → tên CLB, để card hiện "CLB Tin học" thay vì một chuỗi UUID */
const clubNames = new Map();

// ---- URL search params ----
let currentController = null;

function readFiltersFromUrl() {
  // TODO(ch3-T4): đọc q và clubId từ new URLSearchParams(window.location.search); thiếu thì ''
  const params = new URLSearchParams(window.location.search);
  return { q: params.get('q') ?? '', clubId: params.get('clubId') ?? '' };
}

function readFiltersFromForm() {
  return { q: searchInput.value.trim(), clubId: clubSelect.value };
}

function writeFiltersToUrl({ q, clubId }) {
  // TODO(ch3-T4): ghi q, clubId (bỏ giá trị rỗng) lên URL bằng window.history.replaceState
  // — đổi URL mà không tải lại trang.
  const params = new URLSearchParams(window.location.search);
  if (q) params.set('q', q);
  else params.delete('q');
  if (clubId) params.set('clubId', clubId);
  else params.delete('clubId');
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

// ---- Câu lạc bộ ----

async function loadClubs() {
  try {
    for (const club of await getClubs()) {
      clubNames.set(club.id, club.name);
            clubSelect.append(el('option', { text: club.name, attrs: { value: club.id } }));
          
      // TODO(ch3-T4): thêm <option value={club.id}>{club.name}</option> vào clubSelect (dùng el())
    }
  } catch (error) {
    // Thiếu danh sách CLB chỉ làm mất bộ lọc, trang vẫn xem được sự kiện
    console.warn('Không tải được danh sách CLB:', error.message);
  }
}

// ---- Sự kiện ----
function showEvents(page, { q }) {
  if (page.items.length === 0) {
    resultCount.textContent = '';
    const message = q ? `Không có sự kiện nào khớp "${q}".` : 'Chưa có sự kiện nào.'; 
    renderStatus(eventList, 'empty', message);
    return;
  }
  resultCount.textContent = `Tìm thấy ${page.totalCount} sự kiện`;
  renderEventList(eventList, page.items, clubNames);
}


async function loadEvents() {
  const filters = readFiltersFromForm();
  writeFiltersToUrl(filters);

  // TODO(ch3-T4): cài đặt tải sự kiện
  // 1. Huỷ request cũ (AbortController đang chạy → abort()), tạo controller mới.
  // 2. Hiện trạng thái đang tải: renderStatus(eventList, 'loading', 'Đang tải sự kiện…').
  // 3. const page = await getEvents(filters, controller.signal)
  //    - page.items rỗng → renderStatus(eventList, 'empty', …), xoá resultCount
  //    - có dữ liệu → resultCount "Tìm thấy {page.totalCount} sự kiện" + renderEventList(eventList, page.items, clubNames)
  // 4. catch: bỏ qua AbortError; lỗi khác → renderStatus(eventList, 'error', error.message, { label: 'Thử lại', onClick: loadEvents })
  currentController?.abort();
  const controller = new AbortController();
  currentController = controller;

  eventList.setAttribute('aria-busy', 'true');
  resultCount.textContent = '';
  renderStatus(eventList, 'loading', 'Đang tải sự kiện…');
  

  try {
      const page = await getEvents(filters, controller.signal);
      showEvents(page, filters);
    } catch (error) {
      if (error.name === 'AbortError') return; // request cũ bị huỷ — request mới sẽ vẽ kết quả
      renderStatus(eventList, 'error', error.message, { label: 'Thử lại', onClick: loadEvents });
    } finally {
      if (currentController === controller) eventList.setAttribute('aria-busy', 'false');
    }
}

// ---- Gắn sự kiện ----

// TODO(ch3-T4): ô tìm kiếm gọi loadEvents sau khi ngừng gõ SEARCH_DELAY_MS ms:
//   searchInput.addEventListener('input', debounce(loadEvents, SEARCH_DELAY_MS));
// TODO(ch3-T4): đổi CLB (sự kiện 'change' của clubSelect) → loadEvents ngay.

const loadEventsAfterTyping = debounce(loadEvents, SEARCH_DELAY_MS);

searchInput.addEventListener('input', loadEventsAfterTyping);
clubSelect.addEventListener('change', loadEvents);

filterForm.addEventListener('submit', (event) => {
  event.preventDefault(); // Enter trong ô tìm kiếm: lọc ngay, không tải lại trang
  loadEvents();
});

async function init() {
  const filters = readFiltersFromUrl();
  searchInput.value = filters.q;
  await loadClubs(); // cần có <option> CLB thì mới chọn lại được clubId từ URL
  clubSelect.value = filters.clubId;
  await loadEvents();
}

init();
