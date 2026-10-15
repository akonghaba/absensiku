# AbsensiKu React + Vite untuk GitHub Pages

Project ini memakai React + Vite, Supabase Auth, dan Supabase database. GitHub Actions membangun lalu menerbitkan ke GitHub Pages saat ada push ke branch `main`.

## Deploy
1. Backup repo lama terlebih dahulu.
2. Ekstrak isi ZIP ini ke repo `akonghaba/absensiku`, lalu commit ke branch `main`.
3. Buka repo GitHub → Settings → Pages → Build and deployment, pilih **GitHub Actions**.
4. Buka tab Actions dan tunggu workflow Deploy AbsensiKu selesai.
5. URL aplikasi: https://akonghaba.github.io/absensiku/

## Supabase Auth URL Configuration
- Site URL: `https://akonghaba.github.io/absensiku/`
- Redirect URL: `https://akonghaba.github.io/absensiku/`
- Redirect URL reset sandi: `https://akonghaba.github.io/absensiku/**`
- Aktifkan Confirm email di Authentication → Providers → Email jika pendaftaran wajib diverifikasi.

## Fitur
- Daftar akun, login, logout
- Link verifikasi email lewat Supabase Auth
- Lupa sandi dan ubah sandi melalui tautan email
- Akun baru mendapat role `murid` lewat trigger profil Supabase
- Dashboard presensi, data siswa, riwayat
- Owner dapat mengatur role melalui RPC `owner_set_user_role`
- UI mobile-friendly

## Catatan penting sebelum dipakai
- Publishable key di frontend memang untuk aplikasi browser. Jangan pernah masukkan `service_role` atau secret key.
- Aplikasi ini mengikuti kolom tabel lama yang terlihat di project: `students.name`, `students.nis`, `students.class_name`, `students.user_id`, serta `attendance.student_nis`, `student_name`, `note`, `attendance_date`, `status`, `class_name`.
- Query presensi mengasumsikan unique constraint `(student_id, attendance_date)` dan izin RLS yang sesuai. Bila database lu berbeda, cocokkan skema sebelum dipakai.
- Pastikan policy RLS membatasi murid hanya ke data dirinya, dan hanya owner yang bisa mengubah role. Jangan mengandalkan tampilan frontend sebagai keamanan.
- Daftar akun hanya bisa mengubah profilnya sendiri; owner role memakai RPC `owner_set_user_role` yang sudah dibuat pada setup sebelumnya.
