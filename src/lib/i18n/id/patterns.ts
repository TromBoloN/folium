/**
 * Server messages that carry a value, matched whole. `{1}`… are the captured
 * parts, each translated again (so a field name like "Room" becomes "Ruangan").
 */
export const idPatterns: [RegExp, string][] = [
  [/^(.+) can be at most (\d+) characters\.$/, "{1} maksimal {2} karakter."],
  [/^Use at least (\d+) characters\.$/, "Minimal {1} karakter."],
  [/^A break can be at most (\d+) days\.$/, "Libur maksimal {1} hari."],
  [/^No course matches “(.+)”\.$/, "Tidak ada mata kuliah yang cocok dengan “{1}”."],
  [/^(.+) has no class that day\.$/, "{1} tidak ada kelas hari itu."],
  [/^(.+) has no upcoming class\.$/, "{1} tidak punya kelas mendatang."],
  [/^The current meeting can be at most (\d+)\.$/, "Pertemuan saat ini maksimal {1}."],
];
idPatterns.push(
  [/^“(.+)” matches several accounts\.$/, "“{1}” cocok dengan beberapa rekening."],
  [/^No account called “(.+)”\.$/, "Tidak ada rekening bernama “{1}”."],
  [/^“(.+)” matches several categories\.$/, "“{1}” cocok dengan beberapa kategori."],
  [/^No expense category called “(.+)”\.$/, "Tidak ada kategori pengeluaran bernama “{1}”."],
  [/^No income category called “(.+)”\.$/, "Tidak ada kategori pemasukan bernama “{1}”."],
  [/^to (.+)$/, "ke {1}"],
);
idPatterns.push(
  [/^(\d+) class times added$/, "{1} jadwal kelas ditambahkan"],
  [/^Score can't be more than the maximum \((.+)\)\.$/, "Nilai tidak boleh melebihi maksimum ({1})."],
  [/^Can't read the date “(.*)”\.$/, "Tidak bisa membaca tanggal “{1}”."],
  [/^Up to (\d+) rows at a time\.$/, "Maksimal {1} baris sekali impor."],
  [/^Split (.+) with (.+)$/, "{1} dibagi dengan {2}"],
  [/^Income (Rp[^:]+): (.+)$/, "Pemasukan {1}: {2}"],
  [/^Income (Rp.+)$/, "Pemasukan {1}"],
  [/^Transfer (Rp[^:]+): (.+)$/, "Transfer {1}: {2}"],
  [/^Transfer (Rp.+)$/, "Transfer {1}"],
  [/^Spent (Rp[^:]+): (.+)$/, "Keluar {1}: {2}"],
  [/^Spent (Rp.+)$/, "Keluar {1}"],
  [/^Received: (.+)$/, "Diterima: {1}"],
  [/^Moved: (.+)$/, "Dipindah: {1}"],
  [/^Paid: (.+)$/, "Dibayar: {1}"],
  [/^Copied (\d+) budgets?$/, "{1} anggaran disalin"],
  [/^Suggested (\d+) budgets?$/, "{1} anggaran disarankan"],
);
