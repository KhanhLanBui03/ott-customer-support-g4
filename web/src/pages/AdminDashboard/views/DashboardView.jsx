import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Users, Activity, MessageSquare, ShieldAlert, CheckCircle, XCircle, PlusCircle, Unlock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import adminApi from '../../../api/adminApi';
import { initSocket } from '../../../utils/socket';

// Chuyển milliseconds → chuỗi thời gian thân thiện
const formatTimeAgo = (createdAtMs) => {
  const diffMs = Date.now() - (createdAtMs || Date.now());
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} tháng trước`;
};

const DashboardView = () => {
  const { token } = useSelector(state => state.auth);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    todayMessages: 0,
    newGroupsToday: 0,
    pendingReports: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [showAllLogs, setShowAllLogs] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch dashboard stats & pending reports count song song
      const [data, reportsData] = await Promise.all([
        adminApi.getDashboardStats(timeRange),
        adminApi.getAllReports().catch(() => null),
      ]);

      const pendingCount = reportsData?.data
        ? reportsData.data.filter(r => r.status === 'PENDING').length
        : (Array.isArray(reportsData)
          ? reportsData.filter(r => r.status === 'PENDING').length
          : 0);

      setStats({
        totalUsers: data.totalUsers || 0,
        activeUsers: data.activeUsers || 0,
        todayMessages: data.todayMessages || 0,
        newGroupsToday: data.newGroupsToday || 0,
        pendingReports: pendingCount,
      });
      
      setChartData(data.weeklyChartData || []);
      
      if (data.recentLogs && data.recentLogs.length > 0) {
        const mappedLogs = data.recentLogs.map(log => {
          let icon = ShieldAlert;
          let color = 'orange';
          
          if (log.actionType === 'USER_LOCKED') {
            icon = XCircle;
            color = 'red';
          } else if (log.actionType === 'GROUP_CREATED') {
            icon = PlusCircle;
            color = 'indigo';
          } else if (log.actionType === 'USER_DELETED') {
            icon = XCircle;
            color = 'red';
          } else if (log.actionType === 'USER_CREATED') {
            icon = Users;
            color = 'emerald';
          } else if (log.actionType === 'USER_UNLOCKED') {
            icon = Unlock;
            color = 'blue';
          } else if (log.actionType === 'REPORT_CREATED') {
            icon = ShieldAlert;
            color = 'orange';
          } else if (log.actionType === 'SYSTEM_START') {
            icon = CheckCircle;
            color = 'emerald';
          }
          
          return {
            id: log.logId,
            icon: icon,
            color: color,
            message: log.description,
            time: formatTimeAgo(log.createdAt)
          };
        });
        setLogs(mappedLogs);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!token) return;

    console.log('[DashboardView] Connecting socket for admin stats...');
    const client = initSocket(token);
    let subscription = null;
    let isSubscribed = false;

    const trySubscribe = () => {
      if (isSubscribed) return;
      if (client && client.connected) {
        console.log('[DashboardView] STOMP connected. Subscribing to /topic/admin.stats...');
        subscription = client.subscribe('/topic/admin.stats', (message) => {
          console.log('[DashboardView] 📈 Received stats update signal:', message.body);
          fetchStats();
        });
        isSubscribed = true;
      }
    };

    trySubscribe();

    // Intercept client.onConnect to catch connection event
    const prevOnConnect = client.onConnect;
    client.onConnect = (frame) => {
      if (prevOnConnect) prevOnConnect(frame);
      trySubscribe();
    };

    // Recheck subscription periodically in case of reconnects
    const interval = setInterval(() => {
      if (client && client.connected && !isSubscribed) {
        trySubscribe();
      } else if (client && !client.connected) {
        isSubscribed = false;
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (subscription) {
        subscription.unsubscribe();
      }
      if (client.onConnect === trySubscribe) {
        client.onConnect = prevOnConnect;
      }
    };
  }, [token, fetchStats]);

  if (loading && stats.totalUsers === 0) {
    return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tổng quan hệ thống</h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">Chỉ số trực tiếp và trạng thái hoạt động</p>
      </div>

      {/* Banner cảnh báo báo cáo chờ xử lý */}
      {stats.pendingReports > 0 && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-orange-50 border border-orange-200 rounded-2xl text-orange-700">
          <ShieldAlert size={20} className="flex-shrink-0" />
          <p className="font-semibold text-sm">
            Có <span className="font-black text-orange-800">{stats.pendingReports}</span> báo cáo vi phạm đang chờ xử lý.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
              <Users size={24} />
            </div>
            <h3 className="font-bold text-gray-600">Tổng người dùng</h3>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">{stats.totalUsers.toLocaleString()}</div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
              <Activity size={24} />
            </div>
            <h3 className="font-bold text-gray-600">Đang hoạt động</h3>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">{stats.activeUsers.toLocaleString()}</div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-50 text-blue-500 rounded-xl">
              <MessageSquare size={24} />
            </div>
            <h3 className="font-bold text-gray-600">Tin nhắn hôm nay</h3>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">{stats.todayMessages.toLocaleString()}</div>
        </div>

        {/* Báo cáo chờ xử lý — thay Nhóm mới tạo để luôn thấy */}
        <div className={`rounded-2xl p-6 shadow-sm border hover:shadow-md transition-shadow ${
          stats.pendingReports > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${
              stats.pendingReports > 0 ? 'bg-orange-100 text-orange-500' : 'bg-purple-50 text-purple-500'
            }`}>
              <ShieldAlert size={24} />
            </div>
            <h3 className="font-bold text-gray-600">Báo cáo chờ xử lý</h3>
          </div>
          <div className={`text-3xl font-black tracking-tight ${
            stats.pendingReports > 0 ? 'text-orange-600' : 'text-gray-900'
          }`}>{stats.pendingReports.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">Biểu đồ hoạt động</h3>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                onClick={() => setTimeRange('today')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${timeRange === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Hôm nay
              </button>
              <button 
                onClick={() => setTimeRange('7d')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${timeRange === '7d' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                7 Ngày
              </button>
              <button 
                onClick={() => setTimeRange('30d')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${timeRange === '30d' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                30 Ngày
              </button>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d2a0" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#00d2a0" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="activeUsers" name="Người dùng hoạt động" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                <Area type="monotone" dataKey="sentMessages" name="Tin nhắn đã gửi" stroke="#00d2a0" strokeWidth={3} fillOpacity={1} fill="url(#colorMessages)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Nhật ký hệ thống gần đây</h3>
          <div className="space-y-6">
            {logs.length > 0 ? (showAllLogs ? logs : logs.slice(0, 5)).map((log) => (
              <div key={log.id} className="flex gap-4 items-start">
                <div className={`p-2 bg-${log.color}-50 text-${log.color}-500 rounded-full shrink-0 mt-1`}>
                  <log.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 leading-snug">{log.message}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-1">{log.time}</p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-sm">Chưa có nhật ký hoạt động nào.</p>
            )}
          </div>
          {logs.length > 5 && (
            <button 
              onClick={() => setShowAllLogs(!showAllLogs)}
              className="w-full mt-8 py-2.5 text-sm font-bold text-[#00d2a0] bg-[#00d2a0]/10 hover:bg-[#00d2a0]/20 rounded-xl transition-colors">
              {showAllLogs ? 'Thu gọn nhật ký' : 'Xem tất cả nhật ký'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
