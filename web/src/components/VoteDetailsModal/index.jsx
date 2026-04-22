import React from 'react';
import { X, Users, CheckCircle2 } from 'lucide-react';

const VoteDetailsModal = ({ isOpen, onClose, vote, members }) => {
  if (!isOpen || !vote) return null;

  const totalVotes = vote.options.reduce((sum, opt) => sum + (opt.voterIds?.length || 0), 0);

  // Helper to get member details
  const getMemberInfo = (userId) => {
    return members?.find(m => m.userId === userId) || { fullName: 'Thành viên ẩn danh' };
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden animate-zoom-in border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Chi tiết bình chọn</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-1">
                {totalVotes} lượt bình chọn
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-2 no-scrollbar">
          <div className="px-4 py-4">
             <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 px-2">{vote.question}</h4>
             
             <div className="space-y-6">
                {vote.options.map((opt) => (
                  <div key={opt.optionId} className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                       <span className="text-[12px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">
                         {opt.text}
                       </span>
                       <span className="text-[11px] font-bold text-slate-400">{opt.voterIds?.length || 0} người</span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {opt.voterIds && opt.voterIds.length > 0 ? (
                        opt.voterIds.map((vId) => {
                          const member = getMemberInfo(vId);
                          return (
                            <div key={vId} className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                               <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                                 {member.avatarUrl ? (
                                   <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400">
                                     {member.fullName?.charAt(0)}
                                   </div>
                                 )}
                               </div>
                               <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">
                                 {member.fullName}
                               </span>
                               <CheckCircle2 size={14} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-[11px] italic text-slate-400 dark:text-slate-600 px-3 py-2">Chưa có ai bầu phương án này</p>
                      )}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
           <button
             onClick={onClose}
             className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[20px] font-black text-sm shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]"
           >
             Đóng
           </button>
        </div>
      </div>
    </div>
  );
};

export default VoteDetailsModal;
