// Pagar galat global: kalau ADA komponen melempar saat render, tampilkan pesan
// ramah + tombol muat ulang — BUKAN layar putih total (root kosong). Tanpa ini,
// satu error render (mis. field backend belum sinkron) membuat seluruh aplikasi
// blank. React error boundary WAJIB class component.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Cukup ke console — jangan kirim ke server (bisa memuat data sensitif).
    console.error('ErrorBoundary menangkap:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ivory p-6 text-center">
        <p className="text-4xl" aria-hidden>⚠️</p>
        <h1 className="text-lg font-bold text-primary-dark">Terjadi kesalahan tampilan</h1>
        <p className="max-w-sm text-sm text-gray-600">
          Halaman gagal ditampilkan. Ini sering terjadi bila aplikasi baru diperbarui —
          coba muat ulang. Bila tetap gagal, beri tahu admin.
        </p>
        <p className="max-w-sm break-words text-xs text-gray-400">{this.state.error.message}</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="min-h-tap rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Muat Ulang
          </button>
          <button
            onClick={() => { this.setState({ error: null }); window.location.hash = '#/'; }}
            className="min-h-tap rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700"
          >
            Ke Beranda
          </button>
        </div>
      </div>
    );
  }
}
