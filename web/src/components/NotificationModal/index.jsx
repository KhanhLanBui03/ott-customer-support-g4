import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Check, UserMinus, Bell, User, Users } from 'lucide-react';
import { friendApi } from '../../api/friendApi';
import { chatApi } from '../../api/chatApi';
import { removePendingFriend, removePendingGroup, markActivitiesAsRead } from '../../store/notificationSlice';
import { fetchConversations, fetchFriends } from '../../store/chatSlice';
import { useEffect } from 'react';
import { UserCheck, UserX } from 'lucide-react';

const NotificationModal = ({ isOpen, onClose }) => {
  const { pendingFriends, pendingGroups, activities } = useSelector(state => state.notification);
  const dispatch = useDispatch();

  useEffect(() => {
    if (isOpen && activities.some(a => !a.isRead)) {
      dispatch(markActivitiesAsRead());
    }
  }, [isOpen, activities, dispatch]);

  if (!isOpen) return null;

  const handleAcceptFriend = async (userId) => {
    try {
      await friendApi.acceptRequest(userId);
      dispatch(removePendingFriend(userId));
      dispatch(fetchConversations());
      dispatch(fetchFriends());
    } catch (err) {
      console.error("Failed to accept friend request", err);
    }
  };

  const handleRejectFriend = async (userId) => {
    try {
      await friendApi.rejectRequest(userId);
      dispatch(removePendingFriend(userId));
    } catch (err) {
      console.error("Failed to reject friend request", err);
    }
  };

  const handleAcceptGroup = async (invitationId) => {
    try {
      await chatApi.acceptGroupInvitation(invitationId);
      dispatch(removePendingGroup(invitationId));
      dispatch(fetchConversations());
    } catch (err) {
      console.error("Failed to accept group invite", err);
    }
  };

  const handleRejectGroup = async (invitationId) => {
    try {
      await chatApi.rejectGroupInvitation(invitationId);
      dispatch(removePendingGroup(invitationId));
    } catch (err) {
      console.error("Failed to reject group invite", err);
    }
  };

  const totalPending = pendingFriends.length + pendingGroups.length;
  const totalNotifications = totalPending + activities.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Thông báo</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                {totalPending} yêu cầu chờ • {activities.length} hoạt động
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4 no-scrollbar">
          {totalNotifications === 0 ? (
            <div className="py-12 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                <Bell size={32} className="text-slate-200" />
              </div>
              <p className="text-sm font-bold text-slate-300 italic">Không có thông báo mới nào</p>
            </div>
          ) : (
            <>
              {/* Friend Requests Section */}
              {pendingFriends.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lời mời kết bạn</p>
                  {pendingFriends.map((req) => (
                    <div key={req.userId} className="p-4 bg-slate-50/50 hover:bg-white border border-transparent hover:border-slate-100 rounded-2xl transition-all group shadow-sm hover:shadow-md">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shadow-inner border border-white">
                          {req.avatarUrl ? (
                            <img src={req.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <User size={20} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start">
                            <p className="text-[15px] text-slate-700 leading-tight">
                              <span className="font-black text-slate-900">{req.fullName}</span> muốn kết bạn với bạn
                            </p>
                            {req.createdAt && (
                              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-2">
                                {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{req.phoneNumber}</p>
                        </div>
                      </div>

                      <div className="mt-5 flex space-x-3">
                        <button
                          onClick={() => handleAcceptFriend(req.userId)}
                          className="flex-1 py-3 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                        >
                          Chấp nhận
                        </button>
                        <button
                          onClick={() => handleRejectFriend(req.userId)}
                          className="flex-1 py-3 bg-white text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-50 border border-slate-100 transition-all active:scale-95"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Group Invitations Section */}
              {pendingGroups.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Lời mời vào nhóm</p>
                  {pendingGroups.map((invite) => (
                    <div key={invite.invitationId} className="p-4 bg-indigo-50/30 hover:bg-white border border-transparent hover:border-indigo-100 rounded-2xl transition-all group shadow-sm hover:shadow-md">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-500 flex items-center justify-center shadow-inner border border-white">
                          <Users size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-800 truncate">Nhóm: {invite.groupName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Từ: Người dùng #{invite.inviterId.substring(0, 8)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex space-x-2">
                        <button
                          onClick={() => handleAcceptGroup(invite.invitationId)}
                          className="flex-1 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                        >
                          Tham gia ngay
                        </button>
                        <button
                          onClick={() => handleRejectGroup(invite.invitationId)}
                          className="px-4 py-2.5 bg-white text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-50 hover:text-red-500 border border-slate-100 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Activities Section */}
              {activities.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Hoạt động gần đây</p>
                  {activities.map((activity) => (
                    <div key={activity.id} className={`p-4 rounded-2xl border transition-all flex items-center space-x-4 ${activity.isRead ? 'bg-white border-slate-50' : 'bg-indigo-50/20 border-indigo-100 shadow-sm'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activity.type === 'FRIEND_ACCEPT' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'
                        }`}>
                        {activity.type === 'FRIEND_ACCEPT' ? <UserCheck size={20} /> : <UserX size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-700 leading-tight">
                          {activity.message}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex justify-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Signal Hub Security Protocol</p>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
