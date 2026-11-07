-- Đặt lại tiến trình (dùng ngày 13/11 sau khi chạy thử). Thay 'linh' bằng tài khoản cần đặt lại,
-- hoặc bỏ điều kiện WHERE để đặt lại tất cả. Tương đương: npm run player:reset -- linh
with p as (
  select pl.id from public.players pl
  join auth.users u on u.id = pl.user_id
  where u.email like 'linh@%'
)
, del as (delete from public.progress where player_id in (select id from p))
update public.players
set current_stage = 1, status = 'traveling', started_at = null, finished_at = null
where id in (select id from p);
