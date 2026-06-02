import React, { useState } from 'react';
import { Save, AlertTriangle, Database, Video, Shield } from 'lucide-react';

const SettingsView = () => {
  const [maintenance, setMaintenance] = useState(false);
  const [videoCall, setVideoCall] = useState(true);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cài đặt Hệ thống</h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">Cấu hình các thông số chung của toàn hệ thống</p>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
          <AlertTriangle size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-red-900">Chế độ Bảo trì</h3>
          <p className="text-sm font-medium text-red-700 mt-1 mb-4">
            Bật tính năng này sẽ đăng xuất người dùng và ngăn đăng nhập mới. Chỉ dùng khi nâng cấp hệ thống.
          </p>
          <button 
            onClick={() => setMaintenance(!maintenance)}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
              maintenance ? 'bg-red-600 text-white shadow-red-600/30' : 'bg-white text-red-600 border border-red-200 hover:bg-red-100'
            }`}
          >
            {maintenance ? 'Tắt chế độ bảo trì' : 'Bật chế độ bảo trì'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chat Configuration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
              <Database size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Giới hạn hệ thống</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Dung lượng File tối đa (MB)</label>
              <input type="number" defaultValue={25} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00d2a0] focus:border-[#00d2a0] font-medium text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Số thành viên tối đa mỗi nhóm</label>
              <input type="number" defaultValue={1000} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00d2a0] focus:border-[#00d2a0] font-medium text-gray-900" />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
              <Video size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Tính năng</h3>
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">Gọi Video (Video Call)</p>
                <p className="text-sm font-medium text-gray-500">Bật tính năng gọi video tích hợp Agora</p>
              </div>
              <button 
                onClick={() => setVideoCall(!videoCall)}
                className={`w-12 h-6 rounded-full transition-colors relative ${videoCall ? 'bg-[#00d2a0]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${videoCall ? 'translate-x-6' : ''}`}></span>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-900">Đăng ký tự do</p>
                <p className="text-sm font-medium text-gray-500">Cho phép người dùng tự đăng ký tài khoản</p>
              </div>
              <button className="w-12 h-6 rounded-full bg-[#00d2a0] relative">
                <span className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform translate-x-6"></span>
              </button>
            </div>
          </div>
        </div>

        {/* API Integrations */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
              <Shield size={20} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Khóa API & Tích hợp</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Agora App ID</label>
              <input type="password" defaultValue="abcdef1234567890" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00d2a0] font-medium font-mono text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">AWS S3 Bucket URL</label>
              <input type="text" defaultValue="https://chatapp-bucket.s3.amazonaws.com" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00d2a0] font-medium text-gray-900" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button className="flex items-center gap-2 px-6 py-3 bg-[#00d2a0] hover:bg-[#00b88c] text-white rounded-xl font-bold transition-all shadow-lg shadow-[#00d2a0]/30">
          <Save size={18} />
          Lưu cài đặt
        </button>
      </div>
    </div>
  );
};

export default SettingsView;
