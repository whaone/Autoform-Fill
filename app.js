/* =========================================================
   Form Builder Autofill
   - Profil = kumpulan field custom (label, tipe, nilai, matcher)
   - Disimpan ke localStorage
   - Generate bookmarklet untuk autofill form di web target
   ========================================================= */

const STORAGE_KEY = "formBuilderAutofill.profiles";
const FIELD_TYPES = [
  "text", "email", "tel", "number", "date", "url", "password", "textarea"
];

/** @typedef {{label:string,type:string,value:string,match:string}} Field */
/** @typedef {{id:string,name:string,rows:number,cols:number,fields:Field[]}} Profile */

const DEFAULT_ROWS = 5;
const DEFAULT_COLS = 2;
const MAX_ROWS = 20;
const MAX_COLS = 6;

function blankField() {
  return { label: "", type: "text", value: "", match: "" };
}

/** @type {Profile[]} */
let profiles = [];
/** @type {string|null} */
let activeId = null;

// ---------- Elemen DOM ----------
const $ = (id) => document.getElementById(id);
const els = {
  profileList: $("profileList"),
  profileName: $("profileName"),
  gridRows: $("gridRows"),
  gridCols: $("gridCols"),
  gridInfo: $("gridInfo"),
  fieldsContainer: $("fieldsContainer"),
  editorStatus: $("editorStatus"),
  preview: $("preview"),
  bookmarkletLink: $("bookmarkletLink"),
  bookmarkletCode: $("bookmarkletCode"),
  importFile: $("importFile"),
  toast: $("toast"),
};

// ---------- Util ----------
function uid() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(msg, isError = false) {
  els.toast.textContent = msg;
  els.toast.classList.toggle("error", isError);
  els.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (els.toast.hidden = true), 2400);
}

function load() {
  try {
    profiles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    profiles = [];
  }
  // normalisasi profil lama (yang belum punya rows/cols)
  profiles.forEach((p) => {
    if (!Array.isArray(p.fields)) p.fields = [];
    if (!p.cols) p.cols = Math.min(MAX_COLS, Math.max(1, p.cols || DEFAULT_COLS));
    if (!p.rows) p.rows = Math.max(1, Math.ceil((p.fields.length || DEFAULT_ROWS * p.cols) / p.cols));
    ensureGridSize(p);
  });
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Pastikan jumlah field == rows*cols (pad blank / trim sisa). */
function ensureGridSize(p) {
  const total = p.rows * p.cols;
  while (p.fields.length < total) p.fields.push(blankField());
  if (p.fields.length > total) p.fields.length = total;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function getActive() {
  return profiles.find((p) => p.id === activeId) || null;
}

// ---------- Render daftar profil ----------
function renderProfileList() {
  els.profileList.innerHTML = "";
  if (profiles.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Belum ada profil. Klik \"+ Profil Baru\".";
    li.style.cursor = "default";
    els.profileList.appendChild(li);
    return;
  }
  profiles.forEach((p) => {
    const li = document.createElement("li");
    li.className = p.id === activeId ? "active" : "";
    li.innerHTML = `<span>${escapeHtml(p.name || "(tanpa nama)")}</span>
                    <span class="count">${p.rows}×${p.cols}</span>`;
    li.addEventListener("click", () => selectProfile(p.id));
    els.profileList.appendChild(li);
  });
}

// ---------- Render satu field card ----------
function fieldCardTemplate(field, index) {
  const card = document.createElement("div");
  card.className = "field-card";
  card.dataset.index = index;

  const typeOptions = FIELD_TYPES.map(
    (t) => `<option value="${t}" ${t === field.type ? "selected" : ""}>${t}</option>`
  ).join("");

  card.innerHTML = `
    <span class="cell-no">#${index + 1}</span>
    <button class="remove" title="Kosongkan sel" type="button">✕</button>
    <div>
      <span class="mini-label">Label</span>
      <input class="f-label" type="text" value="${escapeAttr(field.label)}" placeholder="cth: Nama Lengkap" />
    </div>
    <div class="row-2">
      <div>
        <span class="mini-label">Tipe</span>
        <select class="f-type">${typeOptions}</select>
      </div>
      <div>
        <span class="mini-label">Nilai</span>
        ${
          field.type === "textarea"
            ? `<textarea class="f-value" rows="1" placeholder="isi nilai">${escapeHtml(field.value)}</textarea>`
            : `<input class="f-value" type="text" value="${escapeAttr(field.value)}" placeholder="isi nilai" />`
        }
      </div>
    </div>
    <div>
      <span class="mini-label">Cocokkan dengan (koma)</span>
      <input class="f-match" type="text" value="${escapeAttr(field.match)}" placeholder="cth: name, nama, fullname" />
    </div>
  `;

  // events
  card.querySelector(".f-label").addEventListener("input", (e) => updateField(index, "label", e.target.value));
  card.querySelector(".f-type").addEventListener("change", (e) => {
    updateField(index, "type", e.target.value);
    renderFields(); // re-render karena textarea vs input
  });
  card.querySelector(".f-value").addEventListener("input", (e) => updateField(index, "value", e.target.value));
  card.querySelector(".f-match").addEventListener("input", (e) => updateField(index, "match", e.target.value));
  card.querySelector(".remove").addEventListener("click", () => clearField(index));

  return card;
}

function renderFields() {
  const p = getActive();
  els.fieldsContainer.innerHTML = "";
  if (!p) {
    els.gridInfo.textContent = "";
    return;
  }
  els.fieldsContainer.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
  p.fields.forEach((f, i) => els.fieldsContainer.appendChild(fieldCardTemplate(f, i)));
  els.gridInfo.textContent = `${p.rows} × ${p.cols} = ${p.rows * p.cols} sel`;
  updatePreview();
}

// ---------- Operasi field (in-memory, belum tersimpan) ----------
function updateField(index, key, value) {
  const p = getActive();
  if (!p) return;
  p.fields[index][key] = value;
  if (key === "label" || key === "value") updatePreview();
  markUnsaved();
}

function addField() {
  const p = getActive();
  if (!p) {
    toast("Buat / pilih profil dulu.", true);
    return;
  }
  p.fields.push(blankField());
  p.rows = Math.ceil(p.fields.length / p.cols);
  ensureGridSize(p);
  renderFields();
  markUnsaved();
}

/** Kosongkan isi sebuah sel tanpa mengubah ukuran grid. */
function clearField(index) {
  const p = getActive();
  if (!p) return;
  p.fields[index] = blankField();
  renderFields();
  markUnsaved();
}

/** Terapkan dimensi grid baru (baris × kolom). */
function applyLayout() {
  const p = getActive();
  if (!p) {
    toast("Buat / pilih profil dulu.", true);
    return;
  }
  const rows = clampInt(els.gridRows.value, 1, MAX_ROWS, DEFAULT_ROWS);
  const cols = clampInt(els.gridCols.value, 1, MAX_COLS, DEFAULT_COLS);
  els.gridRows.value = rows;
  els.gridCols.value = cols;

  // peringatkan jika menyusutkan grid akan menghapus data terisi
  const newTotal = rows * cols;
  if (newTotal < p.fields.length) {
    const lost = p.fields.slice(newTotal).filter((f) => f.label || f.value).length;
    if (lost > 0 && !confirm(`Mengecilkan grid akan menghapus ${lost} sel yang sudah terisi. Lanjutkan?`)) {
      els.gridRows.value = p.rows;
      els.gridCols.value = p.cols;
      return;
    }
  }

  p.rows = rows;
  p.cols = cols;
  ensureGridSize(p);
  renderFields();
  markUnsaved();
  toast(`Layout ${rows} × ${cols} diterapkan.`);
}

// ---------- Profil ----------
function newProfile() {
  const rows = clampInt(els.gridRows.value, 1, MAX_ROWS, DEFAULT_ROWS);
  const cols = clampInt(els.gridCols.value, 1, MAX_COLS, DEFAULT_COLS);
  const p = { id: uid(), name: "Profil " + (profiles.length + 1), rows, cols, fields: [] };
  ensureGridSize(p);
  profiles.push(p);
  activeId = p.id;
  persist();
  renderProfileList();
  loadProfileIntoEditor();
  toast(`Profil baru ${rows}×${cols} dibuat.`);
}

function selectProfile(id) {
  activeId = id;
  renderProfileList();
  loadProfileIntoEditor();
}

function loadProfileIntoEditor() {
  const p = getActive();
  els.profileName.value = p ? p.name : "";
  els.gridRows.value = p ? p.rows : DEFAULT_ROWS;
  els.gridCols.value = p ? p.cols : DEFAULT_COLS;
  renderFields();
  els.editorStatus.textContent = "";
  updateBookmarklet();
}

function saveProfile() {
  const p = getActive();
  if (!p) {
    toast("Tidak ada profil yang dipilih.", true);
    return;
  }
  p.name = els.profileName.value.trim() || "(tanpa nama)";
  persist();
  renderProfileList();
  els.editorStatus.textContent = "✓ Tersimpan";
  updateBookmarklet();
  toast("Profil tersimpan.");
}

function deleteProfile() {
  const p = getActive();
  if (!p) return;
  if (!confirm(`Hapus profil "${p.name}"?`)) return;
  profiles = profiles.filter((x) => x.id !== p.id);
  activeId = profiles[0] ? profiles[0].id : null;
  persist();
  renderProfileList();
  loadProfileIntoEditor();
  toast("Profil dihapus.");
}

function markUnsaved() {
  els.editorStatus.textContent = "● Belum disimpan";
  updateBookmarklet();
}

// ---------- Preview ----------
function buildDataMap() {
  const p = getActive();
  const map = {};
  if (!p) return map;
  p.fields.forEach((f) => {
    if (f.label) map[f.label] = f.value;
  });
  return map;
}

function updatePreview() {
  els.preview.textContent = JSON.stringify(buildDataMap(), null, 2);
}

// ---------- Bookmarklet generation ----------
// Fungsi ini di-stringify lalu dijalankan di halaman target.
function autofillRuntime(fields) {
  const norm = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
  let filled = 0;

  // kumpulkan kandidat input
  const inputs = Array.from(
    document.querySelectorAll("input, textarea, select")
  ).filter((el) => {
    const t = (el.type || "").toLowerCase();
    return !["hidden", "submit", "button", "reset", "image", "file"].includes(t);
  });

  // ambil teks label terkait sebuah input
  function labelText(el) {
    let txt = "";
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) txt += " " + lab.textContent;
    }
    const wrap = el.closest("label");
    if (wrap) txt += " " + wrap.textContent;
    return txt;
  }

  function haystack(el) {
    return norm(
      [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), labelText(el)]
        .filter(Boolean)
        .join(" ")
    );
  }

  function setValue(el, value) {
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) setter.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  fields.forEach((f) => {
    if (!f.value) return;
    const keywords = (f.match || f.label || "")
      .split(",")
      .map((k) => norm(k))
      .filter(Boolean);
    if (keywords.length === 0) return;

    const target = inputs.find((el) => {
      if (el.dataset._afDone) return false;
      const hay = haystack(el);
      return keywords.some((k) => hay.includes(k));
    });

    if (target) {
      if (target.tagName === "SELECT") {
        const opt = Array.from(target.options).find(
          (o) => norm(o.value) === norm(f.value) || norm(o.textContent) === norm(f.value)
        );
        if (opt) {
          target.value = opt.value;
          target.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        setValue(target, f.value);
      }
      target.dataset._afDone = "1";
      target.style.outline = "2px solid #2dd4bf";
      filled++;
    }
  });

  alert("Autofill selesai. " + filled + " field terisi.");
}

function buildBookmarklet() {
  const p = getActive();
  const fields = p ? p.fields.filter((f) => f.value) : [];
  const payload = JSON.stringify(fields);
  // bungkus runtime + data jadi satu IIFE
  const code =
    "javascript:(function(){var __f=" +
    payload +
    ";(" +
    autofillRuntime.toString() +
    ")(__f);})();";
  return code;
}

function updateBookmarklet() {
  const code = buildBookmarklet();
  els.bookmarkletLink.href = code;
  els.bookmarkletCode.value = code;
}

// ---------- Export / Import ----------
function exportProfiles() {
  if (profiles.length === 0) {
    toast("Tidak ada profil untuk diekspor.", true);
    return;
  }
  const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "autofill-profiles.json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Profil diekspor.");
}

function importProfiles(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Format tidak valid");
      // normalisasi + id baru agar tidak bentrok
      data.forEach((p) => {
        const cols = clampInt(p.cols, 1, MAX_COLS, DEFAULT_COLS);
        const fields = Array.isArray(p.fields)
          ? p.fields.map((f) => ({
              label: f.label || "",
              type: FIELD_TYPES.includes(f.type) ? f.type : "text",
              value: f.value || "",
              match: f.match || "",
            }))
          : [];
        const rows = clampInt(p.rows, 1, MAX_ROWS, Math.max(1, Math.ceil((fields.length || 1) / cols)));
        const np = { id: uid(), name: p.name || "Imported", rows, cols, fields };
        ensureGridSize(np);
        profiles.push(np);
      });
      persist();
      renderProfileList();
      toast("Import berhasil: " + data.length + " profil.");
    } catch (e) {
      toast("Gagal import: " + e.message, true);
    }
  };
  reader.readAsText(file);
}

// ---------- Helpers escape ----------
function escapeHtml(s) {
  return (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}
function escapeAttr(s) {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---------- Wiring event ----------
function init() {
  load();

  $("btnNewProfile").addEventListener("click", newProfile);
  $("btnApplyLayout").addEventListener("click", applyLayout);
  $("btnSaveProfile").addEventListener("click", saveProfile);
  $("btnDeleteProfile").addEventListener("click", deleteProfile);
  $("btnExport").addEventListener("click", exportProfiles);
  $("btnImport").addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) importProfiles(e.target.files[0]);
    e.target.value = "";
  });
  els.profileName.addEventListener("input", markUnsaved);
  $("btnCopyCode").addEventListener("click", () => {
    els.bookmarkletCode.select();
    navigator.clipboard.writeText(els.bookmarkletCode.value).then(
      () => toast("Kode disalin."),
      () => toast("Gagal menyalin.", true)
    );
  });
  els.bookmarkletLink.addEventListener("click", (e) => {
    // klik langsung tidak menjalankan di app ini; arahkan user agar drag
    e.preventDefault();
    toast("Tarik tombol ini ke bookmarks bar, lalu klik di website target.");
  });

  // pilih profil pertama jika ada
  if (profiles.length > 0) activeId = profiles[0].id;
  renderProfileList();
  loadProfileIntoEditor();
}

document.addEventListener("DOMContentLoaded", init);
