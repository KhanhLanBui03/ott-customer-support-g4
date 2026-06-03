import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, X, Mail, Phone, Shield, Calendar, Info } from 'lucide-react';
import adminApi from '../../../api/adminApi';

const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, LOCKED
  const [selectedUser, setSelectedUser] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAllUsers();
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Reset pagination to page 1 when filter or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const filteredUsers = users.filter(u => {
    const name = u.fullName || (u.lastName + " " + u.firstName) || '';
    const email = u.email || '';
    const phone = u.phoneNumber || '';

    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm);

    const isLocked = u.status === 'LOCKED';
    if (statusFilter === 'ACTIVE' && isLocked) return false;
    if (statusFilter === 'LOCKED' && !isLocked) return false;

    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quản lý Người dùng</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Giám sát và xem danh sách tài khoản hệ thống</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900 tracking-tight">{users.length}</div>
          <p className="text-gray-500 text-sm font-medium">Tổng người dùng</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="p-5 flex items-center justify-between gap-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên, email, số điện thoại..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0] focus:border-[#00d2a0] sm:text-sm font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${statusFilter === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${statusFilter === 'ACTIVE' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Hoạt động
              </button>
              <button
                onClick={() => setStatusFilter('LOCKED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${statusFilter === 'LOCKED' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Bị khóa
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Đang tải dữ liệu người dùng...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Họ và tên
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Địa chỉ Email / SĐT
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((u) => {
                    const name = u.fullName || (u.lastName + " " + u.firstName) || 'Chưa đặt tên';
                    const avatarUrl = u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
                    const isLocked = u.status === 'LOCKED';

                    return (
                      <tr key={u.userId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <img className="h-10 w-10 rounded-full object-cover border border-gray-200" src={avatarUrl} alt="" />
                            <span className="font-bold text-gray-900">{name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-600 text-sm">{u.email || 'Không có email'}</span>
                            <span className="text-xs text-gray-400 font-semibold">{u.phoneNumber || 'Không có SĐT'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${!isLocked
                              ? 'bg-[#e0f8f1] text-[#00d2a0]'
                              : 'bg-red-50 text-red-500 border border-red-100'
                            }`}>
                            {!isLocked ? 'Hoạt động' : 'Bị khóa'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-all font-semibold shadow-sm text-xs"
                          >
                            <MoreHorizontal size={14} /> Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-400 font-medium">
                      Không tìm thấy người dùng nào phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
          <span className="text-sm font-medium text-gray-500">
            Hiển thị {filteredUsers.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredUsers.length)} trong số {filteredUsers.length} người dùng
          </span>

          <div className="flex items-center gap-2">
            {/* Prev Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white bg-gray-50 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-gray-50"
            >
              Trước
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${currentPage === page
                      ? 'bg-[#00d2a0] text-white shadow-sm shadow-[#00d2a0]/20'
                      : 'border border-gray-200 text-gray-600 hover:bg-white bg-gray-50'
                    }`}
                >
                  {page}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white bg-gray-50 transition-all shadow-sm disabled:opacity-40 disabled:hover:bg-gray-50"
            >
              Tiếp theo
            </button>
          </div>
        </div>

      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedUser(null)}
          ></div>

          {/* Modal Center */}
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-sm transform rounded-2xl bg-white p-5 text-left shadow-xl border border-gray-100 flex flex-col max-h-[85vh] transition-all">

              {/* Close Button */}
              <button
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors z-10"
                onClick={() => setSelectedUser(null)}
              >
                <X size={16} />
              </button>

              {/* Scrollable Content */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {/* Header */}
                <div className="flex flex-col items-center text-center pb-3 border-b border-gray-100">
                  <img
                    className="h-16 w-16 rounded-full object-cover border border-gray-200 shadow-sm"
                    src={selectedUser.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedUser.fullName || (selectedUser.lastName + " " + selectedUser.firstName) || 'U')}`}
                    alt=""
                  />
                  <h3 className="mt-2 text-lg font-bold text-gray-900 leading-tight">
                    {selectedUser.fullName || (selectedUser.lastName + " " + selectedUser.firstName) || 'Chưa đặt tên'}
                  </h3>
                  <span className={`mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${selectedUser.status !== 'LOCKED'
                      ? 'bg-[#e0f8f1] text-[#00d2a0]'
                      : 'bg-red-50 text-red-500 border border-red-100'
                    }`}>
                    {selectedUser.status !== 'LOCKED' ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </div>

                {/* Info Fields */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={12} /> Thông tin tài khoản
                  </h4>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Mail size={14} className="text-gray-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Email</span>
                        <span className="text-xs font-semibold text-gray-700 break-all">{selectedUser.email || 'Không có'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Phone size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Số điện thoại</span>
                        <span className="text-xs font-semibold text-gray-700">{selectedUser.phoneNumber || 'Không có'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Shield size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Vai trò</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {selectedUser.role === 'ADMIN' ? 'Quản trị viên' : 'Người dùng'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Ngày tham gia</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Không rõ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedUser.bio && (
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <span className="block text-[9px] font-bold text-gray-400 uppercase mb-1 leading-none">Giới thiệu (Bio)</span>
                      <p className="text-xs font-medium text-gray-600 italic">"{selectedUser.bio}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  className="px-4 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg text-xs transition-all"
                  onClick={() => setSelectedUser(null)}
                >
                  Đóng
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersView;
