import type { TrackWithStatus } from '../types';

interface TrackCardProps {
  track: TrackWithStatus;
  onClick: () => void;
}

// 언어별 국기 이모지 매핑 — 참조곡의 출처를 직관적으로 구분
const FLAG_MAP: Record<string, string> = {
  ko: '🇰🇷',
  en: '🇬🇧',
  is: '🇮🇸',
};

// 수집 상태별 뱃지 설정 — 색상과 텍스트를 한 곳에서 관리
const STATUS_CONFIG = {
  none: {
    label: '미수집',
    className: 'bg-gray-500/20 text-gray-400',
  },
  partial: {
    label: '일부 수집',
    className: 'bg-amber-500/20 text-amber-400',
  },
  complete: {
    label: '수집 완료 ✓',
    className: 'bg-emerald-500/20 text-emerald-400',
  },
} as const;

function TrackCard({ track, onClick }: TrackCardProps) {
  const status = STATUS_CONFIG[track.scrapeStatus];

  return (
    <button
      onClick={onClick}
      className="
        glass-card glass-card-hover hover-float
        p-5 text-left w-full
        cursor-pointer group
        animate-enter
      "
    >
      {/* 상단: 트랙 번호 뱃지 + 장르 태그 */}
      <div className="flex items-center justify-between mb-3">
        <span className="
          inline-flex items-center justify-center
          w-8 h-8 rounded-lg
          bg-amber-500/15 text-amber-400
          font-heading font-bold text-sm
        ">
          {String(track.number).padStart(2, '0')}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-gray-400">
          {track.genre}
        </span>
      </div>

      {/* 제목 — 한국어(메인) + 영어(서브) */}
      <h3 className="font-heading font-semibold text-lg text-white mb-0.5 group-hover:text-amber-300 transition-colors">
        {track.titleKo}
      </h3>
      <p className="text-xs text-gray-500 mb-3">{track.titleEn}</p>

      {/* BPM 표시 — 곡의 템포를 빠르게 파악하기 위해 */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">BPM</span>
        <span className="text-sm font-medium text-gray-300">{track.bpm}</span>
      </div>

      {/* 참조곡 리스트 — 최대 3개까지 표시 */}
      <div className="space-y-1.5 mb-4">
        {track.references.map((ref, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-gray-400"
          >
            <span className="text-sm flex-shrink-0">{FLAG_MAP[ref.language] ?? '🌐'}</span>
            <span className="truncate">
              {ref.artist} — {ref.title}
            </span>
          </div>
        ))}
      </div>

      {/* 하단: 수집 상태 뱃지 */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.className}`}>
          {track.scrapeStatus === 'partial'
            ? `${status.label} (${track.lyricsCount}/${track.references.length})`
            : status.label}
        </span>
      </div>
    </button>
  );
}

export default TrackCard;
