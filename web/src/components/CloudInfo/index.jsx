import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, Download, Trash2, HardDrive, FileText, ChevronDown, ChevronRight, 
  Image as ImageIcon, Video, Link as LinkIcon, PlayCircle 
} from 'lucide-react';
import { myCloudApi } from '../../api/myCloudApi';
import { useTranslation } from 'react-i18next';

const CloudInfo = ({ onClose, isDark, onPreviewFile }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState({
    media: false,
    files: false,
    links: false
  });

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

  const toggleSection = (section) => {
    setSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
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
      for (const f of files) {
        await myCloudApi.deleteFile(f.id);
      }
      setFiles([]);
    } catch (err) {
      console.error('Clear all failed', err);
      alert(t('cloud.delete_failed'));
    }
  };

  const mediaItems = useMemo(() => {
    return files
      .filter(f => f.typeFile === 'image' || f.typeFile === 'video')
      .map(f => ({
        ...f,
        url: f.fileUrl,
        type: f.typeFile === 'image' ? 'IMAGE' : 'VIDEO',
        name: f.fileName
      }));
  }, [files]);

  const fileItems = useMemo(() => {
    return files
      .filter(f => {
        const isMsg = Boolean(f.messageText) && String(f.fileName || '').startsWith('message_');
        return !isMsg && f.typeFile !== 'image' && f.typeFile !== 'video' && f.typeFile !== 'audio';
      })
      .map(f => {
        const decoded = decodeURIComponent(f.fileUrl || '');
        const cleanUrl = decoded.split('?')[0];
        let name = f.fileName || cleanUrl.split('/').pop() || 'File';
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;
        name = name.replace(uuidPattern, '');
        const longPrefixPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_[0-9]+_/i;
        name = name.replace(longPrefixPattern, '');
        return {
          ...f,
          url: f.fileUrl,
          name: name
        };
      });
  }, [files]);

  const linkItems = useMemo(() => {
    const items = [];
    files.forEach(f => {
      const isMsg = Boolean(f.messageText) && String(f.fileName || '').startsWith('message_');
      if (isMsg) {
        let text = f.messageText;
        if (text.startsWith('{"text":')) {
          try {
             const parsed = JSON.parse(text);
             text = parsed.text || '';
          } catch (e) {}
        }
        if (text) {
          const urls = text.match(/https?:\/\/[^\s]+/gi);
          if (urls) {
            urls.forEach(url => {
              const lowerUrl = url.toLowerCase();
              if (
                lowerUrl.includes('/chat-media/') ||
                lowerUrl.includes('/uploads/') ||
                lowerUrl.includes('/voice-messages/') ||
                lowerUrl.includes('/chat-wallpaper/') ||
                lowerUrl.includes('/avatars/') ||
                lowerUrl.includes('amazonaws.com') ||
                lowerUrl.includes('s3.') ||
                lowerUrl.includes('dicebear.com')
              ) {
                return;
              }
              items.push({ id: f.id, url, text, uploadedAt: f.uploadedAt });
            });
          }
        }
      }
    });
    return items;
  }, [files]);

  const getFileIconComponent = (url) => {
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    const colorClass =
      ext === 'pdf' ? 'bg-red-500' :
      ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
      ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
      ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
      'bg-indigo-500';

    return (
      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm ${colorClass}`}>
        <FileText size={16} className="mb-[-2px] opacity-40" />
        <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{ext}</span>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      </div>
    );
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

        {loading ? (
          <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="px-4 space-y-3">
            {/* Ảnh/Video đã chia sẻ */}
            <div className="py-2 border-b border-border/40">
              <button 
                onClick={() => toggleSection('media')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_media')}</span>
                {sections.media ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.media && (
                <div className="mt-4 px-2">
                  {mediaItems.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {mediaItems.slice(0, 12).map((item, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-xl overflow-hidden cursor-pointer relative group border border-border bg-surface-100"
                          onClick={() => onPreviewFile ? onPreviewFile(item) : window.open(item.url, '_blank')}
                        >
                          {item.type === 'IMAGE' ? (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-black/40">
                              <PlayCircle size={32} className="text-white drop-shadow-lg" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 opacity-30">
                      <ImageIcon size={32} className="mx-auto mb-3" />
                      <p className="text-xs font-bold italic tracking-tight">{t('info.no_media')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* File đã chia sẻ */}
            <div className="py-2 border-b border-border/40">
              <button 
                onClick={() => toggleSection('files')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_files')}</span>
                {sections.files ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.files && (
                <div className="mt-3 space-y-2 px-2">
                  {fileItems.length > 0 ? (
                    fileItems.slice(0, 5).map((file, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => onPreviewFile ? onPreviewFile(file) : window.open(file.url, '_blank')} 
                        className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98]"
                      >
                        {getFileIconComponent(file.url)}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{file.name || t('chat.attachment')}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 opacity-30">
                      <FileText size={32} className="mx-auto mb-3" />
                      <p className="text-xs font-bold italic tracking-tight">{t('info.no_files')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Link đã chia sẻ */}
            <div className="py-2 border-b border-border/40">
              <button 
                onClick={() => toggleSection('links')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-100 rounded-2xl transition-all"
              >
                <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">{t('info.shared_links')}</span>
                {sections.links ? <ChevronDown size={18} className="text-foreground/70" /> : <ChevronRight size={18} className="text-foreground/70" />}
              </button>
              {sections.links && (
                <div className="mt-3 space-y-2 px-2">
                  {linkItems.length > 0 ? (
                    linkItems.slice(0, 5).map((item, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => window.open(item.url, '_blank')} 
                        className="flex items-center space-x-4 p-4 hover:bg-white dark:hover:bg-white/5 rounded-[24px] border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group shadow-sm hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                          <LinkIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-black text-slate-800 dark:text-slate-200 truncate leading-tight">{item.url}</p>
                          {item.text !== item.url && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-1">{item.text}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 opacity-30">
                      <LinkIcon size={32} className="mx-auto mb-3" />
                      <p className="text-xs font-bold italic tracking-tight">{t('info.no_links')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
