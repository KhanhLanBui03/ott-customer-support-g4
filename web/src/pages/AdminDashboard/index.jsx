import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ProfileModal from '../../components/ProfileModal';
import DashboardView from './views/DashboardView';
import UsersView from './views/UsersView';
import ChannelsView from './views/ChannelsView';
import ReportsView from './views/ReportsView';
import SettingsView from './views/SettingsView';
import adminApi from '../../api/adminApi';
import { 
  MessageSquare, LayoutDashboard, Users, Hash, 
  LineChart, Settings, HelpCircle, Bell, Search, 
  Filter, Plus, Lock, Unlock, Trash2, MoreHorizontal 
} from 'lucide-react';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const fetchNotifications = async () => {
    try {
      const [dashData, reportsData] = await Promise.all([
        adminApi.getDashboardStats('7d'),
        adminApi.getAllReports().catch(() => null),
      ]);

      // Đếm báo cáo chờ xử lý
      const pendingReports = reportsData?.data
        ? reportsData.data.filter(r => r.status === 'PENDING')
        : (Array.isArray(reportsData) ? reportsData.filter(r => r.status === 'PENDING') : []);

      const formatTimeAgo = (ms) => {
        const diffMs = Date.now() - (ms || Date.now());
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} giờ trước`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays} ngày trước`;
        return `${Math.floor(diffDays / 30)} tháng trước`;
      };

      let mapped = [];

      // Thêm thông báo báo cáo chờ xử lý lên đầu
      if (pendingReports.length > 0) {
        mapped.push({
          id: 'pending-reports-summary',
          title: '⚠️ Báo cáo chờ xử lý',
          message: `Có ${pendingReports.length} báo cáo vi phạm đang cần xử lý.`,
          time: 'Ngay bây giờ',
          read: false,
          isPrimary: true,
        });
      }

      // Thêm nhật ký hệ thống
      if (dashData && dashData.recentLogs) {
        const readIds = JSON.parse(localStorage.getItem('readAdminLogs') || '[]');

        const logEntries = dashData.recentLogs.map(log => {
          let title = 'Nhật ký hệ thống';
          if (log.actionType === 'USER_CREATED') title = 'Người dùng mới';
          else if (log.actionType === 'GROUP_CREATED') title = 'Nhóm mới tạo';
          else if (log.actionType === 'USER_LOCKED') title = 'Khóa tài khoản';
          else if (log.actionType === 'USER_UNLOCKED') title = 'Mở khóa tài khoản';
          else if (log.actionType === 'USER_DELETED') title = 'Xóa tài khoản';

          return {
            id: log.logId,
            title,
            message: log.description,
            time: formatTimeAgo(log.createdAt),
            read: readIds.includes(log.logId),
          };
        });

        mapped = [...mapped, ...logEntries];
      }

      setNotifications(mapped);
      const unread = mapped.filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('refreshLogs', handleRefresh);
    return () => {
      window.removeEventListener('refreshLogs', handleRefresh);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenNotifications = () => {
    const nextState = !isNotificationMenuOpen;
    setIsNotificationMenuOpen(nextState);
    setIsProfileMenuOpen(false);
    
    if (nextState && notifications.length > 0) {
      const currentReadIds = JSON.parse(localStorage.getItem('readAdminLogs') || '[]');
      const newReadIds = [...new Set([...currentReadIds, ...notifications.map(n => n.id)])];
      localStorage.setItem('readAdminLogs', JSON.stringify(newReadIds));
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Dashboard':
        return <DashboardView />;
      case 'Users':
        return <UsersView />;
      case 'Channels':
        return <ChannelsView />;
      case 'Reports':
        return <ReportsView />;

      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1a1f2c] text-white flex flex-col transition-all duration-300">
        <div className="p-6 flex items-center gap-3">
          <MessageSquare className="text-[#00d2a0] fill-[#00d2a0]" size={28} />
          <span className="text-xl font-bold tracking-wide">ChatApp Admin</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {[
            { name: 'Dashboard', label: 'Tổng quan', icon: LayoutDashboard },
            { name: 'Users', label: 'Người dùng', icon: Users },
            { name: 'Channels', label: 'Nhóm Chat', icon: Hash },
            { name: 'Reports', label: 'Báo cáo', icon: LineChart },

          ].map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
                activeTab === item.name 
                  ? 'bg-[#242b3d] text-[#00d2a0] border-l-4 border-[#00d2a0]' 
                  : 'text-gray-400 hover:bg-[#242b3d] hover:text-white border-l-4 border-transparent'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-[#242b3d] hover:text-white transition-all font-medium">
            <HelpCircle size={20} />
            Trợ giúp
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-end px-8 gap-6 shrink-0 shadow-sm relative z-20">
          <div className="relative" ref={notificationRef}>
            <button 
              className="text-gray-400 hover:text-gray-600 relative p-2 transition-colors"
              onClick={handleOpenNotifications}
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationMenuOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-bold text-gray-800">Thông báo</h3>
                  {unreadCount > 0 && (
                    <span className="text-xs font-bold bg-[#00d2a0]/10 text-[#00d2a0] px-2 py-1 rounded-full">{unreadCount} Mới</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div key={notif.id} className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-50 cursor-pointer transition-colors ${!notif.read ? 'bg-[#00d2a0]/5' : ''}`}>
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm ${!notif.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{notif.title}</h4>
                          <span className="text-xs font-semibold text-gray-400">{notif.time}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500 line-clamp-2">{notif.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">Không có thông báo mới</div>
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-100 text-center bg-gray-50/50">
                  <button 
                    onClick={() => {
                      setActiveTab('Dashboard');
                      setIsNotificationMenuOpen(false);
                    }}
                    className="text-sm font-bold text-[#00d2a0] hover:text-[#00b88c] transition-colors"
                  >
                    Xem tất cả hoạt động
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative" ref={profileRef}>
            <div 
              className="flex items-center gap-3 border-l border-gray-200 pl-6 cursor-pointer" 
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
                setIsNotificationMenuOpen(false);
              }}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden flex items-center justify-center font-bold text-indigo-600">
                {user?.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user?.fullName?.charAt(0) || 'A'}
              </div>
              <span className="font-semibold text-gray-700">{user?.fullName || 'Admin'}</span>
            </div>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 z-50">
                <button 
                  className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                >
                  Xem hồ sơ
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button 
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  onClick={handleLogout}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Modals */}
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </div>
  );
};

export default AdminDashboard;
