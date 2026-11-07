import React, { useState } from 'react';
import { X, Copy, Check, Truck, Calendar, DollarSign, Globe, Ban, AlertTriangle, Download, User, Phone, MapPin, Layers, Activity } from 'lucide-react';
import { Contract } from '../types';
import { calculateTaskPayroll } from '../utils/payroll';

// Compact QuickCopy helper for modal
const ModalCopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 px-2 py-1 rounded-md transition cursor-pointer font-sans font-semibold shrink-0"
      title="Sao chép"
    >
      {copied ? (
        <>
          <Check size={11} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-700 text-[9px]">Đã chép</span>
        </>
      ) : (
        <>
          <Copy size={10} className="text-slate-400 shrink-0" />
          <span>Sao chép</span>
        </>
      )}
    </button>
  );
};

const truncateFileName = (name: string, maxLen = 24) => {
  if (name.length <= maxLen) return name;
  const lastDotIdx = name.lastIndexOf('.');
  if (lastDotIdx === -1) {
    return name.slice(0, maxLen - 3) + '...';
  }
  const ext = name.slice(lastDotIdx);
  const baseName = name.slice(0, lastDotIdx);
  const keepLen = Math.max(5, maxLen - ext.length - 3);
  return baseName.slice(0, keepLen) + '...' + ext;
};

interface HistoryModalProps {
  showHistoryModal: boolean;
  setShowHistoryModal: (show: boolean) => void;
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  handleCancelContract?: (contractId: string, note: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  showHistoryModal,
  setShowHistoryModal,
  selectedContract,
  setSelectedContract,
  handleCancelContract,
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'legal' | 'shipping' | 'logs'>('legal');

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '-';
    return new Date(isoStr).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Chờ duyệt bản mềm': return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Chờ in': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Đang chờ ký': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Chờ tạo vận đơn': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Chờ shipper đến lấy': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Đang giao': return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'Chờ bản gửi lại': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Hoàn tất': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Đã hủy': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'Bị từ chối ký': return 'bg-red-50 text-red-850 border-red-200';
      case 'Sự cố vận chuyển': return 'bg-amber-100 text-amber-900 border-amber-300';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (!showHistoryModal || !selectedContract) return null;

  const isPhysical = selectedContract.processingMethod !== 'digital';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="contract-detail-modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200/50 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200/50 bg-slate-50/70 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                {selectedContract.contractNumber}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(selectedContract.status)}`}>
                {selectedContract.status}
              </span>
              {selectedContract.slaBreached && (
                <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded animate-pulse">
                  TRỄ SLA
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-950 text-base leading-snug">{selectedContract.name}</h3>
          </div>
          <button 
            onClick={() => {
              setShowHistoryModal(false);
              setSelectedContract(null);
            }}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex border-b border-slate-200/60 bg-slate-50/50 p-1.5 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('legal')}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'legal'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <Layers size={13} className={activeTab === 'legal' ? 'text-emerald-750' : 'text-slate-400'} />
            <span>Pháp lý &amp; Tài liệu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shipping')}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'shipping'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <Truck size={13} className={activeTab === 'shipping' ? 'text-emerald-750' : 'text-slate-400'} />
            <span>Giao nhận</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
            }`}
          >
            <Activity size={13} className={activeTab === 'logs' ? 'text-emerald-750' : 'text-slate-400'} />
            <span>Nhật ký ({selectedContract.auditLog.length})</span>
          </button>
        </div>

        {/* Modal Body (Tabbed Content) */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'legal' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* General Legal info */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/50 p-4 space-y-3.5">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                  <Layers size={14} className="text-blue-600" />
                  Thông Tin Pháp Lý &amp; Văn Bản
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="col-span-2">
                    <p className="text-slate-400 font-medium">Đối tác</p>
                    <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <span>{selectedContract.partnerName}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Ngày ký kết</p>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{selectedContract.signDate}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Ngày hiệu lực</p>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      <span>{selectedContract.effectiveDate}</span>
                    </p>
                  </div>
                </div>

                {selectedContract.googleDocsLink && (
                  <div className="border-t border-slate-200/50 pt-3 space-y-1.5 text-xs">
                    <p className="text-slate-400 font-medium">Đường dẫn Google Docs gốc</p>
                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                      <Globe size={13} className="text-slate-400 shrink-0" />
                      <a 
                        href={selectedContract.googleDocsLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-blue-600 hover:underline font-medium truncate flex-1 font-mono text-[11px]"
                      >
                        {selectedContract.googleDocsLink}
                      </a>
                      <ModalCopyButton text={selectedContract.googleDocsLink} />
                    </div>
                  </div>
                )}
              </div>

              {/* Legal Payroll & Drafting Evaluation Card */}
              {(() => {
                const payroll = calculateTaskPayroll(selectedContract);
                return (
                  <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                      <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <DollarSign size={14} className="text-emerald-600" />
                        Đánh Giá &amp; Lương Task Soạn Thảo (Legal)
                      </span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {payroll.finalPayroll.toLocaleString('vi-VN')} VNĐ
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 font-sans block">Đơn giá nền</span>
                        <span className="font-bold text-slate-800">{payroll.basePay.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 font-sans block">Hệ số gấp</span>
                        <span className="font-bold text-blue-700">+{Math.round(payroll.urgencyCoef * 100)}%</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 font-sans block">Đúng hạn</span>
                        <span className={`font-bold ${payroll.punctualCoef > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                          +{Math.round(payroll.punctualCoef * 100)}%
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 font-sans block">Chất lượng ({payroll.feedbackCount} feedback)</span>
                        <span className={`font-bold ${payroll.qualityCoef >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {payroll.qualityCoef >= 0 ? `+${Math.round(payroll.qualityCoef * 100)}%` : `${Math.round(payroll.qualityCoef * 100)}%`}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono italic bg-white/70 p-2 rounded-lg border border-emerald-100">
                      Công thức: {payroll.formulaString}
                    </div>
                  </div>
                );
              })()}

              {/* Attachments Section */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/50 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200/50 pb-2 flex items-center justify-between">
                  <span>Tài Liệu Đính Kèm ({selectedContract.files.length})</span>
                </h4>
                <div className="space-y-2">
                  {selectedContract.files.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Không có tài liệu đính kèm.</p>
                  ) : (
                    selectedContract.files.map((file) => {
                      const isScanFile = file.type === 'scan';
                      return (
                        <div key={file.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/50 text-xs">
                          <div className="space-y-0.5 truncate pr-4">
                            <p className="font-bold text-slate-800 truncate" title={file.name}>
                              {truncateFileName(file.name, 28)}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {isScanFile ? 'Bản quét ký kết (OCR)' : 'Bản gốc soạn thảo'} • {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <a 
                            href={`/api/contracts/${selectedContract.id}/files/${file.id}`} 
                            download 
                            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-2.5 py-1 rounded transition cursor-pointer shadow-2xs shrink-0"
                          >
                            <Download size={10} />
                            Tải xuống
                          </a>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Shipping Recipient Info */}
              <div className="bg-slate-50/60 rounded-xl border border-slate-200/50 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                  <Truck size={14} className="text-amber-600" />
                  Thông Tin Giao Nhận &amp; Bưu Cục
                </h4>
                
                <div className="text-xs space-y-3">
                  <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-200/50">
                    <span className="text-slate-500 font-medium">Quy cách xử lý:</span>
                    {isPhysical ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        📦 In &amp; Gửi bưu phẩm ({selectedContract.printCopies || 2} bản)
                      </span>
                    ) : (
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        💻 Lưu scan số hóa (Chỉ Scan)
                      </span>
                    )}
                  </div>

                  {isPhysical && (
                    <div className="space-y-2.5 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-slate-200/50 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Người nhận bưu phẩm</p>
                            <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <User size={13} className="text-slate-400" />
                              {selectedContract.receiverName || '-'}
                            </p>
                          </div>
                          {selectedContract.receiverName && <ModalCopyButton text={selectedContract.receiverName} />}
                        </div>

                        <div className="flex justify-between items-start border-t border-slate-100 pt-2">
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Số điện thoại</p>
                            <p className="font-bold font-mono text-slate-800 text-xs flex items-center gap-1.5">
                              <Phone size={13} className="text-slate-400" />
                              {selectedContract.receiverPhone || '-'}
                            </p>
                          </div>
                          {selectedContract.receiverPhone && <ModalCopyButton text={selectedContract.receiverPhone} />}
                        </div>

                        <div className="flex justify-between items-start border-t border-slate-100 pt-2">
                          <div className="space-y-1 flex-1 pr-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Địa chỉ chi tiết</p>
                            <p className="font-medium text-slate-700 text-xs flex items-start gap-1.5 mt-0.5 leading-relaxed">
                              <MapPin size={13} className="text-slate-400 mt-0.5 shrink-0" />
                              {selectedContract.receiverAddress || '-'}
                            </p>
                          </div>
                          {selectedContract.receiverAddress && <ModalCopyButton text={selectedContract.receiverAddress} />}
                        </div>

                        {selectedContract.deliveryNotes && (
                          <div className="bg-amber-50/50 p-2 rounded-md border border-amber-100 text-[11px] text-amber-800">
                            <strong>Ghi chú bưu tá:</strong> {selectedContract.deliveryNotes}
                          </div>
                        )}
                      </div>

                      {/* Waybill and VTP status history */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200/50 space-y-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Vận đơn Viettel Post</p>
                        {selectedContract.waybillCode ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Truck size={14} className="text-blue-500" />
                              <strong className="font-mono text-blue-600 text-sm">{selectedContract.waybillCode}</strong>
                              <ModalCopyButton text={selectedContract.waybillCode} />
                            </div>
                            
                            {/* Waybill steps log */}
                            {selectedContract.vtpStatusHistory && selectedContract.vtpStatusHistory.length > 0 ? (
                              <div className="border-t border-slate-100 pt-2 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500">Lịch trình Viettel Post mới nhất:</p>
                                <div className="space-y-1.5 pl-1">
                                  {selectedContract.vtpStatusHistory.map((step, idx) => (
                                    <div key={idx} className="text-[11px] border-l-2 border-blue-200 pl-2.5 py-0.5">
                                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                        <span className="font-bold text-blue-600 uppercase">{step.status}</span>
                                        <span>{formatDate(step.updatedAt)}</span>
                                      </div>
                                      <p className="text-slate-600 mt-0.5 leading-tight">{step.note}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">Vận đơn đã khởi tạo trên hệ thống, đang chờ Viettel Post lấy hàng.</p>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">Chưa phát hành bưu phẩm bưu cục / Chưa gán mã vận đơn Viettel Post.</div>
                        )}
                      </div>

                      {/* PHYSICAL STEP NOTES LOG HISTORY */}
                      <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/80 space-y-2">
                        <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          📌 Ghi chú bước xử lý vật lý thực tế (Văn thư/Clerk)
                        </p>
                        {selectedContract.physical_step_history && selectedContract.physical_step_history.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {selectedContract.physical_step_history.map((noteItem, idx) => (
                              <div key={idx} className="bg-white p-2 rounded-lg border border-amber-200/60 text-xs space-y-0.5">
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                  <span className="font-bold text-amber-800">{noteItem.by}</span>
                                  <span>{formatDate(noteItem.at)}</span>
                                </div>
                                <p className="text-slate-800 font-medium text-[11px] leading-snug">{noteItem.note}</p>
                              </div>
                            ))}
                          </div>
                        ) : selectedContract.physical_notes ? (
                          <div className="bg-white p-2 rounded-lg border border-amber-200/60 text-xs">
                            <p className="text-slate-800 font-medium text-[11px]">{selectedContract.physical_notes}</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Chưa có ghi chú xử lý vật lý nào được ghi nhận cho hợp đồng này.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-slate-50/40 rounded-xl border border-slate-200/50 p-4 space-y-3 animate-in fade-in duration-150">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200/50 pb-2 mb-3">
                <Activity size={14} className="text-emerald-600" />
                Nhật Ký Vận Hành Chi Tiết (Sổ Cái)
              </h4>
              
              <div className="overflow-y-auto space-y-4 pr-1 max-h-[480px]">
                <div className="relative border-l border-slate-200 pl-4 ml-2 space-y-4 pt-1">
                  {selectedContract.auditLog.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline node */}
                      <div className="absolute -left-[21px] top-1 w-2 h-2 bg-emerald-500 rounded-full ring-4 ring-slate-100 border border-white"></div>
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-800">{log.updatedBy}</span>
                          <span className="text-slate-400 font-mono">{formatDate(log.updatedAt)}</span>
                        </div>
                        {log.fromStatus !== log.toStatus && (
                          <p className="text-[9px] text-slate-500">
                            <span className="font-medium text-slate-400">{log.fromStatus || 'Mới'}</span>
                            <span className="mx-1 text-slate-300">➔</span>
                            <span className="font-bold text-emerald-600">{log.toStatus}</span>
                          </p>
                        )}
                        <p className="text-slate-600 leading-normal text-[11px] bg-white p-2 rounded-md border border-slate-100 mt-1 shadow-3xs">{log.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with "Hủy bỏ" flow */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {handleCancelContract && selectedContract.status !== 'Hoàn tất' && selectedContract.status !== 'Đã hủy' && (
              <div className="flex items-center">
                {!showCancelConfirm ? (
                  <button 
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer font-sans font-bold"
                  >
                    <Ban size={12} />
                    Hủy bỏ quy trình hồ sơ này
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <input 
                      type="text" 
                      placeholder="Lý do hủy..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="bg-white border border-rose-300 rounded-md px-2 py-1 text-xs focus:outline-none text-rose-700 w-[180px]"
                    />
                    <button 
                      onClick={() => {
                        handleCancelContract(selectedContract.id, cancelReason || 'Hủy quy trình hợp đồng');
                        setShowHistoryModal(false);
                        setSelectedContract(null);
                      }}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-2.5 py-1 rounded transition cursor-pointer"
                    >
                      Xác nhận Hủy
                    </button>
                    <button 
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setCancelReason('');
                      }}
                      className="text-slate-500 text-xs font-semibold px-2 hover:underline cursor-pointer"
                    >
                      Quay lại
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 shrink-0">
            <button 
              onClick={() => {
                setShowHistoryModal(false);
                setSelectedContract(null);
              }}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer font-sans"
            >
              Đóng chi tiết
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default HistoryModal;
