// Jalankan: node test/uji-transform.js
const assert = require("assert");
const fs = require("fs");
const { ringkas } = require("../scripts/ambil-cuaca.js");

const raw = JSON.parse(fs.readFileSync(__dirname + "/fixture-bmkg.json", "utf8"));
const h = ringkas(raw);
assert.strictEqual(h.sumber, "BMKG");
assert.strictEqual(h.adm4, "33.22.07.2004");
assert.strictEqual(h.lokasi, "Wirogomo, Banyubiru, Kab. Semarang");
assert.strictEqual(h.slot.length, 20);
assert.deepStrictEqual(h.slot[0], { w: "2026-11-02T12:00", c: "Cerah Berawan", t: 26, hu: 65, ws: 6, tp: 0 });
for (let i = 1; i < h.slot.length; i++) assert(h.slot[i - 1].w < h.slot[i].w, "slot harus berurutan");
assert.strictEqual(h.contoh, false);

const g = ringkas(raw, { contoh: true, geserKeHariIni: true });
const hari = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
assert.strictEqual(g.slot[0].w.slice(0, 10), hari);
assert.strictEqual(g.contoh, true);

assert.throws(() => ringkas({}), /Format data BMKG/);
assert.throws(() => ringkas({ data: [{ cuaca: [[{ local_datetime: "x", weather_desc: "Cerah", t: 99 }]] }] }), /Tidak ada data/);
const rusak = JSON.parse(JSON.stringify(raw)); rusak.data[0].cuaca[0][1].t = null;
assert.strictEqual(ringkas(rusak).slot.length, 19, "slot tanpa suhu dibuang");
console.log("Semua uji transformasi lulus (" + h.slot.length + " slot).");
