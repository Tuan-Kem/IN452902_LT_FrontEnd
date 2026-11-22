import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Dự án có 4 trang HTML. Mặc định Vite chỉ build index.html,
// nên phải liệt kê đủ các trang ở build.rolldownOptions.input.
const page = (file) => resolve(import.meta.dirname, file);

export default defineConfig({
  // Đường dẫn tương đối: bản build chạy được cả ở GitHub Pages (https://<user>.github.io/<repo>/)
  base: './',
  build: {
    rolldownOptions: {
      input: {
        home: page('index.html'),
        events: page('events.html'),
        eventDetail: page('event-detail.html'),
        register: page('register.html'),
      },
    },
  },
  // Mock API chỉ cho phép origin http://localhost:5173 (xem mock-api/README.md, CORS_ORIGINS).
  // Cho `npm run preview` dùng cùng cổng 5173 với `npm run dev` để gọi API không bị chặn CORS.
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
