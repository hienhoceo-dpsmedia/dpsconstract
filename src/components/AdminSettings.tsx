import React from 'react';
import { Clock, Users, Mail, Plus, Trash2, Send, FileText, Activity, CheckCircle } from 'lucide-react';
import { SettingsState } from '../types';

interface AdminSettingsProps {
  settings?: SettingsState | null;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState | null>>;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: 'legal' | 'clerk' | 'admin';
  setInviteRole: (role: 'legal' | 'clerk' | 'admin') => void;
  handleInviteUser: (e: React.FormEvent) => void;
  handleRemoveUser: (email: string) => void;
  handleSaveSettings: (e: React.FormEvent) => void;
  currentUser?: any;
  devModeEnabled?: boolean;
  setDevModeEnabled?: (enabled: boolean) => void;
  onRequestNewDraft?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings,
  setSettings,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  handleInviteUser,
  handleRemoveUser,
  handleSaveSettings,
  devModeEnabled,
  setDevModeEnabled,
  onRequestNewDraft,
}) => {
  const [userSearchQuery, setUserSearchQuery] = React.useState('');
  const [userRoleFilter, setUserRoleFilter] = React.useState<'all' | 'admin' | 'legal' | 'clerk'>('all');
  const [userToDelete, setUserToDelete] = React.useState<string | null>(null);

  if (!settings) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3" id="admin-settings-loading">
        <Activity className="animate-spin text-emerald-600 mx-auto" size={28} />
        <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình hệ thống...</p>
      </div>
    );
  }

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

  const filteredUsers = (settings.users || []).filter(u => {
    if (!u) return false;
    const matchesSearch = (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleUpdateUserRole = (email: string, newRole: 'admin' | 'legal' | 'clerk') => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        users: prev.users.map(u => u.email === email ? { ...u, role: newRole } : u)
      };
    });
  };

  return (
    <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="admin-settings-form">
      {/* Left Column: SLA Config & Team lists */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* SLA Configurations & Base Pay */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock size={16} className="text-emerald-500" />
            Cấu hình Đơn giá Nền (BASE) & Cam kết SLA Tiêu chí
          </h3>

          {/* BASE PAY CONFIG */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">1. Đơn giá Lương Nền (BASE Pay)</h4>
              {onRequestNewDraft && (
                <button
                  type="button"
                  onClick={onRequestNewDraft}
                  className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus size={12} />
                  Sếp Giao Task Legal Ngay
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Lương Nền Soạn Thảo Legal (VNĐ / task)</label>
                <input 
                  type="number" 
                  step={10000}
                  min={0}
                  value={settings.defaultBasePayLegal ?? 500000}
                  onChange={(e) => setSettings({ ...settings, defaultBasePayLegal: parseInt(e.target.value) || 0 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white font-bold text-emerald-700"
                />
                <p className="text-[10px] text-slate-400">Mức lương gốc cho mỗi hợp đồng soạn thảo được giao cho Legal.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Lương Nền Xử Lý Văn Thư (VNĐ / hồ sơ)</label>
                <input 
                  type="number" 
                  step={10000}
                  min={0}
                  value={settings.defaultBasePayClerk ?? 100000}
                  onChange={(e) => setSettings({ ...settings, defaultBasePayClerk: parseInt(e.target.value) || 0 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white font-bold text-blue-700"
                />
                <p className="text-[10px] text-slate-400">Mức lương gốc cho mỗi hồ sơ hợp đồng vật lý do Văn thư phụ trách.</p>
              </div>
            </div>
          </div>

          {/* SLA TIME LIMITS CONFIG */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">2. Thời Hạn Tiêu Chí Cam Kết SLA</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">SLA Soạn Thảo Legal (Giờ)</label>
                <input 
                  type="number" 
                  min={1}
                  value={settings.slaInternalHours || 24}
                  onChange={(e) => setSettings({ ...settings, slaInternalHours: parseInt(e.target.value) || 24 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">SLA In Ấn Văn Thư (Giờ)</label>
                <input 
                  type="number" 
                  min={1}
                  value={settings.slaPrintingHours ?? 2}
                  onChange={(e) => setSettings({ ...settings, slaPrintingHours: parseInt(e.target.value) || 2 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">SLA Giao Vận VTP (Giờ)</label>
                <input 
                  type="number" 
                  min={1}
                  value={settings.slaCourierHours ?? 4}
                  onChange={(e) => setSettings({ ...settings, slaCourierHours: parseInt(e.target.value) || 4 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">SLA Thu Hồi Kho (Ngày)</label>
                <input 
                  type="number" 
                  min={1}
                  value={settings.slaRetrievalDays ?? 7}
                  onChange={(e) => setSettings({ ...settings, slaRetrievalDays: parseInt(e.target.value) || 7 })}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* CUSTOM RATES FOR SLA & FEEDBACK */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>3. Tỷ Lệ % Thưởng / Phạt SLA &amp; Chất Lượng (Áp Dụng Cho Cả 2 Roles)</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Đã cập nhật theo quy tắc mới</span>
            </h4>

            {/* SLA Timeliness Rates & Time Criteria */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-4">
              <span className="text-[11px] font-bold text-slate-800 uppercase font-mono block border-b border-slate-200 pb-1">
                A. Quy tắc SLA Thời gian (% Thưởng/Phạt &amp; Tiêu chí mốc thời gian)
              </span>

              {/* A.1 Money % Rates */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">A.1 Tỷ lệ % Lương Thưởng/Phạt</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Sớm nhiều (%)</label>
                    <input 
                      type="number"
                      value={settings.slaEarlyMaxRate ?? 30}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMaxRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-emerald-600 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Sớm vừa (%)</label>
                    <input 
                      type="number"
                      value={settings.slaEarlyMidRate ?? 20}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMidRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-emerald-600 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-700 block mb-1">Sớm ít (%)</label>
                    <input 
                      type="number"
                      value={settings.slaEarlyMinRate ?? 10}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMinRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-emerald-600 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-blue-700 block mb-1">Đúng SLA (%)</label>
                    <input 
                      type="number"
                      value={settings.slaOnTimeRate ?? 0}
                      onChange={(e) => setSettings({ ...settings, slaOnTimeRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-blue-600 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-rose-700 block mb-1">Trễ ít (%)</label>
                    <input 
                      type="number"
                      value={settings.slaLateMinRate ?? -10}
                      onChange={(e) => setSettings({ ...settings, slaLateMinRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-600 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-rose-700 block mb-1">Trễ vừa (%)</label>
                    <input 
                      type="number"
                      value={settings.slaLateMidRate ?? -20}
                      onChange={(e) => setSettings({ ...settings, slaLateMidRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-600 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-rose-700 block mb-1">Trễ nhiều (%)</label>
                    <input 
                      type="number"
                      value={settings.slaLateMaxRate ?? -30}
                      onChange={(e) => setSettings({ ...settings, slaLateMaxRate: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-600 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* A.2 Threshold Criteria */}
              <div className="space-y-1.5 border-t border-slate-200/60 pt-3">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">A.2 Tiêu chí mốc Thời gian (Phần trăm tiết kiệm &amp; Số giờ trễ)</span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Sớm nhiều (≥ % thời hạn)</label>
                    <input 
                      type="number"
                      min={0}
                      max={100}
                      value={settings.slaEarlyMaxTimePct ?? 50}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMaxTimePct: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Sớm vừa (≥ % thời hạn)</label>
                    <input 
                      type="number"
                      min={0}
                      max={100}
                      value={settings.slaEarlyMidTimePct ?? 25}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMidTimePct: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Sớm ít (≥ % thời hạn)</label>
                    <input 
                      type="number"
                      min={0}
                      max={100}
                      value={settings.slaEarlyMinTimePct ?? 5}
                      onChange={(e) => setSettings({ ...settings, slaEarlyMinTimePct: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Trễ ít (≤ số giờ)</label>
                    <input 
                      type="number"
                      min={0}
                      value={settings.slaLateMinHours ?? 2}
                      onChange={(e) => setSettings({ ...settings, slaLateMinHours: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Trễ vừa (≤ số giờ)</label>
                    <input 
                      type="number"
                      min={0}
                      value={settings.slaLateMidHours ?? 6}
                      onChange={(e) => setSettings({ ...settings, slaLateMidHours: parseInt(e.target.value) || 0 })}
                      className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-800 w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Feedback Rates */}
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/70 space-y-3">
              <span className="text-[11px] font-bold text-amber-900 uppercase font-mono block border-b border-amber-200/80 pb-1">
                B. Quy tắc Chất lượng / Feedback / Phản hồi
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">0 Feedback (Đạt, %)</label>
                  <input 
                    type="number"
                    value={settings.feedback0Rate ?? 0}
                    onChange={(e) => setSettings({ ...settings, feedback0Rate: parseInt(e.target.value) || 0 })}
                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-slate-700 w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-800 block mb-1">1 lần Feedback (%)</label>
                  <input 
                    type="number"
                    value={settings.feedback1Rate ?? -10}
                    onChange={(e) => setSettings({ ...settings, feedback1Rate: parseInt(e.target.value) || 0 })}
                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-amber-700 w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-800 block mb-1">2 lần Feedback (%)</label>
                  <input 
                    type="number"
                    value={settings.feedback2Rate ?? -20}
                    onChange={(e) => setSettings({ ...settings, feedback2Rate: parseInt(e.target.value) || 0 })}
                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-amber-700 w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-rose-800 block mb-1">3+ lần Feedback (%)</label>
                  <input 
                    type="number"
                    value={settings.feedback3Rate ?? -30}
                    onChange={(e) => setSettings({ ...settings, feedback3Rate: parseInt(e.target.value) || 0 })}
                    className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-700 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Google OAuth & Users Invited Table */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2">
              <Users size={16} className="text-emerald-500" />
              Quản lý Người dùng &amp; Phân quyền (Google OAuth)
            </h3>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 w-fit">
              {filteredUsers.length} / {(settings.users || []).length} tài khoản
            </span>
          </div>

          {/* Form to invite user */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 flex-1 w-full">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email tài khoản Google</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input 
                  type="email" 
                  required
                  placeholder="nhap_email@congty.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs w-full focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1 w-full sm:w-44">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gán vai trò (Role)</label>
              <select 
                value={inviteRole}
                onChange={(e: any) => setInviteRole(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs w-full focus:outline-none font-semibold cursor-pointer"
              >
                <option value="legal">Legal (Pháp chế)</option>
                <option value="clerk">Văn thư</option>
                <option value="admin">Sếp (Admin)</option>
              </select>
            </div>

            <button 
              type="button"
              onClick={handleInviteUser}
              className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm w-full sm:w-auto"
            >
              <Plus size={14} />
              Cấp quyền
            </button>
          </div>

          {/* Search & Role Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Tìm kiếm nhân viên theo Email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e: any) => setUserRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer shrink-0"
            >
              <option value="all">Tất cả Vai trò</option>
              <option value="admin">Chỉ Sếp (Admin)</option>
              <option value="legal">Chỉ Pháp chế (Legal)</option>
              <option value="clerk">Chỉ Văn thư (Clerk)</option>
            </select>
          </div>

          {/* Current users table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                  <th className="py-2.5 px-4">Địa chỉ Email</th>
                  <th className="py-2.5 px-4">Quyền hạn (Thay đổi trực tiếp)</th>
                  <th className="py-2.5 px-4">Ngày cấp</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs italic">
                      Không tìm thấy người dùng nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.email} className="hover:bg-slate-50/80 transition" id={`invited-user-${user.role}`}>
                      <td className="py-3 px-4 font-bold text-slate-800">{user.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.email, e.target.value as any)}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer transition ${
                            user.role === 'admin' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            user.role === 'legal' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                            'bg-amber-50 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="legal">Legal (Pháp chế)</option>
                          <option value="clerk">Văn thư (Clerk)</option>
                          <option value="admin">Sếp (Admin)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{formatDate(user.invitedAt || null)}</td>
                      <td className="py-3 px-4 text-right">
                        <button 
                          type="button"
                          onClick={() => setUserToDelete(user.email)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa quyền truy cập"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Deletion Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Xác Nhận Hủy Cấp Quyền?</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{userToDelete}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tài khoản này sẽ lập tức mất quyền truy cập vào hệ thống. Bạn có chắc chắn muốn xóa?
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveUser(userToDelete);
                    setUserToDelete(null);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Third party integrations config */}
      <div className="space-y-6">
        
        {/* MS Teams webhook configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Send size={16} className="text-indigo-500" />
            Microsoft Teams Webhook
          </h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Webhook URL nhận sự kiện</label>
              <input 
                type="text" 
                placeholder="https://outlook.office.com/webhook/..."
                value={settings.teamsWebhookUrl || ''}
                onChange={(e) => setSettings({ ...settings, teamsWebhookUrl: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payload Template (JSON)</label>
              <textarea 
                rows={6}
                value={settings.teamsPayloadTemplate || ''}
                onChange={(e) => setSettings({ ...settings, teamsPayloadTemplate: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Google Drive backup folder destination */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText size={16} className="text-blue-500" />
            Sao lưu Google Drive Backup
          </h3>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Folder ID hoặc Đường dẫn backup</label>
              <input 
                type="text" 
                value={settings.googleDriveFolderId || ''}
                onChange={(e) => setSettings({ ...settings, googleDriveFolderId: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono w-full focus:outline-none"
              />
              <p className="text-[9px] text-slate-400">Tự động đẩy bản gốc và bản scan lưu trữ vào thư mục Google Drive tương ứng.</p>
            </div>
          </div>
        </div>



        {/* Developer & Simulator Mode Configuration */}
        {setDevModeEnabled && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-slate-900 font-bold text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Activity size={16} className="text-purple-500" />
              Chế Độ Giả Lập &amp; Nhà Phát Triển (Dev/Simulator Mode)
            </h3>
            <div className="flex items-center justify-between p-3.5 bg-purple-50/50 rounded-xl border border-purple-100/80">
              <div className="space-y-0.5 pr-2">
                <p className="text-xs font-extrabold text-purple-950">Kích hoạt Chế Độ Giả Lập Vai Trò &amp; Webhook</p>
                <p className="text-[10px] text-purple-700 leading-snug">Dành riêng cho Quản trị viên để kiểm thử chuỗi liên thông tự động giữa các vai trò Sếp - Legal - Clerk mà không ảnh hưởng người dùng thật.</p>
              </div>
              <button
                type="button"
                onClick={() => setDevModeEnabled(!devModeEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  devModeEnabled ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {devModeEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
              </button>
            </div>
          </div>
        )}

        {/* Master Save Trigger bar */}
        <button 
          type="submit"
          className="w-full py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition cursor-pointer flex items-center justify-center gap-2 shadow"
        >
          <CheckCircle size={14} />
          Lưu Toàn Bộ Cấu Hình Hệ Thống
        </button>
      </div>
    </form>
  );
};
export default AdminSettings;
