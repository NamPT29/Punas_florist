\set ON_ERROR_STOP 1
\o /dev/null
\set QUIET 1

insert into auth.users values
  ('00000000-0000-0000-0000-000000000001', 'owner@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'stranger@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'staff@example.com');
insert into staff (user_id, name, role) values
  ('00000000-0000-0000-0000-000000000001', 'Chủ shop', 'owner'),
  ('00000000-0000-0000-0000-000000000003', 'Nhân viên', 'staff');

create function pg_temp.expect_error(sql text, needle text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if position(needle in sqlerrm) = 0 and position(needle in sqlstate) = 0 then
      raise exception 'Sai lỗi cho [%]: % (%)', sql, sqlerrm, sqlstate;
    end if;
    return;
  end;
  raise exception 'Mong đợi lỗi "%" nhưng không có: %', needle, sql;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create function pg_temp.eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception '% : nhận %, mong đợi %', label, actual, expected;
  end if;
end $$;
grant execute on function pg_temp.eq(anyelement, anyelement, text) to anon, authenticated;

-- 1. Khách vãng lai (anon) không đọc được gì.
set role anon;
select pg_temp.expect_error('select * from materials', '42501');
select pg_temp.expect_error('select create_order(''{}''::jsonb)', '42501');
reset role;

-- 2. Người đăng nhập nhưng không phải nhân viên: không thấy, không ghi được.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select pg_temp.eq((select count(*) from settings), 0::bigint, 'người lạ thấy settings');
select pg_temp.expect_error('insert into materials (name) values (''x'')', '42501');
reset role;

-- 3. Chủ shop.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

insert into materials (name, unit, cost, min_stock) values
  ('Hồng đỏ', 'cành', 15000, 30), ('Baby trắng', 'bó', 45000, 2), ('Giấy kraft', 'tờ', 5000, 10);
update materials set stock = 10 where name in ('Baby trắng', 'Giấy kraft');

select import_stock((select id from materials where name = 'Hồng đỏ'), 50, 16000, 'Chợ Đầm Sen', '2026-10-17');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 50::numeric, 'nhập kho');
select pg_temp.eq((select cost from materials where name = 'Hồng đỏ'), 16000::numeric, 'giá nhập mới');
select pg_temp.eq((select amount from expenses where category = 'Nhập hoa'), 800000::numeric, 'tự ghi chi phí nhập');
select pg_temp.expect_error('select import_stock(1, 0, 1000)', 'lớn hơn 0');

select save_product(jsonb_build_object(
  'name', 'Bó hồng đỏ 20 bông', 'price', 650000, 'holiday_price', 750000,
  'categories', jsonb_build_array('Sinh nhật'),
  'components', jsonb_build_array(
    jsonb_build_object('material_id', (select id from materials where name = 'Hồng đỏ'), 'qty', 20),
    jsonb_build_object('material_id', (select id from materials where name = 'Baby trắng'), 'qty', 1),
    jsonb_build_object('material_id', (select id from materials where name = 'Giấy kraft'), 'qty', 2))));
select pg_temp.eq((select count(*) from product_components), 3::bigint, 'lưu công thức');

-- Tạo đơn thường: chưa trừ kho.
select create_order(jsonb_build_object(
  'customer_name', 'Anh Tuấn', 'customer_phone', '0903 123 456',
  'recipient_name', 'Chị Lan', 'recipient_phone', '0938-555-777', 'address', '45 Võ Văn Tần',
  'delivery_date', '2026-10-19', 'delivery_slot', '08–10h', 'ship_fee', 30000, 'discount', 20000,
  'items', jsonb_build_array(
    jsonb_build_object('product_id', (select id from products limit 1), 'qty', 1),
    jsonb_build_object('name', 'Thiệp', 'price', 20000, 'qty', 1)))) as order1 \gset
select pg_temp.eq((select subtotal from orders where id = :order1), 670000::numeric, 'tạm tính');
select pg_temp.eq((select total from orders where id = :order1), 680000::numeric, 'tổng');
select pg_temp.eq((select phone from customers), '0903123456', 'chuẩn hóa SĐT');
select pg_temp.eq((select recipient_phone from orders where id = :order1), '0938555777', 'SĐT người nhận');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 50::numeric, 'chưa trừ kho khi mới tạo');

-- Bắt đầu cắm: trừ kho theo công thức.
select set_order_status(:order1, 'dang_cam');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 30::numeric, 'trừ kho khi cắm');
select pg_temp.eq((select stock from materials where name = 'Giấy kraft'), 8::numeric, 'trừ phụ liệu');
select pg_temp.expect_error('select set_order_status(' || :order1 || ', ''moi'')', 'quay lại');
select pg_temp.expect_error('select set_order_status(' || :order1 || ', ''dang_cam'')', 'quay lại');
select _deduct_order_stock(:order1);
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 30::numeric, 'không trừ hai lần');

-- Đổi công thức rồi hủy đơn: hoàn đúng lượng đã trừ.
update product_components set qty = 5 where material_id = (select id from materials where name = 'Hồng đỏ');
select set_order_status(:order1, 'huy');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 50::numeric, 'hoàn kho khi hủy');
select pg_temp.eq((select stock from materials where name = 'Giấy kraft'), 10::numeric, 'hoàn phụ liệu');
select pg_temp.expect_error('select set_order_status(' || :order1 || ', ''dang_giao'')', 'kết thúc');
update product_components set qty = 20 where material_id = (select id from materials where name = 'Hồng đỏ');

-- Ngày lễ: tự dùng giá lễ.
select create_order(jsonb_build_object(
  'customer_name', 'Anh Tuấn (mới)', 'customer_phone', '0903123456', 'delivery_date', '2026-10-20',
  'items', jsonb_build_array(jsonb_build_object('product_id', (select id from products limit 1), 'qty', 2)))) as order2 \gset
select pg_temp.eq((select total from orders where id = :order2), 1500000::numeric, 'giá lễ 20/10');
select pg_temp.eq((select count(*) from customers), 1::bigint, 'khách cũ theo SĐT');
select pg_temp.eq((select name from customers), 'Anh Tuấn (mới)', 'cập nhật tên khách');

-- Bán tại quầy: giao luôn, trừ kho luôn.
select create_order(jsonb_build_object(
  'customer_name', 'Khách lẻ', 'customer_phone', '0911222333', 'delivery_date', '2026-10-17',
  'pickup', true, 'paid', true, 'payment_method', 'chuyen_khoan', 'status', 'da_giao',
  'items', jsonb_build_array(jsonb_build_object('product_id', (select id from products limit 1), 'qty', 1)))) as order3 \gset
select pg_temp.eq((select status from orders where id = :order3), 'da_giao', 'bán tại quầy');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 30::numeric, 'trừ kho bán tại quầy');

-- Kiểm tra dữ liệu đầu vào.
select pg_temp.expect_error($$select create_order('{"customer_name":"A","customer_phone":"123","delivery_date":"2026-10-17","items":[{"name":"x","price":1}]}')$$, 'Số điện thoại');
select pg_temp.expect_error($$select create_order('{"customer_name":"A","customer_phone":"0903123456","delivery_date":"2026-10-17","items":[]}')$$, 'chưa có sản phẩm');
select pg_temp.expect_error($$select create_order('{"customer_name":"A","customer_phone":"0903123456","delivery_date":"2026-10-17","items":[{"name":"x"}]}')$$, 'tên và giá');
update products set active = false;
select pg_temp.expect_error('select create_order(''{"customer_name":"A","customer_phone":"0903123456","delivery_date":"2026-10-17","items":[{"product_id":' || (select id from products limit 1) || '}]}'')', 'ngừng bán');
update products set active = true;

-- Hủy hoa héo và kiểm kho.
select pg_temp.expect_error('select waste_stock(' || (select id from materials where name = 'Hồng đỏ') || ', 999)', 'lớn hơn tồn kho');
select waste_stock((select id from materials where name = 'Hồng đỏ'), 5, 'héo');
select pg_temp.eq((select stock from materials where name = 'Hồng đỏ'), 25::numeric, 'hủy hoa héo');
select adjust_stock((select id from materials where name = 'Hồng đỏ'), 22);
select pg_temp.eq((select qty from stock_moves where kind = 'kiem'), -3::numeric, 'kiểm kho');

-- Thống kê khách hàng (đơn hủy không tính).
select pg_temp.eq((select order_count from customer_stats where phone = '0903123456'), 1::bigint, 'số đơn');
select pg_temp.eq((select debt from customer_stats where phone = '0903123456'), 1500000::numeric, 'công nợ');
select pg_temp.eq((select debt from customer_stats where phone = '0911222333'), 0::numeric, 'đã trả');

update settings set shop_name = 'Tiệm Hoa Mộc';
select pg_temp.eq((select shop_name from settings), 'Tiệm Hoa Mộc', 'chủ sửa cài đặt');
reset role;

-- 4. Trang cho khách: ai cũng xem được, chỉ sản phẩm đang bán, không lộ giá vốn/công thức.
update products set description = 'Hồng Đà Lạt, baby trắng';
select save_product('{"name":"Mẫu ẩn","price":1,"active":false}');
reset role;
set role anon;
select pg_temp.eq(jsonb_array_length(public_catalog()->'products'), 1, 'chỉ sản phẩm đang bán');
select pg_temp.eq(public_catalog()->'products'->0->>'description', 'Hồng Đà Lạt, baby trắng', 'mô tả');
select pg_temp.eq(public_catalog()->'shop'->>'shop_name', 'Tiệm Hoa Mộc', 'tên shop');
select pg_temp.eq(public_catalog()::text ~ '(cost|components|stock|min_stock)', false, 'không lộ dữ liệu nội bộ');
select pg_temp.expect_error('select * from products', '42501');
reset role;

-- 5. Nhân viên thường: dùng được nghiệp vụ, không sửa được cài đặt.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select pg_temp.eq((select count(*) from orders), 3::bigint, 'nhân viên thấy đơn');
update settings set shop_name = 'Bị đổi';
select pg_temp.eq((select shop_name from settings), 'Tiệm Hoa Mộc', 'nhân viên không sửa cài đặt');
select pg_temp.expect_error('insert into staff (user_id) values (''00000000-0000-0000-0000-000000000002'')', '42501');
reset role;

\echo 'SQL: tất cả kiểm thử đều đạt'
