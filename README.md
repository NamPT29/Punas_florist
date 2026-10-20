# Shop Hoa — phần mềm quản lý shop hoa nhỏ

Web app cài được lên iPhone như app thường (PWA). Dữ liệu lưu trên Supabase. Tất cả đều dùng gói **miễn phí**.

Giao diện tự đổi theo màn hình:
- **Điện thoại:** thanh menu dưới, một cột.
- **iPad dọc:** thanh menu dưới, nội dung rộng hơn.
- **Laptop hoặc iPad ngang (từ 900px):** menu bên trái, nội dung chia 2–3 cột, hộp thoại hiện giữa màn hình.

**Chức năng**
- **Tổng quan:** doanh thu hôm nay và tháng này, đơn cần giao, khách còn nợ, cảnh báo hoa sắp hết hoặc sắp héo, sinh nhật khách, nhắc ngày lễ.
- **Đơn hàng:**
  - Xem đơn hôm nay, ngày mai, một ngày bất kỳ, hoặc theo kỳ (tuần này, tháng này, tự chọn từ ngày đến ngày).
  - Tạo đơn nhanh theo SĐT, tự nhận ra khách cũ.
  - Người nhận riêng, khung giờ giao, lời thiệp, giảm giá, phí ship.
  - Bán tại quầy, đặt lại đơn cũ.
  - Trạng thái Mới → Đang cắm → Đang giao → Đã giao, hoặc Hủy.
  - Chụp ảnh bó hoa để gửi khách, gửi thông tin cho shipper, in phiếu.
- **Kho hoa:**
  - Nhập hoa (tự ghi vào chi phí), hủy hoa héo, kiểm kho, xem lịch sử.
  - **Kho tự trừ khi bắt đầu cắm**, theo công thức từng bó. Hủy đơn thì hoàn kho.
  - Hiện lượng hoa mà đơn đặt trước sẽ cần.
- **Sản phẩm:**
  - Xếp theo **nhóm** như thư mục, ví dụ nhóm "Hoa hồng Plume" chứa các mẫu hồng Plume. Mỗi nhóm có ảnh đại diện. Trong nhóm, bấm "Chuyển mẫu vào" để gom các mẫu có sẵn.
  - Công thức bó hoa, giá vốn, lãi, giá ngày lễ (tự áp dụng vào 14/2, 8/3, 20/10…).
- **Khách hàng:** lịch sử đơn, tổng đã mua, công nợ, sinh nhật, ghi chú sở thích.
- **Thu chi, báo cáo tháng:** doanh thu theo ngày, sản phẩm bán chạy, chi phí theo loại, lãi, hoa hư hỏng, xuất Excel (CSV).
- **Sao lưu:** tải toàn bộ dữ liệu về máy (JSON).
- **Trang cho khách** (trang chính của tên miền): khách xem mẫu hoa, giá, giá dịp lễ, lọc theo dịp, đặt qua Zalo hoặc gọi điện. Không cần đăng nhập, không hiện giá vốn, kho hay công thức.

## Cấu trúc

```
web/                 Giao diện (HTML/CSS/JS thuần, không cần build)
  js/config.js       ← điền thông tin Supabase ở đây
  js/views/          Các màn hình quản lý
  index.html         Trang cho khách (trang chính)
  quan-ly/           Trang quản lý (đơn, kho, khách, báo cáo…)
supabase/schema.sql  Cơ sở dữ liệu, phân quyền, nghiệp vụ kho/đơn
tests/               Kiểm thử (logic, SQL, giao diện)
```

Khi `web/js/config.js` còn để trống, app chạy **bản dùng thử**: có sẵn dữ liệu mẫu, dữ liệu chỉ lưu trên máy đang mở. Bạn có thể dùng bản này để xem thử trước khi cài Supabase.

Lưu ý: bản dùng thử lưu **riêng cho từng địa chỉ**. Ví dụ `127.0.0.1:8080` và `192.168.1.148:8080` là hai kho dữ liệu khác nhau, dù cùng một máy. Hãy mở trang quản lý và trang khách bằng **cùng một địa chỉ**. Khi đã nối Supabase thì mọi máy, mọi địa chỉ dùng chung dữ liệu.

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
select id, 'Tên chủ shop', 'owner' from auth.users where email = 'chu-shop@gmail.com'
on conflict (user_id) do update set name = excluded.name, role = excluded.role;

-- Nhân viên
insert into staff (user_id, name, role)
select id, 'Tên nhân viên', 'staff' from auth.users where email = 'nhan-vien@gmail.com'
on conflict (user_id) do update set name = excluded.name, role = excluded.role;
```

Tài khoản không có trong bảng `staff` sẽ không xem được dữ liệu, kể cả khi đăng nhập được. Chạy lại lệnh nhiều lần vẫn an toàn (chỉ cập nhật tên và vai trò).

Kiểm tra danh sách người được dùng app:

```sql
select u.email, s.name, s.role from staff s join auth.users u on u.id = s.user_id;
```

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
3. Bấm **Deploy**. Bạn sẽ có địa chỉ dạng `https://punas.pages.dev`:
   - `https://punas.pages.dev`: **trang cho khách** (trang chính, gửi link này cho khách).
   - `https://punas.pages.dev/quan-ly/`: **trang quản lý** của shop (cần đăng nhập).

Từ đó mỗi lần push code lên GitHub, Cloudflare sẽ tự cập nhật app.

### 7. Cài lên iPhone
Mở **trang quản lý** (`…/quan-ly/`) bằng **Safari** → nút **Chia sẻ** → **Thêm vào MH chính**. Đăng nhập một lần là dùng như app thường. Điện thoại Android, iPad và máy tính ở quầy cũng dùng được, chung dữ liệu.

## Trang cho khách xem hoa
- Địa chỉ: chính là tên miền, ví dụ `https://punas.pages.dev`. Trong app quản lý, bấm **Trang khách** ở Tổng quan, hoặc vào **Thêm → Trang cho khách xem hoa** để mở hay chia sẻ link. Link cũ có `/shop/` vẫn tự chuyển về trang chính.
- Trang lấy dữ liệu từ app quản lý. Sản phẩm nào **Đang bán** thì hiện, bỏ chọn thì ẩn. Sửa giá, ảnh hay mô tả xong là trang tự cập nhật.
- Mẫu hoa được xếp theo **bộ sưu tập**, chính là các **nhóm** trong mục Sản phẩm, theo thứ tự tên. Mẫu chưa xếp nhóm nằm ở "Mẫu khác". Mọi ảnh hiện trong khung cùng cỡ có viền kem, nên ảnh chụp khác nền vẫn gọn. Khách lọc theo **dịp** ở ô "Dịp" (lấy từ ô "Dịp" của từng sản phẩm).
- **Dịp lễ:** trong 14 ngày trước một ngày lễ (danh sách ngày lễ ở Cài đặt), trang tự đưa mẫu của dịp đó lên đầu, kèm đếm ngược "Còn 5 ngày". Mẫu của dịp là mẫu có ô "Dịp" ghi ngày (VD `20/10`) hoặc tên dịp (VD `Phụ nữ`, `Nhà giáo`). Nếu chưa mẫu nào ghi, trang lấy các mẫu có giá ngày lễ.
- **Lọc theo giá:** Dưới 250k, 250k – 400k, Trên 400k (theo giá đang áp dụng hôm nay).
- **Hoa đã giao:** trong một đơn đã chụp ảnh bó hoa, tick **"Đăng ảnh lên trang khách"**. Trang chỉ hiện ảnh, tên mẫu và tháng giao (12 ảnh mới nhất), không hiện thông tin khách. Bỏ tick là gỡ ảnh.
- Vào **Thêm → Thông tin shop** để điền **số Zalo**, **giờ mở cửa** và **lời giới thiệu**. Mỗi sản phẩm có ô **Mô tả cho khách**.
- Cũng trong đó, tải **ảnh bìa** (ảnh lớn phủ kín đầu trang) và điền **khẩu hiệu** (chữ lớn trên ảnh). Nên dùng ảnh ngang, rõ nét, chụp hoa thật của shop. Chưa có ảnh thì đầu trang dùng nền hoa văn tối màu.
- Zalo không cho điền sẵn tin nhắn qua link. Vì vậy khi khách bấm "Đặt qua Zalo", tên mẫu hoa và giá được chép sẵn để khách dán vào tin nhắn.
- **Logo:** bông hoa 5 cánh. File logo để dùng cho Facebook, Zalo, in ấn nằm ở `web/brand/`, tải trực tiếp được trên web: `…/brand/logo-vuong.png` (ảnh đại diện vuông), `…/brand/logo-ngang.png` (nền trong suốt), `…/brand/logo-ngang-nen-toi.png`, `…/brand/hoa.svg` (chỉ bông hoa, dạng vector).
- Muốn đổi dòng tiêu đề hiện khi chia sẻ link lên Facebook hay Zalo, sửa thẻ `og:title` và `og:description` trong `web/index.html`.
- Nếu bạn đã chạy `schema.sql` bản cũ, hãy chạy lại bản mới trong SQL Editor để có trang khách. Chạy lại an toàn, không mất dữ liệu.

## Cập nhật cơ sở dữ liệu
Một số bản cập nhật cần thêm bảng hoặc cột mới (ví dụ **nhóm sản phẩm**). Khi đó:
1. Vào Supabase, mở **SQL Editor** → **New query**.
2. Dán toàn bộ nội dung `supabase/schema.sql` bản mới nhất rồi bấm **Run**.

Chạy lại nhiều lần vẫn an toàn, không mất dữ liệu. Nếu chưa chạy, trang quản lý sẽ báo lỗi kiểu *"product_groups" does not exist*.

## Lưu ý khi dùng gói miễn phí
- Supabase **tạm dừng** dự án miễn phí nếu khoảng 1 tuần không có ai dùng. Shop dùng hằng ngày thì không bị. Nếu bị dừng, vào trang Supabase bấm **Restore**.
- Nên **sao lưu** định kỳ (Thêm → Sao lưu toàn bộ dữ liệu), ví dụ mỗi tuần một lần.
- Gói miễn phí đủ cho shop nhỏ dùng nhiều năm (khoảng 500 MB dữ liệu và 1 GB ảnh).

## Dành cho người sửa code
- Chạy thử trên máy: `npm start` rồi mở http://localhost:8080 (trang khách) và http://localhost:8080/quan-ly/ (trang quản lý). Không mở thẳng file `index.html` được, vì trình duyệt chặn module JS khi mở file trực tiếp.
- Khi sửa giao diện quản lý, đổi `VERSION` trong `web/quan-ly/sw.js` để iPhone tải bản mới.
- Kiểm thử:
  - `npm test`: logic tính toán và bản dùng thử.
  - `npm run test:sql`: chạy `schema.sql` trên PostgreSQL tạm, kiểm tra phân quyền, trừ/hoàn kho, giá lễ, công nợ. Cần PostgreSQL 15 trở lên.
  - `npm run test:e2e`: bấm thử toàn bộ giao diện trên trình duyệt cỡ iPhone. Cần Playwright.
  - `npm run test:supabase`: chạy đúng code kết nối Supabase (`backend-supabase.js`) với thư viện Supabase chính thức, PostgREST và PostgreSQL thật. Script tự tải PostgREST và @supabase/supabase-js ở lần đầu.
  - `npm run lint`
