import React from 'react';
import { 
  FileText, BarChart2, Settings, Users, Mail, Plus, Trash2, 
  Send, Activity, Clock, CheckCircle, CheckCircle2, Shield, Database, LogOut,
  Layers, Search, Filter, AlertTriangle, Truck, Printer, Check, 
  Camera, Upload, Download, ChevronRight, X, CloudLightning, RefreshCw,
  Home, Inbox, User, AlertCircle, Ban
} from 'lucide-react';
import { useContracts } from './hooks/useContracts';
import { WORKFLOW_STEPS, getStepCount, getContractsSummary } from './constants/workflow';
import { ReportView } from './components/ReportView';
import { AdminSettings } from './components/AdminSettings';
import { SimulatorPanel } from './components/SimulatorPanel';
import { AuthModal } from './components/AuthModal';
import { HistoryModal } from './components/HistoryModal';
import { ContractTable } from './components/ContractTable';
import ContractScanner from './components/ContractScanner';
import { CreateContractForm } from './components/CreateContractForm';
import { ClerkManualMatcher } from './components/ClerkManualMatcher';
import { LegalPayrollDashboard } from './components/LegalPayrollDashboard';
import { CreateDraftingRequestModal } from './components/CreateDraftingRequestModal';
import { Calculator, DollarSign } from 'lucide-react';


export default function App() {
  const {
    currentUser,
    authEmail,
    setAuthEmail,
    authError,
    showAuthModal,
    setShowAuthModal,
    contracts,
    settings,
    setSettings,
    reports,
    simLogs,
    currentTab,
    setCurrentTab,
    activeMobileView,
    setActiveMobileView,
    showUploadModal,
    setShowUploadModal,
    contractFilter,
    setContractFilter,
    searchQuery,
    setSearchQuery,
    selectedContract,
    setSelectedContract,
    showHistoryModal,
    setShowHistoryModal,
    isUploading,
    uploadProgress,
    uploadError,
    setUploadError,
    isManualInputMode,
    setIsManualInputMode,
    pendingActions,
    uploadedFileDetails,
    setUploadedFileDetails,
    originalFile,
    setOriginalFile,
    scanFile,
    setScanFile,
    waybillInputs,
    setWaybillInputs,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    showSimulator,
    setShowSimulator,
    simVtpContractId,
    setSimVtpContractId,
    simVtpStatus,
    setSimVtpStatus,
    simVtpNote,
    setSimVtpNote,
    showScanner,
    setShowScanner,
    preselectedContractForScanner,
    setPreselectedContractForScanner,
    fetchSimLogs,
    handleSignIn,
    handleGoogleSignIn,
    handleSignOut,
    handleContractUpload,
    handleManualContractCreate,
    handleRequestDraftContract,
    handleSubmitDraftContract,
    handleFeedbackDraftContract,
    handleApproveSoftCopy,
    handleConfirmPrinted,
    handleConfirmSigned,
    handleAssignWaybill,
    handleUploadScan,
    handleDirectUploadScan,
    handleScannerUpload,
    handleArchiveContract,
    handleQrTransitionContract,
    handleInviteUser,
    handleRemoveUser,
    handleSaveSettings,
    handleSimulateVtpWebhook,
    handleTriggerSlaCheck,
    handleRejectContract,
    handleReportIssue,
    handleRedraftContract,
    handleReshipContract,
    handleCancelContract,
    handleEditContract,
    handleAddPhysicalNote,
    handleUpdateContractStatus,
    handleToggleVtpConnection,
    checkContractId,
    toast,
    showToast,
  } = useContracts();

  const [showDraftingModal, setShowDraftingModal] = React.useState(false);

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

  const [devModeEnabled, setDevModeEnabled] = React.useState(false);
  const [taskFilter, setTaskFilter] = React.useState<string | null>(null);
  const [cancelContractId, setCancelContractId] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState<string>('');

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Chờ duyệt bản mềm': return 'bg-sky-50/60 text-sky-700 border-sky-200/80';
      case 'Chờ in': return 'bg-rose-50/60 text-rose-700 border-rose-200/80';
      case 'Đang chờ ký': return 'bg-amber-50/60 text-amber-700 border-amber-200/80';
      case 'Chờ tạo vận đơn': return 'bg-indigo-50/60 text-indigo-700 border-indigo-200/80';
      case 'Chờ shipper đến lấy': return 'bg-purple-50/60 text-purple-700 border-purple-200/80';
      case 'Đang giao': return 'bg-blue-50/60 text-blue-700 border-blue-200/80';
      case 'Chờ bản gửi lại': return 'bg-orange-50/60 text-orange-700 border-orange-200/80';
      case 'Hoàn tất': return 'bg-emerald-50/60 text-emerald-700 border-emerald-200/80';
      case 'Bị từ chối ký': return 'bg-red-50 text-red-700 border-red-200/80';
      case 'Sự cố vận chuyển': return 'bg-amber-100 text-amber-850 border-amber-300';
      case 'Đã hủy': return 'bg-slate-100 text-slate-550 border-slate-300';
      default: return 'bg-slate-50 text-slate-700 border-slate-200/60';
    }
  };

  const getDisplayName = (email: string | undefined): string => {
    if (!email) return 'Người dùng';
    if (currentUser?.email === email && currentUser?.name) return currentUser.name;
    const namePart = email.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans antialiased text-slate-800 selection:bg-emerald-100 selection:text-emerald-900" id="app-root">
      {/* Simulation and developer helper bar */}
      {devModeEnabled && (
        <div className="hidden md:flex bg-[#0B0F17] text-slate-400 px-6 py-2.5 items-center justify-between text-[11px] font-mono border-b border-slate-900 z-30 shrink-0" id="sim-developer-bar">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-bold tracking-tight text-slate-200 uppercase">Hệ thống Giả lập Tích hợp Viettel Post & Google Drive</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => handleTriggerSlaCheck()}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer text-slate-400 font-medium"
            >
              <Clock size={12} className="text-slate-500" />
              Kiểm tra SLA nền (Cron Job)
            </button>
            <button 
              onClick={() => setShowSimulator(!showSimulator)} 
              className="flex items-center gap-1.5 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded-md text-[10px] font-bold shadow-xs transition cursor-pointer"
            >
              <CloudLightning size={12} />
              {showSimulator ? 'Đóng Bảng Giả Lập' : 'Mở Giả Lập Webhook / Logs'}
            </button>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/80 py-3 md:py-4.5 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs" id="primary-header">
        <div className="flex items-center gap-2.5 md:gap-3.5 select-none">
          <div className="bg-emerald-50 text-emerald-600 p-2 md:p-2.5 rounded-lg md:rounded-xl border border-emerald-100/80 shadow-xs shrink-0">
            <FileText size={18} className="md:size-[22px] stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight tracking-tight">
              <span className="md:hidden">QL Hợp đồng</span>
              <span className="hidden md:inline">Hệ thống Quản lý Hợp đồng Nội bộ</span>
            </h1>
            <p className="text-[11px] text-slate-505 font-medium mt-0.5 hidden md:block">Tự động hoá quy trình soạn thảo • Giao vận Viettel Post • Đồng bộ Google Drive • AI Extraction</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {currentUser && (
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-slate-700">{currentUser.email}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                <Clock size={11} className="text-slate-300" />
                Đồng bộ tức thì (GMT+7)
              </span>
            </div>
          )}

          {currentUser ? (
            <div className="flex items-center gap-2 md:gap-3 border-l border-slate-200 pl-2 md:pl-4">
              {(currentUser.role === 'admin' || currentUser.role === 'legal') && (
                <button
                  onClick={() => setShowDraftingModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs font-extrabold shadow-sm hover:shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={currentUser.role === 'admin' ? "Sếp hoặc Quản lý tạo giao task soạn thảo cho Legal" : "Tạo Yêu Cầu Soạn Thảo Mới"}
                >
                  <Plus size={15} className="stroke-[3]" />
                  <span className="hidden sm:inline">
                    {currentUser.role === 'admin' ? 'Sếp Giao Task Legal' : 'Tạo Task Soạn Thảo'}
                  </span>
                  <span className="sm:hidden">Giao Task</span>
                </button>
              )}

              <div className={`hidden sm:inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                currentUser.role === 'admin' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                currentUser.role === 'legal' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                'bg-amber-50 text-amber-700 border border-amber-200/60'
              }`}>
                {currentUser.role === 'admin' ? 'Sếp (Admin)' : currentUser.role === 'legal' ? 'Legal' : 'Văn thư'}
              </div>
              <button 
                onClick={handleSignOut}
                title="Đăng xuất"
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer"
            >
              <Shield size={14} />
              Đăng nhập tài khoản
            </button>
          )}
        </div>
      </header>

      {/* Global Toast Notification Popup */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold transition animate-in slide-in-from-top-3 border backdrop-blur-md ${
          toast.type === 'success' ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/40 shadow-emerald-950/20' :
          toast.type === 'error' ? 'bg-slate-900/95 text-rose-300 border-rose-500/40 shadow-rose-950/20' :
          'bg-slate-900/95 text-sky-300 border-sky-500/40'
        }`}>
          {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle size={18} className="text-rose-400 shrink-0" />}
          {toast.type === 'info' && <Clock size={18} className="text-sky-400 shrink-0" />}
          <span className="leading-snug">{toast.message}</span>
        </div>
      )}

      {/* App Body Area */}
      <div className="flex-1 flex flex-col lg:flex-row relative">
        
        {/* Main Workspace */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          
          {/* Unauthenticated State Display */}
          {!currentUser ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 max-w-md mx-auto text-center space-y-6" id="login-welcome-panel">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center border border-emerald-100 shadow-sm">
                <Shield size={32} className="stroke-[2.2]" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Hệ Thống Quản Lý Hợp Đồng Nội Bộ</h2>
                <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
                  Cổng thông tin bảo mật dành cho Ban Giám Đốc, Bộ phận Pháp chế (Legal) &amp; Văn thư (Clerk).
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full text-left space-y-4 shadow-sm">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800">Đăng Nhập Tài Khoản Doanh Nghiệp</h4>
                  <p className="text-[11px] text-slate-400">Sử dụng Google Workspace hoặc SSO công ty để truy cập.</p>
                </div>

                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-md hover:bg-emerald-500 transition duration-150 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <Shield size={16} />
                  Mở Cổng Đăng Nhập SSO / Google
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ----------------- DESKTOP VIEWS (hidden md:block) ----------------- */}
              <div className="hidden md:block space-y-6" id="desktop-workspace-container">
                {/* Navigation tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
                  <button 
                    onClick={() => setCurrentTab('contracts')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition cursor-pointer ${
                      currentTab === 'contracts' 
                        ? 'border-emerald-500 text-emerald-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <FileText size={16} />
                    Danh sách Hợp đồng
                  </button>

                  <button 
                    onClick={() => setCurrentTab('legal-payroll')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition cursor-pointer ${
                      currentTab === 'legal-payroll' 
                        ? 'border-emerald-500 text-emerald-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <Calculator size={16} />
                    Tính Lương &amp; KPI (Legal &amp; Văn thư)
                  </button>

                  {currentUser.role === 'admin' && (
                    <>
                      <button 
                        onClick={() => setCurrentTab('reports')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition cursor-pointer ${
                          currentTab === 'reports' 
                            ? 'border-emerald-500 text-emerald-600' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <BarChart2 size={16} />
                        Dashboard Báo cáo
                      </button>
                      <button 
                        onClick={() => setCurrentTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition cursor-pointer ${
                          currentTab === 'settings' 
                            ? 'border-emerald-500 text-emerald-600' 
                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <Settings size={16} />
                        Cài đặt Admin
                      </button>
                    </>
                  )}
                </div>

                {/* ----------------- CONTRACTS TAB ----------------- */}
                {currentTab === 'contracts' && (
                  <div className="space-y-3.5">

                    {/* 3-COLUMN UNIFIED ACTION & MONITORING STRIP ON A SINGLE ROW */}
                    {(() => {
                      const pendingDrafts = contracts.filter(c => c.status === 'Chờ duyệt bản mềm');
                      const slaBreachedContracts = contracts.filter(c => c.slaBreached);
                      const myPendingTasks = contracts.filter(c => 
                        c.assigned_to === currentUser?.email && c.status === 'Chờ soạn thảo'
                      );

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                          {/* Col 1: Luồng 1 • Pháp chế & Soạn thảo */}
                          <div className="bg-gradient-to-r from-emerald-500/5 via-white to-white p-3 sm:p-3.5 rounded-xl border border-emerald-200/80 shadow-2xs hover:border-emerald-300 transition flex items-center justify-between gap-3 min-h-[68px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 bg-emerald-100/70 text-emerald-800 rounded-lg shrink-0">
                                <Plus size={15} className="stroke-[2.5]" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 shrink-0">Luồng 1</span>
                                  <h3 className="text-xs font-bold text-slate-900 truncate">Yêu Cầu Soạn Thảo</h3>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">Sếp giao Legal soạn thảo &amp; đếm ngược SLA</p>
                              </div>
                            </div>
                            {(currentUser.role === 'admin' || currentUser.role === 'legal') && (
                              <button
                                onClick={() => setShowDraftingModal(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                              >
                                <Plus size={13} className="stroke-[2.5]" />
                                <span>Tạo Task</span>
                              </button>
                            )}
                          </div>

                          {/* Col 2: Luồng 2 • Văn thư & In ấn */}
                          <div className="bg-gradient-to-r from-blue-500/5 via-white to-white p-3 sm:p-3.5 rounded-xl border border-blue-200/80 shadow-2xs hover:border-blue-300 transition flex items-center justify-between gap-3 min-h-[68px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 bg-blue-100/70 text-blue-800 rounded-lg shrink-0">
                                <FileText size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 shrink-0">Luồng 2</span>
                                  <h3 className="text-xs font-bold text-slate-900 truncate">Thêm Hợp Đồng Có Sẵn</h3>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">File PDF/bản giấy vào in ấn &amp; vận đơn VTP</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowUploadModal(true)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                            >
                              <FileText size={13} />
                              <span>Nhập HĐ</span>
                            </button>
                          </div>

                          {/* Col 3: Giám sát SLA / Chờ Sếp Duyệt / Hạn Chót Cá Nhân */}
                          {currentUser.role === 'admin' ? (
                            pendingDrafts.length > 0 ? (
                              <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-white p-3 sm:p-3.5 rounded-xl border border-amber-200/90 shadow-2xs hover:border-amber-300 transition flex items-center justify-between gap-3 min-h-[68px]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 bg-amber-100/80 text-amber-800 rounded-lg shrink-0">
                                    <AlertCircle size={15} className="text-amber-700" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold text-amber-900 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300/80 shrink-0">
                                        Chờ duyệt ({pendingDrafts.length})
                                      </span>
                                      <h3 className="text-xs font-bold text-slate-900 truncate" title={pendingDrafts[0].name}>
                                        {pendingDrafts[0].name}
                                      </h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                      Soạn bởi: <b className="text-slate-700">{pendingDrafts[0].assigned_to}</b>
                                      {pendingDrafts.length > 1 && <span className="ml-1 text-amber-800 font-semibold">(+{pendingDrafts.length - 1} khác)</span>}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleApproveSoftCopy(pendingDrafts[0].id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-2xs transition shrink-0 cursor-pointer active:scale-95"
                                >
                                  Duyệt Ngay
                                </button>
                              </div>
                            ) : (
                              <div className="bg-gradient-to-r from-emerald-500/5 via-slate-50/50 to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 min-h-[68px]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                                    <CheckCircle size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 shrink-0">Giám sát</span>
                                      <h3 className="text-xs font-bold text-slate-900 truncate">Quy trình thông suốt</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {slaBreachedContracts.length > 0 ? `${slaBreachedContracts.length} hợp đồng trễ hạn cần rà soát` : '0 bản thảo chờ duyệt, SLA ổn định'}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200/70 shrink-0">
                                  100% SLA
                                </span>
                              </div>
                            )
                          ) : currentUser.role === 'legal' ? (
                            myPendingTasks.length > 0 ? (
                              <div className="bg-gradient-to-r from-blue-500/10 via-blue-50/40 to-white p-3 sm:p-3.5 rounded-xl border border-blue-200/80 shadow-2xs flex items-center justify-between gap-3 min-h-[68px]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 bg-blue-100 text-blue-800 rounded-lg shrink-0">
                                    <Clock size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 shrink-0">Hạn chót ({myPendingTasks.length})</span>
                                      <h3 className="text-xs font-bold text-slate-900 truncate">{myPendingTasks[0].name}</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                      Hạn: <b className="text-slate-700">{myPendingTasks[0].deadline ? new Date(myPendingTasks[0].deadline).toLocaleDateString('vi-VN') : 'Trong ngày'}</b>
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200/70 shrink-0">
                                  Đang xử lý
                                </span>
                              </div>
                            ) : (
                              <div className="bg-gradient-to-r from-slate-50 via-white to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 min-h-[68px]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg shrink-0">
                                    <CheckCircle size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 shrink-0">Legal</span>
                                      <h3 className="text-xs font-bold text-slate-900 truncate">Hoàn tất nhiệm vụ</h3>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">Không còn task soạn thảo tồn đọng</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md shrink-0">
                                  Sẵn sàng
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="bg-gradient-to-r from-slate-50 via-white to-white p-3 sm:p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3 min-h-[68px]">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                                  <Printer size={15} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 shrink-0">Văn thư</span>
                                    <h3 className="text-xs font-bold text-slate-900 truncate">Trạm xử lý hồ sơ</h3>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">In ấn, trình ký và phát vận đơn VTP</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200/60 shrink-0">
                                Trực tuyến
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {/* NEW GLOBAL 10-STEP TIMELINE DASHBOARD FOR DESKTOP */}
                    <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5" id="global-workflow-dashboard">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <Layers size={17} className="text-emerald-600" />
                          <h2 className="text-xs font-bold text-slate-900 font-sans">Tiến trình liên thông quy trình (10 bước SLA)</h2>
                          {(() => {
                            const filteredForSummary = contracts.filter(c => {
                              if (contractFilter !== 'All') {
                                if (contractFilter === 'Exception') {
                                  if (c.status !== 'Bị từ chối ký' && c.status !== 'Sự cố vận chuyển') return false;
                                } else if (contractFilter === 'Overdue') {
                                  if (!c.slaBreached) return false;
                                } else {
                                  if (c.status !== contractFilter) return false;
                                }
                              }
                              if (searchQuery.trim() !== '') {
                                const q = searchQuery.trim().toLowerCase();
                                const numMatch = c.contractNumber?.toLowerCase().includes(q);
                                const nameMatch = c.name?.toLowerCase().includes(q);
                                const partMatch = c.partnerName?.toLowerCase().includes(q);
                                const wayMatch = c.waybillCode ? c.waybillCode.toLowerCase().includes(q) : false;
                                if (!numMatch && !nameMatch && !partMatch && !wayMatch) return false;
                              }
                              return true;
                            });
                            const { total, active, cancelled } = getContractsSummary(contracts);
                            return (
                              <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                                Tổng {total} bộ ({active} đang xử lý, {cancelled} đã hủy)
                              </span>
                            );
                          })()}
                        </div>
                        {contractFilter !== 'All' && (
                          <button 
                            onClick={() => setContractFilter('All')}
                            className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 transition"
                          >
                            <RefreshCw size={12} className="animate-spin-slow" />
                            Xem tất cả hồ sơ
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 sm:gap-2 relative">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const IconComponent = step.icon;
                          const count = getStepCount(step, contracts);
                          const isCurrentFilter = contractFilter === step.filterVal;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setContractFilter(isCurrentFilter ? 'All' : step.filterVal);
                              }}
                              className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-[76px] transition duration-150 z-10 bg-white cursor-pointer group active:scale-95 ${
                                isCurrentFilter 
                                  ? `${step.activeRing} border-transparent shadow-xs bg-slate-50` 
                                  : 'border-slate-200/80 hover:border-slate-300 hover:shadow-2xs'
                              }`}
                            >
                              <div className="flex justify-between items-start w-full">
                                <div className={`${step.color} p-1 rounded-lg border group-hover:scale-105 transition duration-150 shrink-0`}>
                                  <IconComponent size={13} />
                                </div>
                                <span className={`text-sm font-bold leading-none ${isCurrentFilter ? 'text-slate-900 scale-105' : 'text-slate-700'}`}>
                                  {count}
                                </span>
                              </div>
                              <div className="mt-1 min-w-0 w-full">
                                <p className="text-[10px] font-semibold text-slate-700 tracking-tight leading-snug truncate" title={step.label}>
                                  {step.label}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ROLE WORKFLOW ACTIONS BAR */}
                    {currentUser.role === 'legal' && (
                      <CreateContractForm
                        onSubmit={handleManualContractCreate}
                        checkContractId={checkContractId}
                        isUploading={isUploading}
                        uploadProgress={uploadProgress}
                        uploadError={uploadError}
                        setUploadError={setUploadError}
                        uploadedFileDetails={uploadedFileDetails}
                        setUploadedFileDetails={setUploadedFileDetails}
                      />
                    )}

                    {currentUser.role === 'clerk' && (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4" id="clerk-tasks-summary">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Printer size={20} className="text-slate-505" />
                          <h2 className="text-base font-bold text-slate-900">Bảng Công việc Văn thư (Cần xử lý vật lý)</h2>
                        </div>

                        {/* Interactive Camera Scanner Entrypoint */}
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                          <div className="space-y-1">
                            <p className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Trạm Số hóa Camera Thông minh!
                            </p>
                            <p className="text-[11px] text-emerald-700 leading-relaxed">
                              Có tập hợp đồng khách ký gửi lại bằng giấy? Bật máy ảnh để scan tự động bóc tách viền, băm nhiều trang, ghép thành 1 tệp PDF duy nhất và đối khớp ngay lập tức.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setPreselectedContractForScanner(null);
                              setShowScanner(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] px-4 py-2.5 rounded-lg shadow-sm flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
                          >
                            <Camera size={13} />
                            Bật Camera Scanner
                          </button>
                        </div>

                        {/* Clerk Manual Matching & PDF Upload station */}
                        <ClerkManualMatcher 
                          contracts={contracts}
                          onUploadScan={handleDirectUploadScan}
                          isUploading={isUploading}
                        />
                      </div>
                    )}

                    {/* Desktop Contracts Data Grid Panel */}
                    <ContractTable
                      contracts={contracts}
                      currentUser={currentUser}
                      contractFilter={contractFilter}
                      setContractFilter={setContractFilter}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      handleConfirmPrinted={handleConfirmPrinted}
                      handleConfirmSigned={handleConfirmSigned}
                      waybillInputs={waybillInputs}
                      setWaybillInputs={setWaybillInputs}
                      handleAssignWaybill={handleAssignWaybill}
                      setPreselectedContractForScanner={setPreselectedContractForScanner}
                      setShowScanner={setShowScanner}
                      scanFile={scanFile}
                      setScanFile={setScanFile}
                      handleUploadScan={handleUploadScan}
                      handleArchiveContract={handleArchiveContract}
                      setSelectedContract={setSelectedContract}
                      setShowHistoryModal={setShowHistoryModal}
                      handleRejectContract={handleRejectContract}
                      handleReportIssue={handleReportIssue}
                      handleRedraftContract={handleRedraftContract}
                      handleReshipContract={handleReshipContract}
                      handleCancelContract={handleCancelContract}
                      handleEditContract={handleEditContract}
                      handleAddPhysicalNote={handleAddPhysicalNote}
                      handleUpdateContractStatus={handleUpdateContractStatus}
                      pendingActions={pendingActions}
                    />
                  </div>
                )}
                {/* ----------------- LEGAL PAYROLL TAB ----------------- */}
                {currentTab === 'legal-payroll' && (
                  <LegalPayrollDashboard
                    contracts={contracts}
                    currentUser={currentUser}
                    settings={settings || undefined}
                    users={settings?.users || []}
                    onRequestNewDraft={() => setShowDraftingModal(true)}
                    onSubmitDraft={handleSubmitDraftContract}
                    onFeedbackDraft={handleFeedbackDraftContract}
                    onApproveSoftCopy={handleApproveSoftCopy}
                    onSelectContract={(contract) => {
                      setSelectedContract(contract);
                      setShowHistoryModal(true);
                    }}
                  />
                )}

                {/* ----------------- REPORTS TAB ----------------- */}
                {currentUser.role === 'admin' && currentTab === 'reports' && reports && (
                  <ReportView reports={reports} contracts={contracts} />
                )}

                {/* ----------------- ADMIN SETTINGS TAB ----------------- */}
                {currentUser.role === 'admin' && currentTab === 'settings' && settings && (
                  <AdminSettings
                    settings={settings}
                    setSettings={setSettings}
                    inviteEmail={inviteEmail}
                    setInviteEmail={setInviteEmail}
                    inviteRole={inviteRole}
                    setInviteRole={setInviteRole}
                    handleInviteUser={handleInviteUser}
                    handleRemoveUser={handleRemoveUser}
                    handleSaveSettings={handleSaveSettings}
                  />
                )}
              </div>

              {/* ----------------- MOBILE VIEWS (md:hidden) ----------------- */}
              <div className="md:hidden block space-y-4 pb-20" id="mobile-workspace-container">
                {activeMobileView === 'home' && (
                  <div className="space-y-5">
                    {/* Welcome Section */}
                    <div className="flex items-center justify-between bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-xs">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Phiên làm việc</p>
                        <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                          Xin chào, {getDisplayName(currentUser?.email)}!
                        </h2>
                        <div className="flex flex-col gap-1 mt-1.5">
                          <p className="text-xs text-slate-505 font-medium">
                            Hôm nay có <span className="font-extrabold text-slate-900 font-mono">{WORKFLOW_STEPS.reduce((acc, step) => acc + getStepCount(step, contracts), 0)}</span> việc cần xử lý.
                          </p>
                          {(reports?.overdueContracts?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-150 w-fit">
                              <AlertTriangle size={10} className="animate-bounce" />
                              {(reports?.overdueContracts?.length || 0)} hồ sơ vượt SLA cảnh báo!
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center font-black text-sm shadow-inner uppercase shrink-0 font-sans">
                        {currentUser?.role === 'admin' ? 'BOSS' : currentUser?.role === 'legal' ? 'LEGAL' : 'VT'}
                      </div>
                    </div>

                    {/* 8-Step Vertical Stepper / Timeline Dashboard */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Tiến trình vận hành 8 bước (SLA)</h3>
                      </div>
                      
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                        {WORKFLOW_STEPS.map((step, idx) => {
                          const IconComponent = step.icon;
                          const count = getStepCount(step, contracts);
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setTaskFilter(step.filterVal);
                                setActiveMobileView('tasks');
                              }}
                              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition cursor-pointer text-left group active:scale-98"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`${step.mobileColor} p-1.5 rounded-lg border shrink-0`}>
                                  <IconComponent size={14} />
                                </div>
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <h4 className="text-xs font-extrabold text-slate-800 leading-none">{step.label}</h4>
                                  <p className="text-[10px] text-slate-400 truncate pr-2 mt-0.5">{step.desc}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                                <span className="text-xs font-black text-slate-800 font-mono bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/50">
                                  {count}
                                </span>
                                <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section: Hồ sơ khẩn cấp cần chú ý (SLA) */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-rose-500 animate-pulse" />
                          Hồ sơ trễ hạn / Cận SLA
                        </h3>
                        {Array.isArray(reports?.overdueContracts) && reports.overdueContracts.length > 0 && (
                          <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                            {reports.overdueContracts.length} hồ sơ
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {!Array.isArray(reports?.overdueContracts) || reports.overdueContracts.length === 0 ? (
                          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4.5 text-center space-y-1">
                            <p className="text-emerald-700 text-xs font-bold font-sans">🎉 Không có hồ sơ bị trễ hạn</p>
                            <p className="text-emerald-600/80 text-[10px] leading-relaxed">Tuyệt vời! Toàn bộ hồ sơ đang được các bộ phận liên thông xử lý đúng tiến độ SLA.</p>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100/70 overflow-hidden shadow-2xs">
                            {reports.overdueContracts.map((contract) => (
                              <div 
                                key={contract.id} 
                                className="p-3.5 hover:bg-slate-50/50 transition flex items-center justify-between gap-3 bg-rose-50/10"
                              >
                                <div className="flex-1 min-w-0 space-y-1">
                                  {/* Line 1: Code, SLA, Partner */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 leading-none">
                                      #{contract.contractNumber}
                                    </span>
                                    <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-extrabold px-1 py-0.5 rounded leading-none uppercase">
                                      TRỄ SLA
                                    </span>
                                    <span className="text-[10px] text-slate-505 font-semibold truncate max-w-[120px]">
                                      {contract.partnerName}
                                    </span>
                                  </div>

                                  {/* Line 2: Document Name (Truncated) */}
                                  <h4 className="font-bold text-slate-800 text-[11px] leading-snug truncate" title={contract.name}>
                                    {contract.name}
                                  </h4>
                                </div>

                                {/* Right Side: Status badge & Slim action button */}
                                <div className="shrink-0 flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none shrink-0 ${
                                    contract.status === 'Chờ in' ? 'bg-rose-50/60 text-rose-700 border-rose-200/80' :
                                    contract.status === 'Đang chờ ký' ? 'bg-amber-50/60 text-amber-700 border-amber-200/80' :
                                    contract.status === 'Chờ tạo vận đơn' ? 'bg-indigo-50/60 text-indigo-700 border-indigo-200/80' :
                                    contract.status === 'Chờ shipper đến lấy' ? 'bg-purple-50/60 text-purple-700 border-purple-200/80' :
                                    contract.status === 'Đang giao' ? 'bg-blue-50/60 text-blue-700 border-blue-200/80' :
                                    contract.status === 'Chờ bản gửi lại' ? 'bg-orange-50/60 text-orange-700 border-orange-200/80' :
                                    contract.status === 'Hoàn tất' ? 'bg-emerald-50/60 text-emerald-700 border-emerald-200/80' :
                                    contract.status === 'Bị từ chối ký' ? 'bg-red-50 text-red-705 border-red-200/80' :
                                    contract.status === 'Sự cố vận chuyển' ? 'bg-amber-50/70 text-amber-800 border-amber-200/60' :
                                    'bg-slate-50 text-slate-700 border-slate-200/60'
                                  }`}>
                                    {contract.status}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTaskFilter(contract.status);
                                      setActiveMobileView('tasks');
                                    }}
                                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition active:scale-95 shrink-0 whitespace-nowrap cursor-pointer flex items-center gap-0.5"
                                  >
                                    Xử lý ➔
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Performance metrics (Chỉ dành cho Sếp/Admin) */}
                    {reports && currentUser?.role === 'admin' && (
                      <div className="bg-white p-4.5 rounded-2xl border border-slate-200/50 shadow-xs space-y-3.5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                            <Activity size={14} className="text-emerald-500" />
                            Đo lường SLA (Dành riêng cho Sếp)
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md uppercase font-mono">Báo cáo Admin</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/50 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Thời in</p>
                            <p className="text-xs font-black text-slate-800 mt-1">{reports?.averages?.avgUploadToPrintHours ?? '0.0'}h</p>
                            <p className="text-[7px] text-slate-400 mt-0.5 font-medium">Pháp chế ➔ In</p>
                          </div>
                          <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-200/50 text-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">Ký duyệt</p>
                            <p className="text-xs font-black text-slate-800 mt-1">{reports?.averages?.avgPrintToSignHours ?? '0.0'}h</p>
                            <p className="text-[7px] text-slate-400 mt-0.5 font-medium">In ➔ Ký tay</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeMobileView === 'tasks' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quy trình vật lý</p>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5 font-sans">Nhiệm vụ văn thư</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Xử lý in ấn, ký duyệt và giao nhận.</p>
                    </div>

                    {/* Task grids (Đồng bộ 100% màu sắc & icon với 7 bước) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: 'Chờ in ấn', count: contracts.filter(c => c.status === 'Chờ in').length, color: 'bg-rose-50 border-rose-100 text-rose-700', activeRing: 'ring-2 ring-rose-500', icon: Printer, filterVal: 'Chờ in' },
                        { label: 'Chờ sếp ký', count: contracts.filter(c => c.status === 'Đang chờ ký').length, color: 'bg-amber-50 border-amber-100 text-amber-700', activeRing: 'ring-2 ring-amber-500', icon: Clock, filterVal: 'Đang chờ ký' },
                        { label: 'Cần gán mã VTP', count: contracts.filter(c => c.status === 'Chờ tạo vận đơn').length, color: 'bg-indigo-50 border-indigo-100 text-indigo-700', activeRing: 'ring-2 ring-indigo-500', icon: FileText, filterVal: 'Chờ tạo vận đơn' },
                        { label: 'Chờ shipper lấy', count: contracts.filter(c => c.status === 'Chờ shipper đến lấy').length, color: 'bg-purple-50 border-purple-100 text-purple-700', activeRing: 'ring-2 ring-purple-500', icon: Inbox, filterVal: 'Chờ shipper đến lấy' },
                        { label: 'Đang giao (VTP)', count: contracts.filter(c => c.status === 'Đang giao').length, color: 'bg-blue-50 border-blue-100 text-blue-700', activeRing: 'ring-2 ring-blue-500', icon: Truck, filterVal: 'Đang giao' },
                        { label: 'Chờ bản gửi lại', count: contracts.filter(c => c.status === 'Chờ bản gửi lại').length, color: 'bg-orange-50 border-orange-100 text-orange-700', activeRing: 'ring-2 ring-orange-500', icon: RefreshCw, filterVal: 'Chờ bản gửi lại' },
                        { label: 'Đã hoàn tất', count: contracts.filter(c => c.status === 'Hoàn tất').length, color: 'bg-emerald-50 border-emerald-100 text-emerald-700', activeRing: 'ring-2 ring-emerald-500', icon: CheckCircle, filterVal: 'Hoàn tất' }
                      ].map((card, index) => {
                        const IconComponent = card.icon;
                        const isCurrentFilter = taskFilter === card.filterVal;
                        return (
                          <button 
                            key={index}
                            onClick={() => {
                              setTaskFilter(isCurrentFilter ? null : card.filterVal);
                            }}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 shadow-2xs transition active:scale-95 cursor-pointer bg-white ${
                              isCurrentFilter ? `${card.activeRing} border-transparent shadow-xs` : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-start w-full">
                              <div className={`${card.color} p-1 rounded-lg border`}>
                                <IconComponent size={12} />
                              </div>
                              <span className="text-sm font-black text-slate-900 font-mono leading-none">{card.count}</span>
                            </div>
                            <p className="text-[9px] font-black text-slate-650 uppercase tracking-wide truncate mt-1">{card.label}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Scanner Entrypoint */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-black text-emerald-800 flex items-center gap-1.5 font-sans">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Scan &amp; Đối khớp Camera
                        </p>
                        <p className="text-[11px] text-emerald-700 leading-relaxed mt-1">
                          Chụp tập hồ sơ giấy của khách gửi lại để tự động ghép thành tệp PDF và đối khớp vận đơn tức thì.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setPreselectedContractForScanner(null);
                          setShowScanner(true);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 rounded-xl shadow flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer active:scale-98"
                      >
                        <Camera size={14} />
                        Bật Camera Scan
                      </button>
                    </div>

                    {/* Section: Pending tasks */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                            {taskFilter ? `Hồ sơ ${taskFilter}` : 'Hồ sơ cần xử lý'}
                          </h3>
                          {taskFilter && (
                            <button 
                              onClick={() => setTaskFilter(null)}
                              className="text-[9px] bg-slate-100 text-slate-650 hover:bg-slate-200 px-2 py-0.5 rounded-full font-bold transition flex items-center gap-0.5 cursor-pointer"
                            >
                              Xóa lọc <X size={8} />
                            </button>
                          )}
                        </div>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                          {contracts.filter(c => {
                            const matchFilter = !taskFilter || c.status === taskFilter;
                            const matchSearch = searchQuery === '' || 
                              c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
                            const isCompletedSelected = taskFilter === 'Hoàn tất';
                            const statusMatch = isCompletedSelected ? (c.status === 'Hoàn tất') : (c.status !== 'Hoàn tất');
                            return c.status !== 'Đã hủy' && statusMatch && matchFilter && matchSearch;
                          }).length} bản
                        </span>
                      </div>

                      {/* Lọc/Tìm kiếm nhanh trên Mobile */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="text"
                          placeholder="Mã số HĐ, đối tác, tên hồ sơ..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:border-slate-300 shadow-xs"
                        />
                      </div>

                      <div className="space-y-3">
                        {contracts.filter(c => {
                          const matchFilter = !taskFilter || c.status === taskFilter;
                          const matchSearch = searchQuery === '' || 
                            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
                          const isCompletedSelected = taskFilter === 'Hoàn tất';
                          const statusMatch = isCompletedSelected ? (c.status === 'Hoàn tất') : (c.status !== 'Hoàn tất');
                          return c.status !== 'Đã hủy' && statusMatch && matchFilter && matchSearch;
                        }).length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4">
                            <p className="text-slate-400 text-xs italic">Không tìm thấy hồ sơ nào chờ xử lý phù hợp</p>
                          </div>
                        ) : (
                          contracts.filter(c => {
                            const matchFilter = !taskFilter || c.status === taskFilter;
                            const matchSearch = searchQuery === '' || 
                              c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.partnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              c.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
                            const isCompletedSelected = taskFilter === 'Hoàn tất';
                            const statusMatch = isCompletedSelected ? (c.status === 'Hoàn tất') : (c.status !== 'Hoàn tất');
                            return c.status !== 'Đã hủy' && statusMatch && matchFilter && matchSearch;
                          }).map((contract) => (
                            <div key={contract.id} className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">#{contract.contractNumber}</span>
                                  <h4 className="text-xs font-extrabold text-slate-800 mt-1 leading-snug">{contract.name}</h4>
                                  <p className="text-[10px] text-slate-500">Đối tác: {contract.partnerName}</p>
                                </div>
                                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${getStatusBadgeStyle(contract.status)}`}>
                                  {contract.status}
                                </span>
                              </div>

                              {/* Action items */}
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/50 flex flex-col items-stretch justify-center gap-2">
                                {contract.status === 'Chờ tạo vận đơn' ? (
                                  <div className="flex flex-col gap-1.5 w-full">
                                    <div className="flex gap-1">
                                      <input 
                                        type="text"
                                        placeholder="Mã vận đơn VTP..."
                                        value={waybillInputs[contract.id] || ''}
                                        onChange={(e) => setWaybillInputs({ ...waybillInputs, [contract.id]: e.target.value })}
                                        className="flex-1 bg-white border border-slate-200/50 rounded-lg px-2.5 py-1 text-[11px] font-mono focus:outline-none"
                                      />
                                      <button 
                                        onClick={() => handleAssignWaybill(contract.id)}
                                        className="text-[10px] font-black text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-500 transition shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                                      >
                                        <Truck size={10} />
                                        Gửi VTP
                                      </button>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-0.5">
                                      <span className="text-[10px] text-slate-550 font-semibold">Khác:</span>
                                      <div className="flex gap-1.5">
                                        <button 
                                          onClick={() => {
                                            setSelectedContract(contract);
                                            setShowHistoryModal(true);
                                          }}
                                          className="text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                                        >
                                          Chi tiết
                                        </button>
                                        <button 
                                          onClick={() => {
                                            setCancelContractId(contract.id);
                                            setCancelReason('');
                                          }}
                                          className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center w-full gap-2">
                                    <span className="text-[10px] text-slate-550 font-semibold">Thao tác nhanh:</span>
                                    <div className="flex gap-1.5">
                                      <button 
                                        onClick={() => {
                                          setSelectedContract(contract);
                                          setShowHistoryModal(true);
                                        }}
                                        className="text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                                      >
                                        Chi tiết
                                      </button>
                                      {contract.status === 'Chờ duyệt bản mềm' && (
                                        <button 
                                          onClick={() => handleApproveSoftCopy(contract.id)}
                                          className="text-[10px] font-black text-white bg-sky-600 px-3 py-1.5 rounded-lg hover:bg-sky-500 transition shadow-xs flex items-center gap-1 cursor-pointer animate-pulse"
                                        >
                                          <CheckCircle size={10} />
                                          Duyệt bản mềm
                                        </button>
                                      )}
                                      {contract.status === 'Chờ in' && (
                                        <button 
                                          onClick={() => handleConfirmPrinted(contract.id)}
                                          className="text-[10px] font-black text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-500 transition shadow-xs flex items-center gap-1 cursor-pointer animate-pulse"
                                        >
                                          <Printer size={10} />
                                          Đã in
                                        </button>
                                      )}
                                      {contract.status === 'Đang chờ ký' && (
                                        <button 
                                          onClick={() => handleConfirmSigned(contract.id)}
                                          className="text-[10px] font-black text-white bg-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-500 transition shadow-xs flex items-center gap-1 cursor-pointer"
                                        >
                                          <CheckCircle size={10} />
                                          Đã ký
                                        </button>
                                      )}
                                      {contract.status === 'Chờ bản gửi lại' && (
                                        <button 
                                          onClick={() => {
                                            setPreselectedContractForScanner(contract);
                                            setShowScanner(true);
                                          }}
                                          className="text-[10px] font-black text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-500 transition shadow-xs flex items-center gap-1 cursor-pointer animate-pulse"
                                        >
                                          <Camera size={10} />
                                          Quét Scan
                                        </button>
                                      )}
                                      <button 
                                        onClick={() => {
                                          setCancelContractId(contract.id);
                                          setCancelReason('');
                                        }}
                                        className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                      >
                                        Hủy
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Self-contained Inline Cancel Panel */}
                              {cancelContractId === contract.id && (
                                <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100/80 space-y-2 mt-2">
                                  <div className="flex items-center gap-1.5 border-b border-rose-100 pb-1">
                                    <Ban size={12} className="text-rose-600" />
                                    <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Hủy bỏ hồ sơ quy trình</span>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Lý do hủy (Bắt buộc):</label>
                                    <textarea
                                      rows={2}
                                      value={cancelReason}
                                      onChange={(e) => setCancelReason(e.target.value)}
                                      placeholder="Nhập lý do chi tiết..."
                                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-1.5 text-[9px]">
                                    <button 
                                      onClick={() => {
                                        setCancelContractId(null);
                                        setCancelReason('');
                                      }}
                                      className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded font-bold cursor-pointer"
                                    >
                                      Đóng
                                    </button>
                                    <button 
                                      onClick={() => {
                                        if (!cancelReason.trim()) {
                                          alert('Vui lòng điền lý do hủy hồ sơ!');
                                          return;
                                        }
                                        handleCancelContract(contract.id, cancelReason);
                                        setCancelContractId(null);
                                        setCancelReason('');
                                      }}
                                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold cursor-pointer"
                                    >
                                      Xác nhận Hủy
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeMobileView === 'contracts' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Hồ sơ</p>
                        <h2 className="text-lg font-bold text-slate-900 mt-0.5">Danh sách hợp đồng</h2>
                      </div>
                      {currentUser?.role === 'legal' && (
                        <button 
                          onClick={() => setShowUploadModal(true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl shadow flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
                          title="Thêm hợp đồng mới"
                        >
                          <Plus size={18} />
                        </button>
                      )}
                    </div>

                    <ContractTable
                      contracts={contracts}
                      currentUser={currentUser}
                      contractFilter={contractFilter}
                      setContractFilter={setContractFilter}
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      handleConfirmPrinted={handleConfirmPrinted}
                      handleConfirmSigned={handleConfirmSigned}
                      waybillInputs={waybillInputs}
                      setWaybillInputs={setWaybillInputs}
                      handleAssignWaybill={handleAssignWaybill}
                      setPreselectedContractForScanner={setPreselectedContractForScanner}
                      setShowScanner={setShowScanner}
                      scanFile={scanFile}
                      setScanFile={setScanFile}
                      handleUploadScan={handleUploadScan}
                      handleArchiveContract={handleArchiveContract}
                      setSelectedContract={setSelectedContract}
                      setShowHistoryModal={setShowHistoryModal}
                      handleRejectContract={handleRejectContract}
                      handleReportIssue={handleReportIssue}
                      handleCancelContract={handleCancelContract}
                      handleEditContract={handleEditContract}
                      handleUpdateContractStatus={handleUpdateContractStatus}
                      pendingActions={pendingActions}
                    />
                  </div>
                )}

                {activeMobileView === 'payroll' && (
                  <div className="space-y-4">
                    <LegalPayrollDashboard
                      contracts={contracts}
                      currentUser={currentUser}
                      settings={settings || undefined}
                      users={settings?.users || []}
                      onRequestNewDraft={() => setShowDraftingModal(true)}
                      onSubmitDraft={handleSubmitDraftContract}
                      onFeedbackDraft={handleFeedbackDraftContract}
                      onApproveSoftCopy={handleApproveSoftCopy}
                      onSelectContract={(contract) => {
                        setSelectedContract(contract);
                        setShowHistoryModal(true);
                      }}
                    />
                  </div>
                )}

                {activeMobileView === 'reports' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl shadow">
                      <button
                        onClick={() => setActiveMobileView('profile')}
                        className="text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 active:scale-95 transition"
                      >
                        <ChevronRight size={16} className="rotate-180 text-emerald-400" />
                        Quay lại Trang cá nhân
                      </button>
                      <span className="text-xs font-black text-emerald-400 font-mono flex items-center gap-1.5">
                        <BarChart2 size={14} />
                        BÁO CÁO KPI SYSTEM
                      </span>
                    </div>
                    {reports && <ReportView reports={reports} contracts={contracts} />}
                  </div>
                )}

                {activeMobileView === 'settings' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl shadow">
                      <button
                        onClick={() => setActiveMobileView('profile')}
                        className="text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 active:scale-95 transition"
                      >
                        <ChevronRight size={16} className="rotate-180 text-emerald-400" />
                        Quay lại Trang cá nhân
                      </button>
                      <span className="text-xs font-black text-emerald-400 font-mono flex items-center gap-1.5">
                        <Settings size={14} />
                        CÀI ĐẶT ADMIN
                      </span>
                    </div>
                    {settings && (
                      <AdminSettings
                        settings={settings}
                        setSettings={setSettings}
                        inviteEmail={inviteEmail}
                        setInviteEmail={setInviteEmail}
                        inviteRole={inviteRole}
                        setInviteRole={setInviteRole}
                        handleInviteUser={handleInviteUser}
                        handleRemoveUser={handleRemoveUser}
                        handleSaveSettings={handleSaveSettings}
                        currentUser={currentUser}
                        devModeEnabled={devModeEnabled}
                        setDevModeEnabled={setDevModeEnabled}
                      />
                    )}
                  </div>
                )}

                {activeMobileView === 'profile' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">THÔNG TIN HOẠT ĐỘNG</p>
                      <h2 className="text-xl font-bold text-slate-900 mt-0.5">Trang Cá Nhân</h2>
                    </div>

                    {/* Account info card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 flex items-center justify-center font-black text-lg shadow-inner uppercase shrink-0 font-sans">
                          {currentUser?.email.charAt(0) || 'U'}
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          <h3 className="text-sm font-extrabold text-slate-800 truncate">{currentUser?.email.split('@')[0] || 'User'}</h3>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser?.email}</p>
                          <div className="inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-250 text-emerald-700 text-[9px] font-black rounded-full uppercase">
                            {currentUser?.role === 'admin' ? 'Quyền HĐQT / Giám đốc' : currentUser?.role === 'legal' ? 'Bộ phận Pháp chế' : 'Hành chính Văn thư'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Admin Mobile Shortcuts to Reports & Settings */}
                    {currentUser?.role === 'admin' && (
                      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4.5 rounded-2xl shadow-md space-y-3">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <Settings size={14} />
                          Quản Trị Ban Giám Đốc (Admin)
                        </span>
                        <p className="text-[11px] text-slate-300">
                          Truy cập báo cáo phân tích toàn hệ thống &amp; cấu hình tiêu chuẩn SLA/Mức lương.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => {
                              setCurrentTab('reports');
                              setActiveMobileView('reports');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 px-3 rounded-xl shadow flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                          >
                            <BarChart2 size={15} />
                            Báo Cáo KPI
                          </button>
                          <button
                            onClick={() => {
                              setCurrentTab('settings');
                              setActiveMobileView('settings');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl border border-white/20 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                          >
                            <Settings size={15} />
                            Cài Đặt Admin
                          </button>
                        </div>
                      </div>
                    )}
                    {devModeEnabled ? (
                      <>
                        {/* Account info section */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                          <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                              <Users size={14} className="text-indigo-500" />
                              Tài Khoản Đang Xác Thực
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-snug mt-1">
                              Phiên đăng nhập thực tế bảo vệ bằng mã hóa Argon2id &amp; Cookie session bảo mật:
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">Email:</span>
                              <span className="font-bold text-slate-800 font-mono text-[11px]">{currentUser?.email || 'Chưa đăng nhập'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">Vai trò:</span>
                              <span className="font-bold text-emerald-700 uppercase text-[10px]">{currentUser?.role || '-'}</span>
                            </div>
                            <div className="pt-2 flex gap-2">
                              {currentUser ? (
                                <button
                                  type="button"
                                  onClick={handleSignOut}
                                  className="w-full py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  Đăng xuất phiên này
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowAuthModal(true)}
                                  className="w-full py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                  Đăng nhập tài khoản
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Logs & Sim Switch */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Database size={14} className="text-violet-500" />
                            Bảng Giả Lập &amp; Log Webhook
                          </h4>
                          <button 
                            onClick={() => setShowSimulator(!showSimulator)} 
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer active:scale-95"
                          >
                            <CloudLightning size={13} />
                            {showSimulator ? 'Đóng Bảng Giả Lập' : 'Bật Bảng Giả Lập Webhook'}
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Production-oriented User Information Help Card */
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Shield size={14} className="text-emerald-500" />
                            Thông tin bảo mật
                          </h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Tài khoản của bạn được liên thông bảo mật đa lớp qua Google Workspace &amp; Viettel Post API. Toàn bộ thao tác nghiệp vụ đều được ghi nhận lịch sử (Audit Log) và mã hóa bảo mật toàn vẹn.
                          </p>
                        </div>
                        <div className="border-t border-slate-100 pt-3 space-y-2">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Sao lưu đám mây</span>
                            <span className="text-emerald-600 font-extrabold font-mono flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                              Đang đồng bộ Google Drive
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Trạng thái API vận đơn</span>
                            <span className="text-indigo-600 font-extrabold font-mono flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
                              Viettel Post Connected
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Mô hình phân tích</span>
                            <span className="text-slate-800 font-extrabold font-mono uppercase">Gemini 2.5 Flash</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sign out */}
                    <button
                      onClick={handleSignOut}
                      className="w-full py-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-black hover:bg-rose-100 transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                    >
                      <LogOut size={14} />
                      Đăng Xuất Tài Khoản
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* ----------------- FIXED BOTTOM MOBILE NAV BAR (ROLE-SPECIFIC) ----------------- */}
        {currentUser && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-2 px-3 flex items-center justify-around z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]" id="mobile-nav-footer">
            <button 
              onClick={() => setActiveMobileView('home')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                activeMobileView === 'home' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
              }`}
            >
              <Home size={18} />
              <span className="text-[9px] font-bold tracking-tight">Trang chủ</span>
            </button>

            {/* Clerk Only: Giỏ việc & Camera Scan */}
            {currentUser.role === 'clerk' && (
              <>
                <button 
                  onClick={() => setActiveMobileView('tasks')}
                  className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                    activeMobileView === 'tasks' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Inbox size={18} />
                  <span className="text-[9px] font-bold tracking-tight">Giỏ việc</span>
                </button>

                {/* Center green action button for scanning */}
                <button 
                  onClick={() => {
                    setPreselectedContractForScanner(null);
                    setShowScanner(true);
                  }}
                  className="flex items-center justify-center bg-emerald-600 text-white w-12 h-12 rounded-full -mt-6 shadow-md shadow-emerald-500/30 hover:bg-emerald-500 transition-all active:scale-90 border-4 border-white shrink-0 cursor-pointer"
                  title="Quét số hóa nhanh"
                >
                  <Camera size={20} />
                </button>
              </>
            )}

            <button 
              onClick={() => setActiveMobileView('contracts')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                activeMobileView === 'contracts' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
              }`}
            >
              <FileText size={18} />
              <span className="text-[9px] font-bold tracking-tight">Hợp đồng</span>
            </button>

            {/* Legal / Admin Center FAB: Create Task */}
            {(currentUser.role === 'admin' || currentUser.role === 'legal') && (
              <button 
                onClick={() => setShowDraftingModal(true)}
                className="flex items-center justify-center bg-emerald-600 text-white w-12 h-12 rounded-full -mt-6 shadow-md shadow-emerald-500/30 hover:bg-emerald-500 transition-all active:scale-90 border-4 border-white shrink-0 cursor-pointer"
                title={currentUser.role === 'admin' ? "Sếp Giao Task Soạn Thảo" : "Tạo Task Soạn Thảo"}
              >
                <Plus size={22} className="stroke-[3]" />
              </button>
            )}

            <button 
              onClick={() => setActiveMobileView('payroll')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                activeMobileView === 'payroll' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
              }`}
            >
              <Calculator size={18} />
              <span className="text-[9px] font-bold tracking-tight">Lương KPI</span>
            </button>

            {/* Admin Only: Báo cáo KPI */}
            {currentUser.role === 'admin' && (
              <button 
                onClick={() => setActiveMobileView('reports')}
                className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                  activeMobileView === 'reports' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
                }`}
              >
                <BarChart2 size={18} />
                <span className="text-[9px] font-bold tracking-tight">Báo cáo</span>
              </button>
            )}

            <button 
              onClick={() => setActiveMobileView('profile')}
              className={`flex flex-col items-center gap-1 transition-all active:scale-95 py-1 cursor-pointer ${
                activeMobileView === 'profile' ? 'text-emerald-600 scale-105 font-bold' : 'text-slate-400'
              }`}
            >
              <User size={18} />
              <span className="text-[9px] font-bold tracking-tight">Cá nhân</span>
            </button>
          </nav>
        )}

        {/* ----------------- MOBILE CONTRACT UPLOAD MODAL ----------------- */}
        {showUploadModal && currentUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" id="mobile-upload-overlay">
            <div className="bg-white text-slate-800 rounded-2xl shadow-xl max-w-xl w-full my-8 overflow-hidden border border-slate-200/50 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
              <div className="p-4 border-b border-slate-200/50 flex items-center justify-between shrink-0 bg-slate-50">
                <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
                  Khởi tạo quy trình
                </span>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <CreateContractForm
                  onSubmit={async (data) => {
                    await handleManualContractCreate(data);
                    setShowUploadModal(false);
                  }}
                  checkContractId={checkContractId}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  uploadError={uploadError}
                  setUploadError={setUploadError}
                  uploadedFileDetails={uploadedFileDetails}
                  setUploadedFileDetails={setUploadedFileDetails}
                  onCancel={() => setShowUploadModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ----------------- THIRD PARTY SIMULATOR SIDEBAR DRAWER ----------------- */}
        <SimulatorPanel
          showSimulator={showSimulator}
          setShowSimulator={setShowSimulator}
          contracts={contracts}
          simVtpContractId={simVtpContractId}
          setSimVtpContractId={setSimVtpContractId}
          simVtpStatus={simVtpStatus}
          setSimVtpStatus={setSimVtpStatus}
          simVtpNote={simVtpNote}
          setSimVtpNote={setSimVtpNote}
          handleSimulateVtpWebhook={handleSimulateVtpWebhook}
          handleTriggerSlaCheck={handleTriggerSlaCheck}
          simLogs={simLogs}
          fetchSimLogs={fetchSimLogs}
        />

        {/* ----------------- AUTH ACCOUNT MODAL ----------------- */}
        <AuthModal
          showAuthModal={showAuthModal}
          setShowAuthModal={setShowAuthModal}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authError={authError}
          handleSignIn={handleSignIn}
        />

        {/* ----------------- CREATE DRAFTING REQUEST MODAL ----------------- */}
        <CreateDraftingRequestModal
          isOpen={showDraftingModal}
          onClose={() => setShowDraftingModal(false)}
          onSubmit={handleRequestDraftContract}
          users={settings?.users || []}
          defaultBasePay={settings?.defaultBasePayLegal || 500000}
        />

        {/* ----------------- CONTRACT DETAILS & AUDIT LOG HISTORY MODAL ----------------- */}
        <HistoryModal
          showHistoryModal={showHistoryModal}
          setShowHistoryModal={setShowHistoryModal}
          selectedContract={selectedContract}
          setSelectedContract={setSelectedContract}
        />

        {/* ----------------- CLERK PHYSICAL DOCUMENT SCANNER STATION ----------------- */}
        {showScanner && currentUser && (
          <ContractScanner
            onClose={() => {
              setShowScanner(false);
              setPreselectedContractForScanner(null);
            }}
            contracts={contracts}
            onUploadSuccess={handleScannerUpload}
            onQrScanTransition={handleQrTransitionContract}
            currentUserEmail={currentUser.email}
            initialContract={preselectedContractForScanner}
          />
        )}



      </div>
    </div>
  );
}
