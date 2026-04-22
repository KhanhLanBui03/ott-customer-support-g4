import React, { useState } from 'react';
import { X, Plus, Trash2, BarChart2, Calendar, CheckSquare, Square } from 'lucide-react';

const CreateVoteModal = ({ isOpen, onClose, onCreate }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [deadline, setDeadline] = useState('');

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    const filteredOptions = options.filter(opt => opt.trim() !== '');
    if (filteredOptions.length < 2) return;

    onCreate({
      question: question.trim(),
      options: filteredOptions,
      allowMultiple,
      deadline: deadline ? new Date(deadline).getTime() : null
    });
    
    // Reset and close
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-surface-100 border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-200/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <BarChart2 size={18} />
            </div>
            <h2 className="font-bold text-foreground">Tạo cuộc bình chọn</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-200 rounded-full transition-colors">
            <X size={20} className="text-foreground/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-foreground/40 px-1">Câu hỏi</label>
            <input
              autoFocus
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Nhập nội dung bình chọn..."
              className="w-full bg-surface-200 border-none rounded-xl px-4 py-3 text-foreground placeholder:text-foreground/30 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase tracking-wider text-foreground/40 px-1">Các lựa chọn</label>
            {options.map((opt, index) => (
              <div key={index} className="flex items-center space-x-2 group">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Lựa chọn ${index + 1}`}
                    className="w-full bg-surface-200 border-none rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required={index < 2}
                  />
                </div>
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2.5 text-red-400 hover:bg-red-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full py-3 border-2 border-dashed border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 rounded-xl flex items-center justify-center space-x-2 text-foreground/40 hover:text-indigo-500 transition-all text-sm font-bold"
              >
                <Plus size={16} />
                <span>Thêm lựa chọn</span>
              </button>
            )}
          </div>

          <div className="pt-2 space-y-4">
            <button
              type="button"
              onClick={() => setAllowMultiple(!allowMultiple)}
              className="flex items-center space-x-3 w-full p-1 hover:text-indigo-500 transition-colors group"
            >
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${allowMultiple ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-surface-200 text-foreground/20'}`}>
                {allowMultiple ? <CheckSquare size={14} /> : <Square size={14} />}
              </div>
              <span className="text-sm font-bold text-foreground/70 group-hover:text-foreground transition-colors">Cho phép chọn nhiều phương án</span>
            </button>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-foreground/40 px-1 flex items-center space-x-1">
                <Calendar size={12} />
                <span>Thời hạn (Không bắt buộc)</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface-200 border-none rounded-xl px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>
        </form>

        <div className="p-4 bg-surface-200/50 border-t border-border flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl font-bold text-sm text-foreground/60 hover:bg-surface-200 transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
            className="flex-2 py-3.5 px-8 rounded-xl font-bold text-sm bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            Tạo bình chọn
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateVoteModal;
