import React, { useState, useMemo } from 'react';
import { CheckCircle, AlertTriangle, FileText, BarChart2, Calendar, Filter } from 'lucide-react';
import { Contract, ReportsData } from '../types';

interface ReportViewProps {
  reports?: ReportsData | null;
  contracts?: Contract[];
}

export const ReportView: React.FC<ReportViewProps> = ({ reports, contracts = [] }) => {
  const [timeRange, setTimeRange] = useState<'all' | 'week' | 'month' | 'quarter' | 'year'>('all');
  const safeContracts = Array.isArray(contracts) ? contracts : [];

  // Filter contracts based on selected time range
  const filteredContracts = useMemo(() => {
    if (timeRange === 'all') return safeContracts;

    const now = Date.now();
    let days = 30;
    if (timeRange === 'week') days = 7;
    else if (timeRange === 'month') days = 30;
    else if (timeRange === 'quarter') days = 90;
    else if (timeRange === 'year') days = 365;

    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return safeContracts.filter(c => {
      if (!c) return false;
      const dateStr = c.uploaded_at || c.lastActivityAt || c.signDate;
      if (!dateStr) return false;
      const createdTime = new Date(dateStr).getTime();
      return createdTime >= cutoff;
    });
  }, [safeContracts, timeRange]);

  // Compute metrics for filtered contracts
  const filteredMetrics = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    let completedCount = 0;

    filteredContracts.forEach(c => {
      if (!c) return;
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      if (c.status === 'Hoàn tất') {
        completedCount++;
      }
    });

    const filteredContractIds = new Set(filteredContracts.map(c => c.id));
    const safeOverdue = Array.isArray(reports?.overdueContracts) ? reports!.overdueContracts : [];
    const filteredOverdue = safeOverdue.filter(c => c && filteredContractIds.has(c.id));

    return {
      statusCounts,
      completedCount,
      totalCount: filteredContracts.length,
      overdueContracts: filteredOverdue,
    };
  }, [filteredContracts, reports?.overdueContracts]);

  return (
    <div className="space-y-6" id="report-view-container">
      {/* Time Range Filter Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-100">
            <Calendar size={18} />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm">Báo Cáo Hiệu Suất SLA & KPI</h3>
            <p className="text-[11px] text-slate-500 font-medium">Lọc số liệu theo khoảng thời gian để so sánh giữa các giai đoạn</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              timeRange === 'week' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tuần này (7d)
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              timeRange === 'month' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tháng này (30d)
          </button>
          <button
            onClick={() => setTimeRange('quarter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              timeRange === 'quarter' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Quý này (90d)
          </button>
          <button
            onClick={() => setTimeRange('year')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              timeRange === 'year' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Năm nay
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              timeRange === 'all' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* Big stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow duration-200 flex flex-col justify-between" id="stat-completed-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Hợp đồng Đã Hoàn Tất</h4>
              <p className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                {filteredMetrics.completedCount}
              </p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <p className="text-xs text-slate-500 font-medium">Tệp hợp đồng đã được scan lưu trữ hoàn toàn</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow duration-200 flex flex-col justify-between" id="stat-sla-breach-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-rose-500/80 uppercase tracking-wider font-mono">Vượt SLA Cảnh Báo</h4>
              <p className="text-4xl font-extrabold text-rose-600 tracking-tight font-mono">
                {filteredMetrics.overdueContracts.length}
              </p>
            </div>
            <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100 animate-pulse">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <p className="text-xs text-slate-500 font-medium">Cần xử lý khẩn cấp tránh tắc nghẽn</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100/80 shadow-xs hover:shadow-xs transition-shadow duration-200 flex flex-col justify-between" id="stat-total-card">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Tổng Hợp Đồng Quy Trình</h4>
              <p className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                {filteredMetrics.totalCount}
              </p>
            </div>
            <div className="bg-slate-50 text-slate-600 p-2.5 rounded-xl border border-slate-200/50">
              <FileText size={20} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50">
            <p className="text-xs text-slate-500 font-medium">Hợp đồng trong khoảng thời gian đã chọn</p>
          </div>
        </div>
      </div>

      {/* Operational response speed benchmarks */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100/80 shadow-xs space-y-6" id="sla-benchmark-card">
        <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
          <BarChart2 size={18} className="text-emerald-500" />
          Đo lường Hiệu quả Làm việc Nội bộ (SLA & Latency)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Upload to printed hours */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tốc độ phản hồi Văn thư</p>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {reports?.averages?.avgUploadToPrintHours ?? '0.0'} <span className="text-xs font-normal">tiếng</span>
            </p>
            <p className="text-[10px] text-slate-500 leading-snug">Thời gian trung bình từ lúc Pháp chế upload file (.docx) đến lúc Văn thư bấm in ấn bưu phẩm.</p>
          </div>

          {/* Print to signed hours */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Độ trễ ký kết của Sếp</p>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {reports?.averages?.avgPrintToSignHours ?? '0.0'} <span className="text-xs font-normal">tiếng</span>
            </p>
            <p className="text-[10px] text-slate-500 leading-snug">Thời gian trung bình từ lúc bản in cứng sẵn sàng đến khi Sếp ký tay và đóng dấu vật lý hoàn thành.</p>
          </div>

          {/* Total Cycle hours */}
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vòng đời hoàn thành trung bình</p>
            <p className="text-2xl font-black text-slate-800 font-mono">
              {reports?.averages?.avgTotalCycleHours ?? '0.0'} <span className="text-xs font-normal">tiếng</span>
            </p>
            <p className="text-[10px] text-slate-500 leading-snug">Tổng thời gian trung bình từ khi hợp đồng được khai sinh đến lúc số hóa và lưu trữ hoàn tất hồ sơ.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="reports-breakdown-row">
        {/* Status volume distribution chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider font-mono">Sản lượng hợp đồng theo Trạng thái</h4>
          
          <div className="space-y-3.5">
            {Object.entries(filteredMetrics.statusCounts).map(([status, count]) => {
              const percentage = filteredMetrics.totalCount ? Math.round(((count as number) / filteredMetrics.totalCount) * 100) : 0;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600">{status}</span>
                    <span className="text-slate-800 font-mono font-bold">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        status === 'Hoàn tất' ? 'bg-emerald-500' :
                        status === 'Chờ in' ? 'bg-pink-500' :
                        status === 'Đang chờ ký' ? 'bg-amber-500' :
                        status === 'Chờ tạo vận đơn' ? 'bg-indigo-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SLA Breaches / Overdue List */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h4 className="text-slate-900 font-bold text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 text-rose-600">
            <AlertTriangle size={14} />
            Hợp đồng tắc nghẽn (Vượt SLA) ({filteredMetrics.overdueContracts.length})
          </h4>

          {filteredMetrics.overdueContracts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium text-xs">
              Tuyệt vời! Không có hợp đồng nào đang trong tình trạng trễ hạn SLA.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
              {filteredMetrics.overdueContracts.map((c) => {
                const lastAct = new Date(c.lastActivityAt);
                const hoursPending = Math.round((Date.now() - lastAct.getTime()) / (1000 * 60 * 60));

                return (
                  <div key={c.id} className="py-3 flex justify-between items-start gap-4" id={`overdue-contract-${c.id}`}>
                    <div>
                      <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mr-2">
                        {c.contractNumber}
                      </span>
                      <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-1 py-0.2 rounded font-bold">
                        {c.slaBreachType === 'internal' ? 'SLA Nội Bộ' : 'SLA Vận Chuyển'}
                      </span>
                      <h5 className="font-bold text-slate-800 text-xs mt-1 leading-snug">{c.name}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5">Trạng thái: <span className="font-bold">{c.status}</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-rose-600 font-mono font-bold text-xs">{hoursPending} giờ tồn đọng</span>
                      <p className="text-[9px] text-slate-400 mt-0.5">Yêu cầu can thiệp gấp</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
