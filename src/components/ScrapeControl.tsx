import type { ScrapeProgress } from '../types';

interface ScrapeControlProps {
  progress: ScrapeProgress;
  onStartScrape: () => void;
  onCancelScrape: () => void;
}

function ScrapeControl({ progress, onStartScrape, onCancelScrape }: ScrapeControlProps) {
  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="glass-card p-4 bg-white/5 border border-white/5 rounded-xl shadow-lg">
      {progress.isRunning ? (
        // 스크래핑 진행 중인 화면
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300 flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-glow-pulse" />
              가사 레퍼런스 실시간 수집 중...
            </span>
            <span className="text-amber-400 font-heading font-bold text-base">{percentage}%</span>
          </div>

          {/* 프로그레스 바 영역 */}
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="truncate max-w-md">
              수집 중: ({progress.current}/{progress.total}) · <span className="text-gray-200">{progress.currentSong}</span>
            </span>
            
            {/* 스크래핑 중단 버튼 */}
            <button
              onClick={onCancelScrape}
              className="px-2.5 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md font-bold transition-all"
            >
              🛑 수집 중단
            </button>
          </div>
        </div>
      ) : (
        // 대기 상태 화면
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">레퍼런스 가사 스크래퍼</h4>
            <p className="text-xs text-gray-500">
              목록에 표시된 모든 참조곡(가사 미수집 건)을 검색하여 가사 본문을 자동으로 수집합니다.
            </p>
          </div>
          <button
            onClick={onStartScrape}
            className="btn-amber text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-500/10 flex-shrink-0"
          >
            🚀 전체 가사 수집 시작
          </button>
        </div>
      )}
    </div>
  );
}

export default ScrapeControl;
