import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Phone, UserPlus, Check, UserMinus, ShieldAlert } from 'lucide-react';
import { friendApi } from '../api/friendApi';
import { userApi } from '../api/userApi';
import { useChat } from '../hooks/useChat';
import { useTheme } from '../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const UserInfoModal = ({ isOpen, onClose, userInfo, onStartCall }) => {
  const { isDark } = useTheme();
  const { create, selectConversation, activeConversationId } = useChat();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(userInfo?.friendshipStatus || 'NONE');
  const [profile, setProfile] = useState(userInfo);

  useEffect(() => {
    if (isOpen && userInfo) {
      const fetchLatestInfo = async () => {
        try {
          const res = await userApi.getUserById(userInfo.userId || userInfo.id);
          if (res.data) {
            setProfile(res.data);
            setStatus(res.data.friendshipStatus || 'NONE');
          }
        } catch (err) {
          console.error("Failed to fetch latest user info", err);
          // Fallback to initial info
          setProfile(userInfo);
          setStatus(userInfo.friendshipStatus || 'NONE');
        }
      };
      fetchLatestInfo();
    }
  }, [isOpen, userInfo]);

  if (!isOpen || !userInfo) return null;

  const handleStartChat = async () => {
    setLoading(true);
    try {
      const result = await create('SINGLE', [userInfo.userId || userInfo.id]);
      if (result.payload) {
        const convId = result.payload.conversationId || result.payload?.data?.conversationId;
        if (convId) selectConversation(convId);
        onClose();
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCallClick = async (type = 'audio') => {
    setLoading(true);
    try {
      const targetUserId = userInfo.userId || userInfo.id;
      const result = await create('SINGLE', [targetUserId]);
      if (result.payload) {
        const convId = result.payload.conversationId || result.payload?.data?.conversationId;
        
        if (convId) {
          // If already in this conversation, just start call
          if (convId === activeConversationId) {
            if (onStartCall) onStartCall(type);
          } else {
            // Switch conversation and then start call via event
            selectConversation(convId);
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('START_CALL_AGAIN', { detail: { type, isSingle: true } }));
            }, 500);
          }
        }
        onClose();
      }
    } catch (err) {
      console.error("Failed to start call", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    setLoading(true);
    try {
      await friendApi.sendRequest(userInfo.userId || userInfo.id);
      setStatus('PENDING');
    } catch (err) {
      console.error("Failed to send friend request", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md bg-black/40 animate-fade-in">
      <div className={cn(
        "w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden border transition-all duration-500 scale-in-center",
        isDark ? "bg-[#1a1e26] border-white/5" : "bg-white border-slate-100"
      )}>
        {/* Header Background - Using a premium gradient instead of a missing cover photo */}
        <div className={cn(
          "h-32 relative overflow-hidden",
          isDark 
            ? "bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-slate-900" 
            : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
        )}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
          <div className="absolute inset-0 bg-black/10" />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all backdrop-blur-md"
          >
            <X size={20} />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-8 pt-12 relative text-center">
          {/* Avatar - overlapping cover */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2">
            <div className={cn(
              "w-24 h-24 rounded-full border-4 overflow-hidden shadow-xl bg-surface-300",
              isDark ? "border-[#1a1e26]" : "border-white"
            )}>
              <img 
                src={userInfo.avatarUrl || userInfo.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.fullName || userInfo.name)}&background=random`} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            </div>
          </div>

          <h2 className={cn(
            "text-xl font-black tracking-tight",
            isDark ? "text-white" : "text-slate-900"
          )}>
            {profile?.fullName || profile?.name}
          </h2>
          <p className={cn(
            "text-sm font-medium mt-1",
            isDark ? "text-white/40" : "text-slate-500"
          )}>
            {profile?.phoneNumber || "Chưa cập nhật số điện thoại"}
          </p>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex gap-2">
              {status === 'ACCEPTED' || status === 'FRIEND' ? (
                <>
                  <button
                    onClick={handleStartChat}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <MessageSquare size={18} />
                    <span>Nhắn tin</span>
                  </button>
                  <button
                    onClick={() => handleCallClick('audio')}
                    disabled={loading}
                    className="p-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    title="Gọi điện"
                  >
                    <Phone size={18} />
                  </button>
                </>
              ) : status === 'PENDING' ? (
                <div className="w-full py-3.5 bg-indigo-500/10 text-indigo-500 rounded-2xl font-bold flex items-center justify-center gap-2 border border-indigo-500/20">
                  <Check size={18} />
                  <span>Đã gửi lời mời</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleAddFriend}
                    className={cn(
                      "flex-1 py-3.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2",
                      isDark ? "bg-white/5 text-white hover:bg-white/10" : "bg-slate-800 hover:bg-slate-900 text-white shadow-lg"
                    )}
                  >
                    <UserPlus size={18} />
                    <span>Kết bạn</span>
                  </button>
                  <button
                    onClick={handleStartChat}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <MessageSquare size={18} />
                    <span>Nhắn tin</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserInfoModal;
