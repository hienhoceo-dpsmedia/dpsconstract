import React from 'react';
import { Layers, Search, Filter, AlertTriangle, Truck, Printer, Check, Camera, Upload, CheckCircle, Activity, Download, Clock, X, Edit, AlertCircle, Ban, RotateCcw, Plus, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Copy, QrCode, Eye, MoreHorizontal, FileText, FileCheck, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel, SortingState } from '@tanstack/react-table';
import { Contract, User } from '../types';
import QRCode from 'qrcode';

// Modular QuickCopyButton helper for high-fidelity quick copy experiences
const QuickCopyButton: React.FC<{ text: string; className?: string; label?: string }> = ({ text, className = '', label }) => {
  const [copied, setCopied] = React.useState(false);
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
      className={`inline-flex items-center gap-1 text-[9px] bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-all cursor-pointer select-none font-sans font-semibold shrink-0 ${className}`}
      title="Sao chép nhanh"
    >
      {copied ? (
        <>
          <Check size={9} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-700 text-[8px] font-bold">{label ? `Đã chép ${label}` : 'Đã chép!'}</span>
        </>
      ) : (
        <>
          <Copy size={9} className="shrink-0 text-slate-400" />
          <span>{label || 'Sao chép'}</span>
        </>
      )}
    </button>
  );
};

interface ContractTableProps {
  contracts: Contract[];
  currentUser: User;
  contractFilter: string;
  setContractFilter: (filter: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleApproveSoftCopy?: (contractId: string) => void;
  handleConfirmPrinted: (contractId: string) => void;
  handleConfirmSigned: (contractId: string) => void;
  waybillInputs: Record<string, string>;
  setWaybillInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAssignWaybill: (contractId: string) => void;
  setPreselectedContractForScanner: (contract: Contract | null) => void;
  setShowScanner: (show: boolean) => void;
  scanFile: File | null;
  setScanFile: (file: File | null) => void;
  handleUploadScan: (contractId: string) => void;
  handleArchiveContract: (contractId: string) => void;
  setSelectedContract: (contract: Contract | null) => void;
  setShowHistoryModal: (show: boolean) => void;
  handleRejectContract?: (contractId: string, note: string) => void;
  handleReportIssue?: (contractId: string, note: string) => void;
  handleRedraftContract?: (contractId: string, note: string) => void;
  handleReshipContract?: (contractId: string, note: string) => void;
  handleCancelContract?: (contractId: string, note: string) => void;
  handleEditContract?: (contractId: string, fields: Partial<Contract>, note: string) => void;
  handleAddPhysicalNote?: (contractId: string, note: string) => void;
  handleUpdateContractStatus?: (contractId: string, status: string, note?: string) => void;
  pendingActions?: Record<string, boolean>;
}

export const ContractTable: React.FC<ContractTableProps> = ({
  contracts,
  currentUser,
  contractFilter,
  setContractFilter,
  searchQuery,
  setSearchQuery,
  handleApproveSoftCopy,
  handleConfirmPrinted,
  handleConfirmSigned,
  waybillInputs,
  setWaybillInputs,
  handleAssignWaybill,
  setPreselectedContractForScanner,
  setShowScanner,
  scanFile,
  setScanFile,
  handleUploadScan,
  handleArchiveContract,
  setSelectedContract,
  setShowHistoryModal,
  handleRejectContract,
  handleReportIssue,
  handleRedraftContract,
  handleReshipContract,
  handleCancelContract,
  handleEditContract,
  handleAddPhysicalNote,
  handleUpdateContractStatus,
  pendingActions = {},
}) => {
  // Support states for Manual Edit & Business Failures
  const [editingContractId, setEditingContractId] = React.useState<string | null>(null);
  const [editFields, setEditFields] = React.useState<Partial<Contract>>({});
  const [editNote, setEditNote] = React.useState('');

  const [actionContractId, setActionContractId] = React.useState<string | null>(null);
  const [actionType, setActionType] = React.useState<'reject' | 'report' | 'cancel' | 'redraft' | 'reship' | 'physical_note' | null>(null);
  const [actionNote, setActionNote] = React.useState('');
  const [qrPrintContract, setQrPrintContract] = React.useState<Contract | null>(null);
  const [activeDropdownId, setActiveDropdownId] = React.useState<string | null>(null);
  const [activeActionDropdownId, setActiveActionDropdownId] = React.useState<string | null>(null);

  // --- CUSTOM COMPREHENSIVE STATES FOR SEARCH, FILTER, SORT, AND PAGINATION ---
  const [localSearch, setLocalSearch] = React.useState(searchQuery);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [filterOverdueOnly, setFilterOverdueOnly] = React.useState<boolean>(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);

  const getDropdownOptions = (contract: Contract) => {
    const options: { label: string; action: () => void; category: 'primary' | 'exception' | 'manual' }[] = [];

    // Category 1: Primary workflow transitions based on status and role
    if (contract.status === 'Chờ duyệt bản mềm') {
      options.push({
        label: '✅ Duyệt bản mềm (Chuyển sang Chờ in)',
        action: () => handleApproveSoftCopy && handleApproveSoftCopy(contract.id),
        category: 'primary'
      });
    }

    if (currentUser.role === 'clerk') {
      if (contract.status === 'Chờ in') {
        options.push({
          label: '🖨️ Xác nhận: Đã in xong',
          action: () => handleConfirmPrinted(contract.id),
          category: 'primary'
        });
      }
      if (contract.status === 'Đang chờ ký') {
        options.push({
          label: '✍️ Xác nhận: Sếp đã ký',
          action: () => handleConfirmSigned(contract.id),
          category: 'primary'
        });
      }
      if (contract.status === 'Chờ bản gửi lại') {
        options.push({
          label: '📷 Mở máy quét Camera',
          action: () => {
            setPreselectedContractForScanner(contract);
            setShowScanner(true);
          },
          category: 'primary'
        });
        if (contract.files.some(f => f.type === 'scan')) {
          options.push({
            label: '✅ Hoàn tất & Lưu kho',
            action: () => handleArchiveContract(contract.id),
            category: 'primary'
          });
        }
      }
    }

    // Category 2: Exception & Physical Step Notes
    if (contract.status !== 'Hoàn tất' && contract.status !== 'Đã hủy') {
      if (currentUser.role === 'clerk' || currentUser.role === 'admin') {
        options.push({
          label: '📌 Ghi chú bước xử lý vật lý (Thực tế)',
          action: () => {
            setActionContractId(contract.id);
            setActionType('physical_note');
            setActionNote('');
          },
          category: 'exception'
        });
      }
      if (currentUser.role === 'clerk' && contract.status === 'Đang chờ ký') {
        options.push({
          label: '❌ Từ chối ký duyệt',
          action: () => {
            setActionContractId(contract.id);
            setActionType('reject');
            setActionNote('');
          },
          category: 'exception'
        });
      }
      if (currentUser.role === 'clerk' && contract.status === 'Đang giao') {
        options.push({
          label: '⚠️ Báo sự cố giao nhận',
          action: () => {
            setActionContractId(contract.id);
            setActionType('report');
            setActionNote('');
          },
          category: 'exception'
        });
      }
      if (contract.status === 'Sự cố vận chuyển' || contract.status === 'Bị từ chối ký') {
        options.push({
          label: '📝 Yêu cầu soạn thảo lại',
          action: () => {
            setActionContractId(contract.id);
            setActionType('redraft');
            setActionNote('');
          },
          category: 'exception'
        });
        options.push({
          label: '🔄 Giao lại bưu kiện mới',
          action: () => {
            setActionContractId(contract.id);
            setActionType('reship');
            setActionNote('');
          },
          category: 'exception'
        });
      }
      options.push({
        label: '🚫 Hủy bỏ quy trình',
        action: () => {
          setActionContractId(contract.id);
          setActionType('cancel');
          setActionNote('');
        },
        category: 'exception'
      });
    }

    // Category 3: Manual Status Overrides
    const allStatuses = [
      'Chờ soạn thảo',
      'Chờ duyệt bản mềm',
      'Chờ in',
      'Đang chờ ký',
      'Chờ tạo vận đơn',
      'Chờ shipper đến lấy',
      'Đang giao',
      'Chờ bản gửi lại',
      'Hoàn tất',
      'Bị từ chối ký',
      'Sự cố vận chuyển',
      'Đã hủy'
    ];

    allStatuses.forEach(st => {
      if (st !== contract.status) {
        options.push({
          label: `Chuyển sang: ${st}`,
          action: () => {
            if (handleUpdateContractStatus) {
              handleUpdateContractStatus(contract.id, st);
            }
          },
          category: 'manual'
        });
      }
    });

    return options;
  };

  // --- TANSTACK TABLE ENTERPRISE INTEGRATION ---
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'uploaded_at', desc: true }
  ]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Mobile load more limit state
  const [mobilePageSize, setMobilePageSize] = React.useState(10);

  // Sync searchQuery prop with local search input and handle debouncing
  React.useEffect(() => {
    if (qrPrintContract) {
      setTimeout(() => {
        const canvas = document.getElementById('qr-code-canvas');
        if (canvas) {
          QRCode.toCanvas(canvas, qrPrintContract.contractNumber, {
            width: 140,
            margin: 1,
            color: {
              dark: '#0f172a', // Slate 900
              light: '#ffffff'
            }
          }, (error) => {
            if (error) console.error('Lỗi sinh mã QR:', error);
          });
        }
      }, 50);
    }
  }, [qrPrintContract]);

  React.useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setSearchQuery]);

  // Sync parent workflow pipeline filter with local selected statuses
  React.useEffect(() => {
    if (contractFilter === 'All') {
      setSelectedStatuses([]);
      setFilterOverdueOnly(false);
    } else if (contractFilter === 'Exception') {
      setSelectedStatuses(['Bị từ chối ký', 'Sự cố vận chuyển']);
      setFilterOverdueOnly(false);
    } else if (contractFilter === 'Overdue') {
      setSelectedStatuses([]);
      setFilterOverdueOnly(true);
    } else {
      setSelectedStatuses([contractFilter]);
      setFilterOverdueOnly(false);
    }
    // Reset pages on filter changes
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setMobilePageSize(10);
  }, [contractFilter]);

  // Reset pages on search or filter change
  React.useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setMobilePageSize(10);
  }, [searchQuery, selectedStatuses, filterOverdueOnly]);

  // Accent-insensitive Vietnamese string matching helpers
  const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  };

  const highlightText = (text: string, search: string) => {
    if (!text) return '-';
    if (!search.trim()) return <span>{text}</span>;
    
    const normalizedText = removeVietnameseTones(text).toLowerCase();
    const normalizedSearch = removeVietnameseTones(search).toLowerCase();
    
    const index = normalizedText.indexOf(normalizedSearch);
    if (index === -1) return <span>{text}</span>;
    
    const result: React.ReactNode[] = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
      const matchIndex = removeVietnameseTones(text.slice(currentIndex)).toLowerCase().indexOf(normalizedSearch);
      if (matchIndex === -1) {
        result.push(text.slice(currentIndex));
        break;
      }
      
      const absoluteMatchIndex = currentIndex + matchIndex;
      if (absoluteMatchIndex > currentIndex) {
        result.push(text.slice(currentIndex, absoluteMatchIndex));
      }
      
      const matchText = text.slice(absoluteMatchIndex, absoluteMatchIndex + search.length);
      result.push(
        <mark key={absoluteMatchIndex} className="bg-yellow-200 text-slate-950 font-bold rounded-sm px-0.5">
          {matchText}
        </mark>
      );
      
      currentIndex = absoluteMatchIndex + search.length;
    }
    
    return <span>{result}</span>;
  };

  const getParsedValue = (valStr: string): number => {
    if (!valStr) return 0;
    const numericStr = valStr.replace(/[^\d]/g, '');
    return parseInt(numericStr, 10) || 0;
  };

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

  const getVtpLogStyle = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('DELIVERED') || s.includes('SUCCESS') || s.includes('THÀNH CÔNG') || s.includes('HOÀN TẤT')) {
      return 'bg-emerald-50/80 text-emerald-800';
    }
    if (s.includes('IN_TRANSIT') || s.includes('PICKED_UP') || s.includes('GIAO') || s.includes('LẤY HÀNG') || s.includes('VẬN CHUYỂN')) {
      return 'bg-blue-50/85 text-blue-800';
    }
    if (s.includes('EXCEPTION') || s.includes('FAIL') || s.includes('ERROR') || s.includes('SỰ CỐ') || s.includes('HỦY')) {
      return 'bg-rose-50/80 text-rose-800';
    }
    return 'bg-slate-50 text-slate-700';
  };

  const renderStatusBadge = (status: string) => {
    let bg = 'bg-slate-50 text-slate-700 border-slate-200/60';
    let dot = 'bg-slate-400';
    
    switch (status) {
      case 'Chờ duyệt bản mềm':
        bg = 'bg-sky-50/60 text-sky-700 border-sky-200/80';
        dot = 'bg-sky-500 animate-pulse';
        break;
      case 'Chờ in':
        bg = 'bg-rose-50/60 text-rose-700 border-rose-200/80';
        dot = 'bg-rose-500';
        break;
      case 'Đang chờ ký':
        bg = 'bg-amber-50/60 text-amber-700 border-amber-200/80';
        dot = 'bg-amber-500 animate-pulse';
        break;
      case 'Chờ tạo vận đơn':
        bg = 'bg-indigo-50/60 text-indigo-700 border-indigo-200/80';
        dot = 'bg-indigo-500';
        break;
      case 'Chờ shipper đến lấy':
        bg = 'bg-purple-50/60 text-purple-700 border-purple-200/80';
        dot = 'bg-purple-500';
        break;
      case 'Đang giao':
        bg = 'bg-blue-50/60 text-blue-700 border-blue-200/80';
        dot = 'bg-blue-500';
        break;
      case 'Chờ bản gửi lại':
        bg = 'bg-orange-50/60 text-orange-700 border-orange-200/80';
        dot = 'bg-orange-500';
        break;
      case 'Hoàn tất':
        bg = 'bg-emerald-50/60 text-emerald-700 border-emerald-200/80';
        dot = 'bg-emerald-500';
        break;
      case 'Bị từ chối ký':
        bg = 'bg-red-50 text-red-700 border-red-200/80';
        dot = 'bg-red-600';
        break;
      case 'Sự cố vận chuyển':
        bg = 'bg-amber-50/70 text-amber-800 border-amber-200/60';
        dot = 'bg-amber-500';
        break;
      case 'Đã hủy':
        bg = 'bg-slate-50 text-slate-500 border-slate-200/60';
        dot = 'bg-slate-400';
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>
        {status}
      </span>
    );
  };

  // --- ACCENT-INSENSITIVE & NESTED LOG MATCHING FILTER ENGINE ---
  const filteredContracts = contracts.filter((contract) => {
    // 1. Status Filter
    if (selectedStatuses.length > 0) {
      if (contract.status === 'Đã hủy' && !selectedStatuses.includes('Đã hủy')) {
        return false;
      }
      if (!selectedStatuses.includes(contract.status)) {
        return false;
      }
    } else {
      if (contract.status === 'Đã hủy' && searchQuery.trim() === '') {
        return false;
      }
    }

    // 2. Overdue Filter
    if (filterOverdueOnly && !contract.slaBreached) {
      return false;
    }

    // 3. Search query filter
    if (searchQuery.trim() !== '') {
      const q = removeVietnameseTones(searchQuery.trim().toLowerCase());
      const numMatch = removeVietnameseTones(contract.contractNumber).toLowerCase().includes(q);
      const nameMatch = removeVietnameseTones(contract.name).toLowerCase().includes(q);
      const partMatch = removeVietnameseTones(contract.partnerName).toLowerCase().includes(q);
      const wayMatch = contract.waybillCode ? removeVietnameseTones(contract.waybillCode).toLowerCase().includes(q) : false;
      
      const logMatch = contract.vtpStatusHistory?.some(log => 
        removeVietnameseTones(log.status).toLowerCase().includes(q) || 
        removeVietnameseTones(log.note).toLowerCase().includes(q)
      );

      return numMatch || nameMatch || partMatch || wayMatch || logMatch;
    }

    return true;
  });

  // --- TANSTACK TABLE COLUMN DEFINITIONS & HOOKS ---
  const columns = React.useMemo(() => [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Mã & tên hồ sơ',
      enableSorting: true,
    },
    {
      id: 'partnerName',
      accessorKey: 'partnerName',
      header: 'Đối tác',
      enableSorting: true,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Trạng thái',
      enableSorting: true,
    },
    {
      id: 'uploaded_at',
      accessorKey: 'uploaded_at',
      header: 'Ngày tạo',
      enableSorting: true,
    },
    {
      id: 'actions',
      header: 'Hành động',
      enableSorting: false,
    },
    {
      id: 'more',
      header: '',
      enableSorting: false,
    }
  ], []);

  const table = useReactTable({
    data: filteredContracts,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalItems = filteredContracts.length;
  const mobileContracts = filteredContracts.slice(0, mobilePageSize);

  return (
    <div className="bg-white rounded-2xl border border-slate-100/80 shadow-xs overflow-hidden space-y-4" id="contracts-table-card">
      {/* Filters & Control bar */}
      <div className="p-5 border-b border-slate-200/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Layers size={18} className="text-slate-500" />
          <h3 className="text-slate-900 font-bold text-sm">Hồ sơ Hợp đồng Vận hành</h3>
          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full" title="Số lượng hồ sơ sau khi lọc">
            {filteredContracts.length} / {contracts.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input with Debounce */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Tìm số HĐ, đối tác, vận đơn..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition"
            />
            {localSearch !== searchQuery && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </div>

          {/* Advanced Multi-Select Status Dropdown Popover */}
          <div className="relative">
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold cursor-pointer transition select-none"
              title="Bộ lọc trạng thái nâng cao"
            >
              <Filter size={12} className="text-slate-500" />
              <span>
                {(() => {
                  if (filterOverdueOnly && selectedStatuses.length === 0) return 'Đang lọc: Trễ SLA ⚠️';
                  if (selectedStatuses.length === 0) return 'Tất cả trạng thái hoạt động';
                  if (selectedStatuses.length === 1) return `Trạng thái: ${selectedStatuses[0]}`;
                  return `Đã chọn: ${selectedStatuses.length} trạng thái`;
                })()}
              </span>
              <span className="text-[9px] text-slate-400 ml-0.5">▼</span>
            </button>

            {isStatusDropdownOpen && (
              <>
                {/* Backdrop overlay */}
                <div className="fixed inset-0 z-30" onClick={() => setIsStatusDropdownOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 z-40 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-150">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Lọc theo trạng thái</span>
                    <button 
                      onClick={() => {
                        setSelectedStatuses([]);
                        setFilterOverdueOnly(false);
                        setContractFilter('All');
                      }}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                    >
                      Bỏ lọc hết
                    </button>
                  </div>
                  
                  {/* Quick toggle presets */}
                  <div className="grid grid-cols-2 gap-1.5 pb-2 border-b border-slate-150">
                    <button
                      onClick={() => {
                        setSelectedStatuses(['Bị từ chối ký', 'Sự cố vận chuyển']);
                        setFilterOverdueOnly(false);
                        setContractFilter('Exception');
                      }}
                      className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 text-amber-800 text-[10px] font-bold rounded-lg transition text-center cursor-pointer"
                    >
                      ⚠️ Xử lý ngoại lệ
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatuses([]);
                        setFilterOverdueOnly(true);
                        setContractFilter('Overdue');
                      }}
                      className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 text-rose-800 text-[10px] font-bold rounded-lg transition text-center cursor-pointer"
                    >
                      ⏰ Quá hạn SLA
                    </button>
                  </div>

                  {/* List of Checkboxes */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 font-sans">
                    <label className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                      <input 
                        type="checkbox"
                        checked={filterOverdueOnly}
                        onChange={(e) => setFilterOverdueOnly(e.target.checked)}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                        ⏰ Chỉ hiển thị Trễ SLA
                      </span>
                    </label>
                    {['Chờ duyệt bản mềm', 'Chờ in', 'Đang chờ ký', 'Chờ tạo vận đơn', 'Chờ shipper đến lấy', 'Đang giao', 'Chờ bản gửi lại', 'Hoàn tất', 'Bị từ chối ký', 'Sự cố vận chuyển', 'Đã hủy'].map((status) => {
                      const isChecked = selectedStatuses.includes(status);
                      return (
                        <label key={status} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span className="text-xs text-slate-700 font-medium">{status}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sorting Dropdown - Synced with TanStack Table */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <ArrowUpDown size={12} className="text-slate-500" />
            <select 
              value={(() => {
                const firstSort = sorting[0];
                if (!firstSort) return 'uploaded_at-desc';
                return `${firstSort.id}-${firstSort.desc ? 'desc' : 'asc'}`;
              })()}
              onChange={(e) => {
                const [id, order] = e.target.value.split('-');
                setSorting([{ id, desc: order === 'desc' }]);
              }}
              className="text-xs bg-transparent focus:outline-none text-slate-700 font-semibold cursor-pointer"
            >
              <option value="uploaded_at-desc">Mới nhất trước</option>
              <option value="uploaded_at-asc">Cũ nhất trước</option>
              <option value="name-asc">Tên hợp đồng (A-Z)</option>
              <option value="name-desc">Tên hợp đồng (Z-A)</option>
              <option value="partnerName-asc">Tên đối tác (A-Z)</option>
              <option value="partnerName-desc">Tên đối tác (Z-A)</option>
              <option value="status-asc">Theo trạng thái</option>
            </select>
          </div>

          {/* Clear Filters Button (Xóa lọc ×) */}
          {(contractFilter !== 'All' || searchQuery !== '' || selectedStatuses.length > 0 || filterOverdueOnly) && (
            <button 
              onClick={() => {
                setContractFilter('All');
                setSelectedStatuses([]);
                setFilterOverdueOnly(false);
                setLocalSearch('');
                setSearchQuery('');
              }}
              className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 px-2.5 py-1.5 rounded-lg border border-rose-200/40 font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
              id="clear-all-filters-btn"
              title="Xóa tất cả bộ lọc và tìm kiếm"
            >
              <X size={12} />
              <span>Xóa lọc ×</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container - Desktop view with TanStack Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-semibold text-slate-600">
              <th 
                onClick={() => table.getColumn('name')?.toggleSorting()}
                className="py-3 px-4 pl-5 w-[30%] min-w-[240px] cursor-pointer select-none group"
                title="Bấm để sắp xếp theo tên hợp đồng"
              >
                <div className="flex items-center gap-1.5">
                  <span>Mã &amp; tên hồ sơ</span>
                  {table.getColumn('name')?.getIsSorted() === 'asc' ? (
                    <ArrowUp size={13} className="text-emerald-600" />
                  ) : table.getColumn('name')?.getIsSorted() === 'desc' ? (
                    <ArrowDown size={13} className="text-emerald-600" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => table.getColumn('partnerName')?.toggleSorting()}
                className="py-3 px-4 w-[26%] min-w-[200px] cursor-pointer select-none group"
                title="Bấm để sắp xếp theo tên đối tác"
              >
                <div className="flex items-center gap-1.5">
                  <span>Đối tác</span>
                  {table.getColumn('partnerName')?.getIsSorted() === 'asc' ? (
                    <ArrowUp size={13} className="text-emerald-600" />
                  ) : table.getColumn('partnerName')?.getIsSorted() === 'desc' ? (
                    <ArrowDown size={13} className="text-emerald-600" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                  )}
                </div>
              </th>

              <th 
                onClick={() => table.getColumn('status')?.toggleSorting()}
                className="py-3 px-4 w-[18%] min-w-[150px] cursor-pointer select-none group"
                title="Bấm để sắp xếp theo trạng thái"
              >
                <div className="flex items-center gap-1.5">
                  <span>Trạng thái</span>
                  {table.getColumn('status')?.getIsSorted() === 'asc' ? (
                    <ArrowUp size={13} className="text-emerald-600" />
                  ) : table.getColumn('status')?.getIsSorted() === 'desc' ? (
                    <ArrowDown size={13} className="text-emerald-600" />
                  ) : (
                    <ArrowUpDown size={12} className="text-slate-300 group-hover:text-slate-500 transition" />
                  )}
                </div>
              </th>

              <th className="py-3 px-4 w-[20%] min-w-[180px]">Hành động</th>
              <th className="py-3 px-4 pr-5 w-[6%] min-w-[50px] text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 px-5 text-center text-slate-400 font-medium">
                  Không tìm thấy hợp đồng nào phù hợp với bộ lọc tìm kiếm.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const contract = row.original;
                const vtpLastStatus = contract.vtpStatusHistory[contract.vtpStatusHistory.length - 1];
                const isEditing = editingContractId === contract.id;
                const isActionPending = actionContractId === contract.id;

                return (
                  <React.Fragment key={contract.id}>
                    <tr className={`transition-colors hover:bg-slate-50/80 ${contract.slaBreached ? 'bg-rose-50/20' : ''} h-[56px]`} id={`contract-row-${contract.id}`}>
                      {/* 1. Mã HĐ & Tên hồ sơ */}
                      <td 
                        onClick={() => {
                          setSelectedContract(contract);
                          setShowHistoryModal(true);
                        }}
                        className="py-2.5 px-4 pl-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 leading-none">
                            {highlightText(contract.contractNumber, searchQuery)}
                          </span>
                          <QuickCopyButton text={contract.contractNumber} className="h-4 py-0 px-1" />
                          {contract.slaBreached && (
                            <span className="bg-rose-100 text-rose-700 border border-rose-200 text-[8px] font-bold px-1 py-0.5 rounded animate-pulse flex items-center gap-0.5 leading-none" title="TRỄ SLA VẬN HÀNH">
                              <AlertTriangle size={8} />
                              TRỄ SLA
                            </span>
                          )}
                          {contract.processingMethod === 'physical' && !contract.waybillCode && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Chưa tạo vận đơn bưu phẩm" />
                          )}
                        </div>
                        <h4 className="font-semibold text-slate-900 leading-normal line-clamp-1 truncate max-w-sm mt-1" title={contract.name}>
                          {highlightText(contract.name, searchQuery)}
                        </h4>
                      </td>

                      {/* 2. Đối tác */}
                      <td 
                        onClick={() => {
                          setSelectedContract(contract);
                          setShowHistoryModal(true);
                        }}
                        className="py-2.5 px-4 font-medium text-slate-800 truncate whitespace-nowrap max-w-[260px] cursor-pointer hover:bg-slate-50/50 transition-colors" 
                        title={contract.partnerName}
                      >
                        {highlightText(contract.partnerName, searchQuery)}
                      </td>

                      {/* 3. Trạng thái */}
                      <td 
                        onClick={() => {
                          setSelectedContract(contract);
                          setShowHistoryModal(true);
                        }}
                        className="py-2.5 px-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          {renderStatusBadge(contract.status)}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tải lên: {formatDate(contract.uploaded_at).split(' ')[0]}
                        </div>
                      </td>

                      {/* 4. Hành động chính */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 w-full max-w-[220px]">
                          {/* Special inline inputs for active workflows to maintain fast completion times */}
                          {contract.status === 'Chờ tạo vận đơn' && currentUser.role === 'clerk' && (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="text" 
                                placeholder="Mã vận đơn VTP..."
                                value={waybillInputs[contract.id] || ''}
                                disabled={pendingActions[contract.id]}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setWaybillInputs(prev => ({ ...prev, [contract.id]: val }));
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:bg-white focus:border-blue-500"
                              />
                              <button 
                                onClick={() => handleAssignWaybill(contract.id)}
                                disabled={pendingActions[contract.id]}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-2xs transition shrink-0 cursor-pointer"
                              >
                                OK
                              </button>
                            </div>
                          )}

                          {contract.status === 'Chờ bản gửi lại' && currentUser.role === 'clerk' && !contract.files.some(f => f.type === 'scan') && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button 
                                onClick={() => {
                                  setPreselectedContractForScanner(contract);
                                  setShowScanner(true);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-2 py-1 rounded text-xs font-semibold transition flex items-center gap-0.5 cursor-pointer"
                                title="Quét bằng camera"
                              >
                                <Camera size={11} className="text-emerald-600 animate-pulse" />
                                Quét
                              </button>
                              <div className="border border-dashed border-slate-300 hover:border-emerald-500 rounded px-1.5 py-1 text-center cursor-pointer transition bg-slate-50 relative shrink-0">
                                <input 
                                  type="file" 
                                  accept=".pdf,image/*"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      setScanFile(e.target.files[0]);
                                    }
                                  }}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <span className="text-[10px] font-medium text-slate-600 block truncate max-w-[50px]">
                                  {scanFile ? '✓ Chọn' : 'Chọn tệp'}
                                </span>
                              </div>
                              {scanFile && (
                                <button 
                                  onClick={() => handleUploadScan(contract.id)}
                                  className="bg-emerald-600 text-white rounded text-xs font-semibold px-2 py-1 hover:bg-emerald-500 cursor-pointer"
                                >
                                  Up
                                </button>
                              )}
                            </div>
                          )}

                          {/* Action Badge Indicator for completed statuses */}
                          {contract.status === 'Hoàn tất' && (
                            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-0.5 self-start">
                              <CheckCircle size={10} />
                              Hoàn tất
                            </span>
                          )}
                          {contract.status === 'Đã hủy' && (
                            <span className="text-[10px] text-slate-500 font-semibold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded self-start">
                              Đã hủy
                            </span>
                          )}

                          {/* Unified Action Dropdown Selector */}
                          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setActiveActionDropdownId(activeActionDropdownId === contract.id ? null : contract.id);
                              }}
                              disabled={pendingActions[contract.id]}
                              className="w-full flex items-center justify-between px-2.5 py-1 bg-white border border-slate-200/90 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer shadow-2xs"
                            >
                              <span className="truncate">
                                {pendingActions[contract.id] ? 'Đang xử lý...' : 'Cập nhật ▾'}
                              </span>
                            </button>

                            {activeActionDropdownId === contract.id && (
                              <>
                                <div 
                                  className="fixed inset-0 z-30 cursor-default" 
                                  onClick={() => setActiveActionDropdownId(null)} 
                                />
                                <div className="absolute left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-40 text-left animate-in fade-in slide-in-from-top-1 duration-100 max-h-60 overflow-y-auto">
                                  {(() => {
                                    const opts = getDropdownOptions(contract);
                                    const primaryOpts = opts.filter(o => o.category === 'primary');
                                    const exceptionOpts = opts.filter(o => o.category === 'exception');
                                    const manualOpts = opts.filter(o => o.category === 'manual');

                                    return (
                                      <>
                                        {primaryOpts.length > 0 && (
                                          <div className="px-2 py-1">
                                            <div className="text-[9px] font-semibold text-slate-400 px-1 mb-0.5">Nghiệp vụ chính</div>
                                            {primaryOpts.map((o, idx) => (
                                              <button
                                                key={`p-${idx}`}
                                                onClick={() => {
                                                  o.action();
                                                  setActiveActionDropdownId(null);
                                                }}
                                                className="w-full text-left px-2 py-1 hover:bg-emerald-50 hover:text-emerald-800 text-xs font-medium text-emerald-700 rounded-md transition cursor-pointer"
                                              >
                                                {o.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}

                                        {exceptionOpts.length > 0 && (
                                          <div className="px-2 py-1 border-t border-slate-100">
                                            <div className="text-[9px] font-semibold text-slate-400 px-1 mb-0.5">Xử lý sự cố / Ngoại lệ</div>
                                            {exceptionOpts.map((o, idx) => (
                                              <button
                                                key={`e-${idx}`}
                                                onClick={() => {
                                                  o.action();
                                                  setActiveActionDropdownId(null);
                                                }}
                                                className="w-full text-left px-2 py-1 hover:bg-rose-50 hover:text-rose-800 text-xs font-medium text-rose-600 rounded-md transition cursor-pointer"
                                              >
                                                {o.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}

                                        {manualOpts.length > 0 && (
                                          <div className="px-2 py-1 border-t border-slate-100">
                                            <div className="text-[9px] font-semibold text-slate-400 px-1 mb-0.5">Sửa trạng thái quy trình</div>
                                            {manualOpts.map((o, idx) => (
                                              <button
                                                key={`m-${idx}`}
                                                onClick={() => {
                                                  o.action();
                                                  setActiveActionDropdownId(null);
                                                }}
                                                className="w-full text-left px-2 py-1 hover:bg-slate-50 hover:text-slate-900 text-xs text-slate-600 rounded-md transition cursor-pointer"
                                              >
                                                {o.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Thao tác & Chi tiết */}
                      <td className="py-2.5 px-4 pr-5 text-center">
                        <div className="flex items-center justify-center gap-1 relative">


                          {/* 5b. Dropdown Menu Trigger */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(activeDropdownId === contract.id ? null : contract.id);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-950 transition cursor-pointer"
                            title="Lựa chọn thêm"
                          >
                            <MoreHorizontal size={14} />
                          </button>

                          {/* Dropdown Menu Portal */}
                          {activeDropdownId === contract.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-30 cursor-default" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                }} 
                              />
                              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-40 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                                {/* Edit Action */}
                                {contract.status !== 'Hoàn tất' && contract.status !== 'Đã hủy' && (
                                  <button
                                    onClick={() => {
                                      setEditingContractId(contract.id);
                                      setEditFields({
                                        name: contract.name,
                                        contractNumber: contract.contractNumber,
                                        partnerName: contract.partnerName,
                                        value: contract.value,
                                        waybillCode: contract.waybillCode || '',
                                        signDate: contract.signDate,
                                        effectiveDate: contract.effectiveDate,
                                        receiverName: contract.receiverName || '',
                                        receiverPhone: contract.receiverPhone || '',
                                        receiverAddress: contract.receiverAddress || '',
                                        deliveryNotes: contract.deliveryNotes || '',
                                        googleDocsLink: contract.googleDocsLink || '',
                                      });
                                      setEditNote('');
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer text-left"
                                  >
                                    <Edit size={12} className="text-slate-400" />
                                    Sửa thủ công
                                  </button>
                                )}

                                {/* Cancel Action */}
                                {contract.status !== 'Hoàn tất' && contract.status !== 'Đã hủy' && (
                                  <button
                                    onClick={() => {
                                      setActionContractId(contract.id);
                                      setActionType('cancel');
                                      setActionNote('');
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-rose-600 cursor-pointer text-left"
                                  >
                                    <Ban size={12} />
                                    Hủy bỏ quy trình
                                  </button>
                                )}

                                {/* QR Print label action */}
                                {contract.processingMethod === 'physical' && (
                                  <button
                                    onClick={() => {
                                      setQrPrintContract(contract);
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer text-left"
                                  >
                                    <QrCode size={12} className="text-slate-400" />
                                    In nhãn QR bưu kiện
                                  </button>
                                )}

                                {/* Reject signing */}
                                {currentUser.role === 'clerk' && contract.status === 'Đang chờ ký' && (
                                  <button
                                    onClick={() => {
                                      setActionContractId(contract.id);
                                      setActionType('reject');
                                      setActionNote('');
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-red-600 cursor-pointer text-left"
                                  >
                                    <AlertTriangle size={12} />
                                    Từ chối ký duyệt
                                  </button>
                                )}

                                {/* Report Shipping issue */}
                                {currentUser.role === 'clerk' && contract.status === 'Đang giao' && (
                                  <button
                                    onClick={() => {
                                      setActionContractId(contract.id);
                                      setActionType('report');
                                      setActionNote('');
                                      setActiveDropdownId(null);
                                    }}
                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-amber-700 cursor-pointer text-left"
                                  >
                                    <AlertTriangle size={12} />
                                    Báo sự cố giao nhận
                                  </button>
                                )}

                                {/* Downloads separator */}
                                <div className="border-t border-slate-100 my-1"></div>

                                {/* Download items */}
                                {contract.files.map((file) => {
                                  const isScanFile = file.type === 'scan';
                                  const canDownloadScan = contract.status === 'Chờ bản gửi lại' || contract.status === 'Hoàn tất';
                                  if (isScanFile && !canDownloadScan) return null;
                                  return (
                                    <a
                                      key={file.id}
                                      href={`/api/contracts/${contract.id}/files/${file.id}`}
                                      download
                                      onClick={() => setActiveDropdownId(null)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] text-slate-600 hover:text-emerald-600"
                                    >
                                      <Download size={12} className="text-slate-400" />
                                      Tải {isScanFile ? 'Bản quét' : 'Bản gốc'}
                                    </a>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Inline Manual Edit Panel */}
                    {isEditing && (
                      <tr className="bg-slate-50/80 border-b border-slate-200/50" id={`edit-panel-${contract.id}`}>
                        <td colSpan={5} className="p-4">
                          <div className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <Edit size={14} className="text-emerald-600" />
                                Chỉnh sửa thông tin hồ sơ (Ghi đè thủ công / Sửa lỗi OCR bóc tách)
                              </span>
                              <button 
                                onClick={() => setEditingContractId(null)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Mã hợp đồng</label>
                                <input 
                                  type="text" 
                                  value={editFields.contractNumber || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, contractNumber: e.target.value}))}
                                  disabled={contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại'}
                                  className={`w-full border rounded px-2 py-1.5 focus:outline-none focus:bg-white font-mono font-bold ${
                                    (contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại')
                                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                      : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                />
                                {(contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại') ? (
                                  <span className="text-[10px] text-amber-600 font-medium block mt-0.5">🔒 Đã khóa ID (Đã phát/giao)</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">Cho phép sửa ở Chờ duyệt bản mềm / Chờ in</span>
                                )}
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Tên hồ sơ</label>
                                <input 
                                  type="text" 
                                  value={editFields.name || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, name: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Tên đối tác</label>
                                  <input 
                                  type="text" 
                                  value={editFields.partnerName || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, partnerName: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Mã vận đơn bưu cục</label>
                                <input 
                                  type="text" 
                                  value={editFields.waybillCode || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, waybillCode: e.target.value}))}
                                  placeholder="Chưa có vận đơn"
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white font-mono font-bold text-blue-600"
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Ngày ký</label>
                                <input 
                                  type="text" 
                                  value={editFields.signDate || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, signDate: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Ngày hiệu lực</label>
                                <input 
                                  type="text" 
                                  value={editFields.effectiveDate || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, effectiveDate: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                            </div>

                            {/* Google Docs Link & Shipping inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border-t border-slate-100 pt-3">
                              <div className="md:col-span-3">
                                <label className="block text-slate-500 font-bold mb-1">Đường dẫn Google Docs</label>
                                <input 
                                  type="text" 
                                  value={editFields.googleDocsLink || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, googleDocsLink: e.target.value}))}
                                  placeholder="https://docs.google.com/document/d/..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Tên người nhận (Bưu kiện)</label>
                                <input 
                                  type="text" 
                                  value={editFields.receiverName || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, receiverName: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Số điện thoại nhận (chuẩn VN)</label>
                                <input 
                                  type="text" 
                                  value={editFields.receiverPhone || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, receiverPhone: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-500 font-bold mb-1">Địa chỉ giao nhận bưu tá chi tiết</label>
                                <input 
                                  type="text" 
                                  value={editFields.receiverAddress || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, receiverAddress: e.target.value}))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <label className="block text-slate-500 font-bold mb-1">Ghi chú vận chuyển bưu cục</label>
                                <input 
                                  type="text" 
                                  value={editFields.deliveryNotes || ''} 
                                  onChange={(e) => setEditFields(prev => ({...prev, deliveryNotes: e.target.value}))}
                                  placeholder="Ghi chú thêm cho bưu tá Viettel Post..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:bg-white"
                                />
                              </div>
                            </div>

                            <div className="space-y-1 text-xs">
                              <label className="block text-slate-500 font-bold">Lý do chỉnh sửa thủ công (Sẽ ghi nhận vào Audit Log bắt buộc) <span className="text-rose-500">*</span></label>
                              <input 
                                type="text" 
                                placeholder="Ghi nhận nhật ký..."
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:bg-white text-rose-700 font-medium placeholder-rose-300"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                              <button 
                                onClick={() => setEditingContractId(null)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold text-xs cursor-pointer"
                              >
                                Hủy bỏ
                              </button>
                              <button 
                                onClick={() => {
                                  if (handleEditContract) {
                                    handleEditContract(contract.id, editFields, editNote || 'Sửa đổi thông tin thủ công bởi người dùng');
                                  }
                                  setEditingContractId(null);
                                  setEditNote('');
                                }}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs shadow-sm cursor-pointer"
                              >
                                Cập nhật hệ thống
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Inline Action Failure Panel */}
                    {isActionPending && (
                      <tr className="bg-rose-50/40 border-b border-rose-100" id={`action-panel-${contract.id}`}>
                        <td colSpan={5} className="p-4">
                          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-150 pb-2">
                              <span className="font-bold text-rose-700 text-xs flex items-center gap-1.5">
                                <AlertCircle size={14} />
                                Kích hoạt luồng đảo ngược / xử lý lỗi: {
                                  actionType === 'reject' ? 'Từ chối duyệt ký' : 
                                  actionType === 'report' ? 'Báo cáo sự cố bưu kiện vận chuyển' : 
                                  actionType === 'redraft' ? 'Yêu cầu Soạn thảo lại hợp đồng (Quay về Chờ in)' :
                                  actionType === 'reship' ? 'Yêu cầu Giao lại bưu phẩm mới (Quay về Chờ tạo vận đơn)' :
                                  'Yêu cầu hủy hồ sơ'
                                }
                              </span>
                              <button 
                                onClick={() => setActionContractId(null)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="text-xs space-y-1.5">
                              <label className="block text-slate-500 font-bold">Lý do ghi nhận quy trình (Bắt buộc ghi nhận sổ cái) <span className="text-rose-500">*</span></label>
                              <textarea 
                                rows={2}
                                placeholder={
                                  actionType === 'reject' ? "Ghi lý do từ chối (ví dụ: Thiếu chữ ký nháy, sai điều khoản thanh toán, đối tác yêu cầu thương lượng lại...)" : 
                                  actionType === 'report' ? "Mô tả sự cố vận chuyển bưu tá (ví dụ: Bưu kiện thất lạc, rách nát, người nhận từ chối ký nhận...)" : 
                                  actionType === 'redraft' ? "Mô tả lý do soạn thảo lại (ví dụ: Thay đổi lại Mục 5.2 về điều khoản thanh toán theo đàm phán mới...)" :
                                  actionType === 'reship' ? "Mô tả lý do gửi lại bưu cục (ví dụ: Bưu phẩm cũ bị hỏng do thời tiết bão bùng, tiến hành in bản cứng mới trình Sếp ký gửi lại...)" :
                                  "Nhập lý do hủy hồ sơ quy trình..."
                                }
                                value={actionNote}
                                onChange={(e) => setActionNote(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded p-2 focus:outline-none focus:bg-white text-slate-800"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button 
                                onClick={() => setActionContractId(null)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold text-xs cursor-pointer"
                              >
                                Đóng lại
                              </button>
                              <button 
                                onClick={() => {
                                  if (actionType === 'reject' && handleRejectContract) {
                                    handleRejectContract(contract.id, actionNote || 'Đối tác/Sếp từ chối ký');
                                  } else if (actionType === 'report' && handleReportIssue) {
                                    handleReportIssue(contract.id, actionNote || 'Báo cáo sự cố vận chuyển Viettel Post');
                                  } else if (actionType === 'redraft' && handleRedraftContract) {
                                    handleRedraftContract(contract.id, actionNote || 'Tiến hành soạn thảo lại hợp đồng sau khi bị từ chối ký');
                                  } else if (actionType === 'reship' && handleReshipContract) {
                                    handleReshipContract(contract.id, actionNote || 'Yêu cầu giao lại bưu phẩm mới do sự cố giao nhận');
                                  } else if (actionType === 'cancel' && handleCancelContract) {
                                    handleCancelContract(contract.id, actionNote || 'Yêu cầu hủy hồ sơ');
                                  }
                                  setActionContractId(null);
                                  setActionNote('');
                                }}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-xs shadow-sm cursor-pointer"
                              >
                                {actionType === 'redraft' || actionType === 'reship' ? 'Xác nhận xử lý ngoại lệ' : 'Xác nhận gửi báo cáo lỗi'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Desktop Pagination Bar - Powered by TanStack Table */}
      {table.getFilteredRowModel().rows.length > 0 && (
        <div className="hidden md:flex items-center justify-between p-4 border-t border-slate-200/50 bg-slate-50/50 text-xs">
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <span>
              Đang xem <strong className="text-slate-800">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} - {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)}</strong> trong tổng số <strong className="text-slate-800">{table.getFilteredRowModel().rows.length}</strong> hồ sơ
            </span>
            <div className="flex items-center gap-1.5">
              <span>Hiển thị:</span>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="bg-white border border-slate-200/50 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={10}>10 dòng</option>
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
                <option value={100}>100 dòng</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-bold disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              <span>Trước</span>
            </button>
            
            {/* Page number buttons */}
            {(() => {
              const pages: React.ReactNode[] = [];
              const totalPages = table.getPageCount();
              const currentPage = table.getState().pagination.pageIndex + 1;
              for (let p = 1; p <= totalPages; p++) {
                if (totalPages > 6) {
                  if (p !== 1 && p !== totalPages && Math.abs(p - currentPage) > 1) {
                    if (p === 2 && currentPage > 3) {
                      pages.push(<span key="dots-start" className="px-1.5 text-slate-400 select-none">...</span>);
                    } else if (p === totalPages - 1 && currentPage < totalPages - 2) {
                      pages.push(<span key="dots-end" className="px-1.5 text-slate-400 select-none">...</span>);
                    }
                    continue;
                  }
                }
                pages.push(
                  <button
                    key={p}
                    onClick={() => table.setPageIndex(p - 1)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${currentPage === p ? 'bg-emerald-600 text-white border border-transparent shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    {p}
                  </button>
                );
              }
              return pages;
            })()}
            
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-600 font-bold disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
            >
              <span>Sau</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Card Grid Container - Mobile view */}
      <div className="block md:hidden divide-y divide-slate-100 bg-white">
        {filteredContracts.length === 0 ? (
          <div className="py-12 px-5 text-center text-slate-400 font-medium text-xs">
            Không tìm thấy hợp đồng nào phù hợp với bộ lọc tìm kiếm.
          </div>
        ) : (
          mobileContracts.map((contract) => {
            const vtpLastStatus = contract.vtpStatusHistory[contract.vtpStatusHistory.length - 1];

            return (
              <div key={contract.id} className={`p-3.5 transition border-b border-slate-100/80 ${contract.slaBreached ? 'bg-rose-50/10' : ''}`} id={`contract-card-${contract.id}`}>
                {/* Clickable Header & Title Row */}
                <div 
                  onClick={() => {
                    setSelectedContract(contract);
                    setShowHistoryModal(true);
                  }}
                  className="flex items-start justify-between gap-3 cursor-pointer select-none group"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Line 1: Code, SLA, Partner, Date */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 leading-none">
                        {highlightText(contract.contractNumber, searchQuery)}
                      </span>
                      {contract.slaBreached && (
                        <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-extrabold px-1 py-0.5 rounded animate-pulse leading-none uppercase">
                          TRỄ SLA
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px] group-hover:text-slate-800 transition">
                        {highlightText(contract.partnerName, searchQuery)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        • {formatDate(contract.uploaded_at).split(' ')[0]}
                      </span>
                    </div>

                    {/* Line 2: Document Name (Truncated to 1 line) */}
                    <h4 className="font-bold text-slate-800 text-[11px] leading-snug truncate group-hover:text-emerald-700 transition" title={contract.name}>
                      {highlightText(contract.name, searchQuery)}
                    </h4>
                  </div>

                  {/* Right Side: Status Badge & 3-dot Dropdown */}
                  <div className="shrink-0 flex items-center gap-1 pt-0.5 relative" onClick={(e) => e.stopPropagation()}>
                    {renderStatusBadge(contract.status)}
                    
                    {/* 3-dot Dropdown Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownId(activeDropdownId === contract.id ? null : contract.id);
                      }}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      title="Lựa chọn thêm"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Dropdown Menu Portal */}
                    {activeDropdownId === contract.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-30 cursor-default" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownId(null);
                          }} 
                        />
                        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-40 text-left animate-in fade-in slide-in-from-top-1 duration-100">
                          {/* Edit Action */}
                          {contract.status !== 'Hoàn tất' && contract.status !== 'Đã hủy' && (
                            <button
                              onClick={() => {
                                setEditingContractId(contract.id);
                                setEditFields({
                                  name: contract.name,
                                  contractNumber: contract.contractNumber,
                                  partnerName: contract.partnerName,
                                  value: contract.value,
                                  waybillCode: contract.waybillCode || '',
                                  signDate: contract.signDate,
                                  effectiveDate: contract.effectiveDate,
                                  receiverName: contract.receiverName || '',
                                  receiverPhone: contract.receiverPhone || '',
                                  receiverAddress: contract.receiverAddress || '',
                                  deliveryNotes: contract.deliveryNotes || '',
                                  googleDocsLink: contract.googleDocsLink || '',
                                });
                                setEditNote('');
                                setActiveDropdownId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer text-left"
                            >
                              <Edit size={12} className="text-slate-400" />
                              Sửa thủ công
                            </button>
                          )}

                          {/* Cancel Action */}
                          {contract.status !== 'Hoàn tất' && contract.status !== 'Đã hủy' && (
                            <button
                              onClick={() => {
                                setActionContractId(contract.id);
                                setActionType('cancel');
                                setActionNote('');
                                setActiveDropdownId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-rose-600 cursor-pointer text-left"
                            >
                              <Ban size={12} />
                              Hủy bỏ quy trình
                            </button>
                          )}

                          {/* QR Print label action */}
                          {contract.processingMethod === 'physical' && (
                            <button
                              onClick={() => {
                                setQrPrintContract(contract);
                                setActiveDropdownId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer text-left"
                            >
                              <QrCode size={12} className="text-slate-400" />
                              In nhãn QR bưu kiện
                            </button>
                          )}

                          {/* Reject signing */}
                          {currentUser.role === 'clerk' && contract.status === 'Đang chờ ký' && (
                            <button
                              onClick={() => {
                                setActionContractId(contract.id);
                                setActionType('reject');
                                setActionNote('');
                                setActiveDropdownId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-red-600 cursor-pointer text-left"
                            >
                              <AlertTriangle size={12} />
                              Từ chối ký duyệt
                            </button>
                          )}

                          {/* Report Shipping issue */}
                          {currentUser.role === 'clerk' && contract.status === 'Đang giao' && (
                            <button
                              onClick={() => {
                                setActionContractId(contract.id);
                                setActionType('report');
                                setActionNote('');
                                setActiveDropdownId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-amber-700 cursor-pointer text-left"
                            >
                              <AlertTriangle size={12} />
                              Báo sự cố giao nhận
                            </button>
                          )}

                          {/* Downloads separator */}
                          <div className="border-t border-slate-100 my-1"></div>

                          {/* Original PDF */}
                          <a
                            href={`/api/contracts/${contract.id}/files/${contract.files.find(f => f.type === 'original')?.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer text-left"
                          >
                            <FileText size={12} className="text-slate-400" />
                            Tải file gốc (PDF)
                          </a>

                          {/* Scan PDF */}
                          {contract.files.some(f => f.type === 'scan') && (
                            <a
                              href={`/api/contracts/${contract.id}/files/${contract.files.find(f => f.type === 'scan')?.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 text-[11px] font-semibold text-emerald-600 cursor-pointer text-left"
                            >
                              <FileCheck size={12} />
                              Xem bản ký quét (PDF)
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer Quick Action Bar (Compact & Slim) */}
                {['Chờ duyệt bản mềm', 'Chờ in', 'Đang chờ ký', 'Chờ tạo vận đơn', 'Chờ bản gửi lại'].includes(contract.status) && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50 p-2 rounded-xl" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Thao tác nhanh:</span>
                    <div className="flex items-center gap-1.5">
                      {/* Chờ duyệt bản mềm */}
                      {contract.status === 'Chờ duyệt bản mềm' && (
                        <button 
                          onClick={() => handleApproveSoftCopy && handleApproveSoftCopy(contract.id)}
                          disabled={pendingActions[contract.id]}
                          className="px-2.5 py-1.5 bg-sky-600 text-white rounded-md text-[10px] font-bold shadow-xs hover:bg-sky-500 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {pendingActions[contract.id] ? <RefreshCw className="animate-spin" size={10} /> : <FileCheck size={10} />}
                          Duyệt bản mềm
                        </button>
                      )}

                      {/* Clerk - Chờ in */}
                      {contract.status === 'Chờ in' && (
                        <button 
                          onClick={() => handleConfirmPrinted(contract.id)}
                          disabled={pendingActions[contract.id]}
                          className="px-2.5 py-1.5 bg-slate-900 text-white rounded-md text-[10px] font-bold shadow-xs hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {pendingActions[contract.id] ? <RefreshCw className="animate-spin" size={10} /> : <Printer size={10} />}
                          In xong
                        </button>
                      )}

                      {/* Clerk - Đang chờ ký */}
                      {contract.status === 'Đang chờ ký' && (
                        <button 
                          onClick={() => handleConfirmSigned(contract.id)}
                          disabled={pendingActions[contract.id]}
                          className="px-2.5 py-1.5 bg-amber-600 text-white rounded-md text-[10px] font-bold shadow-xs hover:bg-amber-500 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {pendingActions[contract.id] ? <RefreshCw className="animate-spin" size={10} /> : <Check size={10} />}
                          Sếp đã ký
                        </button>
                      )}

                      {/* Clerk - Chờ tạo vận đơn */}
                      {contract.status === 'Chờ tạo vận đơn' && (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            placeholder="Mã vận đơn VTP..."
                            value={waybillInputs[contract.id] || ''}
                            disabled={pendingActions[contract.id]}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWaybillInputs(prev => ({ ...prev, [contract.id]: val }));
                            }}
                            className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-mono focus:outline-none w-[120px]"
                          />
                          <button 
                            onClick={() => handleAssignWaybill(contract.id)}
                            disabled={pendingActions[contract.id]}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold shadow-xs transition shrink-0"
                          >
                            Gán
                          </button>
                        </div>
                      )}

                      {/* Clerk - Chờ bản gửi lại (Quét/Upload scan) */}
                      {contract.status === 'Chờ bản gửi lại' && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setPreselectedContractForScanner(contract);
                              setShowScanner(true);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-2 py-1 rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                          >
                            <Camera size={10} className="text-emerald-600 animate-pulse" />
                            Quét
                          </button>
                          <div className="border border-dashed border-slate-300 hover:border-emerald-500 rounded px-1.5 py-1 text-center cursor-pointer transition bg-white relative shrink-0">
                            <input 
                              type="file" 
                              accept=".pdf,image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setScanFile(e.target.files[0]);
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <span className="text-[9px] font-semibold text-slate-600 block truncate max-w-[50px]">
                              {scanFile ? '✓ Chọn' : 'Chọn tệp'}
                            </span>
                          </div>
                          {scanFile && (
                            <button 
                              onClick={() => handleUploadScan(contract.id)}
                              className="bg-emerald-600 text-white rounded text-[9px] font-bold px-1.5 py-1 hover:bg-emerald-500"
                            >
                              Up
                            </button>
                          )}
                          {contract.files.some(f => f.type === 'scan') && (
                            <button 
                              onClick={() => handleArchiveContract(contract.id)}
                              className="bg-emerald-600 text-white rounded text-[9px] font-bold px-1.5 py-1 hover:bg-emerald-500"
                              title="Xác nhận hoàn tất lưu trữ"
                            >
                              Xong
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Inline Manual Edit Panel - Mobile */}
                {editingContractId === contract.id && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 mt-2" id={`edit-panel-mobile-${contract.id}`}>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <Edit size={12} className="text-emerald-600" />
                        Sửa thông tin hồ sơ
                      </span>
                      <button onClick={() => setEditingContractId(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Mã hợp đồng</label>
                        <input 
                          type="text" 
                          value={editFields.contractNumber || ''} 
                          onChange={(e) => setEditFields(prev => ({...prev, contractNumber: e.target.value}))} 
                          disabled={contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại'}
                          className={`w-full border rounded px-2 py-1 focus:outline-none font-mono font-bold ${
                            (contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại')
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-white border-slate-200 text-slate-850'
                          }`}
                        />
                        {(contract.status !== 'Chờ duyệt bản mềm' && contract.status !== 'Chờ in' && contract.status !== 'Chờ bản gửi lại') && (
                          <span className="text-[9px] text-amber-600 font-medium block mt-0.5">🔒 Đã khóa ID (Đã phát/giao)</span>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Tên hồ sơ</label>
                        <input type="text" value={editFields.name || ''} onChange={(e) => setEditFields(prev => ({...prev, name: e.target.value}))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Tên đối tác</label>
                        <input type="text" value={editFields.partnerName || ''} onChange={(e) => setEditFields(prev => ({...prev, partnerName: e.target.value}))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Mã vận đơn VTP</label>
                        <input type="text" value={editFields.waybillCode || ''} onChange={(e) => setEditFields(prev => ({...prev, waybillCode: e.target.value}))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none font-bold text-blue-600" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Ngày ký</label>
                        <input type="text" value={editFields.signDate || ''} onChange={(e) => setEditFields(prev => ({...prev, signDate: e.target.value}))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-0.5">Ngày hiệu lực</label>
                        <input type="text" value={editFields.effectiveDate || ''} onChange={(e) => setEditFields(prev => ({...prev, effectiveDate: e.target.value}))} className="w-full bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-0.5">Lý do chỉnh sửa <span className="text-rose-500">*</span></label>
                        <input type="text" placeholder="Nhập lý do lưu nhật ký..." value={editNote} onChange={(e) => setEditNote(e.target.value)} className="w-full bg-white border border-rose-200 rounded px-2 py-1 text-rose-700" />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button onClick={() => setEditingContractId(null)} className="px-2.5 py-1 bg-slate-200 rounded text-slate-700 text-[10px] font-bold">Hủy</button>
                      <button 
                        onClick={() => {
                          if (handleEditContract) handleEditContract(contract.id, editFields, editNote || 'Sửa thủ công');
                          setEditingContractId(null);
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
                      >
                        Lưu lại
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Action Panel */}
                {actionContractId === contract.id && (
                  <div className={`p-3.5 rounded-xl border space-y-3 mt-2 ${
                    actionType === 'physical_note' ? 'bg-amber-50/80 border-amber-200' : 'bg-rose-50 border-rose-200'
                  }`} id={`action-panel-mobile-${contract.id}`}>
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                      <span className={`font-bold text-xs flex items-center gap-1.5 ${
                        actionType === 'physical_note' ? 'text-amber-900' : 'text-rose-700'
                      }`}>
                        <AlertCircle size={14} />
                        {
                          actionType === 'physical_note' ? '📌 Ghi chú nhanh bước xử lý thực tế vật lý' :
                          actionType === 'redraft' ? 'Xử lý Soạn thảo lại' :
                          actionType === 'reship' ? 'Xử lý Yêu cầu Giao lại' :
                          'Thao tác lỗi nghiệp vụ'
                        }
                      </span>
                      <button onClick={() => setActionContractId(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                    </div>

                    {/* Quick Preset Chips for Physical Notes */}
                    {actionType === 'physical_note' && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-800">Chọn mẫu ghi chú có sẵn:</p>
                        <div className="flex flex-wrap gap-1">
                          {[
                            '📄 Đã in - thiếu 1 trang phụ lục',
                            '✍️ Đối tác hẹn lại giờ ký',
                            '🚚 Địa chỉ giao đổi sang PGD 2',
                            '🖊️ Chờ sếp ký bổ sung đóng dấu',
                            '📦 Đã bàn giao shipper VTP'
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActionNote(chip)}
                              className="text-[10px] bg-white border border-amber-200 hover:bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-medium transition cursor-pointer"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 text-xs">
                      <label className="block text-slate-600 font-bold">Nội dung ghi chú / Lý do <span className="text-rose-500">*</span></label>
                      <textarea 
                        rows={2} 
                        value={actionNote} 
                        onChange={(e) => setActionNote(e.target.value)} 
                        placeholder={
                          actionType === 'physical_note' ? "Nhập chi tiết thông tin vật lý (hoặc chọn mẫu ở trên)..." :
                          actionType === 'redraft' ? "Mô tả lý do soạn thảo lại (ví dụ: Sửa đổi điều khoản thanh toán...)" :
                          actionType === 'reship' ? "Mô tả lý do giao lại (ví dụ: Thất lạc bưu kiện, in lại bưu phẩm mới...)" :
                          "Nhập lý do chi tiết..."
                        }
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button onClick={() => setActionContractId(null)} className="px-2.5 py-1 bg-slate-200 rounded-lg text-slate-700 text-[10px] font-bold">Đóng</button>
                      <button 
                        onClick={() => {
                          if (actionType === 'physical_note' && handleAddPhysicalNote) {
                            handleAddPhysicalNote(contract.id, actionNote || 'Đã ghi nhận bước xử lý vật lý');
                          } else if (actionType === 'reject' && handleRejectContract) {
                            handleRejectContract(contract.id, actionNote || 'Sếp từ chối duyệt ký');
                          } else if (actionType === 'report' && handleReportIssue) {
                            handleReportIssue(contract.id, actionNote || 'Báo cáo sự cố bưu phẩm');
                          } else if (actionType === 'redraft' && handleRedraftContract) {
                            handleRedraftContract(contract.id, actionNote || 'Tiến hành soạn thảo lại hợp đồng');
                          } else if (actionType === 'reship' && handleReshipContract) {
                            handleReshipContract(contract.id, actionNote || 'Yêu cầu giao lại bưu phẩm mới');
                          } else if (actionType === 'cancel' && handleCancelContract) {
                            handleCancelContract(contract.id, actionNote || 'Hủy bỏ hồ sơ');
                          }
                          setActionContractId(null);
                          setActionNote('');
                        }}
                        className={`px-3 py-1 text-white rounded-lg text-[10px] font-bold cursor-pointer transition ${
                          actionType === 'physical_note' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                        }`}
                      >
                        {actionType === 'physical_note' ? 'Lưu Ghi Chú Vật Lý' : actionType === 'redraft' || actionType === 'reship' ? 'Xác nhận' : 'Báo lỗi'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Progressive Load More Button */}
      {filteredContracts.length > mobilePageSize && (
        <div className="block md:hidden p-4 border-t border-slate-100 bg-slate-50/50 text-center">
          <button
            onClick={() => setMobilePageSize(prev => prev + 10)}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition active:scale-98 cursor-pointer"
          >
            Tải thêm +10 hồ sơ ({Math.min(mobilePageSize, filteredContracts.length)}/{filteredContracts.length})
          </button>
        </div>
      )}

      {/* QR Code Printing Modal */}
      {qrPrintContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 font-sans">
                <QrCode size={16} className="text-emerald-500" />
                In Nhãn QR Bưu Kiện
              </h3>
              <button 
                onClick={() => setQrPrintContract(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/50 space-y-3">
              <canvas id="qr-code-canvas" className="bg-white p-2 rounded-lg border border-slate-100 shadow-xs" />
              <div className="text-center">
                <p className="text-xs font-bold text-slate-900 font-mono">#{qrPrintContract.contractNumber}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{qrPrintContract.name}</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 border border-slate-100 p-3 rounded-lg bg-slate-50/30">
              <p><strong>Đối tác:</strong> {qrPrintContract.partnerName}</p>
              {qrPrintContract.receiverName && <p><strong>Người nhận:</strong> {qrPrintContract.receiverName}</p>}
              {qrPrintContract.receiverPhone && <p><strong>SĐT:</strong> {qrPrintContract.receiverPhone}</p>}
              {qrPrintContract.receiverAddress && <p><strong>Địa chỉ:</strong> {qrPrintContract.receiverAddress}</p>}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setQrPrintContract(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
                  if (canvas) {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>In mã QR bưu kiện</title>
                            <style>
                              body { font-family: monospace; padding: 20px; text-align: center; }
                              .label-container { border: 2px dashed #000; padding: 15px; display: inline-block; width: 300px; }
                              .title { font-size: 16px; font-weight: bold; margin-bottom: 10px; }
                              .qr { margin: 15px auto; }
                              .details { font-size: 11px; text-align: left; line-height: 1.4; margin-top: 10px; border-top: 1px solid #000; padding-top: 10px; }
                            </style>
                          </head>
                          <body>
                            <div class="label-container">
                              <div class="title">BƯU KIỆN HỢP ĐỒNG</div>
                              <div>Mã: <strong>${qrPrintContract.contractNumber}</strong></div>
                              <img src="${canvas.toDataURL()}" class="qr" width="150" height="150" />
                              <div class="details">
                                <div><strong>Tên HĐ:</strong> ${qrPrintContract.name}</div>
                                <div><strong>Đối tác:</strong> ${qrPrintContract.partnerName}</div>
                                ${qrPrintContract.receiverName ? `<div><strong>Người nhận:</strong> ${qrPrintContract.receiverName}</div>` : ''}
                                ${qrPrintContract.receiverPhone ? `<div><strong>SĐT:</strong> ${qrPrintContract.receiverPhone}</div>` : ''}
                                ${qrPrintContract.receiverAddress ? `<div><strong>Địa chỉ:</strong> ${qrPrintContract.receiverAddress}</div>` : ''}
                              </div>
                            </div>
                            <script>
                              window.onload = function() {
                                window.print();
                                setTimeout(function() { window.close(); }, 500);
                              }
                            </script>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
              >
                <Printer size={14} />
                In Nhãn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ContractTable;
