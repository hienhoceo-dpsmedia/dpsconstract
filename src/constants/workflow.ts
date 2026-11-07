import { Printer, Clock, FileText, Inbox, Truck, RefreshCw, CheckCircle, AlertCircle, FileCheck, Edit3 } from 'lucide-react';

export interface WorkflowStep {
  label: string;
  countKey: string;
  color: string;
  mobileColor: string;
  activeRing: string;
  icon: any;
  filterVal: string;
  desc: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { 
    label: '01. Soạn thảo', 
    countKey: 'Chờ soạn thảo', 
    color: 'bg-teal-50 text-teal-700 border-teal-100', 
    mobileColor: 'text-teal-600 bg-teal-50 border-teal-100', 
    activeRing: 'ring-2 ring-teal-500', 
    icon: Edit3, 
    filterVal: 'Chờ soạn thảo', 
    desc: 'Quản lý yêu cầu Legal soạn thảo hợp đồng theo yêu cầu & deadline' 
  },
  { 
    label: '02. Duyệt bản mềm', 
    countKey: 'Chờ duyệt bản mềm', 
    color: 'bg-sky-50 text-sky-700 border-sky-100', 
    mobileColor: 'text-sky-600 bg-sky-50 border-sky-100', 
    activeRing: 'ring-2 ring-sky-500', 
    icon: FileCheck, 
    filterVal: 'Chờ duyệt bản mềm', 
    desc: 'Chờ sếp/lãnh đạo duyệt nội dung bản mềm trước khi cho phép in ấn' 
  },
  { 
    label: '03. Chờ in ấn', 
    countKey: 'Chờ in', 
    color: 'bg-rose-50 text-rose-700 border-rose-100', 
    mobileColor: 'text-rose-600 bg-rose-50 border-rose-100', 
    activeRing: 'ring-2 ring-rose-500', 
    icon: Printer, 
    filterVal: 'Chờ in', 
    desc: 'Sếp đã duyệt bản mềm. Văn thư in ra giấy để sếp ký tay đóng dấu' 
  },
  { 
    label: '04. Trình ký duyệt', 
    countKey: 'Đang chờ ký', 
    color: 'bg-amber-50 text-amber-700 border-amber-100', 
    mobileColor: 'text-amber-600 bg-amber-50 border-amber-100', 
    activeRing: 'ring-2 ring-amber-500', 
    icon: Clock, 
    filterVal: 'Đang chờ ký', 
    desc: 'Hợp đồng giấy chờ sếp ký tay và đóng dấu đỏ vật lý' 
  },
  { 
    label: '05. Mã vận đơn', 
    countKey: 'Chờ tạo vận đơn', 
    color: 'bg-indigo-50 text-indigo-700 border-indigo-100', 
    mobileColor: 'text-indigo-600 bg-indigo-50 border-indigo-100', 
    activeRing: 'ring-2 ring-indigo-500', 
    icon: FileText, 
    filterVal: 'Chờ tạo vận đơn', 
    desc: 'Gán mã vận đơn giao Viettel Post hai chiều' 
  },
  { 
    label: '06. Chờ shipper', 
    countKey: 'Chờ shipper đến lấy', 
    color: 'bg-purple-50 text-purple-700 border-purple-100', 
    mobileColor: 'text-purple-600 bg-purple-50 border-purple-100', 
    activeRing: 'ring-2 ring-purple-500', 
    icon: Inbox, 
    filterVal: 'Chờ shipper đến lấy', 
    desc: 'Hồ sơ đã đóng gói, chờ bưu tá Viettel Post đến lấy' 
  },
  { 
    label: '07. Đang giao (VTP)', 
    countKey: 'Đang giao', 
    color: 'bg-blue-50 text-blue-700 border-blue-100', 
    mobileColor: 'text-blue-600 bg-blue-50 border-blue-100', 
    activeRing: 'ring-2 ring-blue-500', 
    icon: Truck, 
    filterVal: 'Đang giao', 
    desc: 'Đang vận chuyển hai chiều liên tỉnh/quốc tế' 
  },
  { 
    label: '08. Chờ gửi lại', 
    countKey: 'Chờ bản gửi lại', 
    color: 'bg-orange-50 text-orange-700 border-orange-100', 
    mobileColor: 'text-orange-600 bg-orange-50 border-orange-100', 
    activeRing: 'ring-2 ring-orange-500', 
    icon: RefreshCw, 
    filterVal: 'Chờ bản gửi lại', 
    desc: 'Chờ đối tác ký xong và shipper VTP gửi trả bản cứng' 
  },
  { 
    label: '09. Đã hoàn tất', 
    countKey: 'Hoàn tất', 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100', 
    mobileColor: 'text-emerald-600 bg-emerald-50 border-emerald-100', 
    activeRing: 'ring-2 ring-emerald-500', 
    icon: CheckCircle, 
    filterVal: 'Hoàn tất', 
    desc: 'Đã nhận đủ bản gốc giấy, scan số hóa lưu Drive & lưu kho' 
  },
  { 
    label: '10. Xử lý ngoại lệ',  
    countKey: 'Exception', 
    color: 'bg-red-50 text-red-700 border-red-150', 
    mobileColor: 'text-red-650 bg-red-50 border-red-150', 
    activeRing: 'ring-2 ring-red-500', 
    icon: AlertCircle, 
    filterVal: 'Exception', 
    desc: 'Hợp đồng bị sếp từ chối hoặc gặp sự cố bưu tá bưu phẩm' 
  }
];

export const getStepCount = (step: WorkflowStep, contracts: any[]): number => {
  if (step.countKey === 'Exception') {
    return contracts.filter(c => c.status === 'Bị từ chối ký' || c.status === 'Sự cố vận chuyển').length;
  }
  return contracts.filter(c => c.status === step.countKey).length;
};

export const getContractsSummary = (contracts: any[]) => {
  const total = contracts.length;
  const active = contracts.filter(c => c.status !== 'Đã hủy').length;
  const cancelled = contracts.filter(c => c.status === 'Đã hủy').length;
  return { total, active, cancelled };
};
