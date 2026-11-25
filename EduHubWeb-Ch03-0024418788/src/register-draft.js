// (Challenge) Lưu nháp form đăng ký vào localStorage: lỡ đóng tab thì mở lại vẫn còn chữ đã gõ.
// localStorage chỉ lưu CHUỖI → dùng JSON.stringify khi ghi, JSON.parse khi đọc.
// Tuyệt đối không lưu mật khẩu: ai mở DevTools trên máy này cũng đọc được localStorage.
const DRAFT_KEY = 'eduhub.registerDraft';

// không lưu mk
const DRAFT_FIELDS = ['studentId', 'name', 'email'];
export function saveDraft(form) {
  // TODO(ch3-T7): lấy giá trị studentId, name, email từ form.elements,
  // ghi vào localStorage dưới một khoá (vd. 'eduhub.registerDraft') bằng JSON.stringify
  const draft = {};
  for (const name of DRAFT_FIELDS) draft[name] = form.elements[name].value;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function restoreDraft(form) {
  // TODO(ch3-T7): đọc khoá nháp, JSON.parse (bọc try/catch — dữ liệu có thể hỏng),
  // điền lại vào các ô studentId, name, email
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY)) ?? {};
    for (const name of DRAFT_FIELDS) {
      if (typeof draft[name] === 'string') form.elements[name].value = draft[name];
    }
  } catch (error) {
    console.error('Error restoring draft:', error);
  }
}

export function clearDraft() {
  // TODO(ch3-T7): xoá khoá nháp khỏi localStorage
  localStorage.removeItem(DRAFT_KEY);
}
