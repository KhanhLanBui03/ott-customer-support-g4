import React, { useEffect, useState } from 'react';
import { X, Download, Trash2, HardDrive, FileText } from 'lucide-react';
import { myCloudApi } from '../../api/myCloudApi';
import { useTranslation } from 'react-i18next';

const CloudInfo = ({ onClose, isDark }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await myCloudApi.listFiles({ limit: 100, fileType: '', nextKey: null });
      const data = res?.data || res || {};
      setFiles(data.myCloudResponses || []);
    } catch (err) {
      console.error('CloudInfo fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t('cloud.delete_confirm'))) return;
    try {
      await myCloudApi.deleteFile(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
      alert(t('cloud.delete_failed'));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(t('cloud.clear_all_confirm') || 'Clear all cloud files?')) return;
    try {
      // naive: delete one by one
      for (const f of files) {
        await myCloudApi.deleteFile(f.id);
      }
      setFiles([]);
    } catch (err) {
      console.error('Clear all failed', err);
      alert(t('cloud.delete_failed'));
    }
  };

  return (
    <div className="w-full lg:w-[360px] h-full bg-sidebar border-l border-border flex flex-col overflow-hidden animate-slide-left shadow-2xl z-40 transition-colors">
      <div className="h-[72px] px-6 border-b border-border flex items-center justify-between flex-shrink-0 glass-premium z-10">
        <h3 className="text-[17px] font-black text-foreground tracking-tight">{t('cloud.info_title') || 'Cloud Info'}</h3>
        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all active:scale-90">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="p-10 flex flex-col items-center text-center space-y-5">
          <div className="w-28 h-28 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl">
            <HardDrive size={48} strokeWidth={1} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-black text-foreground tracking-tight">{t('cloud.title') || 'My Cloud'}</h4>
            <div className="flex items-center justify-center space-x-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500/80">Active</span>
            </div>
          </div>
        </div>

        <div className="px-6 space-y-6">
          <div className="bg-surface-200/50 rounded-3xl p-4 border border-border/50">
             <div className="text-[11px] font-black uppercase tracking-widest text-foreground/40 mb-4 px-2">Recent Files</div>
             {loading ? (
                <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
             ) : (
                <div className="space-y-2">
                   {files.length === 0 ? (
                      <div className="py-4 text-center text-xs text-foreground/30 font-bold uppercase tracking-widest">No files</div>
                   ) : files.slice(0, 10).map(f => (
                      <div key={f.id} className="group flex items-center justify-between p-3 hover:bg-white/5 rounded-2xl transition-colors">
                         <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0"><FileText size={18} /></div>
                            <div className="min-w-0">
                               <div className="text-sm font-bold truncate text-foreground/80">{f.fileName}</div>
                               <div className="text-[10px] text-foreground/40 font-bold">{new Date(f.uploadedAt).toLocaleDateString()}</div>
                            </div>
                         </div>
                         <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={f.fileUrl} target="_blank" rel="noreferrer" className="p-2 hover:text-indigo-500"><Download size={16} /></a>
                            <button onClick={() => handleDelete(f.id)} className="p-2 hover:text-red-500"><Trash2 size={16} /></button>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-border">
         <button 
           onClick={handleClearAll}
           className="w-full py-4 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
         >
           Clear Cloud Storage
         </button>
      </div>
    </div>
  );
};

export default CloudInfo;
