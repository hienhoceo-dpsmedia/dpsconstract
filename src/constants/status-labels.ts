export const CONTRACT_STATUSES = {
  CHO_SOAN_THAO: 'Chờ soạn thảo',
  CHO_DUYET_BAN_MEM: 'Chờ duyệt bản mềm',
  CHO_IN: 'Chờ in',
  DANG_CHO_KY: 'Đang chờ ký',
  CHO_TAO_VAN_DON: 'Chờ tạo vận đơn',
  CHO_SHIPPER: 'Chờ shipper đến lấy',
  DANG_GIAO: 'Đang giao',
  CHO_BAN_GUI_LAI: 'Chờ bản gửi lại',
  HOAN_TAT: 'Hoàn tất',
  BI_TU_CHOI_KY: 'Bị từ chối ký',
  SU_CO_VAN_CHUYEN: 'Sự cố vận chuyển',
  DA_HUY: 'Đã hủy'
} as const;

export type ContractStatus = typeof CONTRACT_STATUSES[keyof typeof CONTRACT_STATUSES];

export const STATUS_LABELS: Record<ContractStatus, string> = {
  [CONTRACT_STATUSES.CHO_SOAN_THAO]: 'Chờ soạn thảo',
  [CONTRACT_STATUSES.CHO_DUYET_BAN_MEM]: 'Chờ duyệt bản mềm',
  [CONTRACT_STATUSES.CHO_IN]: 'Chờ in ấn',
  [CONTRACT_STATUSES.DANG_CHO_KY]: 'Đang chờ ký',
  [CONTRACT_STATUSES.CHO_TAO_VAN_DON]: 'Chờ tạo vận đơn',
  [CONTRACT_STATUSES.CHO_SHIPPER]: 'Chờ shipper đến lấy',
  [CONTRACT_STATUSES.DANG_GIAO]: 'Đang giao',
  [CONTRACT_STATUSES.CHO_BAN_GUI_LAI]: 'Chờ bản gửi lại',
  [CONTRACT_STATUSES.HOAN_TAT]: 'Hoàn tất',
  [CONTRACT_STATUSES.BI_TU_CHOI_KY]: 'Bị từ chối ký',
  [CONTRACT_STATUSES.SU_CO_VAN_CHUYEN]: 'Sự cố vận chuyển',
  [CONTRACT_STATUSES.DA_HUY]: 'Đã hủy'
};
