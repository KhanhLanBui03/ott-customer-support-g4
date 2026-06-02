import React from 'react';
import { Shield, Users, Plus, Check, MoreHorizontal } from 'lucide-react';

const mockRoles = [
  { id: 1, name: 'Super Admin', description: 'Full access to all system features', users: 2 },
  { id: 2, name: 'Moderator', description: 'Can manage users, channels, and reports', users: 15 },
  { id: 3, name: 'Support Staff', description: 'Can view users and reports, cannot delete', users: 45 },
];

const RolesView = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Vai trò & Phân quyền</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Quản lý quyền truy cập của ban quản trị</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1f2c] hover:bg-[#2a3142] text-white rounded-xl font-semibold text-sm transition-all shadow-sm">
          <Plus size={18} strokeWidth={3} />
          Tạo vai trò mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockRoles.map(role => (
          <div key={role.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Shield size={24} />
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreHorizontal size={20} />
              </button>
            </div>
            <h3 className="text-xl font-bold text-gray-900">{role.name}</h3>
            <p className="text-sm text-gray-500 mt-1 h-10">{role.description}</p>
            
            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Users size={16} />
                {role.users} Nhân viên
              </div>
              <button className="text-sm font-bold text-[#00d2a0] hover:text-[#00b88c]">
                Sửa quyền
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Danh sách Quản trị viên</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-[#00d2a0]/30 hover:bg-[#00d2a0]/5 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <img src={`https://i.pravatar.cc/150?img=${i+10}`} alt="" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Admin User {i}</h4>
                  <p className="text-sm font-medium text-gray-500">admin{i}@chatapp.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">
                  {i === 1 ? 'Super Admin' : 'Moderator'}
                </span>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RolesView;
