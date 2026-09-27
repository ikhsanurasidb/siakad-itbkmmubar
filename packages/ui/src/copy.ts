export interface ContentModel {
  actionLabel?: string;
  description: string;
  metadata?: string;
  title: string;
}

export const copy = {
  auth: {
    accountInactive:
      "Akun Anda belum dapat digunakan. Hubungi Admin Akademik untuk pemeriksaan akses.",
    invalidCredentials:
      "Gagal masuk — periksa identitas pengguna dan kata sandi, lalu coba lagi.",
    sessionExpired:
      "Sesi Anda sudah berakhir. Masuk kembali untuk melanjutkan.",
  },
  empty: {
    filtered: {
      actionLabel: "Hapus filter",
      description: "Ubah kata pencarian atau filter yang digunakan.",
      title: "Data tidak ditemukan",
    },
    students: {
      actionLabel: "Tambah mahasiswa",
      description: "Tambahkan mahasiswa secara manual atau melalui import.",
      title: "Belum ada data mahasiswa",
    },
  },
  errors: {
    forbidden: {
      description: "Peran aktif Anda tidak memiliki akses ke halaman ini.",
      title: "Akses tidak tersedia",
    },
    internal: {
      description:
        "Coba lagi. Jika masalah berlanjut, sampaikan kode referensi kepada pengelola.",
      title: "Terjadi kendala pada sistem",
    },
    network: {
      description: "Periksa koneksi internet, lalu coba lagi.",
      title: "Tidak dapat terhubung ke server",
    },
    notFound: {
      description: "Data mungkin telah dihapus atau tautan tidak lagi berlaku.",
      title: "Data tidak ditemukan",
    },
  },
} as const;
