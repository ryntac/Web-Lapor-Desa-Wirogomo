#!/usr/bin/env node
"use strict";
// Mengambil prakiraan cuaca BMKG untuk satu desa dan menulis cuaca.json yang ringkas.
// Pemakaian:
//   node scripts/ambil-cuaca.js                                  (ambil dari BMKG, tulis cuaca.json)
//   node scripts/ambil-cuaca.js --dari-berkas test/fixture-bmkg.json   (data CONTOH untuk uji tampilan)
//   tambahan: --keluar jalur/berkas.json
const fs = require("fs");
const path = require("path");

const ADM4 = "33.22.07.2004"; // Desa Wirogomo, Kec. Banyubiru, Kab. Semarang
const URL_BMKG = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=" + ADM4;

const hariIniWIB = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const selisihHari = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
function geserHari(w, n) {
  const [tgl, jam] = w.split("T");
  const d = new Date(tgl + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10) + "T" + jam;
}

// Mengubah respons BMKG menjadi daftar slot 3 jam yang ringkas (waktu lokal WIB).
function ringkas(raw, opsi = {}) {
  const blok = raw && Array.isArray(raw.data) ? raw.data[0] : null;
  if (!blok || !Array.isArray(blok.cuaca)) throw new Error("Format data BMKG tidak dikenali");
  const lok = blok.lokasi || raw.lokasi || {};
  const semua = blok.cuaca.flat();
  let slot = semua.map(s => ({
    w: String(s.local_datetime || "").slice(0, 16).replace(" ", "T"),
    c: s.weather_desc, t: s.t, hu: s.hu, ws: s.ws, tp: s.tp == null ? 0 : s.tp
  })).filter(s => /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(s.w) && s.c && Number.isFinite(s.t) && s.t > -10 && s.t < 50);
  if (!slot.length) throw new Error("Tidak ada data prakiraan yang valid");
  slot.sort((a, b) => (a.w < b.w ? -1 : a.w > b.w ? 1 : 0));
  if (opsi.geserKeHariIni) {
    const n = selisihHari(slot[0].w.slice(0, 10), hariIniWIB());
    slot = slot.map(s => ({ ...s, w: geserHari(s.w, n) }));
  }
  return {
    sumber: "BMKG",
    adm4: lok.adm4 || ADM4,
    lokasi: [lok.desa, lok.kecamatan, lok.kotkab].filter(Boolean).join(", "),
    analisis: (semua[0] || {}).analysis_date || null,
    diambil: new Date().toISOString(),
    contoh: !!opsi.contoh,
    slot
  };
}

async function ambilBMKG() {
  let err;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(URL_BMKG, {
        headers: { "User-Agent": "info-desa-wirogomo/1.0 (PkM)", "Accept": "application/json" },
        signal: AbortSignal.timeout(20000)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      err = e;
      console.error(`Percobaan ${i} gagal: ${e.message}`);
      await new Promise(res => setTimeout(res, i * 3000));
    }
  }
  throw err;
}

async function main() {
  const a = process.argv.slice(2);
  const arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const keluar = arg("--keluar") || path.join(__dirname, "..", "cuaca.json");
  const berkas = arg("--dari-berkas");
  const raw = berkas ? JSON.parse(fs.readFileSync(berkas, "utf8")) : await ambilBMKG();
  const hasil = ringkas(raw, { contoh: !!berkas, geserKeHariIni: !!berkas });
  const tmp = keluar + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(hasil));
  fs.renameSync(tmp, keluar);
  console.log(`OK: ${hasil.slot.length} slot, ${hasil.lokasi}${hasil.contoh ? " (DATA CONTOH)" : ""} -> ${keluar}`);
}

if (require.main === module) main().catch(e => { console.error("GAGAL:", e.message); process.exit(1); });
module.exports = { ringkas, ADM4 };
