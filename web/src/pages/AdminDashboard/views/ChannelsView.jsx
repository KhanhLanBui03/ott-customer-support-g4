import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, X, User, Calendar, Info, Users, Settings } from 'lucide-react';
import adminApi from '../../../api/adminApi';

const ChannelsView = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAllGroups();
      if (res && res.data) {
        setGroups(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Reset pagination when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredGroups = groups.filter(g => {
    const name = g.name || '';
    const creator = g.creatorName || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           creator.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quản lý Nhóm Chat</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Giám sát các cộng đồng và nhóm trò chuyện trong hệ thống</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-gray-900 tracking-tight">{groups.length}</div>
          <p className="text-gray-500 text-sm font-medium">Tổng số nhóm</p>
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
              placeholder="Tìm kiếm nhóm chat..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0] focus:border-[#00d2a0] sm:text-sm font-medium transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Đang tải dữ liệu nhóm chat...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Tên nhóm
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Loại
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Trưởng nhóm
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Thành viên
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedGroups.length > 0 ? (
                  paginatedGroups.map((g) => {
                    const name = g.name || 'Nhóm không tên';
                    const isApproval = g.memberApprovalRequired === true;
                    const avatarUrl = g.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
                    
                    return (
                      <tr key={g.conversationId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <img className="w-10 h-10 rounded-xl object-cover border border-gray-200" src={avatarUrl} alt="" />
                            <span className="font-bold text-gray-900">{name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                            !isApproval 
                              ? 'bg-[#e0f8f1] text-[#00d2a0]' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {!isApproval ? 'Công khai' : 'Riêng tư (Cần duyệt)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-medium text-gray-600">{g.creatorName || 'Hệ thống'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold text-gray-900">{g.memberCount || 0}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            onClick={() => setSelectedGroup(g)}
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
                    <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-400 font-medium">
                      Không tìm thấy nhóm chat nào phù hợp
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
            Hiển thị {filteredGroups.length > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, filteredGroups.length)} trong số {filteredGroups.length} nhóm
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
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentPage === page 
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

      {/* Group Details Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedGroup(null)}
          ></div>

          {/* Modal Center */}
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-sm transform rounded-2xl bg-white p-5 text-left shadow-xl border border-gray-100 flex flex-col max-h-[85vh] transition-all">
              
              {/* Close Button */}
              <button 
                type="button"
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors z-10"
                onClick={() => setSelectedGroup(null)}
              >
                <X size={16} />
              </button>

              {/* Scrollable Content */}
              <div className="overflow-y-auto pr-1 space-y-4 flex-1">
                {/* Header */}
                <div className="flex flex-col items-center text-center pb-3 border-b border-gray-100">
                  <img 
                    className="h-16 w-16 rounded-xl object-cover border border-gray-200 shadow-sm"
                    src={selectedGroup.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(selectedGroup.name || 'G')}`} 
                    alt="" 
                  />
                  <h3 className="mt-2 text-lg font-bold text-gray-900 leading-tight">
                    {selectedGroup.name || 'Nhóm không tên'}
                  </h3>
                  <span className={`mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedGroup.memberApprovalRequired !== true
                      ? 'bg-[#e0f8f1] text-[#00d2a0]' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedGroup.memberApprovalRequired !== true ? 'Công khai' : 'Riêng tư'}
                  </span>
                </div>

                {/* Info Fields */}
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={12} /> Chi tiết nhóm chat
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <User size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Trưởng nhóm (Người tạo)</span>
                        <span className="text-xs font-semibold text-gray-700">{selectedGroup.creatorName || 'Hệ thống'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Users size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Số lượng thành viên</span>
                        <span className="text-xs font-semibold text-gray-700">{selectedGroup.memberCount || 0} thành viên</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Calendar size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Ngày tạo nhóm</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {selectedGroup.createdAt ? new Date(selectedGroup.createdAt).toLocaleDateString('vi-VN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'Không rõ'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                      <Settings size={14} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="block text-[9px] font-bold text-gray-400 uppercase leading-none mb-0.5">Thiết lập quyền gửi tin</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {selectedGroup.onlyAdminsCanChat === true ? 'Chỉ Admin được gửi tin' : 'Tất cả thành viên đều được gửi tin'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  className="px-4 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 font-semibold rounded-lg text-xs transition-all"
                  onClick={() => setSelectedGroup(null)}
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

export default ChannelsView;
