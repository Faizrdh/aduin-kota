/*eslint-disable*/

// prisma/seed.ts
import { PrismaClient, ReportCategory, ReportStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Data Pengguna Dummy ───────────────────────────────────────────────────────
const USERS = [
  { name: "Budi Santoso",     email: "budi@example.com",    city: "Jakarta",   role: Role.CITIZEN },
  { name: "Sari Dewi",        email: "sari@example.com",    city: "Bandung",   role: Role.CITIZEN },
  { name: "Andi Pratama",     email: "andi@example.com",    city: "Surabaya",  role: Role.CITIZEN },
  { name: "Rina Kusuma",      email: "rina@example.com",    city: "Medan",     role: Role.CITIZEN },
  { name: "Hendra Wijaya",    email: "hendra@example.com",  city: "Makassar",  role: Role.CITIZEN },
  { name: "Fitri Handayani",  email: "fitri@example.com",   city: "Yogyakarta",role: Role.CITIZEN },
  { name: "Dimas Nugroho",    email: "dimas@example.com",   city: "Semarang",  role: Role.CITIZEN },
  { name: "Ayu Rahayu",       email: "ayu@example.com",     city: "Denpasar",  role: Role.CITIZEN },
  { name: "Reza Maulana",     email: "reza@example.com",    city: "Palembang", role: Role.CITIZEN },
  { name: "Nita Anggraeni",   email: "nita@example.com",    city: "Bogor",     role: Role.CITIZEN },
  { name: "Officer Jakarta",  email: "officer1@example.com",city: "Jakarta",   role: Role.OFFICER },
  { name: "Admin Pusat",      email: "admin@example.com",   city: "Jakarta",   role: Role.ADMIN   },
];

// ─── Data Laporan ──────────────────────────────────────────────────────────────
// Setiap laporan diberi index userIndex (0-based, merujuk ke array USERS di atas)
const REPORTS: Array<{
  title:       string;
  description: string;
  category:    ReportCategory;
  status:      ReportStatus;
  lat:         number;
  lng:         number;
  province:    string;
  city:        string;
  district:    string;
  village:     string;
  address?:    string;
  userIndex:   number;
  daysAgo:     number; // untuk simulasi createdAt
}> = [

  // ══════════════════════════════════════════════════════════════════════════════
  // 🏘️  SENGKETA TANAH & SOSIAL (LAND)
  // ══════════════════════════════════════════════════════════════════════════════

  {
    title: "Sengketa Batas Tanah antar Warga di Gang Mawar",
    description:
      "Terdapat perselisihan batas tanah antara dua keluarga di Gang Mawar RT 03/RW 07. " +
      "Pagar tembok salah satu warga dibangun melewati batas kavling yang sudah ditetapkan " +
      "dalam sertifikat tanah. Warga sudah berupaya mediasi secara kekeluargaan namun belum " +
      "menemukan kesepakatan. Kondisi ini berpotensi menimbulkan konflik yang lebih besar " +
      "apabila tidak segera ditangani oleh pihak kelurahan dan BPN setempat.",
    category:  ReportCategory.LAND,
    status:    ReportStatus.IN_REVIEW,
    lat:       -6.2145,
    lng:       106.8450,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Selatan",
    district:  "Setiabudi",
    village:   "Karet Kuningan",
    address:   "Gang Mawar RT 03/RW 07",
    userIndex: 0,
    daysAgo:   5,
  },
  {
    title: "Lahan Hijau Publik Digunakan sebagai Parkir Liar",
    description:
      "Area ruang terbuka hijau (RTH) seluas ±300 m² di depan Perumahan Griya Asri " +
      "telah diokupasi oleh oknum sebagai lahan parkir berbayar tanpa izin. " +
      "Lahan tersebut merupakan fasilitas umum milik pemerintah daerah yang seharusnya " +
      "dapat dinikmati warga untuk aktivitas luar ruangan. Sejak diokupasi, warga " +
      "kehilangan akses ke area tersebut dan anak-anak tidak lagi memiliki tempat bermain " +
      "yang aman. Warga sudah melaporkan ke RT namun belum ada tindak lanjut.",
    category:  ReportCategory.LAND,
    status:    ReportStatus.PENDING,
    lat:       -7.2500,
    lng:       112.7688,
    province:  "Jawa Timur",
    city:      "Kota Surabaya",
    district:  "Wonokromo",
    village:   "Sawunggaling",
    address:   "Depan Perumahan Griya Asri",
    userIndex: 2,
    daysAgo:   2,
  },
  {
    title: "Penggusuran Warga Tanpa Ganti Rugi yang Layak",
    description:
      "Sekitar 15 kepala keluarga di Kampung Rawa Indah terancam digusur " +
      "tanpa kompensasi yang memadai. Pemberitahuan penggusuran datang mendadak hanya " +
      "3 hari sebelum tenggat tanpa surat resmi dari Dinas terkait. Warga telah " +
      "menempati lahan tersebut selama lebih dari 20 tahun dan memiliki surat kepemilikan " +
      "yang diakui kelurahan. Warga meminta mediasi resmi dan penundaan eksekusi hingga " +
      "proses hukum diselesaikan secara adil.",
    category:  ReportCategory.LAND,
    status:    ReportStatus.IN_PROGRESS,
    lat:       3.5952,
    lng:       98.6722,
    province:  "Sumatera Utara",
    city:      "Kota Medan",
    district:  "Medan Deli",
    village:   "Tanjung Mulia",
    address:   "Kampung Rawa Indah",
    userIndex: 3,
    daysAgo:   10,
  },
  {
    title: "Alih Fungsi Sawah Ilegal di Pinggiran Kota",
    description:
      "Beberapa petak sawah produktif di Desa Sindangjaya mulai diuruk menggunakan " +
      "tanah merah dan pasir tanpa izin perubahan fungsi lahan dari dinas pertanian " +
      "maupun tata ruang. Kegiatan diduga dilakukan oleh pengembang properti yang " +
      "berencana membangun perumahan. Hal ini mengancam irigasi sawah milik petani " +
      "sekitar serta dapat mengganggu ketahanan pangan lokal.",
    category:  ReportCategory.LAND,
    status:    ReportStatus.PENDING,
    lat:       -6.8998,
    lng:       107.6400,
    province:  "Jawa Barat",
    city:      "Kota Bandung",
    district:  "Coblong",
    village:   "Dago",
    address:   "Jalan Dago Atas, Desa Sindangjaya",
    userIndex: 1,
    daysAgo:   3,
  },
  {
    title: "Patok Batas Kawasan Hutan Dicabut Warga",
    description:
      "Sejumlah patok batas kawasan hutan produksi milik Perhutani di wilayah " +
      "Kecamatan Baturaden dilaporkan dicabut oleh oknum yang tidak bertanggung jawab. " +
      "Akibatnya, warga sekitar mulai membuka lahan di area yang seharusnya termasuk " +
      "kawasan hutan negara. Kondisi ini dikhawatirkan akan memperparah deforestasi " +
      "dan memicu longsor di musim hujan mengingat topografi kawasan yang berbukit.",
    category:  ReportCategory.LAND,
    status:    ReportStatus.IN_REVIEW,
    lat:       -7.3119,
    lng:       109.2295,
    province:  "Jawa Tengah",
    city:      "Kabupaten Banyumas",
    district:  "Baturaden",
    village:   "Karangsalam",
    userIndex: 6,
    daysAgo:   7,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🌊  BANJIR & GENANGAN (DISTURB / INFRA)
  // ══════════════════════════════════════════════════════════════════════════════

  {
    title: "Banjir Setinggi Lutut Merendam Permukiman Warga",
    description:
      "Hujan deras yang turun sejak dini hari mengakibatkan banjir setinggi 60–80 cm " +
      "di Kelurahan Penjaringan. Puluhan rumah terendam dan warga terpaksa mengungsi " +
      "ke balai RW. Drainase utama meluap karena kapasitasnya tidak memadai dan " +
      "banyak titik yang tersumbat sampah. Warga meminta normalisasi saluran drainase " +
      "dan peninggian tanggul darurat sebelum musim hujan mencapai puncaknya.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.IN_PROGRESS,
    lat:       -6.1237,
    lng:       106.8018,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Utara",
    district:  "Penjaringan",
    village:   "Penjaringan",
    address:   "RT 05/RW 02, dekat Pasar Ikan Penjaringan",
    userIndex: 0,
    daysAgo:   1,
  },
  {
    title: "Gorong-Gorong Tersumbat Menyebabkan Genangan Berulang",
    description:
      "Gorong-gorong di bawah Jalan Raya Kaligawe mengalami penyumbatan parah akibat " +
      "tumpukan sampah plastik dan sedimen lumpur. Setiap hujan lebih dari 30 menit, " +
      "air langsung meluap ke badan jalan dan memacetkan arus lalu lintas. Genangan " +
      "bisa bertahan hingga 4–5 jam setelah hujan berhenti. Kondisi ini sudah berlangsung " +
      "lebih dari 3 bulan dan belum ada penanganan dari dinas PU.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.PENDING,
    lat:       -6.9763,
    lng:       110.4426,
    province:  "Jawa Tengah",
    city:      "Kota Semarang",
    district:  "Gayamsari",
    village:   "Kaligawe",
    address:   "Jalan Raya Kaligawe KM 4",
    userIndex: 6,
    daysAgo:   4,
  },
  {
    title: "Tanggul Sungai Jebol Mengancam Ratusan Rumah",
    description:
      "Tanggul Sungai Berantas di Desa Wonosari mengalami kebocoran dan keretakan " +
      "pada beberapa titik sepanjang ±50 meter. Warga yang bermukim di bantaran sungai " +
      "sangat khawatir karena volume air sungai terus meningkat akibat hujan di hulu. " +
      "Apabila tanggul jebol total, diperkirakan sekitar 300 rumah akan terendam. " +
      "Warga mendesak Balai Besar Wilayah Sungai untuk segera melakukan perbaikan darurat.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.IN_REVIEW,
    lat:       -7.5361,
    lng:       112.2384,
    province:  "Jawa Timur",
    city:      "Kabupaten Mojokerto",
    district:  "Sooko",
    village:   "Wonosari",
    userIndex: 2,
    daysAgo:   2,
  },
  {
    title: "Drainase Perumahan Tidak Berfungsi sejak Selesai Dibangun",
    description:
      "Sistem drainase Perumahan Mutiara Indah yang baru selesai dibangun 8 bulan lalu " +
      "tidak berfungsi sebagaimana mestinya. Saluran air dirancang dengan kemiringan yang " +
      "tidak sesuai sehingga air justru menggenang di dalam perumahan alih-alih mengalir " +
      "keluar. Saat hujan deras, seluruh jalan di dalam komplek terendam 20–40 cm. " +
      "Warga telah mengajukan komplain ke pengembang namun belum ada respons selama 3 bulan.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.IN_REVIEW,
    lat:       -5.1477,
    lng:       119.4327,
    province:  "Sulawesi Selatan",
    city:      "Kota Makassar",
    district:  "Biringkanaya",
    village:   "Sudiang",
    address:   "Perumahan Mutiara Indah Blok C",
    userIndex: 4,
    daysAgo:   8,
  },
  {
    title: "Banjir Bandang Rusak Jembatan Penghubung Desa",
    description:
      "Banjir bandang yang terjadi tiga hari lalu menyebabkan jembatan gantung " +
      "penghubung Desa Cikaret dengan jalan kabupaten rusak parah. Satu pilar penopang " +
      "roboh dan dek jembatan amblas ke sungai. Akibatnya, warga dari dua dusun " +
      "terisolir dan harus memutar sejauh 12 km untuk mengakses fasilitas kesehatan " +
      "dan pasar. Perbaikan darurat sangat dibutuhkan segera.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.IN_PROGRESS,
    lat:       -6.5522,
    lng:       106.7890,
    province:  "Jawa Barat",
    city:      "Kabupaten Bogor",
    district:  "Caringin",
    village:   "Cikaret",
    userIndex: 9,
    daysAgo:   3,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🗑️  POLUSI & PENGELOLAAN SAMPAH (WASTE)
  // ══════════════════════════════════════════════════════════════════════════════

  {
    title: "Pembuangan Limbah Pabrik ke Sungai Ciliwung",
    description:
      "Warga melaporkan pembuangan limbah cair berwarna hitam kecokelatan dari " +
      "sebuah pabrik tekstil ke aliran Sungai Ciliwung. Air sungai berbau menyengat " +
      "dan ikan-ikan ditemukan mati mengapung sepanjang 500 meter ke arah hilir. " +
      "Beberapa warga yang menggunakan air sungai untuk mandi dilaporkan mengalami " +
      "iritasi kulit. Kegiatan pembuangan limbah ini diduga berlangsung setiap malam " +
      "antara pukul 22.00–03.00 untuk menghindari petugas.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.IN_REVIEW,
    lat:       -6.3588,
    lng:       106.8328,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Selatan",
    district:  "Pasar Minggu",
    village:   "Rawajati",
    address:   "Bantaran Sungai Ciliwung dekat Jl. TB Simatupang",
    userIndex: 0,
    daysAgo:   6,
  },
  {
    title: "Tempat Pembuangan Sampah Liar di Tepi Jalan Tol",
    description:
      "Sebuah area kosong di tepi jalan tol telah berubah menjadi tempat pembuangan " +
      "sampah liar dengan volume yang terus bertambah. Sampah berserakan mencakup " +
      "limbah rumah tangga, bangkai furnitur, hingga limbah medis berupa jarum suntik " +
      "bekas. Selain menimbulkan bau tidak sedap dan pemandangan yang kumuh, lokasi ini " +
      "juga berisiko menjadi sarang tikus dan nyamuk. Sudah dua kali ditertibkan namun " +
      "selalu muncul kembali karena tidak ada fasilitas TPS resmi di dekat sini.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.PENDING,
    lat:       -6.2607,
    lng:       106.7892,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Barat",
    district:  "Kebon Jeruk",
    village:   "Kebon Jeruk",
    address:   "Tepi Jalan Tol Dalam Kota, dekat Gerbang Kebon Jeruk",
    userIndex: 9,
    daysAgo:   1,
  },
  {
    title: "Polusi Udara Pekat dari Pembakaran Sampah Terbuka",
    description:
      "Sekelompok warga dan oknum pemulung membakar sampah secara terbuka di lahan " +
      "kosong Kelurahan Tanjung Selor setiap sore. Asap tebal berwarna hitam mengandung " +
      "partikel berbahaya menyebar ke permukiman sekitar. Beberapa warga, terutama " +
      "lansia dan anak-anak, mulai mengalami batuk dan sesak napas. Dikhawatirkan " +
      "kegiatan ini juga membakar sampah jenis B3 seperti plastik PVC dan baterai bekas.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.PENDING,
    lat:       2.9969,
    lng:       117.3616,
    province:  "Kalimantan Utara",
    city:      "Kabupaten Bulungan",
    district:  "Tanjung Selor",
    village:   "Tanjung Selor Hilir",
    userIndex: 3,
    daysAgo:   2,
  },
  {
    title: "Limbah Medis Dibuang Sembarangan di Pasar",
    description:
      "Ditemukan kantong-kantong plastik berisi limbah medis seperti sarung tangan " +
      "bekas, kapas berdarah, dan vial obat di area belakang Pasar Tradisional Segiri. " +
      "Limbah tersebut bercampur dengan sampah organik pasar sehingga sulit dipilah. " +
      "Petugas kebersihan pasar yang menemukannya khawatir terpapar infeksi. " +
      "Diduga limbah berasal dari klinik atau apotek tidak jauh dari lokasi yang membuang " +
      "limbah B3 secara ilegal untuk menghindari biaya pengolahan resmi.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.IN_REVIEW,
    lat:       -0.5022,
    lng:       117.1536,
    province:  "Kalimantan Timur",
    city:      "Kota Samarinda",
    district:  "Samarinda Ulu",
    village:   "Air Hitam",
    address:   "Belakang Pasar Segiri, Jalan Bhayangkara",
    userIndex: 4,
    daysAgo:   4,
  },
  {
    title: "Tumpukan Sampah di Selokan Sebabkan Bau Busuk dan Penyakit",
    description:
      "Selokan di sepanjang Jalan Ahmad Yani Km 5 dipenuhi tumpukan sampah yang " +
      "membusuk, menyumbat aliran air, dan menimbulkan bau menyengat. Warga sekitar " +
      "mengeluhkan munculnya kasus diare berulang yang diduga berkaitan dengan " +
      "kontaminasi air sumur akibat rembesan dari selokan yang meluap. " +
      "Kondisi ini semakin parah di musim hujan. Pemeliharaan rutin yang seharusnya " +
      "dilakukan Dinas PUPR tidak terlihat selama lebih dari 6 bulan terakhir.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.RESOLVED,
    lat:       -3.3220,
    lng:       114.5924,
    province:  "Kalimantan Selatan",
    city:      "Kota Banjarmasin",
    district:  "Banjarmasin Timur",
    village:   "Karang Mekar",
    address:   "Jalan Ahmad Yani KM 5",
    userIndex: 1,
    daysAgo:   14,
  },
  {
    title: "Pencemaran Sungai akibat Tambak Udang Ilegal",
    description:
      "Tambak udang tidak berizin yang beroperasi di sempadan Sungai Musi membuang " +
      "air limbah kaya amonia langsung ke badan sungai tanpa melalui IPAL. " +
      "Konsentrasi amonia yang tinggi menyebabkan kematian ikan massal di sekitar " +
      "muara sungai dan mengganggu mata pencaharian nelayan tradisional. " +
      "Kualitas air sungai yang menurun juga berdampak pada warga yang masih " +
      "menggunakan air sungai untuk kebutuhan sehari-hari.",
    category:  ReportCategory.WASTE,
    status:    ReportStatus.IN_PROGRESS,
    lat:       -2.9831,
    lng:       104.7542,
    province:  "Sumatera Selatan",
    city:      "Kota Palembang",
    district:  "Gandus",
    village:   "Karang Anyar",
    address:   "Sempadan Sungai Musi, Kelurahan Karang Anyar",
    userIndex: 8,
    daysAgo:   9,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🚧  INFRASTRUKTUR (INFRA)
  // ══════════════════════════════════════════════════════════════════════════════

  {
    title: "Jalan Berlubang Besar di Jalur Utama Kecamatan",
    description:
      "Terdapat lubang berdiameter sekitar 1,5 meter dan kedalaman 30 cm di " +
      "Jalan Raya Margahayu yang merupakan jalur utama kecamatan. Lubang ini sangat " +
      "membahayakan pengguna sepeda motor, terutama di malam hari ketika penerangan " +
      "jalan minim. Sudah terjadi dua kecelakaan dalam seminggu terakhir akibat " +
      "pengendara tidak menyadari lubang tersebut. Butuh perbaikan segera sebelum " +
      "korban bertambah.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.PENDING,
    lat:       -6.9745,
    lng:       107.6304,
    province:  "Jawa Barat",
    city:      "Kabupaten Bandung",
    district:  "Margahayu",
    village:   "Margahayu Tengah",
    address:   "Jalan Raya Margahayu, depan SDN Margahayu 1",
    userIndex: 1,
    daysAgo:   2,
  },
  {
    title: "Lampu Penerangan Jalan Mati di Kawasan Rawan Kriminal",
    description:
      "Sebanyak 12 titik lampu penerangan jalan umum (PJU) di Jalan Letjen Suprapto " +
      "padam sejak 3 minggu lalu. Kondisi ini sangat mengkhawatirkan warga karena " +
      "kawasan tersebut dikenal rawan tindak kriminal seperti penodongan dan " +
      "penjambretan. Beberapa pedagang kaki lima yang biasa berjualan malam hari " +
      "terpaksa berhenti beroperasi. Warga berharap Dinas Perhubungan segera " +
      "melakukan perbaikan.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.IN_REVIEW,
    lat:       -6.1863,
    lng:       106.8454,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Pusat",
    district:  "Cempaka Putih",
    village:   "Rawasari",
    address:   "Jalan Letjen Suprapto, antara Bundaran Senen dan RS Carolus",
    userIndex: 5,
    daysAgo:   5,
  },
  {
    title: "Trotoar Rusak dan Berbahaya bagi Pejalan Kaki",
    description:
      "Trotoar di sepanjang Jalan Malioboro sisi timur mengalami kerusakan parah. " +
      "Paving block banyak yang lepas dan mencuat, menciptakan jebakan tersandung " +
      "yang berbahaya khususnya bagi lansia dan penyandang disabilitas. " +
      "Di beberapa titik bahkan terdapat lubang menganga hingga 20 cm. " +
      "Mengingat kawasan ini adalah destinasi wisata utama, kondisi trotoar yang " +
      "buruk juga berdampak negatif terhadap citra pariwisata kota.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.RESOLVED,
    lat:       -7.7928,
    lng:       110.3672,
    province:  "DI Yogyakarta",
    city:      "Kota Yogyakarta",
    district:  "Gedongtengen",
    village:   "Sosromenduran",
    address:   "Jalan Malioboro, sisi timur (depan Ramai Mall)",
    userIndex: 5,
    daysAgo:   20,
  },
  {
    title: "Jembatan Gantung Lapuk Putus Saat Dilintasi Warga",
    description:
      "Jembatan gantung kayu yang menghubungkan Dusun Cimaung dengan pusat desa " +
      "putus tiba-tiba saat dilewati dua orang warga. Beruntung keduanya hanya " +
      "mengalami luka ringan. Jembatan tersebut merupakan satu-satunya akses penyeberangan " +
      "sungai bagi warga dua dusun. Material kayu sudah lapuk dan kabel penopang " +
      "berkarat namun tidak pernah diganti sejak dibangun 15 tahun lalu. " +
      "Warga kini harus memutar ±8 km atau menyeberang sungai dengan rakit darurat.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.IN_PROGRESS,
    lat:       -7.0833,
    lng:       107.5560,
    province:  "Jawa Barat",
    city:      "Kabupaten Bandung",
    district:  "Cimaung",
    village:   "Cikalong",
    userIndex: 9,
    daysAgo:   4,
  },
  {
    title: "Tiang Listrik Miring Mengancam Keselamatan Warga",
    description:
      "Sebuah tiang listrik PLN di pertigaan Jalan Kelapa Dua miring sekitar 30 derajat " +
      "pasca ditabrak kendaraan truk dua minggu lalu. Kabel listrik ikut terkulai " +
      "mendekati permukaan jalan dan berisiko menyebabkan kecelakaan atau kebakaran. " +
      "Warga sudah memasang tali pembatas darurat, namun penanganan permanen dari PLN " +
      "belum kunjung datang meski sudah dilaporkan berkali-kali.",
    category:  ReportCategory.INFRA,
    status:    ReportStatus.IN_REVIEW,
    lat:       -6.3610,
    lng:       106.7770,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Barat",
    district:  "Kebon Jeruk",
    village:   "Kelapa Dua",
    address:   "Pertigaan Jalan Kelapa Dua, dekat Alfamart",
    userIndex: 0,
    daysAgo:   7,
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 🔇  GANGGUAN KETERTIBAN (DISTURB)
  // ══════════════════════════════════════════════════════════════════════════════

  {
    title: "Kebisingan Mesin Proyek Konstruksi Melampaui Batas Jam Kerja",
    description:
      "Proyek pembangunan apartemen di sudut Jalan Gatot Subroto beroperasi melampaui " +
      "jam kerja yang diizinkan, bahkan kerap berlanjut hingga pukul 01.00 dini hari. " +
      "Kebisingan mesin pile driver mencapai 85–90 dB dan getarannya terasa hingga " +
      "radius 200 meter, menyebabkan warga sekitar tidak bisa tidur dengan nyenyak. " +
      "Beberapa bayi dan balita mengalami gangguan tidur serius. Warga meminta " +
      "penertiban jam operasional sesuai Perda yang berlaku.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.IN_REVIEW,
    lat:       -6.2350,
    lng:       106.8082,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Selatan",
    district:  "Mampang Prapatan",
    village:   "Tegal Parang",
    address:   "Jalan Gatot Subroto, dekat Flyover Pancoran",
    userIndex: 0,
    daysAgo:   3,
  },
  {
    title: "PKL Liar Tutup Akses Trotoar dan Jalan Masuk Sekolah",
    description:
      "Pedagang kaki lima berjumlah lebih dari 40 orang menguasai trotoar dan " +
      "bahu jalan di depan SDN Ragunan 01. Situasi ini menyebabkan kemacetan parah " +
      "setiap pagi saat jam masuk dan pulang sekolah. Anak-anak terpaksa berjalan " +
      "di badan jalan karena trotoar sepenuhnya tertutup lapak dagangan. " +
      "Upaya penertiban sudah dilakukan dua kali namun PKL selalu kembali berjualan " +
      "di lokasi yang sama sehari setelah ditertibkan.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.PENDING,
    lat:       -6.3118,
    lng:       106.8218,
    province:  "DKI Jakarta",
    city:      "Kota Jakarta Selatan",
    district:  "Pasar Minggu",
    village:   "Ragunan",
    address:   "Depan SDN Ragunan 01, Jalan Harsono RM",
    userIndex: 8,
    daysAgo:   1,
  },
  {
    title: "Balap Liar Setiap Malam di Jalan Lingkar",
    description:
      "Kegiatan balap liar motor secara rutin berlangsung di Jalan Lingkar Utara " +
      "setiap Jumat dan Sabtu malam mulai pukul 23.00. Peserta berjumlah ratusan " +
      "orang mengakibatkan kemacetan total dan kebisingan ekstrem hingga pukul 03.00. " +
      "Aksi ini sangat berbahaya karena dilakukan di jalan umum tanpa pengamanan. " +
      "Sudah terjadi tiga kecelakaan dalam dua bulan terakhir, salah satunya " +
      "mengakibatkan korban patah tulang serius.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.IN_REVIEW,
    lat:       -8.6574,
    lng:       115.2166,
    province:  "Bali",
    city:      "Kota Denpasar",
    district:  "Denpasar Barat",
    village:   "Pemecutan",
    address:   "Jalan Lingkar Utara Denpasar",
    userIndex: 7,
    daysAgo:   6,
  },
  {
    title: "Pesta Miras Ilegal Ganggu Ketenangan Lingkungan",
    description:
      "Setiap akhir pekan, sekelompok pemuda menggelar pesta minuman keras di area " +
      "taman lingkungan RT 08. Mereka seringkali membuat keributan, membuang botol " +
      "minuman sembarangan, dan mengganggu warga yang melintas. Orang tua khawatir " +
      "terhadap keselamatan anak-anak mereka. Warga sudah menegur secara langsung " +
      "namun mendapat respons yang tidak sopan. Diperlukan patroli rutin dari " +
      "aparat keamanan setempat.",
    category:  ReportCategory.DISTURB,
    status:    ReportStatus.RESOLVED,
    lat:       -7.5666,
    lng:       110.8316,
    province:  "Jawa Tengah",
    city:      "Kabupaten Karanganyar",
    district:  "Jaten",
    village:   "Ngringo",
    address:   "Taman Lingkungan RT 08/RW 04",
    userIndex: 6,
    daysAgo:   15,
  },
];

// ─── Main Seed Function ────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  Memulai proses seeding database...\n");

  // 1. Hapus data lama (urutan penting karena foreign key)
  console.log("🗑️   Membersihkan data lama...");
  await prisma.reportJoin.deleteMany();
  await prisma.report.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
  console.log("     ✓ Data lama dihapus.\n");

  // 2. Buat user
  console.log("👤  Membuat pengguna...");
  const hashedPassword = await bcrypt.hash("password123", 10);
  const createdUsers = await Promise.all(
    USERS.map((u) =>
      prisma.user.create({
        data: {
          name:     u.name,
          email:    u.email,
          password: hashedPassword,
          role:     u.role,
          city:     u.city,
        },
      })
    )
  );
  console.log(`     ✓ ${createdUsers.length} pengguna dibuat.\n`);

  // 3. Buat laporan
  console.log("📋  Membuat laporan...");
  let reportCount = 0;
  for (const r of REPORTS) {
    const createdAt = new Date(Date.now() - r.daysAgo * 86_400_000);
    await prisma.report.create({
      data: {
        title:       r.title,
        description: r.description,
        category:    r.category,
        status:      r.status,
        lat:         r.lat,
        lng:         r.lng,
        province:    r.province,
        city:        r.city,
        district:    r.district,
        village:     r.village,
        address:     r.address ?? null,
        imageUrl:    null, // set ke URL gambar nyata jika ada
        userId:      createdUsers[r.userIndex].id,
        createdAt,
        updatedAt:   createdAt,
      },
    });
    reportCount++;
    console.log(`     [${reportCount}/${REPORTS.length}] ✓ "${r.title}"`);
  }

  console.log(`\n✅  Seeding selesai!`);
  console.log(`    👤 Pengguna   : ${createdUsers.length}`);
  console.log(`    📋 Laporan    : ${reportCount}`);
  console.log(`\n🔑  Kredensial login (semua password: password123)`);
  console.log(`    Citizen  → budi@example.com`);
  console.log(`    Officer  → officer1@example.com`);
  console.log(`    Admin    → admin@example.com`);
}

main()
  .catch((e) => {
    console.error("❌  Seeding gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });