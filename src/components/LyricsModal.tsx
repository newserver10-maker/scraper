import { useState, useEffect } from 'react';
import type { Track, LyricsData } from '../types';

interface LyricsModalProps {
  trackNumber: number | null;
  tracks: Track[];
  localCache: Record<string, LyricsData>;
  onClose: () => void;
  onScrapeTrack: (trackNum: number) => Promise<void>;
}

function LyricsModal({
  trackNumber,
  tracks,
  localCache,
  onClose,
  onScrapeTrack
}: LyricsModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isScraping, setIsScraping] = useState(false);

  // 트랙 변경 시 탭 인덱스 0으로 초기화
  useEffect(() => {
    setActiveTab(0);
  }, [trackNumber]);

  if (trackNumber === null) return null;

  const track = tracks.find((t) => t.number === trackNumber);
  if (!track) return null;

  // 3개 레퍼런스 곡 각각에 대한 수집 상태 데이터 목록
  const songLyricsList: LyricsData[] = track.references.map((ref, idx) => {
    const key = `${trackNumber}-${idx}`;
    const entry = localCache[key];

    return {
      artist: ref.artist,
      title: ref.title,
      lyrics: entry?.lyrics ?? null,
      geniusUrl: entry?.geniusUrl ?? null,
      scrapedAt: entry?.scrapedAt ?? null,
      error: entry?.error ?? null,
    };
  });

  // 개별 트랙 스크래핑 실행 핸들러
  const handleScrapeTrack = async () => {
    setIsScraping(true);
    try {
      await onScrapeTrack(trackNumber);
    } catch (err) {
      console.error('개별 트랙 가사 수집 실패:', err);
    } finally {
      setIsScraping(false);
    }
  };

  const currentLyrics = songLyricsList[activeTab] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-enter"
      onClick={onClose}
    >
      <div
        className="
          glass-card glow-amber
          w-full max-w-3xl max-h-[85vh]
          flex flex-col
          bg-night-800/90 backdrop-blur-xl
          border-amber-500/20
          rounded-xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더: 트랙 번호 및 제목 */}
        <div className="flex flex-shrink-0 items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="font-heading font-bold text-xl text-white">
              Track {String(track.number).padStart(2, '0')}: {track.titleKo}
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              {track.genre} · {track.bpm} BPM
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 탭 바: 3개 레퍼런스 곡 전환 */}
        {songLyricsList.length > 0 && (
          <div className="flex flex-shrink-0 border-b border-white/5 px-5 overflow-x-auto">
            {songLyricsList.map((data, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`
                  flex-shrink-0 px-4 py-3 text-sm font-medium transition-all duration-300
                  border-b-2 -mb-px
                  ${activeTab === i
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }
                `}
              >
                {data.artist} — {data.title}
              </button>
            ))}
          </div>
        )}

        {/* 가사 출력 콘텐트 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {currentLyrics === null ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-4">📝</p>
              <p className="font-heading">곡 정보가 없습니다.</p>
            </div>
          ) : currentLyrics.error ? (
            // 스크래핑 에러 상황 처리
            <div className="text-center py-16">
              <p className="text-4xl mb-4">⚠️</p>
              <p className="text-red-400 font-medium mb-2">가사 수집 오류</p>
              <p className="text-xs text-red-400/70 mb-6">{currentLyrics.error}</p>
              <button
                onClick={handleScrapeTrack}
                disabled={isScraping}
                className="btn-amber text-xs font-semibold"
              >
                {isScraping ? '다시 스크래핑 중...' : '가사 다시 수집하기'}
              </button>
            </div>
          ) : currentLyrics.lyrics ? (
            // 성공 가사 출력
            <div className="whitespace-pre-wrap text-gray-300 leading-relaxed text-sm font-body">
              {currentLyrics.lyrics}
            </div>
          ) : (
            // 미수집된 상태
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🌙</p>
              <p className="text-gray-400 font-heading mb-2">아직 가사가 수집되지 않았습니다</p>
              <p className="text-xs text-gray-500 mb-6">
                Genius API를 통해 이 트랙의 3곡 가사를 수집할까요?
              </p>
              <button
                onClick={handleScrapeTrack}
                disabled={isScraping}
                className="btn-amber text-xs font-semibold"
              >
                {isScraping ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    가사 스크래핑 중...
                  </span>
                ) : (
                  '🚀 이 트랙 가사 수집하기'
                )}
              </button>
            </div>
          )}
        </div>

        {/* 푸터: 링크 및 단일 다운로드 */}
        {currentLyrics?.lyrics && (
          <div className="flex flex-shrink-0 items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
            {currentLyrics.geniusUrl ? (
              <a
                href={currentLyrics.geniusUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                🔗 Genius 가사 페이지 바로가기
              </a>
            ) : (
              <span />
            )}
            <button
              onClick={() => {
                const blob = new Blob(
                  [`[${currentLyrics.artist} — ${currentLyrics.title}]\n\n${currentLyrics.lyrics}`],
                  { type: 'text/plain;charset=utf-8' }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentLyrics.artist} - ${currentLyrics.title}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            >
              💾 파일 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LyricsModal;
