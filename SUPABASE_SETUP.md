# AquaSmart: Supabase va GitHub Pages

GitHub Pages chi host giao dien tinh. Supabase cung cap dang nhap va luu du lieu theo tai khoan.

## Trang thai hien tai

- `supabase-config.js` da co Project URL va publishable key cong khai.
- Ma nguon da duoc tai len repository: https://github.com/dtc235200269-commits/chayngaydi.
- GitHub Pages da duoc bat tu nhanh `main`, thu muc goc: https://dtc235200269-commits.github.io/chayngaydi/.
- Bang du lieu chua co trong Supabase; can chay `supabase/schema.sql`.

## 1. Tao project Supabase

1. Tao project tai https://supabase.com va mo **Project Settings > API Keys**.
2. Sao chep **Project URL** va **publishable key** bat dau bang `sb_publishable_` (hoac `anon` key cu).
3. Dien hai gia tri vao `supabase-config.js` neu chua co:

   ```js
   window.AQUASMART_SUPABASE_CONFIG = {
     url: "https://<project-ref>.supabase.co",
     anonKey: "<publishable-or-anon-key>"
   };
   ```

   Chi dung publishable/anon key tren giao dien. Khong dua `service_role` key vao website.

## 2. Tao bang va chinh sach truy cap

Mo **SQL Editor** trong Supabase, dan va chay noi dung `supabase/schema.sql`. Bang bat Row Level Security va moi tai khoan chi doc/sua du lieu cua chinh minh.

## 3. Cau hinh dang nhap email

Trong **Authentication > URL Configuration**, dat **Site URL** thanh dia chi GitHub Pages, vi du:

`https://<github-user>.github.io/<repository>/`

Them URL sau vao **Redirect URLs**:

`https://<github-user>.github.io/<repository>/auth.html`

Neu bat xac nhan email, hay cau hinh email provider/SMTP trong Supabase de nguoi dung nhan duoc thu xac nhan.

## 4. Dua giao dien len GitHub Pages

1. Tao repository GitHub moi (Public neu muon ai cung truy cap).
2. Tai cac file trong thu muc du an len repository. Khong dua service-role key hoac mat khau vao repository.
3. Trong repository, mo **Settings > Pages**, chon **Deploy from a branch**, branch `main`, folder `/ (root)`, roi bam **Save**.
4. Cho GitHub Pages xuat ban; URL thuong co dang `https://<github-user>.github.io/<repository>/`.
5. Quay lai Supabase **Authentication > URL Configuration**, cap nhat **Site URL** va **Redirect URLs** theo URL GitHub Pages vua nhan.

## Luu y ve tai khoan va du lieu cu

- Tai khoan cu chi ton tai trong trinh duyet khong duoc chuyen sang Supabase. Hay dang ky lai tren website sau khi cau hinh.
- Du lieu cu trong `localStorage` khong tu dong tai len may chu.
- Ten hien thi "Admin" khong tao quyen quan tri; he thong hien chua co role admin.
- Du lieu moi duoc dong bo theo tai khoan Supabase; can co ket noi Internet.
