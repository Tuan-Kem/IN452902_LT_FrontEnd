// Ảnh minh hoạ của từng CLB. Phải `import` ảnh thì Vite mới chép ảnh vào
// bản build (dist/) và trả về đường dẫn đúng — viết chuỗi 'assets/…' trong JS thì không.
import tinHoc from '../assets/club-tin-hoc.svg';
import tinhNguyen from '../assets/club-tinh-nguyen.svg';
import tiengAnh from '../assets/club-tieng-anh.svg';
import amNhac from '../assets/club-am-nhac.svg';
import bongDa from '../assets/club-bong-da.svg';
import kyNangMem from '../assets/club-ky-nang-mem.svg';
import logo from '../assets/logo.svg';

// Khoá là id CLB trong mock-api/db.json
const IMAGES_BY_CLUB_ID = {
  '11111111-1111-4111-8111-000000000001': tinHoc,
  '11111111-1111-4111-8111-000000000002': tinhNguyen,
  '11111111-1111-4111-8111-000000000003': tiengAnh,
  '11111111-1111-4111-8111-000000000004': amNhac,
  '11111111-1111-4111-8111-000000000005': bongDa,
  '11111111-1111-4111-8111-000000000006': kyNangMem,
};

/** CLB mới tạo (chưa có ảnh riêng) dùng tạm logo EduHub */
export function getClubImage(clubId) {
  return IMAGES_BY_CLUB_ID[clubId] ?? logo;
}
