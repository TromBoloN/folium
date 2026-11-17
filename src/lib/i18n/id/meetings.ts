/** Meetings, class types and the attend / skip / cancelled log. */
export const meetings = {
  // Course form
  "Where is it?": "Di mana?",
  Campus: "Kampus",
  "Outside campus": "Luar kampus",
  Meetings: "Pertemuan",
  "Class type": "Jenis kelas",
  "{name} · {n}": "{name} · {n}",
  "Meetings in total": "Jumlah pertemuan",
  "Leave blank to use the class type's.": "Kosongkan untuk memakai jumlah dari jenis kelasnya.",
  "Leave blank if it has no set end.": "Kosongkan jika tidak ada akhir yang pasti.",
  "Next meeting is number": "Pertemuan berikutnya ke-",
  "Joining mid-way? Earlier meetings count as unknown, not attended.":
    "Mulai di tengah jalan? Pertemuan sebelumnya dihitung tidak diketahui, bukan hadir.",
  "Choose campus or outside campus.": "Pilih kampus atau luar kampus.",
  "Choose a class type from the list.": "Pilih jenis kelas dari daftar.",
  "Meetings must be a number.": "Jumlah pertemuan harus berupa angka.",
  "Meetings must be a whole number.": "Jumlah pertemuan harus bilangan bulat.",
  "Meetings must be at least 1.": "Jumlah pertemuan minimal 1.",
  "Meetings can be at most 200.": "Jumlah pertemuan maksimal 200.",
  "Current meeting must be a number.": "Pertemuan saat ini harus berupa angka.",
  "Current meeting must be a whole number.": "Pertemuan saat ini harus bilangan bulat.",
  "Current meeting must be at least 1.": "Pertemuan saat ini minimal 1.",
  "Current meeting can be at most 200.": "Pertemuan saat ini maksimal 200.",
  "Your marked meetings don't fit before that number. Pick a later meeting.":
    "Pertemuan yang sudah ditandai tidak muat sebelum nomor itu. Pilih pertemuan yang lebih akhir.",
  "Couldn't set the current meeting. Please try again.": "Gagal mengatur pertemuan saat ini. Coba lagi.",
  "This class is already marked.": "Kelas ini sudah ditandai.",

  // Settings: class types
  "Class types": "Jenis kelas",
  "Campus courses pick a type and start from its number of meetings. You can change it per course.":
    "Kelas kampus memilih jenis dan mulai dari jumlah pertemuannya. Bisa diubah per kelas.",
  "Class type name, row {n}": "Nama jenis kelas, baris {n}",
  "e.g. Practicum": "mis. Praktikum",
  "Meetings for {name}": "Pertemuan untuk {name}",
  meetings: "pertemuan",
  "Add class type": "Tambah jenis kelas",
  "Regular class": "Kelas Biasa",
  Practicum: "Praktikum",
  "That class type isn't valid.": "Jenis kelas itu tidak valid.",
  "Give each class type a name.": "Beri nama setiap jenis kelas.",
  "Class type names can be at most 40 characters.": "Nama jenis kelas maksimal 40 karakter.",
  "A class type has at least 1 meeting.": "Jenis kelas minimal punya 1 pertemuan.",
  "Up to 12 class types.": "Maksimal 12 jenis kelas.",
  "Class types must be different.": "Jenis kelas harus berbeda-beda.",

  // Logging a meeting
  "Meeting {n}": "Pertemuan {n}",
  "Meeting {n} of {total}": "Pertemuan {n} dari {total}",
  "All {total} meetings done": "Semua {total} pertemuan selesai",
  "Log {meeting}": "Catat {meeting}",
  "Log this class": "Catat kelas ini",
  Attend: "Hadir",
  Skip: "Bolos",
  Skipped: "Bolos",
  "Skipped: {name}": "Bolos: {name}",
  "Cancelled · count unchanged": "Dibatalkan · hitungan tetap",
  "Cancelled: {name}. Your meeting count stays the same.": "Dibatalkan: {name}. Hitungan pertemuanmu tetap.",
  "{n} skip left": "Sisa {n} bolos",
  "{n} skips left": "Sisa {n} bolos",
  "{n} skip over the limit": "{n} bolos melewati batas",
  "{n} skips over the limit": "{n} bolos melewati batas",

  "1 meeting from before you started counting isn't included.":
    "1 pertemuan sebelum kamu mulai menghitung tidak dihitung.",
  "{n} meetings from before you started counting aren't included.":
    "{n} pertemuan sebelum kamu mulai menghitung tidak dihitung.",
  "Show all {n} meetings": "Tampilkan semua {n} pertemuan",
  "That meeting no longer exists.": "Pertemuan itu sudah tidak ada.",

  // Class times in the course form
  "When it meets each week. Leave a row blank to skip it; you can add more on the course page later.":
    "Kapan bertemu tiap minggu. Kosongkan baris untuk melewatinya; kamu bisa menambah lagi di halaman kelas nanti.",
  "Day, class time {n}": "Hari, jadwal {n}",
  "Starts, class time {n}": "Mulai, jadwal {n}",
  "Ends, class time {n}": "Selesai, jadwal {n}",
  "Remove class time {n}": "Hapus jadwal {n}",
  "Add at most 14 class times here.": "Tambah maksimal 14 jadwal di sini.",
  "The course is saved, but its class times weren't. Add them on the course page.":
    "Kelas tersimpan, tapi jadwalnya belum. Tambahkan di halaman kelas.",

  // Today
  "Today fills itself in": "Hari Ini terisi sendiri",
  "Add a class and Today shows what's on, which meeting you're at, and what's due. Cards appear as soon as they have something to say.":
    "Tambah kelas, dan Hari Ini menampilkan kelas yang berlangsung, pertemuan keberapa, dan tenggat tugas. Kartu muncul begitu ada isinya.",
  "Add your first class": "Tambah kelas pertamamu",
  "Start managing your finances": "Mulai kelola keuanganmu",
} as const;
