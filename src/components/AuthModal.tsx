import React, { useState } from 'react';
import { AlertTriangle, Mail, Lock, Shield, Loader2 } from 'lucide-react';

interface AuthModalProps {
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authError: string;
  handleSignIn: (email: string, password: string) => Promise<void> | void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  showAuthModal,
  setShowAuthModal,
  authEmail,
  setAuthEmail,
  authError,
  handleSignIn,
}) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !password) return;
    setIsSubmitting(true);
    try {
      await handleSignIn(authEmail.trim(), password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-250">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        id="auth-dialog"
      >
        {/* Header */}
        <div className="p-6 text-center space-y-2 border-b border-slate-100 bg-slate-50">
          <div className="flex justify-center">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100/80 shadow-xs">
              <Shield size={24} className="stroke-[2.2]" />
            </div>
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Cổng Đăng Nhập Hệ Thống Nội Bộ</h3>
          <p className="text-xs text-slate-500">Xác thực tài khoản và phân quyền bảo mật</p>
        </div>

        {/* Primary Login Form */}
        <div className="p-5 space-y-4">
          {authError && (
            <div
              data-testid="auth-error-alert"
              className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-2.5 rounded-xl font-medium flex items-center gap-1.5 leading-snug"
            >
              <AlertTriangle size={14} className="flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Email Tài Khoản
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="email"
                  required
                  name="email"
                  autoComplete="username"
                  placeholder="nhap_email@agribank.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Mật Khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="password"
                  required
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition shadow-xs cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  <Shield size={14} />
                  Đăng Nhập
                </>
              )}
            </button>

            {/* Quick Demo Fill Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bấm nhanh tài khoản demo:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('admin@dps.media');
                    setPassword('Admin@123456!');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-lg font-bold transition text-slate-700 cursor-pointer text-center"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('legal@dps.media');
                    setPassword('Legal@123456!');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-lg font-bold transition text-slate-700 cursor-pointer text-center"
                >
                  Legal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('clerk@dps.media');
                    setPassword('Clerk@123456!');
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-lg font-bold transition text-slate-700 cursor-pointer text-center"
                >
                  Clerk
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAuthModal(false)}
            className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
