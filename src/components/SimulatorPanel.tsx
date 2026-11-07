import React from 'react';
import { CloudLightning, X, Truck, Clock, RefreshCw } from 'lucide-react';
import { Contract, SimLog } from '../types';

interface SimulatorPanelProps {
  showSimulator: boolean;
  setShowSimulator: (show: boolean) => void;
  contracts: Contract[];
  simVtpContractId: string;
  setSimVtpContractId: (id: string) => void;
  simVtpStatus: string;
  setSimVtpStatus: (status: string) => void;
  simVtpNote: string;
  setSimVtpNote: (note: string) => void;
  handleSimulateVtpWebhook: () => void;
  handleTriggerSlaCheck: () => void;
  simLogs: SimLog[];
  fetchSimLogs: () => void;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  showSimulator,
  setShowSimulator,
  contracts,
  simVtpContractId,
  setSimVtpContractId,
  simVtpStatus,
  setSimVtpStatus,
  simVtpNote,
  setSimVtpNote,
  handleSimulateVtpWebhook,
  handleTriggerSlaCheck,
  simLogs,
  fetchSimLogs,
}) => {
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

  if (!showSimulator) return null;

  return (
    <aside className="w-full lg:w-96 bg-slate-900 text-slate-300 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col z-10 shrink-0" id="simulator-drawer">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-1.5 font-bold text-xs text-white uppercase tracking-wider font-mono">
          <CloudLightning size={14} className="text-violet-400" />
          Giả lập Tích hợp & Hệ thống
        </div>
        <button 
          onClick={() => setShowSimulator(false)}
          className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Viettel Post Webhook Simulator */}
        <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
          <h4 className="text-[10px] font-bold text-violet-400 uppercase tracking-wider font-mono flex items-center gap-1">
            <Truck size={12} />
            1. Viettel Post Webhook Simulator
          </h4>
          <p className="text-[11px] text-slate-400 leading-snug">
            Mô phỏng hành trình bưu phẩm giao nhận để cập nhật tự động trạng thái hợp đồng.
          </p>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Chọn Hợp đồng có Vận đơn</label>
              <select 
                value={simVtpContractId}
                onChange={(e) => setSimVtpContractId(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded p-1.5 w-full focus:outline-none text-white font-medium cursor-pointer"
              >
                <option value="">-- Chọn hợp đồng --</option>
                {contracts.filter(c => c.waybillCode).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.contractNumber} - {c.partnerName.slice(0, 20)}... ({c.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Hành trình cập nhật</label>
              <select 
                value={simVtpStatus}
                onChange={(e) => setSimVtpStatus(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded p-1.5 w-full focus:outline-none text-white font-medium cursor-pointer"
              >
                <option value="PICKED_UP">PICKED_UP - Shipper đã lấy bưu phẩm</option>
                <option value="DELIVERING">DELIVERING - Đang trung chuyển bưu cục</option>
                <option value="DELIVERED">DELIVERED - Giao thành công đối tác</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Ghi chú bưu tá (tùy chọn)</label>
              <input 
                type="text"
                placeholder="vd: Khách hàng đồng ý ký bưu kiện"
                value={simVtpNote}
                onChange={(e) => setSimVtpNote(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded p-1.5 w-full focus:outline-none text-white text-xs font-sans"
              />
            </div>

            <button 
              type="button"
              onClick={handleSimulateVtpWebhook}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 rounded text-xs transition cursor-pointer"
            >
              Bắn Webhook VTP cập nhật trạng thái
            </button>
          </div>
        </div>

        {/* Background SLA checking simulation */}
        <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
          <h4 className="text-[10px] font-bold text-violet-400 uppercase tracking-wider font-mono flex items-center gap-1">
            <Clock size={12} />
            2. SLA Cron Background Job
          </h4>
          <p className="text-[11px] text-slate-400 leading-snug">
            Mô phỏng bộ quét nền kiểm tra hợp đồng quá hạn quy chuẩn để bắn cảnh báo MS Teams.
          </p>
          <button 
            type="button"
            onClick={handleTriggerSlaCheck}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 py-1.5 rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} />
            Kích hoạt Quét SLA ngay lập tức
          </button>
        </div>

        {/* Live telemetry logs */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nhật ký Hệ thống & Webhook (Telemetry)</h4>
            <button onClick={fetchSimLogs} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
            {simLogs.length === 0 ? (
              <p className="text-slate-500 text-[10px] italic text-center py-6">Chưa ghi nhận logs nào.</p>
            ) : (
              simLogs.map((log) => (
                <div key={log.id} className="bg-slate-950/75 p-2 rounded border border-slate-800/80 text-[11px] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase ${
                      log.type === 'teams' ? 'bg-indigo-500/20 text-indigo-300' :
                      log.type === 'drive' ? 'bg-blue-500/20 text-blue-300' :
                      log.type === 'ai' ? 'bg-violet-500/20 text-violet-300' :
                      log.type === 'sla' ? 'bg-rose-500/20 text-rose-300' :
                      'bg-slate-500/20 text-slate-300'
                    }`}>
                      {log.type}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">{formatDate(log.timestamp).split(' ')[1]}</span>
                  </div>
                  <p className="font-bold text-slate-200">{log.title}</p>
                  <p className="text-slate-400 leading-snug break-all font-mono text-[10px] whitespace-pre-wrap">{log.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </aside>
  );
};
export default SimulatorPanel;
