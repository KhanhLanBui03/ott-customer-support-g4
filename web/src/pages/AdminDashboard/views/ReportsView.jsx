import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, ShieldAlert, CheckCircle, XCircle, AlertTriangle, User, Users, Info, RefreshCw, Loader2 } from 'lucide-react';
import adminApi from '../../../api/adminApi';

const ITEMS_PER_PAGE = 5;
const REALTIME_INTERVAL_MS = 30000; // 30 giây tự refresh

const ReportsView = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // reportId đang xử lý
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetchReports = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const response = await adminApi.getAllReports();
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      setReports(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      if (!silent) showToast('Không thể tải danh sách báo cáo', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchReports(false);
  }, [fetchReports]);

  // Auto-refresh mỗi 30s (realtime polling)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchReports(true); // silent = không hiện loading overlay
    }, REALTIME_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchReports]);

  // Reset trang khi đổi filter/search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  // ── Toast ──────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Action ─────────────────────────────────────────────────
  const handleResolve = async (reportId, action, fromModal = false) => {
    try {
      setActionLoading(reportId);
      await adminApi.resolveReport(reportId, action);
      showToast('Xử lý báo cáo thành công', 'success');
      // Đóng modal chi tiết nếu hành động từ modal
      if (fromModal) setSelectedReport(null);
      // Refresh data nhưng KHÔNG chuyển trang
      await fetchReports(true);
    } catch (error) {
      console.error('Failed to resolve report:', error);
      showToast('Gặp lỗi khi xử lý báo cáo', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filter / Paginate ──────────────────────────────────────
  const filteredReports = reports
    .filter((r) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        (r.reportId || '').toLowerCase().includes(q) ||
        (r.targetName || '').toLowerCase().includes(q) ||
        (r.reporterName || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q);

      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'PENDING' && r.status === 'PENDING') ||
        (filterStatus === 'RESOLVED' && r.status === 'RESOLVED');

      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      // PENDING lên trước, RESOLVED xuống sau
      const statusOrder = (s) => (s === 'PENDING' ? 0 : 1);
      const statusDiff = statusOrder(a.status) - statusOrder(b.status);
      if (statusDiff !== 0) return statusDiff;
      // Trong cùng nhóm → sắp xếp theo tên đối tượng A→Z
      return (a.targetName || '').localeCompare(b.targetName || '', 'vi');
    });

  const pendingCount = reports.filter((r) => r.status === 'PENDING').length;
  const resolvedCount = reports.filter((r) => r.status === 'RESOLVED').length;

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE);
  const indexOfFirst = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filteredReports.slice(indexOfFirst, indexOfFirst + ITEMS_PER_PAGE);

  // ── Helpers ────────────────────────────────────────────────
  const truncateId = (id, len = 20) =>
    id && id.length > len ? id.slice(0, len) + '…' : id;

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const ActionSpinner = () => (
    <Loader2 size={14} className="animate-spin" />
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[10000] animate-in fade-in slide-in-from-top-6 duration-300">
          <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl border shadow-2xl ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <p className="text-sm font-bold">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Báo cáo &amp; Kiểm duyệt</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Xử lý các báo cáo vi phạm và thực thi chế tài xử phạt</p>
          {lastUpdated && (
            <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
              <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
              Cập nhật lúc {formatTime(lastUpdated)} · Tự động mỗi 30s
            </p>
          )}
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-orange-600">
            <span className="font-bold text-lg">{pendingCount}</span>
            <span className="text-sm font-medium ml-2">Chờ xử lý</span>
          </div>
          <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 text-emerald-600">
            <span className="font-bold text-lg">{resolvedCount}</span>
            <span className="text-sm font-medium ml-2">Đã xử lý</span>
          </div>
          {/* Nút refresh thủ công */}
          <button
            onClick={() => fetchReports(true)}
            disabled={refreshing}
            title="Làm mới ngay"
            className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-[#00d2a0] transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#00d2a0]' : ''} />
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm (Mã, Đối tượng, Người báo cáo)..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00d2a0] focus:border-[#00d2a0] sm:text-sm font-medium transition-all"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'PENDING', 'RESOLVED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm border ${
                  filterStatus === s
                    ? 'bg-[#00d2a0] text-white border-[#00d2a0]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s === 'ALL' ? 'Tất cả' : s === 'PENDING' ? 'Chờ xử lý' : 'Đã xử lý'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin text-[#00d2a0]" />
              Đang tải danh sách báo cáo...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-medium">Không tìm thấy báo cáo nào.</div>
          ) : (
            <>
              <table className="w-full table-fixed divide-y divide-gray-200">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Mã báo cáo</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Đối tượng bị BC</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lý do</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Người báo cáo</th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Vi phạm</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Hành động</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {currentItems.map((r) => {
                    const isPending = r.status === 'PENDING';
                    const violationLimitReached = (r.violationCount || 0) >= 3;
                    const isActing = actionLoading === r.reportId;

                    return (
                      <tr key={r.reportId} className="hover:bg-gray-50/50 transition-colors">
                        {/* Mã báo cáo */}
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-xs font-bold text-gray-500 block truncate"
                            title={r.reportId}
                          >
                            {truncateId(r.reportId)}
                          </span>
                        </td>

                        {/* Đối tượng */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-1.5 min-w-0">
                            {r.targetType === 'GROUP'
                              ? <Users size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                              : <User size={14} className="text-purple-500 flex-shrink-0 mt-0.5" />
                            }
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 text-sm truncate">{r.targetName || 'Không rõ'}</div>
                              <div className="text-[10px] text-gray-400 truncate" title={r.targetId}>ID: {truncateId(r.targetId, 22)}</div>
                            </div>
                          </div>
                        </td>

                        {/* Lý do */}
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-orange-600 font-semibold text-xs truncate">
                            <AlertTriangle size={12} className="flex-shrink-0" />
                            <span className="truncate">{r.reason}</span>
                          </span>
                        </td>

                        {/* Người báo cáo */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-600 truncate block">{r.reporterName}</span>
                        </td>

                        {/* Số lần vi phạm */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            violationLimitReached ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {r.violationCount || 0}/3
                          </span>
                        </td>

                        {/* Trạng thái */}
                        <td className="px-4 py-3">
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              isPending ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {isPending ? 'Chờ xử lý' : 'Đã xử lý'}
                            </span>
                            {!isPending && r.actionTaken && (
                              <div className="text-[10px] text-gray-500 mt-0.5 font-semibold truncate">
                                {r.actionTaken}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Hành động */}
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {/* Xem chi tiết */}
                            <button
                              onClick={() => setSelectedReport(r)}
                              className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                              title="Xem chi tiết"
                            >
                              <Info size={14} />
                            </button>

                            {isPending && (
                              <>
                                {violationLimitReached ? (
                                  r.targetType === 'USER' ? (
                                    <button
                                      onClick={() => handleResolve(r.reportId, 'LOCK')}
                                      className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-60"
                                      title="Khóa tài khoản"
                                      disabled={isActing}
                                    >
                                      {isActing ? <ActionSpinner /> : <XCircle size={12} />}
                                      Khóa
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleResolve(r.reportId, 'DISBAND')}
                                      className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1 disabled:opacity-60"
                                      title="Xóa nhóm"
                                      disabled={isActing}
                                    >
                                      {isActing ? <ActionSpinner /> : <XCircle size={12} />}
                                      Xóa nhóm
                                    </button>
                                  )
                                ) : (
                                  <button
                                    onClick={() => handleResolve(r.reportId, 'WARN')}
                                    className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-bold hover:bg-orange-600 transition-colors flex items-center gap-1 disabled:opacity-60"
                                    title="Cảnh cáo"
                                    disabled={isActing}
                                  >
                                    {isActing ? <ActionSpinner /> : <ShieldAlert size={12} />}
                                    Cảnh cáo
                                  </button>
                                )}

                                <button
                                  onClick={() => handleResolve(r.reportId, 'DISMISS')}
                                  className="px-2 py-1 rounded text-xs font-bold hover:bg-gray-200 transition-colors flex items-center gap-1 border border-gray-200 bg-gray-100 text-gray-700 disabled:opacity-60"
                                  title="Bỏ qua"
                                  disabled={isActing}
                                >
                                  {isActing ? <ActionSpinner /> : <CheckCircle size={12} />}
                                  Bỏ qua
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                <div className="text-sm font-semibold text-gray-500">
                  Hiển thị <span className="text-gray-900 font-bold">{indexOfFirst + 1}</span>
                  {' – '}
                  <span className="text-gray-900 font-bold">{Math.min(indexOfFirst + ITEMS_PER_PAGE, filteredReports.length)}</span>
                  {' '}trong tổng số{' '}
                  <span className="text-gray-900 font-bold">{filteredReports.length}</span> báo cáo
                </div>
                {totalPages > 1 && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Trước
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all border ${
                          currentPage === p
                            ? 'bg-[#00d2a0] text-white border-[#00d2a0] shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal chi tiết */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="text-[#00d2a0]" /> Chi tiết báo cáo
            </h3>
            <div className="space-y-3 text-sm text-gray-700 mb-6 max-h-[60vh] overflow-y-auto pr-1">
              {[
                ['Mã báo cáo', <span className="font-mono font-bold text-gray-900 break-all">{selectedReport.reportId}</span>],
                ['Đối tượng', `${selectedReport.targetName} (${selectedReport.targetType === 'GROUP' ? 'Nhóm' : 'Cá nhân'})`],
                ['ID đối tượng', <span className="font-mono text-xs break-all">{selectedReport.targetId}</span>],
                ['Người báo cáo', `${selectedReport.reporterName}`],
                ['Lý do', <span className="text-orange-600 font-bold">{selectedReport.reason}</span>],
                ['Số lần vi phạm', <span className="font-bold text-red-600">{selectedReport.violationCount || 0} / 3</span>],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-2">
                  <span className="font-bold text-gray-500">{label}:</span>
                  <span className="col-span-2">{value}</span>
                </div>
              ))}
              <div className="border-b border-gray-100 pb-2">
                <span className="font-bold text-gray-500 block mb-1">Nội dung chi tiết:</span>
                <p className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-gray-600 whitespace-pre-wrap font-medium text-xs leading-relaxed">
                  {selectedReport.details || 'Không có ghi chú thêm.'}
                </p>
              </div>
              {selectedReport.status === 'RESOLVED' && (
                <div className="grid grid-cols-3 gap-2 pt-2 text-emerald-600 font-bold">
                  <span>Kết quả:</span>
                  <span className="col-span-2">{selectedReport.actionTaken}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 flex-wrap">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-bold rounded-xl text-sm"
              >
                Đóng
              </button>
              {selectedReport.status === 'PENDING' && (() => {
                const isActing = actionLoading === selectedReport.reportId;
                const reached = (selectedReport.violationCount || 0) >= 3;
                return (
                  <>
                    {reached ? (
                      selectedReport.targetType === 'USER' ? (
                        <button
                          onClick={() => handleResolve(selectedReport.reportId, 'LOCK', true)}
                          disabled={isActing}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {isActing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                          Khóa tài khoản
                        </button>
                      ) : (
                        <button
                          onClick={() => handleResolve(selectedReport.reportId, 'DISBAND', true)}
                          disabled={isActing}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                        >
                          {isActing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                          Xóa nhóm
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleResolve(selectedReport.reportId, 'WARN', true)}
                        disabled={isActing}
                        className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                      >
                        {isActing ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                        Cảnh cáo
                      </button>
                    )}
                    <button
                      onClick={() => handleResolve(selectedReport.reportId, 'DISMISS', true)}
                      disabled={isActing}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isActing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                      Bỏ qua
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsView;
