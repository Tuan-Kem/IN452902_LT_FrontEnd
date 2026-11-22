// Tệp TypeScript duy nhất của Ch03: các hàm định dạng dữ liệu để hiển thị.
// Kiểu giúp tsc báo lỗi TRƯỚC khi chạy, ví dụ gọi formatSeats(event) mà event thiếu capacity.
// Kiểm tra: npm run typecheck

/** Phần dữ liệu sự kiện cần để tính số chỗ — chỉ 2 trường, không cần cả EventDto. */
export interface SeatInfo {
  capacity: number;
  registeredCount: number;
}

/** Union type: tình trạng chỗ chỉ có thể là một trong ba chuỗi này. */
export type SeatStatus = 'available' | 'almost-full' | 'full';

const ALMOST_FULL_RATIO = 0.2; // Còn dưới 20% chỗ thì coi là "Sắp hết chỗ" (giống quy ước ở Ch02)

// sever luu giờ UTC; sinh viên ở Việt Nam nên luôn hiển thị theo giờ Việt Nam

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
/** "2026-10-17T00:30:00.000Z" → "07:30 Thứ Bảy, 17/10/2026" */
export function formatDateTime(iso: string): string {
  // TODO(ch3-T1): dùng Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday, day, month, year, hour, minute })
  // Server lưu giờ UTC — phải hiển thị theo giờ Việt Nam.
  return dateTimeFormatter.format(new Date(iso));
}

export function getSeatsLeft(seat: SeatInfo): number {
  // TODO(ch3-T1): số chỗ còn lại = capacity - registeredCount, không âm (Math.max)
  return Math.max(0, seat.capacity - seat.registeredCount);
}

export function getSeatStatus(seat: SeatInfo): SeatStatus {
  // TODO(ch3-T1): hết chỗ → 'full'; còn dưới 20% capacity → 'almost-full'; còn lại → 'available'
  const seatsLeft = getSeatsLeft(seat);
  if (seatsLeft === 0) {
    return 'full';
  }
  if (seatsLeft / seat.capacity < ALMOST_FULL_RATIO) {
    return 'almost-full';
  }
  return 'available';
}

/** { capacity: 60, registeredCount: 48 } → "Còn 12/60 chỗ" */
export function formatSeats(seat: SeatInfo): string {
  // TODO(ch3-T1): hết chỗ → "Đã đủ 60 chỗ"; còn chỗ → "Còn 12/60 chỗ"
  const seatsLeft = getSeatsLeft(seat);
  if (seatsLeft === 0) {
    return "Đã đủ 60 chỗ";
  }
  return `Còn ${seatsLeft}/${seat.capacity} chỗ`;
}
