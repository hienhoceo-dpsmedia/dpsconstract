import React, { useState } from 'react';
import { X, Calendar, Clock, DollarSign, UserCheck, AlertCircle, FileText, Send, Sparkles } from 'lucide-react';

interface CreateDraftingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  users?: Array<{ email: string; role: string; name?: string | null }>;
  defaultBasePay?: number;
  onOpenAdminSettings?: () => void;
}

export const CreateDraftingRequestModal: React.FC<CreateDraftingRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  users = [],
  defaultBasePay = 500000,
  onOpenAdminSettings,
}) => {
  const [name, setName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [value, setValue] = useState('100.000.000 VNĐ');
  const [assignedTo, setAssignedTo] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'priority' | 'urgent' | 'emergency'>('normal');
  const [draftingInstructions, setDraftingInstructions] = useState('');
  const [googleDocsLink, setGoogleDocsLink] = useState('');
  
  // Default deadline to tomorrow 17:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  const defaultDeadline = tomorrow.toISOString().slice(0, 16);
  
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Handle escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !partnerName.trim()) {
      setError('Vui lòng nhập Tên công việc/hợp đồng và Tên đối tác.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const numericBasePay = Number(defaultBasePay) || 500000;
      const deadlineIso = new Date(deadline).toISOString();

      const success = await onSubmit({
        name: name.trim(),
        contractNumber: contractNumber.trim(),
        partnerName: partnerName.trim(),
        value: value.trim(),
        assignedTo,
        basePay: numericBasePay,
        urgencyLevel,
        deadline: deadlineIso,
        draftingInstructions: draftingInstructions.trim(),
        googleDocsLink: googleDocsLink.trim()
      });

      if (success) {
        setName('');
        setContractNumber('');
        setPartnerName('');
        setValue('100.000.000 VNĐ');
        setAssignedTo('');
        setDraftingInstructions('');
        setGoogleDocsLink('');
        onClose();
      } else {
        setError('Không thể tạo yêu cầu soạn thảo. Vui lòng kiểm tra lại thông tin hoặc thử lại.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Có lỗi xảy ra khi tạo yêu cầu soạn thảo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate estimated duration & urgency
  const getUrgencyBadge = () => {
    switch (urgencyLevel) {
      case 'emergency':
        return { label: 'Khẩn cấp (+30%)', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'urgent':
        return { label: 'Gấp (+20%)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'priority':
        return { label: 'Ưu tiên (+10%)', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'normal':
      default:
        return { label: 'Bình thường (+0%)', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const urgencyBadge = getUrgencyBadge();

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full my-8 overflow-hidden cursor-default animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Tạo Yêu Cầu Soạn Thảo Hợp Đồng</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Phân công Legal &amp; Cài đặt Đơn giá nền, Deadline để tự động tính lương</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên công việc / Tên hợp đồng <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Hợp đồng nguyên tắc cung cấp dịch vụ công nghệ 2026"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên đối tác <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="VD: Công ty TNHH Giải Pháp Phần Mềm A"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mã hợp đồng (Tùy chọn - Tự động nếu trống)</label>
              <input 
                type="text" 
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Mã tự tạo hoặc VD: HD-2026-088"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giá trị ước tính</label>
              <input 
                type="text" 
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="VD: 50.000.000 VNĐ"
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pháp chế đảm nhận (Assigned Legal)</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50 cursor-pointer"
              >
                <option value="">-- Chọn nhân sự Pháp chế --</option>
                {(users || []).filter(u => u && u.role === 'legal').map(u => (
                  <option key={u.email} value={u.email}>{u.name ? `${u.name} (${u.email})` : u.email}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payroll Parameters Box */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <DollarSign size={15} className="text-emerald-600" />
                Cấu hình Đơn giá &amp; Mức độ gấp (Hệ số Lương Legal)
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${urgencyBadge.color}`}>
                {urgencyBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Đơn giá nền (VND)</span>
                  {onOpenAdminSettings ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminSettings();
                      }}
                      className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-1.5 py-0.5 rounded border border-emerald-300 transition cursor-pointer"
                      title="Chỉnh sửa đơn giá trong Cài đặt Admin"
                    >
                      ⚙️ Sửa trong Settings
                    </button>
                  ) : (
                    <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200">
                      Admin cài sẵn
                    </span>
                  )}
                </label>
                <div className="w-full px-3 py-2 border border-slate-200/80 rounded-lg text-xs font-bold font-mono text-emerald-800 bg-slate-100/90 flex items-center justify-between select-none">
                  <span>{(Number(defaultBasePay) || 500000).toLocaleString('vi-VN')} VNĐ</span>
                  <span className="text-[10px] text-slate-500 font-normal">/ task</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mức độ gấp (Urgency)
                </label>
                <select
                  value={urgencyLevel}
                  onChange={(e: any) => setUrgencyLevel(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white focus:outline-none cursor-pointer"
                >
                  <option value="normal">Bình thường (≥ 24h) [+0%]</option>
                  <option value="priority">Ưu tiên (trong ngày ≥ 3h) [+10%]</option>
                  <option value="urgent">Gấp (trong ngày &lt; 3h) [+20%]</option>
                  <option value="emergency">Khẩn cấp (≤ 1h / ngoài giờ) [+30%]</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hạn chót hoàn thành (Deadline)
                </label>
                <input 
                  type="datetime-local" 
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono font-semibold bg-white focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Detailed Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú &amp; Yêu cầu chi tiết của Quản lý cho Legal
            </label>
            <textarea 
              rows={3}
              value={draftingInstructions}
              onChange={(e) => setDraftingInstructions(e.target.value)}
              placeholder="VD: Soạn thảo theo mẫu hợp đồng nguyên tắc 2026. Chú ý các điều khoản phạt vi phạm hợp đồng tối đa 8% theo Luật Thương mại và cam kết bảo mật thông tin NDA..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Link Google Docs đề xuất / Mẫu hợp đồng (Nếu có)</label>
            <input 
              type="url" 
              value={googleDocsLink}
              onChange={(e) => setGoogleDocsLink(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy
            </button>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={14} />
              {isSubmitting ? 'Đang giao task...' : 'Gửi Yêu Cầu Soạn Thảo'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
