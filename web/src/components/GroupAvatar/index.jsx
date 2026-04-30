import React from 'react';
import { Users, Sparkles as SparklesIcon } from 'lucide-react';
import { useSelector } from 'react-redux';

const GroupAvatar = ({ conversation, size = "h-12 w-12", isLarge = false, isActive = false }) => {
  const { user } = useSelector(state => state.auth);
  
  if (!conversation) return null;

  const { type, avatarUrl, avatar, name, members = [], isAI } = conversation;
  let displayAvatar = avatarUrl || avatar;

  // Fallback to the other member's avatar for SINGLE conversations
  if (type === 'SINGLE' && members.length > 0) {
    const myId = user?.userId || user?.id;
    const otherMember = members.find(m => String(m.userId || m.id) !== String(myId));
    if (otherMember && otherMember.avatarUrl) {
      displayAvatar = otherMember.avatarUrl;
    }
  }

  const containerClasses = `
    ${size} flex-shrink-0 relative overflow-hidden transition-all duration-500
    ${isActive ? 'scale-105 shadow-xl shadow-indigo-500/10' : 'group-hover/member:scale-105 group-hover:scale-105'}
    ${isLarge ? 'rounded-[36px] p-1 border-2 border-white dark:border-slate-700 shadow-2xl' : 'rounded-2xl border border-border/50'}
  `;

  // Handle AI logic
  if (isAI) {
    return (
      <div className={`${containerClasses} bg-indigo-600 flex items-center justify-center`}>
        <SparklesIcon className="text-white" size={isLarge ? 28 : 20} />
      </div>
    );
  }

  // Handle Single or Group with specific avatar
  if (type === 'SINGLE' || displayAvatar) {
    return (
      <div className={`${containerClasses} bg-surface-200`}>
        {displayAvatar ? (
          <img src={displayAvatar} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className={`${isLarge ? 'text-3xl' : 'text-xl'} font-black text-foreground/70 font-serif italic uppercase`}>
              {name?.charAt(0) || 'C'}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Handle Group without avatar (Composite)
  const displayMembers = members.slice(0, 4);
  const remainingCount = members.length - 3;
  const count = displayMembers.length;

  const renderMember = (member, idx, customSize = "w-full h-full", customTextSize = "text-[10px]") => {
    const isCountSlot = idx === 3 && members.length > 4;
    
    if (isCountSlot) {
      return (
        <div key="count" className={`${customSize} bg-slate-800/90 dark:bg-slate-700/90 flex items-center justify-center`}>
          <span className="text-[10px] font-black text-white/90 font-mono tracking-tighter">
            {members.length > 99 ? '99+' : `+${remainingCount}`}
          </span>
        </div>
      );
    }

    return (
      <div key={member.userId || idx} className={`${customSize} bg-indigo-50/80 dark:bg-slate-800/80 flex items-center justify-center overflow-hidden relative group/avatar`}>
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110" />
        ) : (
          <span className={`${customTextSize} font-black text-indigo-500/70 dark:text-indigo-400/70 uppercase font-serif italic`}>
            {member.fullName?.charAt(0) || '?'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={`${containerClasses} bg-white dark:bg-slate-800 p-[1.5px]`}>
      <div className="w-full h-full rounded-[14px] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {count === 2 ? (
          <div className="flex h-full w-full gap-[1.5px]">
            {displayMembers.map((m, i) => renderMember(m, i, "w-1/2 h-full", "text-[14px]"))}
          </div>
        ) : count === 3 ? (
          <div className="flex h-full w-full gap-[1.5px]">
            {renderMember(displayMembers[0], 0, "w-1/2 h-full", "text-[14px]")}
            <div className="w-1/2 h-full flex flex-col gap-[1.5px]">
              {renderMember(displayMembers[1], 1, "w-full h-1/2", "text-[10px]")}
              {renderMember(displayMembers[2], 2, "w-full h-1/2", "text-[10px]")}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-[1.5px]">
            {displayMembers.map((m, i) => renderMember(m, i, "w-full h-full", "text-[10px]"))}
            {/* Fill empty slots if count is 1 (unlikely for group) or 0 */}
            {count < 4 && Array.from({ length: 4 - count }).map((_, i) => (
              <div key={`empty-${i}`} className="w-full h-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
                {count === 0 && i === 0 && <Users size={14} className="text-slate-400/50" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupAvatar;
