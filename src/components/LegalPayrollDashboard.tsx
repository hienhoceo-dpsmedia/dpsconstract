import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Calculator, Award, Clock, CheckCircle2, AlertCircle, 
  FileText, Search, Filter, Download, Plus, Sparkles, MessageSquare, 
  ChevronRight, ChevronDown, ChevronUp, ChevronLeft, ArrowUpRight, TrendingUp, Shield, Edit3, Upload, Check, X, RefreshCw, Send,
  Printer, Truck, Archive, CheckCircle, UserCheck, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  SortingState
} from '@tanstack/react-table';
import { Contract, User, SettingsState } from '../types';
import { calculateTaskPayroll, calculateClerkPayroll } from '../utils/payroll';

interface LegalPayrollDashboardProps {
  contracts: Contract[];
  currentUser: User;
  settings?: SettingsState;
  users?: User[];
  onRequestNewDraft: () => void;
  onSubmitDraft: (contractId: string, file?: File, googleDocsLink?: string) => Promise<void>;
  onFeedbackDraft: (contractId: string, note: string) => Promise<void>;
  onApproveSoftCopy: (contractId: string) => Promise<void>;
  onSelectContract: (contract: Contract) => void;
}

export const LegalPayrollDashboard: React.FC<LegalPayrollDashboardProps> = ({
  contracts,
  currentUser,
  settings,
  users = [],
  onRequestNewDraft,
  onSubmitDraft,
  onFeedbackDraft,
  onApproveSoftCopy,
  onSelectContract
}) => {
  const [subTab, setSubTab] = useState<'legal' | 'clerk'>('legal');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');
  const [punctualFilter, setPunctualFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFormulaLegal, setShowFormulaLegal] = useState<boolean>(true);
  const [showFormulaClerk, setShowFormulaClerk] = useState<boolean>(true);

  // Modals inside component
  const [activeDraftModalContract, setActiveDraftModalContract] = useState<Contract | null>(null);
  const [activeFeedbackContract, setActiveFeedbackContract] = useState<Contract | null>(null);

  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftDocsLink, setDraftDocsLink] = useState<string>('');
  const [feedbackNote, setFeedbackNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Determine if current user is admin
  const isAdmin = currentUser?.role === 'admin';
  const userEmail = currentUser?.email || '';

  // If non-admin, force selectedStaff to currentUser.email
  const effectiveSelectedStaff = isAdmin ? selectedStaff : userEmail;
  const safeContracts = Array.isArray(contracts) ? contracts : [];

  // Filter tasks for LEGAL
  const draftingTasks = safeContracts.filter(c => {
    if (!c) return false;
    if (!c.requested_at && !c.base_pay && c.status !== 'Chờ soạn thảo') return false;
    // Non-admin can only see tasks assigned to them or created by them
    if (!isAdmin && c.assigned_to !== userEmail && c.requested_by !== userEmail) return false;
    return true;
  });

  const filteredLegalTasks = draftingTasks.filter(task => {
    if (effectiveSelectedStaff !== 'ALL' && task.assigned_to !== effectiveSelectedStaff) return false;
    if (urgencyFilter !== 'ALL' && task.urgency_level !== urgencyFilter) return false;
    if (punctualFilter !== 'ALL') {
      if (punctualFilter === 'PUNCTUAL' && !task.is_punctual) return false;
      if (punctualFilter === 'LATE' && task.is_punctual !== false) return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = task.name?.toLowerCase().includes(q);
      const matchNumber = task.contractNumber?.toLowerCase().includes(q);
      const matchPartner = task.partnerName?.toLowerCase().includes(q);
      if (!matchName && !matchNumber && !matchPartner) return false;
    }
    return true;
  });

  // Calculate Aggregated Metrics for LEGAL
  const totalCompletedTasks = draftingTasks.filter(t => t.status !== 'Chờ soạn thảo' && t.status !== 'Đã hủy').length;
  
  const totalApprovedPayroll = draftingTasks.reduce((sum, task) => {
    if (task.calculated_payroll && task.status !== 'Chờ soạn thảo' && task.status !== 'Đã hủy') {
      return sum + task.calculated_payroll;
    }
    const res = calculateTaskPayroll(task, settings);
    return sum + (task.status !== 'Chờ soạn thảo' ? res.finalPayroll : 0);
  }, 0);

  const punctualCount = draftingTasks.filter(t => t.is_punctual === true).length;
  const punctualRate = totalCompletedTasks > 0 ? Math.round((punctualCount / totalCompletedTasks) * 100) : 100;

  const totalFeedbacks = draftingTasks.reduce((sum, t) => sum + (t.feedback_count || 0), 0);
  const avgFeedbackCount = draftingTasks.length > 0 ? (totalFeedbacks / draftingTasks.length).toFixed(1) : '0.0';

  // Filter tasks for CLERK (Văn thư)
  const clerkTasks = safeContracts.filter(c => c && (c.processingMethod === 'physical' || c.printed_at || c.waybillCode || c.status !== 'Chờ soạn thảo'));

  const filteredClerkTasks = clerkTasks.filter(task => {
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = task.name?.toLowerCase().includes(q);
      const matchNumber = task.contractNumber?.toLowerCase().includes(q);
      const matchPartner = task.partnerName?.toLowerCase().includes(q);
      if (!matchName && !matchNumber && !matchPartner) return false;
    }
    return true;
  });

  // Calculate Aggregated Metrics for CLERK
  const totalClerkPayroll = clerkTasks.reduce((sum, task) => {
    const res = calculateClerkPayroll(task, settings);
    return sum + res.finalPayroll;
  }, 0);

  const printedInTimeCount = clerkTasks.filter(t => {
    const res = calculateClerkPayroll(t, settings);
    return res.printSlaCoef > 0;
  }).length;
  const printOnTimeRate = clerkTasks.length > 0 ? Math.round((printedInTimeCount / clerkTasks.length) * 100) : 100;

  const retrievedCount = clerkTasks.filter(t => t.received_back_at || t.archived_at || t.status === 'Hoàn tất').length;
  const retrievalRate = clerkTasks.length > 0 ? Math.round((retrievedCount / clerkTasks.length) * 100) : 0;

  // Format Elapsed Time
  const formatElapsedTime = (requestedAt?: string | null, submittedAt?: string | null) => {
    if (!requestedAt) return '---';
    const start = new Date(requestedAt).getTime();
    const end = submittedAt ? new Date(submittedAt).getTime() : new Date().getTime();
    const diffMins = Math.floor((end - start) / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins} phút`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours}h ${mins}p`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} ngày ${remHours}h`;
  };

  // --- TANSTACK TABLE FOR LEGAL TASKS ---
  const [legalSorting, setLegalSorting] = useState<SortingState>([]);
  const [legalPagination, setLegalPagination] = useState({ pageIndex: 0, pageSize: 15 });

  const legalColumns = useMemo(() => [
    { id: 'name', accessorKey: 'name', header: 'Mã & tên hồ sơ', enableSorting: true },
    { id: 'partnerName', accessorKey: 'partnerName', header: 'Đối tác', enableSorting: true },
    { id: 'assigned_to', accessorKey: 'assigned_to', header: 'Người soạn', enableSorting: true },
    { id: 'deadline', accessorKey: 'deadline', header: 'Hạn chót & tiến độ', enableSorting: true },
    { id: 'urgency_level', accessorKey: 'urgency_level', header: 'Hệ số gấp', enableSorting: true },
    { id: 'is_punctual', accessorKey: 'is_punctual', header: 'Đúng hạn (SLA)', enableSorting: true },
    { id: 'feedback_count', accessorKey: 'feedback_count', header: 'Chất lượng', enableSorting: true },
    { id: 'base_pay', accessorKey: 'base_pay', header: 'Đơn giá nền', enableSorting: true },
    { id: 'calculated_payroll', accessorKey: 'calculated_payroll', header: 'Thành tiền lương', enableSorting: true },
    { id: 'actions', header: 'Thao tác', enableSorting: false },
  ], []);

  const legalTable = useReactTable({
    data: filteredLegalTasks,
    columns: legalColumns,
    state: { sorting: legalSorting, pagination: legalPagination },
    onSortingChange: setLegalSorting,
    onPaginationChange: setLegalPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // --- TANSTACK TABLE FOR CLERK TASKS ---
  const [clerkSorting, setClerkSorting] = useState<SortingState>([]);
  const [clerkPagination, setClerkPagination] = useState({ pageIndex: 0, pageSize: 15 });

  const clerkColumns = useMemo(() => [
    { id: 'name', accessorKey: 'name', header: 'Mã & tên hợp đồng', enableSorting: true },
    { id: 'partnerName', accessorKey: 'partnerName', header: 'Đối tác', enableSorting: true },
    { id: 'status', accessorKey: 'status', header: 'Trạng thái quy trình', enableSorting: true },
    { id: 'printed_at', accessorKey: 'printed_at', header: 'In ấn (≤ 2h)', enableSorting: true },
    { id: 'waybillCode', accessorKey: 'waybillCode', header: 'Mã VTP giao vận', enableSorting: true },
    { id: 'received_original_at', accessorKey: 'received_original_at', header: 'Thu hồi lưu kho', enableSorting: true },
    { id: 'accuracy', header: 'Độ chính xác', enableSorting: false },
    { id: 'base_pay', header: 'Đơn giá nền', enableSorting: false },
    { id: 'payroll', header: 'Thành tiền lương', enableSorting: true },
    { id: 'actions', header: 'Chi tiết', enableSorting: false },
  ], []);

  const clerkTable = useReactTable({
    data: filteredClerkTasks,
    columns: clerkColumns,
    state: { sorting: clerkSorting, pagination: clerkPagination },
    onSortingChange: setClerkSorting,
    onPaginationChange: setClerkPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Submit Draft Handler
  const handleDoSubmitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDraftModalContract) return;
    setIsSubmitting(true);
    try {
      await onSubmitDraft(activeDraftModalContract.id, draftFile || undefined, draftDocsLink || undefined);
      setActiveDraftModalContract(null);
      setDraftFile(null);
      setDraftDocsLink('');
    } catch (err: any) {
      alert(err.message || 'Lỗi nộp bản thảo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feedback Handler
  const handleDoFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedbackContract) return;
    if (!feedbackNote.trim()) {
      alert('Vui lòng nhập lý do / ghi chú feedback cho Legal.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onFeedbackDraft(activeFeedbackContract.id, feedbackNote.trim());
      setActiveFeedbackContract(null);
      setFeedbackNote('');
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV Handler for Legal
  const exportLegalCSV = () => {
    const headers = ['Mã hợp đồng', 'Tên task/Hợp đồng', 'Đối tác', 'Legal đảm nhận', 'Ngày yêu cầu', 'Hạn chót', 'Thời gian nộp', 'Mức độ gấp', 'Đúng hạn', 'Số lượt Feedback', 'Đơn giá nền (VND)', 'Thành tiền lương (VND)'];
    const rows = filteredLegalTasks.map(t => {
      const calc = calculateTaskPayroll(t, settings);
      return [
        `"${t.contractNumber}"`,
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.partnerName.replace(/"/g, '""')}"`,
        `"${t.assigned_to || 'Chưa gán'}"`,
        `"${t.requested_at ? new Date(t.requested_at).toLocaleString('vi-VN') : ''}"`,
        `"${t.deadline ? new Date(t.deadline).toLocaleString('vi-VN') : ''}"`,
        `"${t.draft_submitted_at ? new Date(t.draft_submitted_at).toLocaleString('vi-VN') : 'Chưa nộp'}"`,
        `"${calc.urgencyLabel}"`,
        `"${calc.punctualLabel}"`,
        calc.feedbackCount,
        calc.basePay,
        calc.finalPayroll
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bang_Luong_Soan_Thao_Legal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export CSV Handler for Clerk
  const exportClerkCSV = () => {
    const headers = ['Mã hợp đồng', 'Tên Hợp đồng', 'Đối tác', 'Trạng thái', 'Thời gian in', 'Giao vận VTP', 'Hạn lưu kho', 'In nhanh (SLA)', 'Vận đơn VTP (SLA)', 'Thu hồi kho (SLA)', 'Chất lượng/Sự cố', 'Đơn giá nền', 'Thành tiền lương'];
    const rows = filteredClerkTasks.map(t => {
      const calc = calculateClerkPayroll(t, settings);
      return [
        `"${t.contractNumber}"`,
        `"${t.name.replace(/"/g, '""')}"`,
        `"${t.partnerName.replace(/"/g, '""')}"`,
        `"${t.status}"`,
        `"${t.printed_at ? new Date(t.printed_at).toLocaleString('vi-VN') : 'Chưa in'}"`,
        `"${t.waybillCode || 'Chưa gán'}"`,
        `"${t.received_back_at ? new Date(t.received_back_at).toLocaleString('vi-VN') : 'Chưa thu hồi'}"`,
        `"${calc.printSlaCoef >= 0 ? '+' : ''}${Math.round(calc.printSlaCoef * 100)}%"`,
        `"${calc.courierSlaCoef >= 0 ? '+' : ''}${Math.round(calc.courierSlaCoef * 100)}%"`,
        `"${calc.retrievalSlaCoef >= 0 ? '+' : ''}${Math.round(calc.retrievalSlaCoef * 100)}%"`,
        `"${calc.accuracyCoef >= 0 ? '+' : ''}${Math.round(calc.accuracyCoef * 100)}%"`,
        calc.basePay,
        calc.finalPayroll
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bang_Luong_Van_Thu_Clerk_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="payroll-and-kpi-dashboard-root">
      
      {/* Top Banner Header - Enterprise Soft Slate Style */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-emerald-50/60 via-slate-50/30 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-semibold border border-emerald-200/80">
              <Calculator size={13} className="text-emerald-600" />
              <span>Đánh giá KPI &amp; Tính lương tự động toàn hệ thống</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Hệ Thống Đánh Giá Hiệu Quả &amp; Bảng Lương Nhân Sự
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed font-normal">
              Tự động hóa 100% chi trả thù lao cho bộ phận <b className="text-slate-700 font-semibold">Pháp chế (Legal)</b> và <b className="text-slate-700 font-semibold">Văn thư (Clerk)</b> dựa trên tiêu chí đo lường thời gian thực SLA, chất lượng công việc và độ chính xác quy trình vật lý.
            </p>
          </div>

          {(currentUser?.role === 'admin' || currentUser?.role === 'legal') && (
            <div className="shrink-0 flex items-center gap-3">
              <button
                onClick={onRequestNewDraft}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs transition duration-150 flex items-center gap-2 cursor-pointer hover:shadow active:scale-95"
              >
                <Plus size={16} className="stroke-[2.5]" />
                {currentUser?.role === 'admin' ? 'Sếp Giao Task Legal Soạn Thảo' : 'Tạo Yêu Cầu Soạn Thảo Mới'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Sub-Tabs Navigation (Legal vs Clerk) */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-2xs">
        <button
          onClick={() => setSubTab('legal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            subTab === 'legal'
              ? 'bg-white text-emerald-800 shadow-2xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Award size={15} className={subTab === 'legal' ? 'text-emerald-600' : 'text-slate-400'} />
          <span>Lương Soạn Thảo Legal</span>
          <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded ${subTab === 'legal' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200/70 text-slate-600'}`}>
            {draftingTasks.length}
          </span>
        </button>

        <button
          onClick={() => setSubTab('clerk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
            subTab === 'clerk'
              ? 'bg-white text-blue-800 shadow-2xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Printer size={15} className={subTab === 'clerk' ? 'text-blue-600' : 'text-slate-400'} />
          <span>Lương Xử Lý Văn Thư</span>
          <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded ${subTab === 'clerk' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/70 text-slate-600'}`}>
            {clerkTasks.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: LEGAL PAYROLL DASHBOARD                                           */}
      {/* ========================================================================= */}
      {subTab === 'legal' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* KPI Cards Grid for LEGAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-emerald-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tổng lương Legal đã duyệt</span>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <DollarSign size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {totalApprovedPayroll.toLocaleString('vi-VN')} <span className="text-xs font-medium text-slate-400 font-sans">VNĐ</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <TrendingUp size={13} />
                Nghiệm thu qua sếp duyệt bản mềm
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-blue-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Số task soạn thảo</span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                  <FileText size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {draftingTasks.length} <span className="text-xs font-medium text-slate-400 font-sans">công việc</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                {draftingTasks.filter(t => t.status === 'Chờ soạn thảo').length} task đang chờ Legal xử lý
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-indigo-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tỷ lệ đúng hạn Legal</span>
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                  <Clock size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-indigo-700 font-mono tracking-tight">
                {punctualRate}%
              </div>
              <p className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} />
                {punctualCount}/{totalCompletedTasks || draftingTasks.length} task nộp đúng deadline
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-amber-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Feedback trung bình</span>
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                  <MessageSquare size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {avgFeedbackCount} <span className="text-xs font-medium text-slate-400 font-sans">lần/task</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Chỉ số chất lượng bản soạn thảo ban đầu
              </p>
            </div>

          </div>

          {/* Formula Explanation Banner for Legal - Clean Card with Collapsible Support */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-100/70 text-amber-800 rounded-lg">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Khung công thức lương soạn thảo Legal (Cấu hình hệ số động)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Lương Legal = Đơn giá nền * (1 + %Gấp + %SLA_Thời_gian + %Quality_Feedback)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaLegal(!showFormulaLegal)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer self-start sm:self-auto"
              >
                {showFormulaLegal ? (
                  <><span>Thu gọn</span><ChevronUp size={14} /></>
                ) : (
                  <><span>Chi tiết tỷ lệ</span><ChevronDown size={14} /></>
                )}
              </button>
            </div>

            {showFormulaLegal && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs animate-in fade-in duration-150">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                  <span className="font-bold text-blue-700 block text-xs border-b border-slate-100 pb-1.5">
                    A. Mức độ gấp (Theo Deadline)
                  </span>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    <li className="flex items-center justify-between">
                      <span>Bình thường (≥ 1 ngày)</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">+0%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Ưu tiên (Trong ngày, ≥ 3h)</span>
                      <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded font-mono">+10%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Gấp (Trong ngày, &lt; 3h)</span>
                      <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded font-mono">+20%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Khẩn cấp (≤ 1h / ngoài giờ)</span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded font-mono">+30%</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                  <span className="font-bold text-emerald-700 block text-xs border-b border-slate-100 pb-1.5">
                    B. Tiêu chí SLA (Thời gian nộp)
                  </span>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    <li className="flex items-center justify-between">
                      <span>Sớm nhiều (tiết kiệm ≥ {settings?.slaEarlyMaxTimePct ?? 50}%)</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">+{settings?.slaEarlyMaxRate ?? 30}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Sớm vừa (tiết kiệm ≥ {settings?.slaEarlyMidTimePct ?? 25}%)</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">+{settings?.slaEarlyMidRate ?? 20}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Sớm ít (tiết kiệm ≥ {settings?.slaEarlyMinTimePct ?? 5}%)</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">+{settings?.slaEarlyMinRate ?? 10}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Đúng hạn (Đúng SLA)</span>
                      <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded font-mono">{(settings?.slaOnTimeRate ?? 0) >= 0 ? '+' : ''}{settings?.slaOnTimeRate ?? 0}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Trễ ít (quá hạn ≤ {settings?.slaLateMinHours ?? 2}h)</span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded font-mono">{settings?.slaLateMinRate ?? -10}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Trễ vừa (quá hạn ≤ {settings?.slaLateMidHours ?? 6}h)</span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded font-mono">{settings?.slaLateMidRate ?? -20}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Trễ nhiều (quá hạn &gt; {settings?.slaLateMidHours ?? 6}h)</span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded font-mono">{settings?.slaLateMaxRate ?? -30}%</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                  <span className="font-bold text-amber-700 block text-xs border-b border-slate-100 pb-1.5">
                    C. Chất Lượng (Feedback Sếp)
                  </span>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    <li className="flex items-center justify-between">
                      <span>0 lần feedback (Đạt chuẩn)</span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded font-mono">{(settings?.feedback0Rate ?? 0) >= 0 ? '+' : ''}{settings?.feedback0Rate ?? 0}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>1 lần feedback</span>
                      <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded font-mono">{settings?.feedback1Rate ?? -10}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>2 lần feedback</span>
                      <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded font-mono">{settings?.feedback2Rate ?? -20}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>3+ lần feedback</span>
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded font-mono">{settings?.feedback3Rate ?? -30}%</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên task, mã HD, đối tác..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
                />
              </div>

              {isAdmin ? (
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none cursor-pointer text-slate-800"
                >
                  <option value="ALL">Tất cả nhân sự Legal</option>
                  {users.filter(u => u.role === 'legal').map(u => (
                    <option key={u.email} value={u.email}>{u.name ? `${u.name} (${u.email})` : u.email}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                  <Shield size={13} className="text-emerald-600" />
                  <span>Cá nhân: {userEmail}</span>
                  <span className="text-[10px] text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">🔒 Riêng tư</span>
                </div>
              )}

              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả Mức độ gấp</option>
                <option value="normal">Bình thường (+0%)</option>
                <option value="priority">Ưu tiên (+10%)</option>
                <option value="urgent">Gấp (+20%)</option>
                <option value="emergency">Khẩn cấp (+30%)</option>
              </select>
            </div>

            <button 
              onClick={exportLegalCSV}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download size={14} />
              Xuất Bảng Lương Legal (CSV)
            </button>
          </div>

          {/* Legal Tasks Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Calculator size={16} className="text-emerald-600" />
                <span>Bảng chi tiết lương soạn thảo Legal</span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {filteredLegalTasks.length} task
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 text-xs font-semibold border-b border-slate-200/80">
                    <th 
                      onClick={() => legalTable.getColumn('name')?.toggleSorting()}
                      className="py-3 px-4 pl-5 min-w-[220px] cursor-pointer select-none group"
                      title="Sắp xếp theo tên hồ sơ"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Mã &amp; tên hồ sơ</span>
                        {legalTable.getColumn('name')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-emerald-600" />
                        ) : legalTable.getColumn('name')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-emerald-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th 
                      onClick={() => legalTable.getColumn('partnerName')?.toggleSorting()}
                      className="py-3 px-4 min-w-[190px] max-w-[260px] cursor-pointer select-none group"
                      title="Sắp xếp theo tên đối tác"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Đối tác</span>
                        {legalTable.getColumn('partnerName')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-emerald-600" />
                        ) : legalTable.getColumn('partnerName')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-emerald-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th 
                      onClick={() => legalTable.getColumn('assigned_to')?.toggleSorting()}
                      className="py-3 px-4 min-w-[130px] cursor-pointer select-none group"
                      title="Sắp xếp theo người soạn"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Người soạn</span>
                        {legalTable.getColumn('assigned_to')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-emerald-600" />
                        ) : legalTable.getColumn('assigned_to')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-emerald-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-4 min-w-[160px]">Hạn chót &amp; tiến độ</th>
                    <th className="py-3 px-3 text-center min-w-[90px]">Hệ số gấp</th>
                    <th className="py-3 px-3 text-center min-w-[110px]">Đúng hạn (SLA)</th>
                    <th className="py-3 px-3 text-center min-w-[100px]">Chất lượng</th>

                    <th 
                      onClick={() => legalTable.getColumn('base_pay')?.toggleSorting()}
                      className="py-3 px-4 text-right min-w-[110px] cursor-pointer select-none group"
                      title="Sắp xếp theo đơn giá nền"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {legalTable.getColumn('base_pay')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-emerald-600" />
                        ) : legalTable.getColumn('base_pay')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-emerald-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                        <span>Đơn giá nền</span>
                      </div>
                    </th>

                    <th 
                      onClick={() => legalTable.getColumn('calculated_payroll')?.toggleSorting()}
                      className="py-3 px-4 text-right min-w-[130px] cursor-pointer select-none group"
                      title="Sắp xếp theo thành tiền lương"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {legalTable.getColumn('calculated_payroll')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-emerald-600" />
                        ) : legalTable.getColumn('calculated_payroll')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-emerald-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                        <span>Thành tiền lương</span>
                      </div>
                    </th>

                    <th className="py-3 px-4 pr-5 text-center min-w-[110px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {legalTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 font-medium">
                        Chưa có task soạn thảo nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    legalTable.getRowModel().rows.map(row => {
                      const task = row.original;
                      const calc = calculateTaskPayroll(task, settings);
                      const elapsedTime = formatElapsedTime(task.requested_at, task.draft_submitted_at);

                      return (
                        <tr key={task.id} className="hover:bg-slate-50/80 transition-colors duration-100 h-[56px]">
                          <td className="py-2.5 px-4 pl-5">
                            <div className="flex flex-col space-y-0.5">
                              <span className="text-[10px] font-semibold text-slate-500">{task.contractNumber}</span>
                              <span 
                                onClick={() => onSelectContract(task)}
                                className="font-semibold text-slate-900 hover:text-emerald-600 cursor-pointer line-clamp-1"
                                title={task.name}
                              >
                                {task.name}
                              </span>
                              <span className={`inline-block w-max text-[9px] font-semibold px-1.5 py-0.2 rounded border ${
                                task.status === 'Chờ soạn thảo' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                task.status === 'Chờ duyệt bản mềm' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {task.status}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap truncate max-w-[240px]" title={task.partnerName}>
                            {task.partnerName}
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5.5 h-5.5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">L</div>
                              <span className="font-medium text-slate-700 text-xs truncate max-w-[120px]" title={task.assigned_to}>{task.assigned_to || 'Chưa gán'}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-xs">
                            <div className="flex flex-col space-y-0.5">
                              <span className="text-slate-500 text-[11px]">
                                Deadline: <b className="text-slate-800 font-medium">{task.deadline ? new Date(task.deadline).toLocaleString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa đặt'}</b>
                              </span>
                              <span className="text-slate-700 font-medium flex items-center gap-1 text-[11px]">
                                <Clock size={11} className="text-emerald-600" />
                                Đã dùng: {elapsedTime}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.urgencyCoef === 0.3 ? 'bg-red-50 text-red-700 border-red-200' :
                              calc.urgencyCoef === 0.2 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              calc.urgencyCoef === 0.1 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              +{Math.round(calc.urgencyCoef * 100)}%
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.punctualCoef > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              calc.isPunctual === false ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {calc.punctualCoef > 0 ? '+10% (Đúng hạn)' : calc.isPunctual === false ? '0% (Trễ hạn)' : 'Đang xử lý'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                calc.qualityCoef > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                calc.qualityCoef === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {calc.qualityCoef >= 0 ? `+${Math.round(calc.qualityCoef * 100)}%` : `${Math.round(calc.qualityCoef * 100)}%`}
                              </span>
                              <span className="text-[10px] text-slate-400">{task.feedback_count || 0} lần feedback</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                            {calc.basePay.toLocaleString('vi-VN')} <span className="text-[10px] text-slate-400">đ</span>
                          </td>

                          <td className="py-2.5 px-4 text-right">
                            <div className="flex flex-col items-end" title={calc.formulaString}>
                              <span className="text-sm font-bold text-emerald-700">
                                {calc.finalPayroll.toLocaleString('vi-VN')} <span className="text-[10px] font-normal">VNĐ</span>
                              </span>
                              <span className="text-[10px] text-slate-400">Hệ số: ×{(calc.totalCoef).toFixed(2)}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 pr-5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {task.status === 'Chờ soạn thảo' && (
                                <button
                                  onClick={() => {
                                    setActiveDraftModalContract(task);
                                    setDraftDocsLink(task.googleDocsLink || '');
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Upload size={12} />
                                  Nộp Bản Thảo
                                </button>
                              )}

                              {task.status === 'Chờ duyệt bản mềm' && currentUser.role === 'admin' && (
                                <>
                                  <button
                                    onClick={() => onApproveSoftCopy(task.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                  >
                                    <Check size={12} />
                                    Duyệt bản mềm
                                  </button>
                                  <button
                                    onClick={() => setActiveFeedbackContract(task)}
                                    className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <MessageSquare size={12} />
                                    Sửa
                                  </button>
                                </>
                              )}

                              <button 
                                onClick={() => onSelectContract(task)}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Legal Table TanStack Pagination Footer */}
            {legalTable.getFilteredRowModel().rows.length > 0 && (
              <div className="flex items-center justify-between p-3.5 border-t border-slate-100 bg-slate-50/50 text-xs">
                <div className="flex items-center gap-3 text-slate-500">
                  <span>
                    Hiển thị <b className="text-slate-800">{legalTable.getState().pagination.pageIndex * legalTable.getState().pagination.pageSize + 1} - {Math.min((legalTable.getState().pagination.pageIndex + 1) * legalTable.getState().pagination.pageSize, legalTable.getFilteredRowModel().rows.length)}</b> / <b className="text-slate-800">{legalTable.getFilteredRowModel().rows.length}</b> task
                  </span>
                  <div className="flex items-center gap-1">
                    <span>Mỗi trang:</span>
                    <select
                      value={legalTable.getState().pagination.pageSize}
                      onChange={(e) => legalTable.setPageSize(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => legalTable.previousPage()}
                    disabled={!legalTable.getCanPreviousPage()}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center gap-0.5"
                  >
                    <ChevronLeft size={13} />
                    <span>Trước</span>
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    Trang {legalTable.getState().pagination.pageIndex + 1} / {legalTable.getPageCount()}
                  </span>
                  <button
                    onClick={() => legalTable.nextPage()}
                    disabled={!legalTable.getCanNextPage()}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center gap-0.5"
                  >
                    <span>Sau</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: CLERK (VĂN THƯ) PAYROLL DASHBOARD                                 */}
      {/* ========================================================================= */}
      {subTab === 'clerk' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* KPI Cards Grid for CLERK */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-blue-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tổng lương Văn thư</span>
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                  <DollarSign size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {totalClerkPayroll.toLocaleString('vi-VN')} <span className="text-xs font-medium text-slate-400 font-sans">VNĐ</span>
              </div>
              <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
                <TrendingUp size={13} />
                Đơn giá 100k + các hệ số SLA
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-indigo-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Số hồ sơ vật lý</span>
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                  <Printer size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {clerkTasks.length} <span className="text-xs font-medium text-slate-400 font-sans">hợp đồng</span>
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Đã qua quy trình in ấn, giao vận &amp; lưu kho
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-emerald-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tỷ lệ in nhanh (≤ 2h)</span>
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Clock size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-700 font-mono tracking-tight">
                {printOnTimeRate}%
              </div>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} />
                {printedInTimeCount}/{clerkTasks.length} hồ sơ hoàn tất in ≤ 2 giờ
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:border-purple-300 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Tỷ lệ thu hồi bản gốc</span>
                <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
                  <Archive size={17} />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-700 font-mono tracking-tight">
                {retrievalRate}%
              </div>
              <p className="text-[11px] text-purple-700 font-medium flex items-center gap-1">
                <CheckCircle size={13} />
                {retrievedCount}/{clerkTasks.length} bản hợp đồng gốc lưu kho thành công
              </p>
            </div>

          </div>

          {/* Formula Explanation Banner for Clerk - Clean Card */}
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4.5 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100/70 text-blue-800 rounded-lg">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">
                    Khung tiêu chí đánh giá &amp; tính lương tự động Văn thư (Clerk)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Lương Văn thư per HĐ = Đơn giá nền (100k) * (1 + In Nhanh + Giao VTP + Thu Hồi Kho + Độ Chính Xác)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaClerk(!showFormulaClerk)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer self-start sm:self-auto"
              >
                {showFormulaClerk ? (
                  <><span>Thu gọn</span><ChevronUp size={14} /></>
                ) : (
                  <><span>Chi tiết tỷ lệ</span><ChevronDown size={14} /></>
                )}
              </button>
            </div>

            {showFormulaClerk && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1 text-xs animate-in fade-in duration-150">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                  <span className="font-bold text-emerald-700 block text-xs border-b border-slate-100 pb-1">
                    1. In &amp; Trình ký nhanh
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    In ấn &amp; trình sếp trong vòng ≤ 2h từ khi duyệt bản mềm: <b className="text-emerald-700 font-semibold font-mono bg-emerald-50 px-1 py-0.2 rounded">+10% (+0.1)</b>
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                  <span className="font-bold text-blue-700 block text-xs border-b border-slate-100 pb-1">
                    2. Tạo vận đơn VTP
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Khởi tạo mã Viettel Post &amp; giao shipper đúng hạn: <b className="text-blue-700 font-semibold font-mono bg-blue-50 px-1 py-0.2 rounded">+10% (+0.1)</b>
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                  <span className="font-bold text-purple-700 block text-xs border-b border-slate-100 pb-1">
                    3. Thu hồi &amp; Lưu kho
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Nhận lại bản ký gốc từ đối tác &amp; lưu trữ tủ hồ sơ: <b className="text-purple-700 font-semibold font-mono bg-purple-50 px-1 py-0.2 rounded">+15% (+0.15)</b>
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                  <span className="font-bold text-amber-700 block text-xs border-b border-slate-100 pb-1">
                    4. Độ chính xác giao nhận
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Giao thành công: <b className="text-emerald-700 font-semibold font-mono bg-emerald-50 px-1 py-0.2 rounded">+10%</b> (Nếu sự cố địa chỉ: <b className="text-rose-700 font-semibold font-mono bg-rose-50 px-1 py-0.2 rounded">-20%</b>)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Search and CSV Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <div className="relative min-w-[260px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên HĐ, mã HD, đối tác..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
              />
            </div>

            <button 
              onClick={exportClerkCSV}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download size={14} />
              Xuất Bảng Lương Văn Thư (CSV)
            </button>
          </div>

          {/* Clerk Tasks Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Printer size={16} className="text-blue-600" />
                <span>Bảng lương &amp; đo lường SLA của Văn thư</span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {filteredClerkTasks.length} hồ sơ
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 text-xs font-semibold border-b border-slate-200/80">
                    <th 
                      onClick={() => clerkTable.getColumn('name')?.toggleSorting()}
                      className="py-3 px-4 pl-5 min-w-[220px] cursor-pointer select-none group"
                      title="Sắp xếp theo tên hợp đồng"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Mã &amp; tên hợp đồng</span>
                        {clerkTable.getColumn('name')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-blue-600" />
                        ) : clerkTable.getColumn('name')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-blue-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th 
                      onClick={() => clerkTable.getColumn('partnerName')?.toggleSorting()}
                      className="py-3 px-4 min-w-[190px] max-w-[260px] cursor-pointer select-none group"
                      title="Sắp xếp theo tên đối tác"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Đối tác</span>
                        {clerkTable.getColumn('partnerName')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-blue-600" />
                        ) : clerkTable.getColumn('partnerName')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-blue-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th 
                      onClick={() => clerkTable.getColumn('status')?.toggleSorting()}
                      className="py-3 px-4 min-w-[140px] cursor-pointer select-none group"
                      title="Sắp xếp theo trạng thái quy trình"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Trạng thái quy trình</span>
                        {clerkTable.getColumn('status')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-blue-600" />
                        ) : clerkTable.getColumn('status')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-blue-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                      </div>
                    </th>

                    <th className="py-3 px-3 text-center min-w-[100px]">In ấn (≤ 2h)</th>
                    <th className="py-3 px-3 text-center min-w-[110px]">Mã VTP giao vận</th>
                    <th className="py-3 px-3 text-center min-w-[110px]">Thu hồi lưu kho</th>
                    <th className="py-3 px-3 text-center min-w-[100px]">Độ chính xác</th>
                    <th className="py-3 px-4 text-right min-w-[110px]">Đơn giá nền</th>

                    <th 
                      onClick={() => clerkTable.getColumn('payroll')?.toggleSorting()}
                      className="py-3 px-4 text-right min-w-[130px] cursor-pointer select-none group"
                      title="Sắp xếp theo thành tiền lương"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {clerkTable.getColumn('payroll')?.getIsSorted() === 'asc' ? (
                          <ArrowUp size={13} className="text-blue-600" />
                        ) : clerkTable.getColumn('payroll')?.getIsSorted() === 'desc' ? (
                          <ArrowDown size={13} className="text-blue-600" />
                        ) : (
                          <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                        )}
                        <span>Thành tiền lương</span>
                      </div>
                    </th>

                    <th className="py-3 px-4 pr-5 text-center min-w-[90px]">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {clerkTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 font-medium">
                        Chưa có hồ sơ vật lý nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    clerkTable.getRowModel().rows.map(row => {
                      const task = row.original;
                      const calc = calculateClerkPayroll(task, settings);

                      return (
                        <tr key={task.id} className="hover:bg-slate-50/80 transition-colors duration-100 h-[56px]">
                          <td className="py-2.5 px-4 pl-5">
                            <div className="flex flex-col space-y-0.5">
                              <span className="text-[10px] font-semibold text-slate-500">{task.contractNumber}</span>
                              <span 
                                onClick={() => onSelectContract(task)}
                                className="font-semibold text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-1"
                                title={task.name}
                              >
                                {task.name}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap truncate max-w-[240px]" title={task.partnerName}>
                            {task.partnerName}
                          </td>

                          <td className="py-2.5 px-4">
                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
                              {task.status}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.printSlaCoef > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              +{Math.round(calc.printSlaCoef * 100)}%
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.courierSlaCoef > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              +{Math.round(calc.courierSlaCoef * 100)}%
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.retrievalSlaCoef > 0 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              +{Math.round(calc.retrievalSlaCoef * 100)}%
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              calc.accuracyCoef >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {calc.accuracyCoef >= 0 ? `+${Math.round(calc.accuracyCoef * 100)}%` : `${Math.round(calc.accuracyCoef * 100)}%`}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                            {calc.basePay.toLocaleString('vi-VN')} <span className="text-[10px] text-slate-400">đ</span>
                          </td>

                          <td className="py-2.5 px-4 text-right">
                            <span className="text-sm font-bold text-blue-700">
                              {calc.finalPayroll.toLocaleString('vi-VN')} <span className="text-[10px] font-normal">VNĐ</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-4 pr-5 text-center">
                            <button 
                              onClick={() => onSelectContract(task)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Clerk Table TanStack Pagination Footer */}
            {clerkTable.getFilteredRowModel().rows.length > 0 && (
              <div className="flex items-center justify-between p-3.5 border-t border-slate-100 bg-slate-50/50 text-xs">
                <div className="flex items-center gap-3 text-slate-500">
                  <span>
                    Hiển thị <b className="text-slate-800">{clerkTable.getState().pagination.pageIndex * clerkTable.getState().pagination.pageSize + 1} - {Math.min((clerkTable.getState().pagination.pageIndex + 1) * clerkTable.getState().pagination.pageSize, clerkTable.getFilteredRowModel().rows.length)}</b> / <b className="text-slate-800">{clerkTable.getFilteredRowModel().rows.length}</b> hồ sơ
                  </span>
                  <div className="flex items-center gap-1">
                    <span>Mỗi trang:</span>
                    <select
                      value={clerkTable.getState().pagination.pageSize}
                      onChange={(e) => clerkTable.setPageSize(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={30}>30</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => clerkTable.previousPage()}
                    disabled={!clerkTable.getCanPreviousPage()}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center gap-0.5"
                  >
                    <ChevronLeft size={13} />
                    <span>Trước</span>
                  </button>
                  <span className="px-2 font-semibold text-slate-700">
                    Trang {clerkTable.getState().pagination.pageIndex + 1} / {clerkTable.getPageCount()}
                  </span>
                  <button
                    onClick={() => clerkTable.nextPage()}
                    disabled={!clerkTable.getCanNextPage()}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-slate-600 font-semibold cursor-pointer disabled:cursor-not-allowed flex items-center gap-0.5"
                  >
                    <span>Sau</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL 1: LEGAL SUBMIT DRAFT FILE / GOOGLE DOCS */}
      {activeDraftModalContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                <Upload size={18} />
                <span>Nộp Bản Thảo Hợp Đồng (.docx / Google Docs)</span>
              </div>
              <button 
                onClick={() => setActiveDraftModalContract(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDoSubmitDraft} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800">{activeDraftModalContract.name}</div>
                <div className="text-slate-500 font-mono">Mã: {activeDraftModalContract.contractNumber} • Đối tác: {activeDraftModalContract.partnerName}</div>
                {activeDraftModalContract.deadline && (
                  <div className="text-emerald-700 font-semibold font-mono">
                    Deadline: {new Date(activeDraftModalContract.deadline).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường dẫn Google Docs bản thảo (Nếu có)
                </label>
                <input 
                  type="url" 
                  value={draftDocsLink}
                  onChange={(e) => setDraftDocsLink(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tải lên tệp bản mềm (.docx, .pdf, .zip)
                </label>
                <input 
                  type="file" 
                  onChange={(e) => setDraftFile(e.target.files ? e.target.files[0] : null)}
                  accept=".docx,.doc,.pdf,.zip"
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setActiveDraftModalContract(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload size={14} />
                  {isSubmitting ? 'Đang gửi...' : 'Nộp Bản Thảo Cho Sếp Duyệt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANAGER FEEDBACK / REVISION REQUEST */}
      {activeFeedbackContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                <MessageSquare size={18} />
                <span>Yêu Cầu Chỉnh Sửa Bản Thảo (Feedback Lần {(activeFeedbackContract.feedback_count || 0) + 1})</span>
              </div>
              <button 
                onClick={() => setActiveFeedbackContract(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDoFeedback} className="space-y-4">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs space-y-1 text-amber-900 font-medium">
                <div>Yêu cầu Legal ({activeFeedbackContract.assigned_to || 'Pháp chế'}) chỉnh sửa lại bản mềm hợp đồng.</div>
                <div className="text-[11px] text-amber-700">Lưu ý: Feedback &gt; 2 lần do lỗi soạn thảo sẽ trừ 10% hệ số chất lượng lương task.</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung Yêu cầu Sửa đổi / Lý do feedback <span className="text-red-500">*</span>
                </label>
                <textarea 
                  rows={4}
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="VD: Sửa lại điều khoản thanh toán đợt 2 thành 30 ngày thay vì 15 ngày. Bổ sung bảng phụ lục danh mục thiết bị đi kèm..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setActiveFeedbackContract(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send size={14} />
                  {isSubmitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Chỉnh Sửa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
