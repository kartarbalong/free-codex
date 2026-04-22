# Email Weekly Tracker

Web app statis (tanpa backend) untuk mencatat daftar email dengan countdown mingguan, mode auto/manual, dan rate limit slider.

## Fitur

- Simpan list email ke `localStorage`
- Field per item: `email`, `lastUsed`, `duration`, `mode`, `limitPercent`
- Mode auto: countdown 7 hari dari `lastUsed`
- Mode manual: countdown berdasarkan `duration` (hari) dari `lastUsed`
- Tombol `Set hari ini` untuk update `lastUsed`
- Slider rate limit `0-100%`
- Countdown real-time (update tiap detik)

## Deploy ke GitHub Pages

1. Push isi folder ini ke repository GitHub.
2. Buka `Settings` repository.
3. Masuk ke `Pages`.
4. Pada `Build and deployment`, pilih:
   - `Source`: `Deploy from a branch`
   - Branch: `main` (atau branch yang dipakai), folder `/root`
5. Simpan, tunggu build selesai, lalu akses URL GitHub Pages.
