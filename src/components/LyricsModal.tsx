import { useState, useEffect } from 'react';
import type { Track, LyricsData } from '../types';

interface LyricsModalProps {
  trackNumber: number | null;
  tracks: Track[];
  localCache: Record<string, LyricsData>;
  onClose: () => void;
  onScrapeTrack: (trackNum: number) => Promise<void>;
  // 수동 가사 저장 콜백 — App.tsx에서 localCache 업데이트 처리
  onManualSave?: (trackNum: number, songIdx: number, lyrics: string) => void;
}

function LyricsModal({
  trackNumber,
  tracks,
  localCache,
  onClose,
  onScrapeTrack,
  onManualSave
}: LyricsModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [isScraping, setIsScraping] = useState(false);

  // 수동 가사 입력/편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [editText, setEditText] = useState('');

  // 트랙 변경 시 탭 인덱스 및 편집 모드 초기화
  useEffect(() => {
    setActiveTab(0);
    setIsEditMode(false);
    setEditText('');
  }, [trackNumber]);

  // 탭 전환 시 편집 모드 해제
  useEffect(() => {
    setIsEditMode(false);
    setEditText('');
  }, [activeTab]);

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
      isManual: entry?.isManual ?? false,
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

  // 수동 가사 입력 모드 진입
  const handleEnterEditMode = () => {
    const current = songLyricsList[activeTab];
    setEditText(current?.lyrics || '');
    setIsEditMode(true);
  };

  // 수동 가사 저장
  const handleSaveManualLyrics = () => {
    if (!editText.trim()) {
      alert('가사 내용을 입력해 주세요.');
      return;
    }
    if (onManualSave) {
      onManualSave(trackNumber, activeTab, editText.trim());
    }
    setIsEditMode(false);
    setEditText('');
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditText('');
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
                  border-b-2 -mb-px flex items-center gap-1.5
                  ${activeTab === i
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }
                `}
              >
                {data.artist} — {data.title}
                {/* 수동 입력 배지 */}
                {data.isManual && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    수동
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 가사 출력 콘텐트 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* === 편집 모드 === */}
          {isEditMode ? (
            <div className="flex flex-col h-full gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-heading font-bold text-amber-400 flex items-center gap-2">
                  ✏️ 수동 가사 입력 / 편집
                </h3>
                <span className="text-[10px] text-gray-500">
                  {currentLyrics?.artist} — {currentLyrics?.title}
                </span>
              </div>

              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder={`여기에 "${currentLyrics?.artist} - ${currentLyrics?.title}" 가사를 붙여넣거나 직접 입력해 주세요...\n\n예시:\n[Verse 1]\n첫 번째 줄 가사\n두 번째 줄 가사\n\n[Chorus]\n후렴구 가사...`}
                className="
                  flex-1 min-h-[300px] p-4
                  bg-[#0c1020]/80 border border-white/10 rounded-lg
                  text-sm font-mono text-gray-300 placeholder-gray-600
                  leading-relaxed resize-none
                  focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20
                  transition-all
                "
                autoFocus
              />

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-500">
                  {editText.length > 0
                    ? `${editText.split('\n').length}줄 · ${editText.length}자`
                    : '가사를 입력해 주세요'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-400 hover:text-gray-200 transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveManualLyrics}
                    disabled={!editText.trim()}
                    className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-black text-xs font-bold transition-all shadow-lg shadow-emerald-500/10 disabled:shadow-none"
                  >
                    💾 가사 저장
                  </button>
                </div>
              </div>
            </div>
          ) : currentLyrics === null ? (
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
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleScrapeTrack}
                  disabled={isScraping}
                  className="btn-amber text-xs font-semibold"
                >
                  {isScraping ? '다시 스크래핑 중...' : '🔄 가사 다시 수집하기'}
                </button>
                <button
                  onClick={handleEnterEditMode}
                  className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-all"
                >
                  ✏️ 수동으로 가사 입력
                </button>
              </div>
            </div>
          ) : currentLyrics.lyrics ? (
            // 성공 가사 출력
            <div>
              {/* 수동 입력 가사 배지 */}
              {currentLyrics.isManual && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-emerald-400 text-xs">📝</span>
                  <span className="text-[11px] text-emerald-400/80 font-medium">
                    수동으로 입력된 가사입니다
                  </span>
                  {currentLyrics.scrapedAt && (
                    <span className="text-[10px] text-emerald-400/50 ml-auto">
                      {new Date(currentLyrics.scrapedAt).toLocaleString('ko-KR')}
                    </span>
                  )}
                </div>
              )}
              <div className="whitespace-pre-wrap text-gray-300 leading-relaxed text-sm font-body">
                {currentLyrics.lyrics}
              </div>
            </div>
          ) : (
            // 미수집된 상태
            <div className="text-center py-16">
              <p className="text-4xl mb-4">🌙</p>
              <p className="text-gray-400 font-heading mb-2">아직 가사가 수집되지 않았습니다</p>
              <p className="text-xs text-gray-500 mb-6">
                Genius API를 통해 이 트랙의 {track.references.length}곡 가사를 수집하거나, 수동으로 직접 입력할 수 있습니다.
              </p>
              <div className="flex flex-col items-center gap-3">
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
                <button
                  onClick={handleEnterEditMode}
                  className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-all"
                >
                  ✏️ 수동으로 가사 입력
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 푸터: 링크 및 단일 다운로드 */}
        {currentLyrics?.lyrics && !isEditMode && (
          <div className="flex flex-shrink-0 items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {currentLyrics.geniusUrl ? (
                <a
                  href={currentLyrics.geniusUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors flex items-center gap-1"
                >
                  🔗 {currentLyrics.isManual ? '원본 참조 페이지' : 'Genius 가사 페이지 바로가기'}
                </a>
              ) : (
                <span />
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 가사 편집 버튼 */}
              <button
                onClick={handleEnterEditMode}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 transition-colors"
              >
                ✏️ 가사 편집
              </button>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default LyricsModal;
