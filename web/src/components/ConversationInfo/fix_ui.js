const fs = require('fs');
const path = 'c:/CNM/chat-app/web/src/components/ConversationInfo/index.jsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const customizationCode = `
            {/* Interface Customization */}
            <div className="py-2">
               <button 
                 onClick={() => toggleSection('customization')}
                 className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
               >
                  <div className="flex items-center space-x-3">
                    <Palette size={16} className="text-indigo-500" />
                    <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Tùy chỉnh giao diện</span>
                  </div>
                  {sections.customization ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
               </button>
               
               {sections.customization && (
                 <div className="mt-4 space-y-3 px-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*"
                      onChange={handleWallpaperChange}
                    />
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center space-x-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-[24px] hover:scale-[1.02] active:scale-[0.98] transition-all group"
                    >
                       <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                          <ImageIcon size={20} />
                       </div>
                       <div className="text-left flex-1">
                          <p className="text-[14px] font-black">Thay đổi ảnh nền</p>
                          <p className="text-[10px] font-bold opacity-60">Thỏa sức sáng tạo không gian chat</p>
                       </div>
                    </button>

                    <button 
                      onClick={handleClearWallpaper}
                      className="w-full flex items-center space-x-4 p-4 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-[24px] transition-all group"
                    >
                       <div className="w-10 h-10 rounded-xl bg-background border border-red-500/20 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all shadow-sm">
                          <TrashIcon size={18} />
                       </div>
                       <div className="text-left">
                          <p className="text-[14px] font-black">Xóa ảnh nền</p>
                          <p className="text-[10px] font-bold opacity-60">Quay về giao diện tối giản</p>
                       </div>
                    </button>
                 </div>
               )}
            </div>
`;

// Find line index for toggleSection('security')
const targetIndex = lines.findIndex(line => line.includes("toggleSection('security')"));
if (targetIndex !== -1) {
    // Insert before the py-2 div containing the button
    // The py-2 div is typically 1 or 2 lines before the button
    const insertionPoint = targetIndex - 2; 
    lines.splice(insertionPoint, 0, customizationCode);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Successfully updated ConversationInfo.jsx');
} else {
    console.error('Could not find security section toggler');
}
