import { useState } from 'react';
import { X, RotateCcw, MessageSquare, User, Zap } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { userApi } from '../api/userApi';

const cn = (...classes) => classes.filter(Boolean).join(" ");

const SyncContactsModal = ({ isOpen, onClose, isPanel = false }) => {
  const [contacts, setContacts] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const { create, selectConversation } = useChat();

  if (!isOpen) return null;

  const handleSync = async (e) => {
    e.preventDefault();
    const phoneNumbers = contacts
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 10);

    if (phoneNumbers.length === 0) {
      setError('Import at least one valid node fragment');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await userApi.syncContacts(phoneNumbers);
      setResults(response.data || response);
    } catch (err) {
      setError('Global sync interrupted');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (userId) => {
    setLoading(true);
    try {
      const result = await create('SINGLE', [userId]);
      if (result.payload) {
        const convId = result.payload.conversationId || result.payload?.data?.conversationId;
        if (convId) selectConversation(convId);
        onClose();
      }
    } catch (err) {
      setError('Communication establishment failed');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="flex flex-col space-y-6 p-8 bg-surface-200">
      <div className="space-y-6">
        <div className="space-y-3">
          <label className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">Import Node Array</label>
          <p className="text-[11px] font-serif italic text-cursor-dark/60 leading-relaxed px-1">Paste multiple signal identifiers (phone numbers) to synchronize verified peer nodes across the network.</p>
          <textarea
            className="w-full px-5 py-4 bg-white border border-cursor-dark/10 rounded-2xl text-sm font-mono text-cursor-dark focus:outline-none focus:border-cursor-dark transition-all h-36 resize-none placeholder:text-cursor-dark/10 shadow-inner"
            placeholder="e.g. 0357804429, 0987654321..."
            value={contacts}
            onChange={(e) => setContacts(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-4 bg-cursor-error/5 border border-cursor-error/10 rounded-2xl flex items-center space-x-3 text-cursor-error animate-fade-in shadow-sm">
             <Zap size={14} className="shrink-0" />
             <p className="text-[10px] font-mono font-black uppercase tracking-widest">{error}</p>
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={loading || !contacts.trim()}
          className="group relative w-full py-4 bg-cursor-dark text-cursor-cream rounded-2xl font-mono font-black uppercase tracking-[0.4em] text-[11px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all overflow-hidden flex items-center justify-center space-x-3"
        >
          {loading ? (
             <span className="animate-pulse">PROCESS SYNC...</span>
          ) : (
             <>
               <RotateCcw size={18} /> 
               <span>INITIALIZE NODE SYNC</span>
             </>
          )}
        </button>

        {results && (
          <div className="space-y-6 pt-6 border-t border-cursor-dark/5 animate-slide-up">
            <h4 className="text-[10px] font-mono font-black text-cursor-dark/40 uppercase tracking-[0.3em] px-1">
              {results.joined?.length || 0} Peer Nodes Identified
            </h4>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 no-scrollbar">
              {results.joined?.length === 0 && (
                <div className="text-center py-8 opacity-40 italic font-serif">No peer nodes found in current array.</div>
              )}
              {results.joined?.map((u) => (
                <div key={u.userId} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-cursor-dark/5 hover:border-cursor-dark/15 transition-all shadow-sm group">
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-surface-300 flex items-center justify-center text-cursor-dark/40 overflow-hidden border border-cursor-dark/5">
                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" alt="" /> : <User size={20} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-serif italic font-bold text-cursor-dark truncate">{u.fullName}</p>
                      <p className="text-[10px] font-mono text-cursor-dark/40 uppercase tracking-tighter">{u.phoneNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartChat(u.userId)}
                    className="p-3 text-cursor-dark/40 hover:text-cursor-accent hover:bg-cursor-accent/5 rounded-xl transition-all"
                    title="Connect"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isPanel) return content;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-xl bg-cursor-cream/40 animate-fade-in">
      <div className="bg-surface-200 w-full max-w-lg rounded-[40px] shadow-2xl border border-cursor-dark/5 relative overflow-hidden">
        <div className="h-20 flex items-center justify-between px-10 border-b border-cursor-dark/5 bg-surface-100/30 backdrop-blur-md">
          <h2 className="font-serif italic font-black text-cursor-dark uppercase tracking-[0.2em] text-[12px]">Peer Synchronizer</h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl text-cursor-dark/40 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto no-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};

export default SyncContactsModal;
