# Shop Hoa — phần mềm quản lý shop hoa nhỏ

Web app cài được lên iPhone như app thường (PWA). Dữ liệu lưu trên Supabase. Tất cả đều dùng gói **miễn phí**.

**Chức năng**
- **Tổng quan:** doanh thu hôm nay và tháng này, đơn cần giao, khách còn nợ, cảnh báo hoa sắp hết hoặc sắp héo, sinh nhật khách, nhắc ngày lễ.
- **Đơn hàng:**
  - Tạo đơn nhanh theo SĐT, tự nhận ra khách cũ.
  - Người nhận riêng, khung giờ giao, lời thiệp, giảm giá, phí ship.
  - Bán tại quầy, đặt lại đơn cũ.
  - Trạng thái Mới → Đang cắm → Đang giao → Đã giao, hoặc Hủy.
  - Chụp ảnh bó hoa để gửi khách, gửi thông tin cho shipper, in phiếu.
- **Kho hoa:**
  - Nhập hoa (tự ghi vào chi phí), hủy hoa héo, kiểm kho, xem lịch sử.
  - **Kho tự trừ khi bắt đầu cắm**, theo công thức từng bó. Hủy đơn thì hoàn kho.
  - Hiện lượng hoa mà đơn đặt trước sẽ cần.
- **Sản phẩm:** công thức bó hoa, giá vốn, lãi, giá ngày lễ (tự áp dụng vào 14/2, 8/3, 20/10…).
- **Khách hàng:** lịch sử đơn, tổng đã mua, công nợ, sinh nhật, ghi chú sở thích.
- **Thu chi, báo cáo tháng:** doanh thu theo ngày, sản phẩm bán chạy, chi phí theo loại, lãi, hoa hư hỏng, xuất Excel (CSV).
- **Sao lưu:** tải toàn bộ dữ liệu về máy (JSON).

## Cấu trúc

```
web/                 Giao diện (HTML/CSS/JS thuần, không cần build)
  js/config.js       ← điền thông tin Supabase ở đây
  js/views/          Các màn hình
supabase/schema.sql  Cơ sở dữ liệu, phân quyền, nghiệp vụ kho/đơn
tests/               Kiểm thử (logic, SQL, giao diện)
```

Khi `web/js/config.js` còn để trống, app chạy **bản dùng thử**: có sẵn dữ liệu mẫu, dữ liệu chỉ lưu trên máy đang mở. Bạn có thể dùng bản này để xem thử trước khi cài Supabase.

## Cài đặt (khoảng 20 phút, miễn phí)

### 1. Tạo cơ sở dữ liệu Supabase
1. Đăng ký tại https://supabase.com, bấm **New project**. Region nên chọn **Singapore** cho gần Việt Nam. Ghi lại mật khẩu database.
2. Vào **SQL Editor** → **New query**, dán toàn bộ nội dung `supabase/schema.sql` rồi bấm **Run**.

### 2. Khóa đăng ký tự do
Vào **Authentication → Sign In / Providers**, tắt **Allow new users to sign up**. Chỉ chủ shop mới tạo được tài khoản.

### 3. Tạo tài khoản
Vào **Authentication → Users → Add user → Create new user**. Nhập email và mật khẩu, tick **Auto Confirm User**. Làm lần lượt cho chủ shop và từng nhân viên.

### 4. Cấp quyền dùng app
Vào **SQL Editor**, chạy lệnh dưới đây (thay email và tên):

```sql
-- Chủ shop (được sửa cài đặt)
insert into staff (user_id, name, role)
select id, 'Tên chủ shop', 'owner' from auth.users where email = 'chu-shop@gmail.com';

-- Nhân viên
insert into staff (user_id, name, role)
select id, 'Tên nhân viên', 'staff' from auth.users where email = 'nhan-vien@gmail.com';
```

Tài khoản không có trong bảng `staff` sẽ không xem được dữ liệu, kể cả khi đăng nhập được.

### 5. Kết nối app với Supabase
Vào **Project Settings → API** (hoặc **API Keys**), chép **Project URL** và khóa **anon / publishable** vào `web/js/config.js`:

```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

Khóa này được phép công khai, dữ liệu được bảo vệ bằng đăng nhập và phân quyền ở bước 2–4. **Không bao giờ** dùng khóa `service_role` hay `secret`.

### 6. Đưa app lên mạng bằng Cloudflare Pages (miễn phí)
1. Đăng ký https://dash.cloudflare.com, vào **Workers & Pages → Create → Pages → Connect to Git**, chọn repo `Punas_florist`.
2. Framework preset: **None**. Build command: để trống. **Build output directory: `web`**.
3. Bấm **Deploy**. Bạn sẽ có địa chỉ dạng `https://punas-florist.pages.dev`.

Từ đó mỗi lần push code lên GitHub, Cloudflare sẽ tự cập nhật app.

### 7. Cài lên iPhone
Mở địa chỉ trên bằng **Safari** → nút **Chia sẻ** → **Thêm vào MH chính**. Đăng nhập một lần là dùng như app thường. Điện thoại Android, iPad và máy tính ở quầy cũng dùng được, chung dữ liệu.

## Lưu ý khi dùng gói miễn phí
- Supabase **tạm dừng** dự án miễn phí nếu khoảng 1 tuần không có ai dùng. Shop dùng hằng ngày thì không bị. Nếu bị dừng, vào trang Supabase bấm **Restore**.
- Nên **sao lưu** định kỳ (Thêm → Sao lưu toàn bộ dữ liệu), ví dụ mỗi tuần một lần.
- Gói miễn phí đủ cho shop nhỏ dùng nhiều năm (khoảng 500 MB dữ liệu và 1 GB ảnh).

## Dành cho người sửa code
- Chạy thử trên máy: `npm start` rồi mở http://localhost:8080. Không mở thẳng file `index.html` được, vì trình duyệt chặn module JS khi mở file trực tiếp.
- Khi sửa giao diện, đổi `VERSION` trong `web/sw.js` để iPhone tải bản mới.
- Kiểm thử:
  - `npm test`: logic tính toán và bản dùng thử.
  - `npm run test:sql`: chạy `schema.sql` trên PostgreSQL tạm, kiểm tra phân quyền, trừ/hoàn kho, giá lễ, công nợ. Cần PostgreSQL 15 trở lên.
  - `npm run test:e2e`: bấm thử toàn bộ giao diện trên trình duyệt cỡ iPhone. Cần Playwright.
  - `npm run lint`
