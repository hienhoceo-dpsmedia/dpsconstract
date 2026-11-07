import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User, Contract, SettingsState, ReportsData, SimLog } from '../types';

export function useContracts() {
  // Authentication & Session States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Application Data States
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [simLogs, setSimLogs] = useState<SimLog[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Navigation & Sub-views
  const [currentTab, setCurrentTab] = useState<'home' | 'tasks' | 'contracts' | 'reports' | 'settings' | 'profile' | 'legal-payroll'>('contracts');
  const [activeMobileView, setActiveMobileView] = useState<'home' | 'tasks' | 'contracts' | 'profile' | 'payroll' | 'reports' | 'settings'>('home');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [contractFilter, setContractFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form & Action States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isManualInputMode, setIsManualInputMode] = useState(false);
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [uploadedFileDetails, setUploadedFileDetails] = useState<Contract | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [waybillInputs, setWaybillInputs] = useState<Record<string, string>>({});

  // Admin settings manage users
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'legal' | 'clerk' | 'admin'>('legal');

  // Simulator Drawer state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simVtpContractId, setSimVtpContractId] = useState('');
  const [simVtpStatus, setSimVtpStatus] = useState('PICKED_UP');
  const [simVtpNote, setSimVtpNote] = useState('');

  // Clerk Camera Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [preselectedContractForScanner, setPreselectedContractForScanner] = useState<Contract | null>(null);

  // Fetch functions
  const fetchContracts = async () => {
    try {
      const data = await apiService.getContracts();
      setContracts(data);
    } catch (e) {
      console.error('Error fetching contracts', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await apiService.getSettings();
      setSettings(data);
    } catch (e) {
      console.error('Error fetching settings', e);
    }
  };

  const fetchReports = async () => {
    try {
      const data = await apiService.getReports();
      setReports(data);
    } catch (e) {
      console.error('Error fetching reports', e);
    }
  };

  const fetchSimLogs = async () => {
    try {
      const data = await apiService.getSimLogs();
      setSimLogs(data);
    } catch (e) {
      console.error('Error fetching logs', e);
    }
  };

  // Initial and reactive effects
  useEffect(() => {
    fetchSettings();
  }, []);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;
    apiService
      .getCurrentUser()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (isMounted) setCurrentUser(null);
      })
      .finally(() => {
        if (isMounted) setIsAuthChecking(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Force non-admin users away from admin-only tabs (reports, settings)
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && (currentTab === 'reports' || currentTab === 'settings')) {
      setCurrentTab('contracts');
    }
  }, [currentUser, currentTab]);

  // Poll data periodically
  useEffect(() => {
    if (currentUser) {
      fetchContracts();
      fetchReports();
    }
  }, [currentUser, currentTab, activeMobileView]);

  useEffect(() => {
    let interval: any;
    if (showSimulator) {
      fetchSimLogs();
      interval = setInterval(fetchSimLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [showSimulator]);

  // Actions
  const handleSignIn = async (email: string, password: string) => {
    if (!email || !password) {
      setAuthError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    try {
      const data = await apiService.login(email, password);
      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthError('');
      setAuthEmail('');
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      setAuthError(e.message || 'Đăng nhập thất bại');
      throw e;
    }
  };

  const handleGoogleSignIn = (emailOrPassword?: string, maybePassword?: string) => {
    return handleSignIn(emailOrPassword || authEmail, maybePassword || '');
  };

  const handleSignOut = async () => {
    try {
      await apiService.logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setCurrentUser(null);
    }
  };

  // Legal: Upload Contract
  const handleContractUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalFile) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);
    
    // Simulate upload progress in stages for polish
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 400);

    try {
      const userEmail = currentUser?.email || '';
      const newContract = await apiService.uploadContract(originalFile, userEmail);
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadedFileDetails(newContract);
      fetchContracts();
      setOriginalFile(null);
    } catch (err: any) {
      clearInterval(progressInterval);
      setUploadError(err.message || 'Lỗi upload & xử lý hợp đồng');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleManualContractCreate = async (contractData: {
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
  }) => {
    setIsUploading(true);
    setUploadProgress(30);
    setUploadError(null);
    try {
      const userEmail = currentUser?.email || '';
      const newContract = await apiService.createContractManual({
        ...contractData,
        uploadedBy: userEmail
      });
      setUploadProgress(100);
      setUploadedFileDetails(newContract);
      setIsManualInputMode(false);
      fetchContracts();
    } catch (err: any) {
      setUploadError(err.message || 'Khởi tạo thủ công thất bại');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 300);
    }
  };

  const checkContractId = async (contractNumber: string): Promise<boolean> => {
    try {
      const res = await apiService.checkContractId(contractNumber);
      return res.exists;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // Manager: Create Drafting Request
  const handleRequestDraftContract = async (draftData: any) => {
    try {
      const userEmail = currentUser?.email || 'admin@test.com';
      await apiService.requestDraftContract({
        ...draftData,
        requestedBy: userEmail
      });
      fetchContracts();
      showToast('Đã tạo và giao task soạn thảo hợp đồng thành công!', 'success');
      return true;
    } catch (e: any) {
      console.error(e);
      showToast(e.message, 'error');
      return false;
    }
  };

  // Legal: Submit Draft file or Google Docs link
  const handleSubmitDraftContract = async (contractId: string, file?: File, googleDocsLink?: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.submitDraftContract(contractId, userEmail, file, googleDocsLink);
      fetchContracts();
      showToast('Đã nộp bản mềm draft hợp đồng thành công!', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message, 'error');
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Manager: Feedback / Request Edits on Draft
  const handleFeedbackDraftContract = async (contractId: string, note: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.feedbackDraftContract(contractId, userEmail, note);
      fetchContracts();
      showToast('Đã gửi phản hồi yêu cầu chỉnh sửa draft', 'info');
    } catch (e: any) {
      console.error(e);
      showToast(e.message, 'error');
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Leader/Boss: Approve Soft Copy
  const handleApproveSoftCopy = async (contractId: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.approveSoftCopy(contractId, userEmail);
      fetchContracts();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Clerk: Print Contract
  const handleConfirmPrinted = async (contractId: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.printContract(contractId, userEmail);
      fetchContracts();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Clerk: Signed Contract Confirm
  const handleConfirmSigned = async (contractId: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.signContract(contractId, userEmail);
      fetchContracts();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Clerk: Assign Waybill code
  const handleAssignWaybill = async (contractId: string) => {
    const code = waybillInputs[contractId];
    if (!code || !code.trim()) {
      alert('Vui lòng nhập mã vận đơn Viettel Post');
      return;
    }

    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || '';
      await apiService.assignWaybill(contractId, code.trim(), userEmail);
      
      setWaybillInputs(prev => {
        const next = { ...prev };
        delete next[contractId];
        return next;
      });
      fetchContracts();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Clerk: Upload Scan Copy
  const handleUploadScan = async (contractId: string) => {
    if (!scanFile) return;

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const userEmail = currentUser?.email || '';
      await apiService.uploadScanFile(contractId, scanFile, userEmail);
      setUploadProgress(100);
      setScanFile(null);
      fetchContracts();
      alert('Đã số hóa bản quét hợp đồng thành công. AI đã trích xuất lại các trường dữ liệu.');
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Clerk: Direct PDF upload with matching
  const handleDirectUploadScan = async (contractId: string, file: File) => {
    setIsUploading(true);
    try {
      const userEmail = currentUser?.email || '';
      await apiService.uploadScanFile(contractId, file, userEmail);
      fetchContracts();
    } catch (e: any) {
      alert('Lỗi liên kết bản scan: ' + e.message);
      throw e;
    } finally {
      setIsUploading(false);
    }
  };

  // Clerk: Upload Scan Copy from Camera Scanner
  const handleScannerUpload = async (contractId: string, pdfBlob: Blob) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.uploadScanBlob(contractId, pdfBlob, userEmail);
      fetchContracts();
    } catch (e: any) {
      throw new Error(e.message || 'Tải lên bản scan thất bại');
    }
  };

  // Clerk: Archive and Complete lifecycle
  const handleArchiveContract = async (contractId: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.archiveContract(contractId, userEmail);
      fetchContracts();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    }
  };

  // Clerk: Transition Contract via QR scan
  const handleQrTransitionContract = async (contractId: string) => {
    try {
      const userEmail = currentUser?.email || '';
      const updated = await apiService.qrTransitionContract(contractId, userEmail);
      await fetchContracts();
      return updated;
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  };

  // Admin settings: Invite new user
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      await apiService.inviteUser(inviteEmail, inviteRole);
      await fetchSettings();
      setInviteEmail('');
      alert(`Đã gán vai trò "${inviteRole}" cho email ${inviteEmail}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Admin settings: Remove invited email
  const handleRemoveUser = async (email: string) => {
    if (!confirm(`Xác nhận hủy phân quyền người dùng: ${email}?`)) return;

    try {
      await apiService.removeUser(email);
      await fetchSettings();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Admin settings: Save threshold & integrations
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      await apiService.saveSettings(settings);
      alert('Cấu hình hệ thống được lưu thành công.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Action: Reject Contract (Bị từ chối ký)
  const handleRejectContract = async (contractId: string, note: string) => {
    try {
      const userEmail = currentUser?.email || 'user@test.com';
      await apiService.rejectContract(contractId, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Report Issue (Sự cố vận chuyển)
  const handleReportIssue = async (contractId: string, note: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.reportIssue(contractId, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Redraft Contract (Soạn thảo lại)
  const handleRedraftContract = async (contractId: string, note: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.redraftContract(contractId, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Reship Contract (Giao lại)
  const handleReshipContract = async (contractId: string, note: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.reshipContract(contractId, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Cancel Contract (Đã hủy)
  const handleCancelContract = async (contractId: string, note: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.cancelContract(contractId, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Add Physical Step Note (Ghi chú vật lý xử lý)
  const handleAddPhysicalNote = async (contractId: string, note: string) => {
    if (!note.trim()) return;
    try {
      const userEmail = currentUser?.email || '';
      const target = contracts.find(c => c.id === contractId);
      if (!target) return;
      const history = target.physical_step_history || [];
      const updatedHistory = [
        ...history,
        { at: new Date().toISOString(), by: userEmail, step: target.status, note: note.trim() }
      ];
      await apiService.editContract(contractId, {
        physical_notes: note.trim(),
        physical_step_history: updatedHistory
      }, userEmail, `Ghi chú xử lý vật lý: ${note.trim()}`);
      fetchContracts();
      showToast(`Đã lưu ghi chú xử lý vật lý: "${note.trim()}"`, 'success');
    } catch (e: any) {
      showToast('Lỗi lưu ghi chú: ' + e.message, 'error');
    }
  };

  // Action: Edit Contract (Chỉnh sửa thủ công)
  const handleEditContract = async (contractId: string, fields: Partial<Contract>, note: string) => {
    try {
      const userEmail = currentUser?.email || '';
      await apiService.editContract(contractId, fields, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Action: Update Contract Status (Thay đổi trạng thái thủ công)
  const handleUpdateContractStatus = async (contractId: string, status: string, note?: string) => {
    setPendingActions(prev => ({ ...prev, [contractId]: true }));
    try {
      const userEmail = currentUser?.email || 'user@test.com';
      await apiService.updateContractStatus(contractId, status, userEmail, note);
      fetchContracts();
      fetchReports();
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    } finally {
      setPendingActions(prev => ({ ...prev, [contractId]: false }));
    }
  };

  // Action: Toggle Viettel Post API Connection
  const handleToggleVtpConnection = async () => {
    try {
      const res = await apiService.toggleVtpConnection();
      if (settings) {
        setSettings({ ...settings, ...res });
      }
      alert(`Đã chuyển đổi trạng thái kết nối Viettel Post API thành: ${res.vtpConnectionStatus === 'connected' ? 'CONNECTED (Đang hoạt động)' : 'DISCONNECTED (Mất kết nối / Mô phỏng sự cố)'}`);
    } catch (e: any) {
      alert('Lỗi: ' + e.message);
    }
  };

  // Simulator: Trigger Viettel Post webhook status update
  const handleSimulateVtpWebhook = async () => {
    if (!simVtpContractId) {
      alert('Vui lòng chọn hợp đồng để bắn webhook');
      return;
    }

    const targetContract = contracts.find(c => c.id === simVtpContractId);
    if (!targetContract) return;

    try {
      await apiService.simulateVtpWebhook(targetContract.waybillCode, simVtpStatus, simVtpNote || (simVtpStatus === 'PICKED_UP' ? 'Shipper đã lấy bưu kiện thành công' : 'Đã giao ký nhận thành công'));
      fetchContracts();
      fetchSimLogs();
      setSimVtpNote('');
      alert('Bắn Webhook giả lập thành công! Hãy xem trạng thái hợp đồng cập nhật tức thì.');
    } catch (e: any) {
      alert('Lỗi webhook: ' + e.message);
    }
  };

  // Simulator: Trigger Manual SLA check
  const handleTriggerSlaCheck = async () => {
    try {
      await apiService.runSlaCheck();
      fetchContracts();
      fetchSimLogs();
      alert('Quét SLA thành công! Các hợp đồng vượt hạn đã được ghi vết cảnh báo.');
    } catch (e: any) {
      alert(e.message);
    }
  };

  return {
    toast,
    showToast,
    currentUser,
    setCurrentUser,
    isAuthChecking,
    authEmail,
    setAuthEmail,
    authError,
    setAuthError,
    showAuthModal,
    setShowAuthModal,
    contracts,
    setContracts,
    settings,
    setSettings,
    reports,
    setReports,
    simLogs,
    setSimLogs,
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
    fetchContracts,
    fetchSettings,
    fetchReports,
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
  };
}
