// Trang chi tiết: đọc id từ URL (event-detail.html?id=…), tải sự kiện và điền vào khung HTML có sẵn.
import { getEvent } from './api.js';
import { renderStatus } from './render.js';
// TODO(ch3-T5): import thêm getClub (api.js), getClubImage (club-images.js),
// createEventMeta + createTime (render.js), getSeatsLeft + getSeatStatus (utils/format.ts) khi cần.

const statusBox = document.querySelector('#detail-status');
const article = document.querySelector('#event-detail');

/** Phần tử có data-field="…" trong khung chi tiết */
function field(name) {
  return article.querySelector(`[data-field="${name}"]`);
}

function getEventIdFromUrl() {
  // TODO(ch3-T5): trả về giá trị tham số id trên URL (new URLSearchParams(window.location.search))
  return null;
}

function fillDetail(event, clubName) {
  // TODO(ch3-T5): điền dữ liệu vào các phần tử data-field trong event-detail.html:
  //   document.title = "{tên sự kiện} · EduHub Web"
  //   meta (thay bằng createEventMeta), name, club, time (createTime), location,
  //   seats "{capacity} (còn {số chỗ còn} chỗ)", description, cta, image (src + alt)
  // Chỉ dùng textContent / thuộc tính — không innerHTML.
  field('name').textContent = event.name;
  field('club').textContent = clubName;

  statusBox.replaceChildren();
  article.hidden = false;
}

async function loadDetail() {
  const id = getEventIdFromUrl();
  if (!id) {
    renderStatus(statusBox, 'empty', 'TODO(ch3-T5): đọc ?id= trên URL rồi tải sự kiện.');
    return;
  }

  renderStatus(statusBox, 'loading', 'Đang tải sự kiện…');
  try {
    const event = await getEvent(id);
    // TODO(ch3-T5): lấy tên CLB bằng getClub(event.clubId); lỗi thì dùng chữ 'Câu lạc bộ'
    fillDetail(event, 'Câu lạc bộ');
  } catch (error) {
    // TODO(ch3-T5): error.status === 404 → renderStatus 'empty' "Không tìm thấy sự kiện này…";
    // lỗi khác → renderStatus 'error' kèm nút { label: 'Thử lại', onClick: loadDetail }
    renderStatus(statusBox, 'error', error.message);
  }
}

loadDetail();
