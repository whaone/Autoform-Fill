# Autoform-Fill

Web app (HTML + CSS + JavaScript murni) untuk membuat form custom dan mengisi web form lain secara otomatis.

## Fitur

- **Layout grid kustom** — tentukan jumlah baris × kolom (mis. 5 × 2), tiap sel adalah satu field.
- **Field dinamis** — tiap field punya Label, Tipe (text/email/tel/number/date/url/password/textarea), Nilai, dan kata kunci "Cocokkan dengan".
- **Multi-profil** — simpan banyak profil ke `localStorage` (tetap ada walau browser ditutup).
- **Autofill via bookmarklet** — drag tombol ke bookmarks bar, klik di website target, form terisi otomatis.
- **Export / Import** — backup & pindah profil lewat file JSON.

## Cara pakai

1. Buka `index.html` di browser.
2. Set **Baris** dan **Kolom**, klik **Terapkan Layout** (atau klik **+ Profil Baru**).
3. Isi tiap sel: Label, Tipe, Nilai, dan "Cocokkan dengan" (kata kunci pendeteksi input, dipisah koma — cth: `email, e-mail, mail`).
4. Klik **Simpan Profil**.
5. Tarik (drag) tombol **Autofill Form** ke bookmarks bar browser.
6. Buka website yang punya form, klik bookmark tersebut, dan form terisi otomatis.

## Cara kerja autofill

Bookmarklet mencocokkan kata kunci pada kolom "Cocokkan dengan" dengan atribut `name`, `id`, `placeholder`, `aria-label`, dan teks `<label>` dari setiap input di halaman target. Makin spesifik kata kuncinya, makin akurat pencocokannya.

### Form popup / modal

Bookmarklet berjalan dalam **mode pantau** selama ±25 detik. Untuk form yang muncul sebagai popup/modal:

1. Klik bookmark **lebih dulu**.
2. Klik tombol pembuka form (mis. "produk baru").
3. Form akan terisi otomatis begitu popup muncul.

Bookmarklet juga dapat menembus **iframe** (same-origin) dan **shadow DOM**, serta menampilkan banner status (bukan `alert` yang memblokir).

## File

| File | Keterangan |
|------|-----------|
| `index.html` | Struktur halaman & tata letak panel |
| `styles.css` | Tampilan (tema gelap, responsif) |
| `app.js` | Logika: profil, grid, localStorage, bookmarklet, export/import |
