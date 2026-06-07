import React, { useState } from 'react';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  token: string;
  onSave: (newToken: string) => void;
}

function SettingsModal({ show, onClose, token, onSave }: SettingsModalProps) {
  const [inputToken, setInputToken] = useState(token);

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(inputToken);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-enter"
      onClick={onClose}
    >
      <div
        className="
          glass-card glow-amber
          w-full max-w-md
          bg-night-800/95 backdrop-blur-xl
          border-amber-500/20
          p-6
          rounded-xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-3">
          <h2 className="font-heading font-bold text-lg text-white">⚙️ Genius API 설정</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">
              Client Access Token
            </label>
            <input
              type="password"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Genius API 토큰을 입력해 주세요"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
              required
            />
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              API 토큰이 있어야 가사를 검색할 수 있습니다. 입력된 키는 외부 서버로 전송되지 않고 오직 회원님의 브라우저(로컬 스토리지)에만 안전하게 보관됩니다.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-black font-bold transition-colors shadow-lg shadow-amber-500/10"
            >
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsModal;
