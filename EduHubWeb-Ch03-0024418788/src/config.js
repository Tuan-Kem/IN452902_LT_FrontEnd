// Địa chỉ mock API. Đọc từ biến môi trường VITE_API_URL (tệp .env.local) để
// khi deploy lên GitHub Pages chỉ cần đổi biến, không sửa code.
// Không có biến thì dùng mock API chạy ở máy mình (npm run api).
const DEFAULT_API_URL = 'http://localhost:4000';

// Bỏ dấu "/" ở cuối để ghép `${API_URL}/api/events` không bị thành "//api"
export const API_URL = (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
