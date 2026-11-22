import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  // Không kiểm thư mục build, thư viện và mock API chép sẵn
  globalIgnores(['dist/', 'node_modules/', 'mock-api/']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Cho ESLint biết code chạy trong trình duyệt: document, fetch, URLSearchParams… là biến có sẵn
      globals: globals.browser,
    },
    rules: {
      // Bắt so sánh lỏng (==) — luôn dùng ===
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      // Không báo tham số hàm chưa dùng: hàm TODO trong starter giữ sẵn tham số cho sinh viên
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    // Tệp cấu hình chạy bằng Node, không phải trình duyệt
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
