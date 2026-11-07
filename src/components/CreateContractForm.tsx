import React, { useState, useEffect } from 'react';
import { FileText, Send, CheckCircle, AlertCircle, RefreshCw, HelpCircle, FileCheck } from 'lucide-react';
import { Contract } from '../types';

interface CreateContractFormProps {
  onSubmit: (data: {
    name: string;
    contractNumber: string;
    partnerName: string;
    value: string;
    signDate: string;
    effectiveDate: string;
    googleDocsLink: string;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    deliveryNotes?: string;
    processingMethod: 'physical' | 'digital';
    printCopies?: number;
  }) => Promise<void>;
  checkContractId: (id: string) => Promise<boolean>;
  onCancel?: () => void;
  isUploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  setUploadError: (err: string | null) => void;
  uploadedFileDetails: Contract | null;
  setUploadedFileDetails: (c: Contract | null) => void;
}

export function CreateContractForm({
  onSubmit,
  checkContractId,
  onCancel,
  isUploading,
  uploadProgress,
  uploadError,
  setUploadError,
  uploadedFileDetails,
  setUploadedFileDetails
}: CreateContractFormProps) {
  // Form fields
  const [name, setName] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [value, setValue] = useState('');
  const [signDate, setSignDate] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [googleDocsLink, setGoogleDocsLink] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [processingMethod, setProcessingMethod] = useState<'physical' | 'digital'>('physical');
  const [printCopies, setPrintCopies] = useState<number>(2);

  // Real-time Validation States
  const [idChecking, setIdChecking] = useState(false);
  const [idExists, setIdExists] = useState<boolean | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Check ID Uniqueness
  const handleCheckId = async (idVal: string) => {
    const trimmed = idVal.trim();
    if (!trimmed) {
      setIdExists(null);
      return;
    }
    setIdChecking(true);
    try {
      const exists = await checkContractId(trimmed);
      setIdExists(exists);
    } catch (e) {
      console.error(e);
      setIdExists(null);
    } finally {
      setIdChecking(false);
    }
  };

  // Debounced check on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contractNumber) {
        handleCheckId(contractNumber);
      } else {
        setIdExists(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [contractNumber]);

  // Validate VN Phone
  const validatePhone = (phoneVal: string) => {
    if (!phoneVal) {
      setPhoneError('Số điện thoại không được để trống');
      return false;
    }
    if (phoneVal === '-') {
      setPhoneError(null);
      return true;
    }
    const vnPhoneRegex = /^(0[35789]\d{8})$/;
    if (!vnPhoneRegex.test(phoneVal)) {
      setPhoneError('SĐT không đúng định dạng VN (phải gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09) hoặc điền -');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  const handlePhoneBlur = () => {
    validatePhone(receiverPhone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setUploadError(null);

    // Validate ID first
    if (!contractNumber.trim()) {
      setUploadError('Vui lòng điền mã hợp đồng');
      return;
    }
    if (idExists === true) {
      setUploadError('Mã hợp đồng đã tồn tại trong hệ thống. Vui lòng đổi mã khác.');
      return;
    }

    // Validate fields
    if (!name.trim() || !partnerName.trim()) {
      setUploadError('Vui lòng điền đầy đủ thông tin pháp lý bắt buộc');
      return;
    }

    if (!googleDocsLink.trim()) {
      setUploadError('Vui lòng điền đường dẫn Google Docs');
      return;
    }

    if (!receiverName.trim() || !receiverAddress.trim()) {
      setUploadError('Vui lòng điền đầy đủ thông tin người nhận & địa chỉ giao nhận');
      return;
    }

    const isPhoneValid = validatePhone(receiverPhone);
    if (!isPhoneValid) {
      setUploadError('Số điện thoại người nhận không hợp lệ');
      return;
    }

    if (processingMethod === 'physical' && (!printCopies || printCopies <= 0)) {
      setUploadError('Số lượng bản in hợp đồng giấy phải lớn hơn 0');
      return;
    }

    // Call submit
    await onSubmit({
      name,
      contractNumber,
      partnerName,
      value,
      signDate,
      effectiveDate,
      googleDocsLink,
      receiverName,
      receiverPhone,
      receiverAddress,
      deliveryNotes: deliveryNotes || undefined,
      processingMethod,
      printCopies: processingMethod === 'physical' ? Number(printCopies) : undefined
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100/80 shadow-xs space-y-6" id="legal-contract-create-container">
      {/* Form Title & Role Tag */}
      <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-4">
        <div>
          <span className="bg-blue-50 text-blue-750 border border-blue-200/80 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
            Pháp chế (Legal)
          </span>
          <h2 className="text-base font-extrabold text-slate-900 mt-2 font-sans tracking-tight">Khởi tạo quy trình trình ký &amp; số hóa hợp đồng</h2>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed font-medium">
            Điền đầy đủ thông tin pháp lý, bưu cục giao nhận và quy cách xử lý. Đường dẫn Google Docs sẽ liên kết hồ sơ của bạn với quy trình số hóa hai chiều.
          </p>
        </div>
        <span className="text-[10px] text-slate-500 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/50 font-mono hidden sm:inline-block">
          Quản lý vòng đời bưu phẩm
        </span>
      </div>

      {/* Progress & Feedback Panels */}
      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2 animate-in fade-in duration-150" id="create-error-panel">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
            <div>
              <h4 className="font-bold text-rose-800 uppercase text-[10px] tracking-wider">🔴 Có lỗi xảy ra</h4>
              <p className="text-slate-700 leading-relaxed font-medium mt-0.5">{uploadError}</p>
            </div>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3" id="create-progress-panel">
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center w-10 h-10">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-ping" />
              <RefreshCw className="text-emerald-600 animate-spin" size={20} />
            </div>
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <div className="text-[10px] font-bold text-slate-800 uppercase tracking-widest font-mono">
              Tiến trình khởi tạo: <span className="text-emerald-600 font-black">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {uploadProgress < 40 ? "Đang lưu cấu hình dữ liệu và kiểm tra bưu phẩm..." :
               uploadProgress < 80 ? "Đang đẩy dữ liệu sang Drive và liên thông webhook Teams..." :
               "Hoàn tất! Đang làm mới dữ liệu..."}
            </p>
          </div>
        </div>
      )}

      {uploadedFileDetails && (
        <div className="bg-emerald-50/70 border border-emerald-150 rounded-xl p-4 text-xs space-y-3 animate-in fade-in duration-150" id="create-success-panel">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <span className="text-emerald-800 font-black flex items-center gap-1.5 uppercase font-mono">
              <CheckCircle size={14} className="text-emerald-600" />
              Khởi tạo quy trình thành công: #{uploadedFileDetails.contractNumber}
            </span>
            <button 
              onClick={() => setUploadedFileDetails(null)}
              className="text-slate-400 hover:text-slate-600 font-bold"
            >
              Đóng thông báo
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700">
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Tên hợp đồng</p>
              <p className="font-semibold text-slate-800 truncate mt-0.5">{uploadedFileDetails.name}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Đối tác</p>
              <p className="font-semibold text-slate-800 truncate mt-0.5">{uploadedFileDetails.partnerName}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Luồng bưu gửi</p>
              <p className="font-semibold text-slate-800 mt-0.5 uppercase tracking-wide">
                {uploadedFileDetails.processingMethod === 'digital' ? 'Chỉ Scan' : 'In & Gửi'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Creation Form */}
      {!isUploading && (
        <form onSubmit={handleSubmit} className="space-y-6" id="legal-contract-create-form">
          {/* Section 1: Hợp đồng & Pháp lý */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
              Ⅰ. Thông tin hợp đồng &amp; Pháp lý
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Google Docs Link */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
                  Đường dẫn Google Docs Hợp đồng <span className="text-rose-500">*</span>
                  <span title="Nhập link Google Docs bản thảo hợp đồng để tiến hành số hóa liên thông" className="cursor-help inline-flex items-center">
                    <HelpCircle size={11} className="text-slate-400" />
                  </span>
                </label>
                <input 
                  type="url" 
                  required
                  placeholder="https://docs.google.com/document/d/... (Dán link Google Docs)" 
                  value={googleDocsLink}
                  onChange={(e) => setGoogleDocsLink(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* ID Hợp đồng */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Mã Hợp Đồng (ID hệ thống phát số) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: HD-2026-009A" 
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    className={`w-full bg-slate-50/50 border rounded-lg p-2.5 pr-8 text-xs font-mono focus:outline-none focus:bg-white transition ${
                      idExists === true ? 'border-rose-300 focus:border-rose-400' :
                      idExists === false ? 'border-emerald-300 focus:border-emerald-400' :
                      'border-slate-200 focus:border-slate-400'
                    }`}
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {idChecking ? (
                      <RefreshCw className="text-slate-400 animate-spin" size={12} />
                    ) : idExists === true ? (
                      <span title="Mã hợp đồng đã tồn tại!" className="inline-flex items-center">
                        <AlertCircle className="text-rose-500" size={14} />
                      </span>
                    ) : idExists === false ? (
                      <span title="Mã hợp đồng khả dụng" className="inline-flex items-center">
                        <CheckCircle className="text-emerald-500" size={14} />
                      </span>
                    ) : null}
                  </div>
                </div>
                {idExists === true && (
                  <p className="text-[10px] font-medium text-rose-600">❌ Mã hợp đồng đã tồn tại trong hệ thống. Vui lòng sử dụng mã duy nhất.</p>
                )}
                {idExists === false && (
                  <p className="text-[10px] font-medium text-emerald-600">✓ Mã hợp đồng hợp lệ (chưa tồn tại).</p>
                )}
              </div>

              {/* Tên hợp đồng */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Tên hợp đồng <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Hợp đồng Thuê Máy chủ Cloud" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* Tên đối tác */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Tên đối tác <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Tổng Công ty Viễn thông Viettel" 
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* Ngày ký */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Ngày ký đề xuất</label>
                <input 
                  type="date" 
                  value={signDate}
                  onChange={(e) => setSignDate(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* Ngày hiệu lực */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Ngày hiệu lực dự kiến <span className="text-rose-500">*</span></label>
                <input 
                  type="date" 
                  required
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Giao nhận bưu điện */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
              Ⅱ. Thông tin giao nhận (bắt buộc)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tên người nhận */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Tên người nhận (đối tác) <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Nguyễn Văn A" 
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* SĐT người nhận */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Số điện thoại nhận hàng <span className="text-rose-500">*</span></label>
                <input 
                  type="tel" 
                  required
                  placeholder="Ví dụ: 0912345678" 
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  className={`w-full bg-slate-50/50 border rounded-lg p-2.5 text-xs focus:outline-none focus:bg-white transition ${
                    phoneError ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200 focus:border-slate-400'
                  }`}
                />
                {phoneError && (
                  <p className="text-[10px] font-medium text-rose-600">{phoneError}</p>
                )}
              </div>

              {/* Địa chỉ chi tiết */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Địa chỉ nhận hàng chi tiết <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Tầng 12, Tòa nhà Viettel, 285 Cách Mạng Tháng Tám, Quận 10, TP. Hồ Chí Minh" 
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>

              {/* Ghi chú giao hàng */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Ghi chú bưu tá giao hàng</label>
                <textarea 
                  rows={2}
                  placeholder="Ví dụ: Hợp đồng quan trọng, bưu tá vui lòng cho ký nhận hai chiều đồng kiểm." 
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-slate-400 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Quy cách xử lý */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
              Ⅲ. Quy cách xử lý &amp; số bản in
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/40 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-600 uppercase block">Chọn luồng vận hành quy trình <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Physical */}
                  <label className={`p-3.5 rounded-xl border flex flex-col justify-between h-24 cursor-pointer transition select-none bg-white hover:border-slate-300 ${
                    processingMethod === 'physical' 
                      ? 'ring-2 ring-emerald-500 border-transparent shadow-xs' 
                      : 'border-slate-200/50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-xs font-extrabold text-slate-800 block">In &amp; Gửi</span>
                        <p className="text-[10px] text-slate-500 leading-tight">Văn thư in bưu gửi giấy (mặc định 2 bản), trình Giám đốc ký tay, gửi bưu tá Viettel Post giao khách hàng, nhận trả bản gốc scan lưu kho.</p>
                      </div>
                      <input 
                        type="radio" 
                        name="processingMethod" 
                        value="physical"
                        checked={processingMethod === 'physical'}
                        onChange={() => setProcessingMethod('physical')}
                        className="mt-0.5 animate-pulse"
                      />
                    </div>
                  </label>

                  {/* Option 2: Digital Scan-only */}
                  <label className={`p-3.5 rounded-xl border flex flex-col justify-between h-24 cursor-pointer transition select-none bg-white hover:border-slate-300 ${
                    processingMethod === 'digital' 
                      ? 'ring-2 ring-emerald-500 border-transparent shadow-xs' 
                      : 'border-slate-200/50'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-xs font-extrabold text-slate-800 block flex items-center gap-1">
                          Chỉ Scan
                        </span>
                        <p className="text-[10px] text-slate-500 leading-tight">Hợp đồng điện tử hoặc đối tác tự xử lý in ấn ký trước. Bỏ qua tất cả các bước in, ký nội bộ, giao nhận. Chuyển thẳng bước số hóa PDF.</p>
                      </div>
                      <input 
                        type="radio" 
                        name="processingMethod" 
                        value="digital"
                        checked={processingMethod === 'digital'}
                        onChange={() => setProcessingMethod('digital')}
                        className="mt-0.5 animate-pulse"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {/* Conditional print quantities */}
              {processingMethod === 'physical' && (
                <div className="p-3.5 bg-white border border-slate-200/50 rounded-xl space-y-2 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <label className="text-xs font-extrabold text-slate-800 block">Số lượng bản thảo cần in ấn bưu gửi giấy <span className="text-rose-500">*</span></label>
                      <p className="text-[10px] text-slate-400 font-medium">Bao gồm bản lưu Văn phòng pháp chế + số lượng bản giao đối tác ký tay.</p>
                    </div>
                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                      <button 
                        type="button"
                        onClick={() => setPrintCopies(Math.max(1, printCopies - 1))}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 font-bold flex items-center justify-center text-sm cursor-pointer select-none"
                      >
                        -
                      </button>
                      <input 
                        type="number" 
                        required
                        min="1"
                        max="20"
                        value={printCopies}
                        onChange={(e) => setPrintCopies(Math.max(1, Number(e.target.value)))}
                        className="w-12 h-8 rounded-lg border border-slate-200/60 text-center font-bold text-xs focus:outline-none"
                      />
                      <button 
                        type="button"
                        onClick={() => setPrintCopies(Math.min(20, printCopies + 1))}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-700 font-bold flex items-center justify-center text-sm cursor-pointer select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            {onCancel && (
              <button 
                type="button" 
                onClick={onCancel} 
                className="px-4 py-2 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button 
              type="submit" 
              disabled={idExists === true || idChecking}
              className={`px-6 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-sm ${
                idExists === true || idChecking
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Send size={13} />
              Xác nhận Khởi tạo Quy trình
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
