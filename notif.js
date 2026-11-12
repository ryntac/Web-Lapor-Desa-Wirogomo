// Logika notifikasi cuaca, dipakai oleh halaman (index.html) dan service worker (sw.js).
(function(g){
  const ms = w => Date.parse(w + ":00+07:00");
  const jam = w => w.slice(11,16).replace(":", ".");
  const tgl = t => new Date(t).toLocaleDateString("sv-SE", {timeZone:"Asia/Jakarta"});
  const jamWIB = t => parseInt(new Date(t).toLocaleString("en-GB", {hour:"2-digit", hour12:false, timeZone:"Asia/Jakarta"}), 10) % 24;
  // sudah: objek {tag:true} untuk notifikasi yang pernah dikirim. Mengembalikan [{tag,judul,isi}]
  g.hitungNotif = function(d, kini, sudah){
    const out = [];
    const dekat = d.slot.filter(x => ms(x.w) >= kini - 3*3600e3 && ms(x.w) <= kini + 12*3600e3);
    const buruk = dekat.filter(x => /lebat|petir/i.test(x.c) || x.ws >= 30);
    if(buruk.length){
      const tag = "buruk-" + buruk[0].w;
      if(!sudah[tag]) out.push({tag, judul:"Peringatan cuaca buruk",
        isi:`${buruk[0].c} diperkirakan sekitar pukul ${jam(buruk[0].w)}. Hati-hati, hindari sungai dan lereng rawan longsor.`});
    }
    const h = tgl(kini), tag = "harian-" + h;
    if(jamWIB(kini) >= 6 && !sudah[tag]){
      const s = d.slot.filter(x => x.w.slice(0,10) === h);
      if(s.length){
        const t = s.map(x => x.t), hj = s.filter(x => /hujan|petir/i.test(x.c)).map(x => jam(x.w));
        out.push({tag, judul:"Cuaca hari ini", isi:`${Math.round(Math.min(...t))}-${Math.round(Math.max(...t))}°C. ` +
          (hj.length ? "Hujan sekitar pukul " + hj.join(", ") + "." : "Tidak ada hujan diperkirakan.")});
      }
    }
    return out;
  };
})(self);
