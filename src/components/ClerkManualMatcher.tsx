import React, { useState, useRef } from 'react';
import { Search, FileText, Upload, Check, AlertCircle, FileCheck, Trash2, ArrowRight } from 'lucide-react';
import { Contract } from '../types';

interface ClerkManualMatcherProps {
  contracts: Contract[];
  onUploadScan: (contractId: string, file: File) => Promise<void>;
  isUploading: boolean;
}

export const ClerkManualMatcher: React.FC<ClerkManualMatcherProps> = ({
  contracts,
  onUploadScan,
  isUploading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchId, setSearchId] = useState('');
  const [matchedContract, setMatchedContract] = useState<Contract | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out archived/completed contracts or let them match any active contract
  const activeContracts = contracts.filter(c => c.status !== 'Hoàn tất' && c.status !== 'Đã hủy');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchId(val);

    if (!val.trim()) {
      setMatchedContract(null);
      return;
    }

    // Try to find a exact or partial match of ContractNumber
    const matched = contracts.find(
      c => c.contractNumber.toLowerCase().trim() === val.toLowerCase().trim()
    );
    setMatchedContract(matched || null);
  };

  const handleSelectContractFromDropdown = (contract: Contract) => {
    setMatchedContract(contract);
    setSearchId(contract.contractNumber);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        setSelectedFile(file);
      } else {
        alert("Vui lòng tải lên tệp PDF hoặc ảnh scan hợp lệ");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleMatchAndUpload = async () => {
    setErrorMessage('');
    if (!matchedContract) {
      setErrorMessage("Vui lòng chọn hoặc nhập mã hợp đồng hợp lệ trước.");
      return;
    }
    if (!selectedFile) {
      setErrorMessage("Vui lòng đăng tải tệp bản quét PDF ký.");
      return;
    }

    try {
      await onUploadScan(matchedContract.id, selectedFile);
      // Clear form on success
      setSelectedFile(null);
      setSearchId('');
      setMatchedContract(null);
    } catch (err: any) {
      setErrorMessage(err.message || "Đã xảy ra lỗi khi tải lên bản scan");
    }
  };

  // Quick select contracts needing scan
  const contractsNeedingScan = activeContracts.filter(c => c.status === 'Chờ bản gửi lại');

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5" id="clerk-manual-matcher">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Upload size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-sans">Trạm Đăng tải Scan &amp; Liên kết Mã Hợp đồng Thủ công</h3>
            <p className="text-[11px] text-slate-400">Dành cho văn thư đối khớp thủ công bản scan PDF đã có sẵn trong máy tính</p>
          </div>
        </div>
      </div>

      {/* CLERK TOOL SELECTION GUIDANCE BANNER */}
      <div className="bg-gradient-to-r from-slate-50 to-emerald-50/50 p-3.5 rounded-xl border border-emerald-100/80 text-xs space-y-1.5">
        <span className="font-extrabold text-emerald-900 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
          <FileCheck size={14} className="text-emerald-600" />
          💡 Hướng dẫn chọn công cụ số hóa dành cho Văn thư (Clerk)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
          <div className="bg-white p-2 rounded-lg border border-emerald-200/60 shadow-2xs">
            <p className="font-bold text-emerald-800">📁 1. Tải Lên Bản Quét PDF Có Sẵn (Đang dùng)</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Dùng khi bạn <b>đã scan sẵn file PDF</b> từ máy photocopy/máy quét chuyên dụng vào máy tính, chỉ cần chọn tệp &amp; chọn mã Hợp đồng.</p>
          </div>
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-800">📸 2. Camera AI Scanner (Chụp trực tiếp)</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Dùng khi bạn cầm bản cứng hợp đồng vật lý &amp; muốn <b>dùng camera điện thoại/webcam chụp trực tiếp</b> từng trang để AI tự động xoay lật ghép file.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column: ID Match search */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-slate-700 font-bold text-[11px] uppercase tracking-wider">
              1. Tìm kiếm và Khớp Mã Hợp Đồng (ID)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={searchId}
                onChange={handleSearchChange}
                placeholder="Nhập chính xác ID hợp đồng (ví dụ: HD-2026-...)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-mono focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 text-slate-900 font-bold"
              />
            </div>
          </div>

          {/* Real-time Validation Feedback */}
          {searchId.trim() && (
            <div className="p-3 rounded-xl border text-xs transition-all duration-200">
              {matchedContract ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                    <Check size={14} className="stroke-[3]" />
                    <span>Tìm thấy hợp đồng khớp ID!</span>
                  </div>
                  <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100 space-y-1 text-[11px] text-slate-700">
                    <p className="font-extrabold text-slate-900">📄 {matchedContract.name}</p>
                    <p>🤝 Đối tác: <strong>{matchedContract.partnerName}</strong></p>
                    <p>⚙️ Trạng thái: 
                      <span className="ml-1 bg-slate-200/80 text-slate-800 px-1.5 py-0.5 rounded font-bold text-[9px]">
                        {matchedContract.status}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-amber-600 font-medium">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>Không tìm thấy hợp đồng nào có mã số khớp hoàn toàn. Hãy kiểm tra lại hoặc chọn từ danh sách bên dưới.</span>
                </div>
              )}
            </div>
          )}

          {/* Quick List dropdown / suggestions of contracts waiting for Scan */}
          {contractsNeedingScan.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Hồ sơ đang đợi nộp bản Scan ({contractsNeedingScan.length})
              </span>
              <div className="max-h-28 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 bg-slate-50/40">
                {contractsNeedingScan.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectContractFromDropdown(c)}
                    className="w-full px-3 py-2 text-left text-[11px] hover:bg-emerald-50 hover:text-emerald-900 flex justify-between items-center transition cursor-pointer"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono font-bold text-slate-600 bg-white px-1 py-0.2 rounded border border-slate-200 mr-1.5">
                        {c.contractNumber}
                      </span>
                      <span className="font-medium text-slate-700">{c.name}</span>
                    </div>
                    <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 shrink-0">
                      Đợi scan
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Drag & Drop PDF upload */}
        <div className="space-y-4">
          <span className="block text-slate-700 font-bold text-[11px] uppercase tracking-wider">
            2. Đính kèm tệp Bản Scan Ký tay (PDF)
          </span>

          {!selectedFile ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 select-none h-40 ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-slate-100 rounded-full text-slate-400 group-hover:scale-110 transition duration-150">
                <FileText size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Kéo thả tệp hoặc Nhấp để chọn</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ định dạng .pdf, .jpg, .png bản scan ký tay</p>
              </div>
            </div>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50/30 rounded-2xl p-4 flex items-center justify-between gap-3 h-40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileCheck size={24} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-xs font-bold text-slate-800 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-[10px] text-slate-505 font-mono">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • PDF Scan
                  </p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer shrink-0"
                title="Gỡ bỏ tệp"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Matching confirmation button */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex justify-end pt-3 border-t border-slate-100">
        <button
          onClick={handleMatchAndUpload}
          disabled={isUploading || !matchedContract || !selectedFile}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isUploading || !matchedContract || !selectedFile
              ? 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-md'
          }`}
        >
          {isUploading ? (
            <>
              <div className="w-4.5 h-4.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
              <span>Đang liên kết &amp; bóc tách AI...</span>
            </>
          ) : (
            <>
              <span>Liên kết &amp; Hoàn tất Số hóa bản Scan</span>
              <ArrowRight size={13} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
