import React from 'react';
import { X, Users, CheckCircle2, BarChart2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const VoteDetailsModal = ({ isOpen, onClose, vote, members }) => {
  const { isDark } = useTheme();
  if (!isOpen || !vote) return null;

  const totalVotes = vote.options.reduce((sum, opt) => sum + (opt.voterIds?.length || 0), 0);

  // Helper to get member details
  const getMemberInfo = (userId) => {
    return members?.find(m => m.userId === userId) || { fullName: 'Thành viên ẩn danh' };
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      
      <div className={cn(
        "relative w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-zoom-in border transition-all duration-300",
        isDark ? "bg-[#1a1d26] border-white/10" : "bg-white border-slate-200"
      )}>
        {/* Header */}
        <div className={cn(
          "px-6 py-6 border-b flex items-center justify-between bg-gradient-to-br",
          isDark ? "border-white/5 from-indigo-500/10 to-transparent" : "border-slate-100 from-indigo-50/50 to-transparent"
        )}>
          <div className="flex items-center space-x-4">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-all",
              isDark ? "bg-indigo-500 shadow-indigo-500/20" : "bg-indigo-600 text-white shadow-indigo-500/10"
            )}>
              <BarChart2 size={22} strokeWidth={2.5} className="text-white" />
            </div>
            <div>
              <h3 className={cn("text-[17px] font-black leading-tight", isDark ? "text-white" : "text-slate-900")}>
                Kết quả bình chọn
              </h3>
              <div className="flex items-center mt-1 space-x-1.5">
                <Users size={12} className={isDark ? "text-slate-500" : "text-slate-400"} />
                <span className={cn("text-[11px] font-bold uppercase tracking-wider", isDark ? "text-slate-500" : "text-slate-400")}>
                  {totalVotes} người đã tham gia
                </span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={cn(
              "p-2.5 rounded-2xl transition-all hover:scale-110 active:scale-95",
              isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            )}
          >
            <X size={20} />
          </button>
        </div>

        {/* Question Section */}
        <div className={cn(
          "px-8 py-5",
          isDark ? "bg-black/20" : "bg-slate-50/50"
        )}>
           <h4 className={cn(
             "text-[15px] font-bold leading-relaxed italic border-l-4 border-indigo-500 pl-4",
             isDark ? "text-white/90" : "text-slate-800"
           )}>
             "{vote.question}"
           </h4>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto p-4 no-scrollbar">
           <div className="space-y-6">
              {vote.options.map((opt) => (
                <div key={opt.optionId} className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-4 rounded-full bg-indigo-500" />
                        <span className={cn("text-[13px] font-black uppercase tracking-wider", isDark ? "text-white" : "text-slate-900")}>
                          {opt.text}
                        </span>
                     </div>
                     <span className={cn(
                       "text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter",
                       isDark ? "bg-indigo-500/20 text-indigo-400" : "bg-indigo-500/10 text-indigo-600"
                     )}>
                       {opt.voterIds?.length || 0} lượt bầu
                     </span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-1.5">
                    {opt.voterIds && opt.voterIds.length > 0 ? (
                      opt.voterIds.map((vId) => {
                        const member = getMemberInfo(vId);
                        return (
                          <div key={vId} className={cn(
                            "flex items-center space-x-3 p-2.5 rounded-[20px] transition-all group border",
                            isDark 
                              ? "bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/10" 
                              : "bg-white border-slate-100 hover:border-indigo-500/30 hover:bg-indigo-50/30"
                          )}>
                             <div className={cn(
                               "w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden border shadow-sm ring-2 ring-transparent group-hover:ring-indigo-500/30 transition-all",
                               isDark ? "border-white/10" : "border-slate-200"
                             )}>
                               {member.avatarUrl ? (
                                 <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-[12px] font-black text-white">
                                   {member.fullName?.charAt(0).toUpperCase()}
                                 </div>
                               )}
                             </div>
                             <span className={cn(
                               "text-[14px] font-semibold transition-colors",
                               isDark ? "text-slate-300 group-hover:text-indigo-400" : "text-slate-700 group-hover:text-indigo-600"
                             )}>
                               {member.fullName}
                             </span>
                             <CheckCircle2 size={16} className="text-indigo-500 opacity-0 group-hover:opacity-100 transition-all transform scale-50 group-hover:scale-100 ml-auto" />
                          </div>
                        );
                      })
                    ) : (
                      <div className={cn(
                        "text-[12px] italic px-6 py-4 rounded-2xl border border-dashed",
                        isDark ? "text-slate-600 border-white/5" : "text-slate-400 border-slate-200"
                      )}>
                        Chưa có ai bầu phương án này
                      </div>
                    )}
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "p-6 border-t",
          isDark ? "bg-[#1a1d26] border-white/5" : "bg-white border-slate-100"
        )}>
           <button
             onClick={onClose}
             className={cn(
               "w-full py-4 rounded-[22px] font-black text-[15px] transition-all active:scale-[0.98] shadow-xl",
               isDark 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20" 
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200"
             )}
           >
             Đóng cửa sổ
           </button>
        </div>
      </div>
    </div>
  );
};

export default VoteDetailsModal;
