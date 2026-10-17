// Chọn nơi lưu dữ liệu: Supabase (khi đã cấu hình) hoặc bản dùng thử trong trình duyệt.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export async function loadBackend() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const { createSupabaseBackend } = await import('./backend-supabase.js');
    return createSupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const { createDemoBackend } = await import('./backend-demo.js');
  return createDemoBackend();
}
