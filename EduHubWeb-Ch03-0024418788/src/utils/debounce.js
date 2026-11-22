/**
 * Trả về phiên bản "chờ người dùng ngừng gõ" của hàm fn.
 * Gõ "hien mau" (8 phím) chỉ gọi API 1 lần thay vì 8 lần.
 * timerId nằm trong closure: mỗi lần gọi lại thì huỷ hẹn giờ cũ, đặt hẹn giờ mới.
 */
export function debounce(fn, delayMs) {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), delayMs);
  };
}
