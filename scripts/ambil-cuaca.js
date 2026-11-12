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

// Cadangan: Open-Meteo (gratis, tanpa kunci). Koordinat perkiraan Desa Wirogomo; sesuaikan lewat Google Maps jika perlu.
const LAT = -7.31, LON = 110.44;
const URL_OM = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  "&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=Asia%2FJakarta&forecast_days=4";
const WMO = c => c === 0 ? "Cerah" : c <= 2 ? "Cerah Berawan" : c === 3 ? "Berawan" : (c === 45 || c === 48) ? "Kabut" :
  c >= 95 ? "Hujan Petir" : [65, 66, 67, 82].includes(c) ? "Hujan Lebat" : (c === 63 || c === 81) ? "Hujan Sedang" :
  ((c >= 51 && c <= 61) || c === 80) ? "Hujan Ringan" : "Berawan";

// Ubah respons Open-Meteo menjadi format yang sama (slot 3 jam: 02, 05, 08, ... WIB)
function dariOpenMeteo(raw) {
  const h = raw && raw.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error("Format data Open-Meteo tidak dikenali");
  const slot = [];
  h.time.forEach((w, i) => {
    if (+w.slice(11, 13) % 3 !== 2) return;
    const t = h.temperature_2m[i];
    if (!Number.isFinite(t)) return;
    slot.push({ w: w.slice(0, 16), c: WMO(h.weather_code[i]), t: Math.round(t), hu: Math.round(h.relative_humidity_2m[i]),
      ws: Math.round(h.wind_speed_10m[i] * 10) / 10, tp: h.precipitation[i] || 0 });
  });
  if (!slot.length) throw new Error("Tidak ada data Open-Meteo yang valid");
  return { sumber: "Open-Meteo", adm4: ADM4, lokasi: "Wirogomo, Banyubiru, Semarang", analisis: null,
    diambil: new Date().toISOString(), contoh: false, slot };
}
async function ambilOpenMeteo() {
  const r = await fetch(URL_OM, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Open-Meteo HTTP " + r.status);
  return dariOpenMeteo(await r.json());
}

async function main() {
  const a = process.argv.slice(2);
  const arg = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  const keluar = arg("--keluar") || path.join(__dirname, "..", "cuaca.json");
  const berkas = arg("--dari-berkas");
  let hasil;
  if (berkas) hasil = ringkas(JSON.parse(fs.readFileSync(berkas, "utf8")), { contoh: true, geserKeHariIni: true });
  else {
    try { hasil = ringkas(await ambilBMKG()); }
    catch (e) { console.error("BMKG gagal (" + e.message + "). Memakai Open-Meteo."); hasil = await ambilOpenMeteo(); }
  }
  const tmp = keluar + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(hasil));
  fs.renameSync(tmp, keluar);
  console.log(`OK: ${hasil.slot.length} slot, ${hasil.lokasi}${hasil.contoh ? " (DATA CONTOH)" : ""} -> ${keluar}`);
}

if (require.main === module) main().catch(e => { console.error("GAGAL:", e.message); process.exit(1); });
module.exports = { ringkas, dariOpenMeteo, ADM4 };
