// (Challenge) Lưu nháp form đăng ký vào localStorage: lỡ đóng tab thì mở lại vẫn còn chữ đã gõ.
// localStorage chỉ lưu CHUỖI → dùng JSON.stringify khi ghi, JSON.parse khi đọc.
// Tuyệt đối không lưu mật khẩu: ai mở DevTools trên máy này cũng đọc được localStorage.

export function saveDraft(form) {
  // TODO(ch3-T7): lấy giá trị studentId, name, email từ form.elements,
  // ghi vào localStorage dưới một khoá (vd. 'eduhub.registerDraft') bằng JSON.stringify
}

export function restoreDraft(form) {
  // TODO(ch3-T7): đọc khoá nháp, JSON.parse (bọc try/catch — dữ liệu có thể hỏng),
  // điền lại vào các ô studentId, name, email
}

export function clearDraft() {
  // TODO(ch3-T7): xoá khoá nháp khỏi localStorage
}
