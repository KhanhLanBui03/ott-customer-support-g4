import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Download,
  Eye,
  Trash2,
  File,
  Image as ImageIcon,
  Video,
  Music,
  Search,
  Plus,
  Paperclip,
  FileText,
  HardDrive,
  MoreVertical,
  Forward,
  Reply,
  Play,
  Pause,
  X
} from 'lucide-react';
import { myCloudApi } from '../../api/myCloudApi';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import CloudInfo from '../../components/CloudInfo';
import ForwardModal from '../ForwardModal';

const MyCloud = ({ isDark }) => {
  const { t } = useTranslation();
  const { user } = useSelector(state => state.auth);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [nextKey, setNextKey] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const fileInputRef = useRef(null);
  const threadScrollRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardingItem, setForwardingItem] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const container = threadScrollRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  };

  const getDisplayMessageText = (item) => {
    if (!item?.messageText) return '';
    if (item.messageText.startsWith('{"text":')) {
      try {
        const parsed = JSON.parse(item.messageText);
        return parsed.text || '';
      } catch (e) {
        return item.messageText;
      }
    }
    return item.messageText;
  };

  const getReplyPreview = (item) => {
    if (!item) return null;

    if (item.replyToMessageId || item.replyToContent || item.replyToSenderName || item.replyToFileName || item.replyToFileUrl) {
      return {
        messageId: item.replyToMessageId,
        content: item.replyToContent || item.replyToFileName || '',
        typeFile: item.replyToTypeFile || 'document',
        senderName: item.replyToSenderName || t('common.you') || 'Bạn',
        fileUrl: item.replyToFileUrl || ''
      };
    }

    if (item.messageText && item.messageText.startsWith('{"text":')) {
      try {
        const parsed = JSON.parse(item.messageText);
        return parsed.replyTo || null;
      } catch (e) {
        return null;
      }
    }

    return null;
  };

  const buildReplyMetadata = (item) => {
    if (!item) return {};

    const content = getDisplayMessageText(item) || item.fileName || '';
    const senderName = item.senderName || t('common.you') || 'Bạn';

    return {
      replyToMessageId: item.id,
      replyToContent: content,
      replyToTypeFile: item.typeFile || 'document',
      replyToFileName: item.fileName || content,
      replyToSenderName: senderName,
      replyToFileUrl: item.fileUrl || ''
    };
  };

  const fetchFiles = async (key = null) => {
    setLoading(true);
    try {
      const params = {
        limit: 50,
        fileType: '',
        nextKey: key
      };
      const response = await myCloudApi.listFiles(params);
      const data = response.data || response;

      if (key) {
        setFiles(prev => [...prev, ...(data.myCloudResponses || [])]);
      } else {
        setFiles(data.myCloudResponses || []);
      }

      setNextKey(data.nextKey || null);
      setHasNext(!!data.nextKey);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    const handleCloudUpdate = (e) => {
      const { action, item, fileId } = e.detail;
      if (action === 'UPLOAD') {
        setFiles(prev => {
          if (prev.some(f => f.id === item.id)) return prev;
          const newFiles = [...prev, item];
          return newFiles.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
        });
        scrollToBottom();
      } else if (action === 'DELETE') {
        setFiles(prev => prev.filter(f => f.id !== fileId));
      }
    };

    window.addEventListener('my-cloud-update', handleCloudUpdate);
    return () => window.removeEventListener('my-cloud-update', handleCloudUpdate);
  }, []);

  useEffect(() => {
    if (files.length > 0) {
      scrollToBottom();
    }
  }, [files.length, isInfoOpen]);

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleUpload = async (e) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    setUploading(true);
    try {
      const metadata = replyingTo ? buildReplyMetadata(replyingTo) : {};

      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const resp = await myCloudApi.uploadFile(file, undefined, metadata);
        const created = resp?.data || resp;
        if (created) {
          setFiles(prev => {
            if (prev.some(f => f.id === created.id)) return prev;
            return [...prev, created];
          });
        }
      }
      scrollToBottom();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(t('cloud.upload_failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendTextMessageToCloud = async () => {
    if (uploading) return;
    const text = (messageText || '').trim();
    if (!text) return;
    setUploading(true);
    try {
      const name = `message_${Date.now()}.txt`;
      const blob = new Blob([text], { type: 'text/plain' });
      const metadata = replyingTo ? buildReplyMetadata(replyingTo) : {};
      const resp = await myCloudApi.uploadFile(blob, name, metadata);
      const created = resp?.data?.data || resp?.data || resp;
      if (created) {
        const msgObj = { ...created, typeFile: created.typeFile || 'document' };
        setFiles(prev => {
          if (prev.some(f => f.id === msgObj.id)) return prev;
          return [...prev, msgObj];
        });
        setMessageText('');
        setReplyingTo(null);
        scrollToBottom();
      } else {
        await fetchFiles();
      }
    } catch (err) {
      console.error('Send message failed', err);
      alert(t('cloud.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileIdOrIds) => {
    if (!window.confirm(t('cloud.delete_confirm'))) return;

    try {
      const ids = Array.isArray(fileIdOrIds) ? fileIdOrIds : [fileIdOrIds];
      for (const id of ids) {
        await myCloudApi.deleteFile(id);
      }
      setFiles(prev => prev.filter(f => !ids.includes(f.id)));
    } catch (err) {
      console.error('Delete failed:', err);
      alert(t('cloud.delete_failed'));
    }
  };

  const openForwardModal = (file) => {
    const isMessage = Boolean(getDisplayMessageText(file));
    setForwardingItem({
      messageId: file.id,
      conversationId: 'my-cloud',
      senderName: t('common.you') || 'You',
      content: isMessage ? getDisplayMessageText(file) : '',
      type: isMessage ? 'TEXT' : 'FILE',
      mediaUrls: isMessage ? [] : (file.fileUrl ? [file.fileUrl] : []),
      fileName: file.fileName
    });
    setIsForwardModalOpen(true);
    setActiveMenuId(null);
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (typeFile) => {
    switch (typeFile) {
      case 'image':
        return <ImageIcon className="text-pink-500" size={24} />;
      case 'video':
        return <Video className="text-purple-500" size={24} />;
      case 'audio':
        return <Music className="text-amber-500" size={24} />;
      case 'document':
        return <FileText className="text-blue-500" size={24} />;
      default:
        return <File className="text-slate-400" size={24} />;
    }
  };

  const getFilePreviewType = (file) => {
    const typeFile = String(file?.typeFile || '').toLowerCase();
    const fileName = String(file?.fileName || '').toLowerCase();
    const fileUrl = String(file?.fileUrl || '').toLowerCase();

    if (typeFile === 'image' || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(fileName + fileUrl)) return 'image';
    if (typeFile === 'video' || /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(fileName + fileUrl)) return 'video';
    if (typeFile === 'audio' || /\.(mp3|m4a|wav|ogg|opus|webm)(\?|$)/i.test(fileName + fileUrl)) return 'audio';
    if (/\.(pdf)(\?|$)/i.test(fileName + fileUrl)) return 'pdf';
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i.test(fileName + fileUrl)) return 'office';
    if (typeFile === 'document') return 'document';
    return 'file';
  };

  const getOfficeViewerUrl = (url) => {
    if (!url) return '';
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  };

  const openPreview = (file) => {
    if (!file?.fileUrl) return;
    setPreviewFile(file);
  };

  const closePreview = () => setPreviewFile(null);

  const filteredFiles = files.filter(file =>
    ((getDisplayMessageText(file) || file.fileName || '')).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedItems = useMemo(() => {
    const ordered = [...filteredFiles].sort((left, right) => {
      const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : 0;
      const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : 0;
      return leftTime - rightTime;
    });

    const grouped = [];
    let currentGroup = null;

    ordered.forEach((item) => {
      const isMsg = Boolean(getDisplayMessageText(item)) && String(item.fileName || '').startsWith('message_');
      const isGroupable = !isMsg;
      const itemTime = item.uploadedAt ? new Date(item.uploadedAt).getTime() : 0;

      if (isGroupable && currentGroup) {
        const timeDiff = Math.abs(itemTime - currentGroup.time);
        if (timeDiff <= 5000) {
          currentGroup.files.push(item);
          return;
        }
      }

      if (isGroupable) {
        currentGroup = {
          id: `group_${item.id}`,
          isGroup: true,
          type: 'file_group',
          time: itemTime,
          uploadedAt: item.uploadedAt,
          side: 'right',
          files: [item]
        };
        grouped.push(currentGroup);
      } else {
        currentGroup = null;
        grouped.push({
          ...item,
          side: 'right'
        });
      }
    });

    return grouped;
  }, [filteredFiles]);

  const formatTime = (dateValue) => {
    if (!dateValue) return '';
    return new Date(dateValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative transition-all duration-300">
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDark ? 'bg-[#0b0f18] text-white' : 'bg-white text-slate-800'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/5 bg-[#0f1422]' : 'border-slate-100 bg-white'}`}>
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="text-indigo-400" size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-black tracking-tight leading-none truncate">{t('cloud.title')}</h2>
            <div className={`mt-1 flex items-center space-x-2 text-[11px] font-bold uppercase tracking-[0.24em] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{t('cloud.subtitle')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/5 text-white/50' : 'hover:bg-slate-100 text-slate-500'}`} title="Tìm kiếm">
            <Search size={18} />
          </button>
          <button onClick={() => setIsInfoOpen(!isInfoOpen)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? (isInfoOpen ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5 text-white/50') : (isInfoOpen ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100 text-slate-500')}`} title="Thông tin">
            <span className="text-[12px] font-black">i</span>
          </button>
        </div>
      </div>

      <div ref={threadScrollRef} className={`flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-6 ${isDark ? 'bg-[#0b0f18]' : 'bg-[#f8fafc]'}`}>
        {loading && files.length === 0 ? (
          <div className="flex h-full min-h-[280px] items-center justify-center opacity-40">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">Đang tải tệp...</p>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center px-6 space-y-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
              <File size={30} className={isDark ? 'text-white/20' : 'text-slate-300'} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Chưa có tin nhắn nào</h3>
              <p className={`text-sm mt-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                Gửi một tệp để bắt đầu cuộc hội thoại với Cloud.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current.click()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20"
            >
              Gửi tệp đầu tiên
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-center">
              <div className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.28em] ${isDark ? 'bg-white/5 text-white/45' : 'bg-white text-slate-400 shadow-sm border border-slate-100'}`}>
                Hôm nay
              </div>
            </div>

            {groupedItems.map((file) => {
              const isRight = file.side === 'right';

              if (file.isGroup && file.type === 'file_group') {
                const replyData = getReplyPreview(file.files[0]);
                const imagesAndVideos = file.files.filter(f => {
                  const t = getFilePreviewType(f);
                  return t === 'image' || t === 'video';
                });
                const otherFiles = file.files.filter(f => {
                  const t = getFilePreviewType(f);
                  return t !== 'image' && t !== 'video';
                });

                const renderSingleMedia = (mediaFile) => {
                  const isVideo = getFilePreviewType(mediaFile) === 'video';
                  return (
                    <div
                      onClick={(e) => { e.stopPropagation(); openPreview(mediaFile); }}
                      className="max-w-[280px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/10 bg-black/10"
                    >
                      {isVideo ? (
                        <div className="relative">
                          <video src={mediaFile.fileUrl} className="w-full max-h-[220px] object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                              <Play size={20} fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={mediaFile.fileUrl} alt={mediaFile.fileName} className="w-full max-h-[220px] object-cover" />
                      )}
                    </div>
                  );
                };

                const renderSingleDocument = (docFile) => {
                  return (
                    <div
                      onClick={(e) => { e.stopPropagation(); openPreview(docFile); }}
                      className="flex items-center space-x-4 p-4 rounded-[22px] border transition-all min-w-[260px] max-w-full cursor-pointer bg-white/10 border-white/20 hover:bg-white/15"
                    >
                      {(() => {
                        const ext = docFile.fileName?.split('.').pop().toLowerCase() || 'file';
                        const colorClass =
                          ext === 'pdf' ? 'bg-red-500' :
                          ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
                          ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
                          ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
                          'bg-indigo-500';
                        return (
                          <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm ${colorClass}`}>
                            <FileText size={18} className="mb-[-2px] opacity-40" />
                            <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{ext}</span>
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0 pt-0.5 text-left">
                        <p className="text-[14px] font-bold truncate mb-0.5 text-white">
                          {docFile.fileName}
                        </p>
                        <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
                          {formatSize(docFile.fileSize)}
                        </p>
                      </div>
                    </div>
                  );
                };

                return (
                  <div key={file.id} className="group relative flex flex-col items-end space-y-1">
                    {/* Reaction Bar Dummy */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md rounded-full px-2 py-1 mb-1 mr-10 scale-90 origin-right">
                      {['👍', '❤️', '😂', '😮', '😢', '😡'].map(e => <span key={e} className="cursor-pointer hover:scale-125 transition-transform">{e}</span>)}
                    </div>

                    <div className="flex items-end space-x-3 justify-end">
                      {/* Quick Action Icons */}
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setReplyingTo(file.files[0]); }}
                          className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                        >
                          <Reply size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === file.id ? null : file.id);
                          }}
                          className={`p-1.5 hover:bg-white/10 rounded-full transition-colors ${activeMenuId === file.id ? 'text-indigo-400 bg-white/5' : 'text-white/40 hover:text-white'}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>

                      <div className="max-w-[75%] flex flex-col items-end">
                        {replyData && (
                           <div className={`mb-1 flex items-center space-x-2 px-3 py-1.5 rounded-t-xl border-l-[3px] border-indigo-500 text-[11px] ${isDark ? 'bg-white/5 text-white/40 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 shadow-sm'}`}>
                              <div className="w-5 h-5 bg-indigo-500/10 rounded flex items-center justify-center shrink-0">
                                 <Reply size={10} className="text-indigo-400" />
                              </div>
                              <div className="flex-1 truncate italic">
                                 <span className="font-bold not-italic mr-1">{replyData.senderName}:</span>
                                 {replyData.fileUrl ? (
                                   <a
                                     href={replyData.fileUrl}
                                     target="_blank"
                                     rel="noreferrer"
                                     onClick={(e) => e.stopPropagation()}
                                     className="underline decoration-dotted underline-offset-2 hover:text-indigo-300"
                                   >
                                     {replyData.content}
                                   </a>
                                 ) : (
                                   replyData.content
                                 )}
                              </div>
                           </div>
                        )}

                        {file.files.length === 1 && imagesAndVideos.length === 1 ? (
                          renderSingleMedia(imagesAndVideos[0])
                        ) : file.files.length === 1 && otherFiles.length === 1 ? (
                          renderSingleDocument(otherFiles[0])
                        ) : (
                          <div className="relative shadow-lg transition-all duration-300 pointer-events-auto bg-indigo-600 text-white rounded-[22px] rounded-br-[4px] p-4 max-w-[320px] space-y-3">
                            {/* Media Grid */}
                            {imagesAndVideos.length > 0 && (
                              <div className={`grid ${imagesAndVideos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 overflow-hidden rounded-xl bg-black/10 p-1`}>
                                {imagesAndVideos.map((mediaFile) => {
                                  const isVideo = getFilePreviewType(mediaFile) === 'video';
                                  return (
                                    <div
                                      key={mediaFile.id}
                                      onClick={(e) => { e.stopPropagation(); openPreview(mediaFile); }}
                                      className="relative aspect-square cursor-pointer hover:opacity-90 transition-opacity bg-black/20 rounded-lg overflow-hidden group/item"
                                    >
                                      {isVideo ? (
                                        <>
                                          <video src={mediaFile.fileUrl} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                              <Play size={14} fill="currentColor" />
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <img src={mediaFile.fileUrl} alt={mediaFile.fileName} className="w-full h-full object-cover" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Documents list */}
                            {otherFiles.length > 0 && (
                              <div className="space-y-2">
                                {otherFiles.map((docFile) => {
                                  const ext = docFile.fileName?.split('.').pop().toLowerCase() || 'file';
                                  const colorClass =
                                    ext === 'pdf' ? 'bg-red-500' :
                                    ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
                                    ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
                                    ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
                                    'bg-indigo-500';
                                  return (
                                    <div
                                      key={docFile.id}
                                      onClick={(e) => { e.stopPropagation(); openPreview(docFile); }}
                                      className="flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer bg-white/10 border-white/20 hover:bg-white/15"
                                    >
                                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm ${colorClass}`}>
                                        <FileText size={14} className="mb-[-2px] opacity-40" />
                                        <span className="text-[8px] font-black uppercase tracking-tighter leading-none">{ext}</span>
                                      </div>
                                      <div className="flex-1 min-w-0 text-left">
                                        <p className="text-[13px] font-bold truncate text-white mb-0.5">
                                          {docFile.fileName}
                                        </p>
                                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                                          {formatSize(docFile.fileSize)}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Context Menu for group */}
                        {activeMenuId === file.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                            <div
                              className={`absolute z-50 bottom-full right-0 mb-3 w-56 rounded-[28px] shadow-2xl border backdrop-blur-xl overflow-hidden animate-zoom-in ${isDark ? 'bg-[#161b2c]/95 border-white/10' : 'bg-white/95 border-slate-100'}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="p-2 space-y-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setReplyingTo(file.files[0]); setActiveMenuId(null); }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all ${isDark ? 'hover:bg-white/5 text-white/90' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                  <Reply size={18} className="text-indigo-400" />
                                  <span>Trả lời</span>
                                </button>
                                <div className={`h-px mx-4 my-1 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const ids = file.files.map(f => f.id);
                                    handleDelete(ids);
                                    setActiveMenuId(null);
                                  }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all ${isDark ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                  <Trash2 size={18} />
                                  <span>Xóa nhóm file này</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        <div className={`mt-1.5 flex items-center space-x-2 px-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                          <span>{formatTime(file.uploadedAt)}</span>
                        </div>
                      </div>

                      {isRight && (
                        <div className="flex flex-col items-center mb-6 shrink-0 group/avatar">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-indigo-500/20 text-indigo-300 group-hover/avatar:bg-indigo-500 group-hover/avatar:text-white' : 'bg-indigo-50 text-indigo-600'} border border-indigo-500/30 overflow-hidden shadow-sm`}>
                            <HardDrive size={16} />
                          </div>
                          <span className="text-[9px] font-black mt-1.5 opacity-40 uppercase tracking-tighter">Bạn</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              const displayContent = getDisplayMessageText(file);
              const replyData = getReplyPreview(file);
              const isMessage = Boolean(displayContent) && String(file.fileName || '').startsWith('message_');
              
              return (
                <div key={file.id} className="group relative flex flex-col items-end space-y-1">
                  {/* Reaction Bar Dummy */}
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-md rounded-full px-2 py-1 mb-1 mr-10 scale-90 origin-right">
                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(e => <span key={e} className="cursor-pointer hover:scale-125 transition-transform">{e}</span>)}
                  </div>
 
                  <div className={`flex items-end space-x-3 ${isRight ? 'justify-end' : 'justify-start'}`}>
                    {/* Quick Action Icons */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setReplyingTo(file); }}
                        className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                      >
                        <Reply size={16} />
                      </button>
                      <button onClick={() => openForwardModal(file)} className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-indigo-400 transition-colors"><Forward size={16} /></button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === file.id ? null : file.id);
                        }}
                        className={`p-1.5 hover:bg-white/10 rounded-full transition-colors ${activeMenuId === file.id ? 'text-indigo-400 bg-white/5' : 'text-white/40 hover:text-white'}`}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
 
                    <div className={`max-w-[75%] flex flex-col ${isRight ? 'items-end' : 'items-start'}`}>
                      {replyData && (
                         <div className={`mb-1 flex items-center space-x-2 px-3 py-1.5 rounded-t-xl border-l-[3px] border-indigo-500 text-[11px] ${isDark ? 'bg-white/5 text-white/40 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 shadow-sm'}`}>
                            <div className="w-5 h-5 bg-indigo-500/10 rounded flex items-center justify-center shrink-0">
                               <Reply size={10} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 truncate italic">
                               <span className="font-bold not-italic mr-1">{replyData.senderName}:</span>
                               {replyData.fileUrl ? (
                                 <a
                                   href={replyData.fileUrl}
                                   target="_blank"
                                   rel="noreferrer"
                                   onClick={(e) => e.stopPropagation()}
                                   className="underline decoration-dotted underline-offset-2 hover:text-indigo-300"
                                 >
                                   {replyData.content}
                                 </a>
                               ) : (
                                 replyData.content
                                )}
                            </div>
                         </div>
                      )}
                      
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === file.id ? null : file.id);
                        }}
                        className={`relative shadow-lg transition-all duration-300 pointer-events-auto ${
                          isRight
                            ? 'bg-indigo-600 text-white rounded-[22px] rounded-br-[4px]'
                            : 'bg-white text-slate-800 rounded-[22px] rounded-bl-[4px] border border-slate-100'
                        } ${isMessage ? 'px-5 py-3' : 'p-0 cursor-pointer'} ${replyData ? 'rounded-tr-none' : ''}`}
                      >
                        {isMessage ? (
                          <div className="text-[15px] font-semibold leading-relaxed whitespace-pre-wrap break-words">
                            {(() => {
                              const urlRegex = /(https?:\/\/[^\s]+)/gi;
                              const parts = displayContent.split(urlRegex);
                              return parts.map((part, index) => {
                                if (part.match(urlRegex)) {
                                  return (
                                    <a
                                      key={`link-${index}`}
                                      href={part}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className={`underline font-bold transition-opacity hover:opacity-80 ${
                                        isRight
                                          ? 'text-white hover:text-white/80'
                                          : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500'
                                      }`}
                                    >
                                      {part}
                                    </a>
                                  );
                                }
                                return part;
                              });
                            })()}
                          </div>
                        ) : getFilePreviewType(file) === 'image' ? (
                          <div
                            onClick={(e) => { e.stopPropagation(); openPreview(file); }}
                            className="max-w-[280px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity border border-white/10 bg-black/10"
                          >
                            <img src={file.fileUrl} alt={file.fileName} className="w-full max-h-[220px] object-cover" />
                          </div>
                        ) : getFilePreviewType(file) === 'video' ? (
                          <div
                            onClick={(e) => { e.stopPropagation(); openPreview(file); }}
                            className="max-w-[280px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative border border-white/10 bg-black/10"
                          >
                            <video src={file.fileUrl} className="w-full max-h-[220px] object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                                <Play size={20} fill="currentColor" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={(e) => { e.stopPropagation(); openPreview(file); }}
                            className={`flex items-center space-x-4 p-4 rounded-2xl border transition-all min-w-[260px] max-w-full cursor-pointer bg-white/10 border-white/20 hover:bg-white/15`}
                          >
                            {(() => {
                              const ext = file.fileName?.split('.').pop().toLowerCase() || 'file';
                              const colorClass =
                                ext === 'pdf' ? 'bg-red-500' :
                                ['doc', 'docx'].includes(ext) ? 'bg-blue-500' :
                                ['xls', 'xlsx'].includes(ext) ? 'bg-emerald-500' :
                                ['zip', 'rar', '7z'].includes(ext) ? 'bg-amber-500' :
                                'bg-indigo-500';
                              return (
                                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden flex-shrink-0 shadow-sm ${colorClass}`}>
                                  <FileText size={18} className="mb-[-2px] opacity-40" />
                                  <span className="text-[9px] font-black uppercase tracking-tighter leading-none">{ext}</span>
                                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                                </div>
                              );
                            })()}
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-[14px] font-bold truncate mb-0.5 text-white">
                                {file.fileName}
                              </p>
                              <p className="text-[11px] font-bold text-white/50 uppercase tracking-widest">
                                {formatSize(file.fileSize)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {file.fileUrl && (
                                <a
                                  href={file.fileUrl}
                                  download={file.fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                                  title="Tải về"
                                >
                                  <Download size={14} />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Context Menu Styled */}
                        {activeMenuId === file.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                            <div
                              className={`absolute z-50 bottom-full right-0 mb-3 w-56 rounded-[28px] shadow-2xl border backdrop-blur-xl overflow-hidden animate-zoom-in ${isDark ? 'bg-[#161b2c]/95 border-white/10' : 'bg-white/95 border-slate-100'}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="p-2 space-y-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setReplyingTo(file); setActiveMenuId(null); }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all ${isDark ? 'hover:bg-white/5 text-white/90' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                  <Reply size={18} className="text-indigo-400" />
                                  <span>Trả lời</span>
                                </button>
                                <div className={`h-px mx-4 my-1 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`} />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(file.id); setActiveMenuId(null); }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all ${isDark ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                                >
                                  <Trash2 size={18} />
                                  <span>Xóa phía tôi</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(file.id); setActiveMenuId(null); }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all ${isDark ? 'hover:bg-red-500/10 text-red-500' : 'hover:bg-red-50 text-red-600'}`}
                                >
                                  <Trash2 size={18} />
                                  <span>Thu hồi</span>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className={`mt-1.5 flex items-center space-x-2 px-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                        <span>{formatTime(file.uploadedAt)}</span>
                      </div>
                    </div>

                    {isRight && (
                      <div className="flex flex-col items-center mb-6 shrink-0 group/avatar">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-indigo-500/20 text-indigo-300 group-hover/avatar:bg-indigo-500 group-hover/avatar:text-white' : 'bg-indigo-50 text-indigo-600'} border border-indigo-500/30 overflow-hidden shadow-sm`}>
                          <HardDrive size={16} />
                        </div>
                        <span className="text-[9px] font-black mt-1.5 opacity-40 uppercase tracking-tighter">Bạn</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {hasNext && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchFiles(nextKey)}
                  disabled={loading}
                  className={`px-5 py-2.5 rounded-full text-[12px] font-black uppercase tracking-[0.18em] transition-all ${isDark ? 'bg-white/5 text-white/65 hover:bg-white/10' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                >
                  {loading ? t('cloud.loading_more') : t('cloud.load_more')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`border-t px-4 py-4 ${isDark ? 'border-white/5 bg-[#0f1422]' : 'border-slate-100 bg-white'}`}>
        {replyingTo && (
          <div className="mb-3 animate-slide-up">
            <div className={`relative flex items-center p-3 rounded-2xl border-l-[4px] border-indigo-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex-1 min-w-0 flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                  {replyingTo.messageText ? <Reply size={14} className="text-indigo-400" /> : getFileIcon(replyingTo.typeFile)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">ĐANG TRẢ LỜI {user?.fullName || 'CHÍNH MÌNH'}</span>
                    <span className={`text-[11px] font-bold uppercase ${isDark ? 'text-white/40' : 'text-slate-400'}`}>BẠN</span>
                  </div>
                  <div className={`text-[13px] truncate font-semibold ${isDark ? 'text-white/80' : 'text-slate-600'}`}>
                    {getDisplayMessageText(replyingTo) || replyingTo.fileName}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setReplyingTo(null)}
                className={`ml-2 p-1.5 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-200 text-slate-500'}`}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className={`flex items-end gap-3 rounded-[28px] border px-4 py-3 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
          <button
            onClick={() => fileInputRef.current.click()}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/10 text-white/55' : 'hover:bg-white text-slate-500'}`}
            title="Đính kèm"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
            multiple
          />
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                sendTextMessageToCloud();
              }
            }}
            placeholder="Type a message to Cloud"
            className={`flex-1 min-h-[42px] bg-transparent outline-none text-sm font-medium ${isDark ? 'text-white/85 placeholder-white/40' : 'text-slate-700 placeholder-slate-400'}`}
          />
          <button
            disabled={uploading}
            onClick={() => fileInputRef.current.click()}
            className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/25 disabled:opacity-60"
            title="Gửi tệp"
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus size={18} />
            )}
          </button>
          <button
            onClick={sendTextMessageToCloud}
            className="ml-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold"
            disabled={uploading || !messageText.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
    {isInfoOpen && <CloudInfo onClose={() => setIsInfoOpen(false)} isDark={isDark} onPreviewFile={openPreview} />}
    <ForwardModal
      isOpen={isForwardModalOpen}
      onClose={() => {
        setIsForwardModalOpen(false);
        setForwardingItem(null);
      }}
      messageToForward={forwardingItem}
    />

    {previewFile && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={closePreview}>
        <div
          className={`w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[28px] shadow-2xl border ${isDark ? 'bg-[#121625] border-white/10' : 'bg-white border-slate-100'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black truncate">{previewFile.fileName}</h3>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>Xem trước tệp trong Cloud</p>
            </div>
            <button
              onClick={closePreview}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDark ? 'hover:bg-white/5 text-white/60' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <X size={18} />
            </button>
          </div>

          <div className={`p-4 ${isDark ? 'bg-[#0b0f18]' : 'bg-slate-50'}`}>
            {(() => {
              const previewType = getFilePreviewType(previewFile);
              const url = previewFile.fileUrl;

              if (!url) {
                return (
                  <div className="h-[70vh] flex items-center justify-center text-sm opacity-70">
                    Không có link xem trước.
                  </div>
                );
              }

              if (previewType === 'image') {
                return <img src={url} alt={previewFile.fileName} className="max-h-[78vh] mx-auto rounded-2xl object-contain" />;
              }

              if (previewType === 'video') {
                return <video src={url} controls className="w-full max-h-[78vh] rounded-2xl bg-black" />;
              }

              if (previewType === 'audio') {
                return (
                  <div className="h-[72vh] flex items-center justify-center">
                    <audio src={url} controls className="w-full max-w-2xl" />
                  </div>
                );
              }

              if (previewType === 'pdf') {
                return <iframe title={previewFile.fileName} src={url} className="w-full h-[78vh] rounded-2xl bg-white" />;
              }

              if (previewType === 'office') {
                return (
                  <iframe
                    title={previewFile.fileName}
                    src={getOfficeViewerUrl(url)}
                    className="w-full h-[78vh] rounded-2xl bg-white"
                  />
                );
              }

              return (
                <div className={`h-[72vh] flex flex-col items-center justify-center text-center px-6 space-y-4 ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                    {getFileIcon(previewFile.typeFile)}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">Không hỗ trợ xem trực tiếp loại file này</h4>
                    <p className={`text-sm mt-1 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      Bạn vẫn có thể tải về để mở bằng ứng dụng ngoài.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default MyCloud;
