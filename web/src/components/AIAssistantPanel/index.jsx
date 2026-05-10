import React, { useState } from 'react';
import { 
  Sparkles, MessageSquare, BarChart3, Search, 
  Send, Loader2, Languages, Calendar, CheckCircle2,
  ChevronRight, BrainCircuit, FileText
} from 'lucide-react';
import { chatApi } from '../../api/chatApi';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const AIAssistantPanel = ({ conversationId }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [type, setType] = useState(null); // 'summary', 'stats', 'ask', 'tasks'
  const [question, setQuestion] = useState('');
  const [timeRange, setTimeRange] = useState(0);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleAction = async (actionType, payload = {}) => {
    setLoading(true);
    setType(actionType);
    setResult(null);
    try {
      let response;
      const startTs = isCustomRange && customStart ? new Date(customStart).getTime() : null;
      const endTs = isCustomRange && customEnd ? new Date(customEnd).getTime() : null;
      const currentRange = isCustomRange ? 0 : timeRange;

      switch (actionType) {
        case 'summary':
          if (isCustomRange && (!customStart || !customEnd)) {
            setResult("Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc!");
            setLoading(false);
            return;
          }
          response = await chatApi.getGroupSummary(conversationId, currentRange, startTs, endTs);
          break;
        case 'stats':
          response = await chatApi.getGroupStats(conversationId, currentRange, startTs, endTs);
          break;
        case 'tasks':
          response = await chatApi.extractTasks(conversationId, currentRange, startTs, endTs);
          break;

        case 'announcement':
          response = await chatApi.draftAnnouncement(conversationId, currentRange, startTs, endTs);
          break;
        case 'ask':
          response = await chatApi.askAI(conversationId, payload.question);
          break;
        default:
          return;
      }

      const resData = response.data;
      setResult(resData.summary || resData.stats || resData.answer || resData.tasks || resData.translation || resData.announcement);
    } catch (err) {
      console.error("AI Error:", err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      setResult(`Rất tiếc, trợ lý AI đang gặp sự cố: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    handleAction('ask', { question });
    setQuestion('');
  };

  return (
    <div className="mt-6 px-4 space-y-4 animate-fade-in">
      <div className="px-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <BrainCircuit size={18} />
            </div>
            <span className="text-[11px] font-black text-foreground/70 uppercase tracking-widest">Trợ lý AI</span>
          </div>
          <button 
            onClick={() => setIsCustomRange(!isCustomRange)}
            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isCustomRange ? "Dùng chọn nhanh" : "Tùy chỉnh thời gian"}
          </button>
        </div>

        {isCustomRange ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-foreground/40 uppercase ml-1">Từ lúc</label>
              <input 
                type="datetime-local" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:border-indigo-500/50 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-foreground/40 uppercase ml-1">Đến lúc</label>
              <input 
                type="datetime-local" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:border-indigo-500/50 outline-none transition-colors"
              />
            </div>
          </div>
        ) : (
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="w-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-[11px] font-bold rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-indigo-500/50 transition-colors"
          >
            <option value={0} className="bg-background">Chưa đọc</option>
            <option value={1} className="bg-background">1 giờ qua</option>
            <option value={4} className="bg-background">4 giờ qua</option>
            <option value={12} className="bg-background">12 giờ qua</option>
            <option value={24} className="bg-background">24 giờ qua</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 px-2">
        <button 
          onClick={() => handleAction('summary')}
          className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-[24px] hover:bg-indigo-500/10 hover:border-indigo-500/20 transition-all group"
        >
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl mb-2 group-hover:scale-110 transition-transform">
            <MessageSquare size={18} />
          </div>
          <span className="text-[11px] font-black text-foreground/60 uppercase tracking-tighter">Tóm tắt</span>
        </button>

        <button 
          onClick={() => handleAction('stats')}
          className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-[24px] hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-all group"
        >
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl mb-2 group-hover:scale-110 transition-transform">
            <BarChart3 size={18} />
          </div>
          <span className="text-[11px] font-black text-foreground/60 uppercase tracking-tighter">Thống kê</span>
        </button>

        <button 
          onClick={() => handleAction('tasks')}
          className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-[24px] hover:bg-orange-500/10 hover:border-orange-500/20 transition-all group"
        >
          <div className="p-2 bg-orange-500/20 text-orange-400 rounded-xl mb-2 group-hover:scale-110 transition-transform">
            <Calendar size={18} />
          </div>
          <span className="text-[11px] font-black text-foreground/60 uppercase tracking-tighter">Lịch hẹn</span>
        </button>
        <button 
          onClick={() => handleAction('announcement')}
          className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/5 rounded-[24px] hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group"
        >
          <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl mb-2 group-hover:scale-110 transition-transform">
            <FileText size={18} />
          </div>
          <span className="text-[11px] font-black text-foreground/60 uppercase tracking-tighter">Biên bản</span>
        </button>

      </div>

      {/* Ask AI Input */}
      <div className="px-2">
        <form onSubmit={handleAsk} className="relative group">
          <input 
            type="text" 
            placeholder="Hỏi AI về cuộc trò chuyện..." 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-4 pr-12 text-sm text-foreground focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-foreground/20"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all active:scale-90"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Results Display */}
      {(loading || result) && (() => {
        const renderFormattedResult = (text) => {
          if (!text) return null;
          return text.split('\n').map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} className="h-2" />; // Spacing for empty lines
            
            const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
            const content = isBullet ? trimmed.substring(2) : line;
            
            // Split by ** for bold
            const parts = content.split(/(\*\*.*?\*\*)/g);
            
            return (
              <div key={idx} className={cn(
                "mb-1.5 leading-relaxed", 
                isBullet ? "flex items-start pl-2" : "font-medium"
              )}>
                {isBullet && <span className="mr-2.5 text-indigo-400 font-bold">•</span>}
                <span className="text-[13.5px] text-foreground/80">
                  {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="font-bold text-white/90">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </span>
              </div>
            );
          });
        };

        return (
          <div className="mx-2 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-[32px] animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={48} className="text-indigo-400" />
            </div>
            
            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 flex items-center">
              {loading ? (
                <>
                  <Loader2 size={12} className="animate-spin mr-2" />
                  AI Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="mr-2" />
                  Kết quả từ AI
                </>
              )}
            </h4>

            {result && (
              <div className="relative z-10">
                {renderFormattedResult(result)}
              </div>
            )}

            {!loading && result && (
              <button 
                onClick={() => setResult(null)}
                className="mt-6 flex items-center space-x-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
              >
                <span>Đóng kết quả</span>
                <ChevronRight size={12} />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AIAssistantPanel;
