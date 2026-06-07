import { useState, useEffect, useCallback, useRef } from 'react';
import type { Track, TrackWithStatus, ScrapeProgress } from './types';
import { defaultTracks } from './data/defaultTracks';
import BlockNav from './components/BlockNav';
import TrackCard from './components/TrackCard';
import LyricsModal from './components/LyricsModal';
import ScrapeControl from './components/ScrapeControl';
import DownloadPanel from './components/DownloadPanel';
import SettingsModal from './components/SettingsModal';
import { parsePlaylistText } from './utils/parser';
import {
  getGeniusToken,
  saveGeniusToken,
  loadLocalCache,
  saveLocalCache,
  scrapeSongLyricsClient,
  type ClientLyricsCache
} from './utils/clientScraper';

function App() {
  // === 상태 관리 ===
  const [tracks, setTracks] = useState<Track[]>([]);
  const [localCache, setLocalCache] = useState<ClientLyricsCache>({});
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null);
  const [activeBlock, setActiveBlock] = useState<string>('all');
  
  // UI 컨트롤 상태
  const [showDownload, setShowDownload] = useState(false);
  const [exportFormat, setExportFormat] = useState<'md' | 'txt' | 'json' | 'pdf'>('md');
  const [showSettings, setShowSettings] = useState(false);
  const [geniusToken, setGeniusToken] = useState<string>('');
  
  // 동적 기획안 업로드 입력 제어
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [inputText, setInputText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 스크래핑 진행 상태
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress>({
    current: 0,
    total: 0,
    currentSong: '',
    isRunning: false,
  });

  // 스크래핑 중단 제어용 ref
  const cancelScrapeRef = useRef<boolean>(false);

  // === 초기화 (로컬 데이터 로드) ===
  useEffect(() => {
    // 1. Genius 토큰 로드
    const savedToken = getGeniusToken();
    setGeniusToken(savedToken);
    
    // 만약 토큰이 없다면 설정창을 처음에 띄워 유도합니다.
    if (!savedToken) {
      setShowSettings(true);
    }

    // 2. 로컬 가사 캐시 로드
    const cache = loadLocalCache();
    setLocalCache(cache);

    // 3. 트랙 데이터 로드 (로컬 스토리지 우선, 없을 시 기본 리스트)
    const savedTracks = localStorage.getItem('custom_tracks');
    if (savedTracks) {
      try {
        setTracks(JSON.parse(savedTracks));
      } catch {
        setTracks(defaultTracks);
      }
    } else {
      setTracks(defaultTracks);
    }
  }, []);

  // === Genius API 토큰 저장 ===
  const handleSaveToken = (newToken: string) => {
    setGeniusToken(newToken);
    saveGeniusToken(newToken);
  };

  // === 동적 기획안 파싱 및 적용 ===
  const handleApplyCustomPlan = () => {
    if (!inputText.trim()) {
      setUploadError('기획안 텍스트를 입력해 주세요.');
      return;
    }

    try {
      const parsedTracks = parsePlaylistText(inputText);
      if (parsedTracks.length === 0) {
        throw new Error('텍스트에서 유효한 Track 정보를 추출할 수 없었습니다. 형식을 확인해 주세요.');
      }

      setTracks(parsedTracks);
      localStorage.setItem('custom_tracks', JSON.stringify(parsedTracks));
      setUploadError(null);
      setInputText('');
      setShowUploadArea(false);
      alert(`성공적으로 ${parsedTracks.length}개의 트랙 정보를 추출하여 로드했습니다!`);
    } catch (err) {
      setUploadError((err as Error).message);
    }
  };

  // === 기획안 초기화 (기본 야간비행 20트랙으로 복구) ===
  const handleResetToDefault = () => {
    if (window.confirm('원래의 [야간비행] 20개 트랙 리스트로 복구하시겠습니까? (수집된 가사 데이터는 보존됩니다)')) {
      setTracks(defaultTracks);
      localStorage.removeItem('custom_tracks');
      setShowUploadArea(false);
    }
  };

  // === 파일 드롭/업로드 처리 ===
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file);
  };

  // === 전체 가사 스크래핑 루프 (브라우저 상에서 직접 구동) ===
  const handleStartScrape = async () => {
    if (!geniusToken) {
      alert('가사를 스크래핑하기 위해 먼저 설정 버튼을 눌러 Genius API 토큰을 등록해 주세요.');
      setShowSettings(true);
      return;
    }

    if (scrapeProgress.isRunning) return;

    // 수집 대상 큐 작성
    const queue: Array<{ trackNum: number; songIdx: number; artist: string; title: string }> = [];
    tracks.forEach((track) => {
      track.references.forEach((ref, idx) => {
        const key = `${track.number}-${idx}`;
        // 아직 가사가 없거나 스크래핑 에러가 난 곡들만 필터링하여 수집
        if (!localCache[key]?.lyrics) {
          queue.push({
            trackNum: track.number,
            songIdx: idx,
            artist: ref.artist,
            title: ref.title,
          });
        }
      });
    });

    if (queue.length === 0) {
      if (!window.confirm('이미 모든 가사가 수집되어 있습니다. 전체를 덮어쓰고 재수집하시겠습니까?')) {
        return;
      }
      // 전체 재수집 큐 생성
      tracks.forEach((track) => {
        track.references.forEach((ref, idx) => {
          queue.push({
            trackNum: track.number,
            songIdx: idx,
            artist: ref.artist,
            title: ref.title,
          });
        });
      });
    }

    cancelScrapeRef.current = false;
    setScrapeProgress({
      current: 0,
      total: queue.length,
      currentSong: '준비 중...',
      isRunning: true,
    });

    let activeCache = { ...localCache };

    for (let i = 0; i < queue.length; i++) {
      if (cancelScrapeRef.current) {
        break;
      }

      const item = queue[i];
      const label = `${item.artist} - ${item.title}`;

      setScrapeProgress({
        current: i + 1,
        total: queue.length,
        currentSong: label,
        isRunning: true,
      });

      try {
        const result = await scrapeSongLyricsClient(item.artist, item.title, geniusToken);
        const cacheKey = `${item.trackNum}-${item.songIdx}`;
        
        activeCache = {
          ...activeCache,
          [cacheKey]: {
            artist: item.artist,
            title: item.title,
            lyrics: result.lyrics,
            geniusUrl: result.url,
            scrapedAt: new Date().toISOString(),
            error: result.lyrics ? null : '가사를 찾을 수 없습니다.',
          },
        };
      } catch (err) {
        const cacheKey = `${item.trackNum}-${item.songIdx}`;
        activeCache = {
          ...activeCache,
          [cacheKey]: {
            artist: item.artist,
            title: item.title,
            lyrics: null,
            geniusUrl: null,
            scrapedAt: new Date().toISOString(),
            error: (err as Error).message,
          },
        };
      }

      // 루프 내 진행 상황 반영 및 매 단계 스토리지 백업
      setLocalCache(activeCache);
      saveLocalCache(activeCache);
    }

    setScrapeProgress((prev) => ({ ...prev, isRunning: false }));
    alert(cancelScrapeRef.current ? '스크래핑이 중단되었습니다.' : '스크래핑이 모두 완료되었습니다!');
  };

  // 스크래핑 강제 중지
  const handleCancelScrape = () => {
    cancelScrapeRef.current = true;
    setScrapeProgress((prev) => ({ ...prev, isRunning: false }));
  };

  // === 개별 트랙 스크래핑 함수 (모달과 직접 바인딩됨) ===
  const handleScrapeSingleTrack = async (trackNum: number) => {
    if (!geniusToken) {
      alert('Genius API 토큰을 먼저 설정해 주세요.');
      setShowSettings(true);
      return;
    }

    const track = tracks.find((t) => t.number === trackNum);
    if (!track) return;

    let activeCache = { ...localCache };

    for (let idx = 0; idx < track.references.length; idx++) {
      const ref = track.references[idx];
      const cacheKey = `${trackNum}-${idx}`;

      try {
        const result = await scrapeSongLyricsClient(ref.artist, ref.title, geniusToken);
        activeCache = {
          ...activeCache,
          [cacheKey]: {
            artist: ref.artist,
            title: ref.title,
            lyrics: result.lyrics,
            geniusUrl: result.url,
            scrapedAt: new Date().toISOString(),
            error: result.lyrics ? null : '가사를 찾을 수 없습니다.',
          },
        };
      } catch (err) {
        activeCache = {
          ...activeCache,
          [cacheKey]: {
            artist: ref.artist,
            title: ref.title,
            lyrics: null,
            geniusUrl: null,
            scrapedAt: new Date().toISOString(),
            error: (err as Error).message,
          },
        };
      }
      setLocalCache(activeCache);
      saveLocalCache(activeCache);
    }
  };

  // === 블록 필터링 ===
  const filteredTracks = activeBlock === 'all'
    ? tracks
    : tracks.filter((t) => t.block === activeBlock);

  // === 수집 완료 통계 ===
  const completedCount = tracks.reduce((acc, t) => {
    let count = 0;
    t.references.forEach((_, idx) => {
      const key = `${t.number}-${idx}`;
      if (localCache[key]?.lyrics) count++;
    });
    return acc + count;
  }, 0);

  const totalRefCount = tracks.reduce((acc, t) => acc + t.references.length, 0);

  // === TrackWithStatus 변환 (UI 렌더러용 데이터 구성) ===
  const tracksWithStatus: TrackWithStatus[] = filteredTracks.map((track) => {
    let lyricsCount = 0;
    track.references.forEach((_, idx) => {
      const key = `${track.number}-${idx}`;
      if (localCache[key]?.lyrics) lyricsCount++;
    });

    let scrapeStatus: 'none' | 'partial' | 'complete' = 'none';
    if (lyricsCount === track.references.length) scrapeStatus = 'complete';
    else if (lyricsCount > 0) scrapeStatus = 'partial';

    return {
      ...track,
      scrapeStatus,
      lyricsCount,
    };
  });

  return (
    <div className="min-h-screen font-body bg-gradient-to-br from-[#050810] to-[#0A0E1A] text-gray-200">
      {/* 좌측 블록 내비게이션 사이드바 */}
      <BlockNav
        activeBlock={activeBlock}
        onBlockChange={setActiveBlock}
        completedCount={completedCount}
        totalCount={totalRefCount}
      />

      {/* 메인 콘텐츠 영역 */}
      <main className="ml-64 min-h-screen p-6">
        {/* 상단 헤더 영역 */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white tracking-tight flex items-center gap-2">
                ✈️ {activeBlock === 'all' ? '전체 트랙 관리' : `Block ${activeBlock} 리스트`}
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                {tracksWithStatus.length}개 트랙 · {tracksWithStatus.reduce((a, t) => a + t.references.length, 0)}개 레퍼런스 곡 수집 대상
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 기획안 동적 로드 토글 */}
              <button
                onClick={() => setShowUploadArea(!showUploadArea)}
                className="px-3.5 py-2 glass-card glass-card-hover text-xs font-semibold text-amber-400 border border-amber-500/30 rounded-lg transition-all"
              >
                📝 새 기획안 파싱
              </button>

              {/* 설정 버튼 */}
              <button
                onClick={() => setShowSettings(true)}
                className="px-3.5 py-2 glass-card glass-card-hover text-xs font-semibold text-gray-300 hover:text-white border border-white/10 rounded-lg transition-all"
              >
                ⚙️ API 설정
              </button>

              {/* 내보내기 버튼 */}
              <button
                onClick={() => setShowDownload(!showDownload)}
                className="px-3.5 py-2 glass-card glass-card-hover text-xs font-semibold text-gray-300 hover:text-amber-400 border border-white/10 rounded-lg transition-all"
              >
                📥 파일 내보내기
              </button>
            </div>
          </div>

          {/* 기획안 동적 텍스트 업로드 & 파싱 영역 */}
          {showUploadArea && (
            <div className="glass-card glow-amber p-5 mb-6 border border-amber-500/20 bg-white/5 rounded-xl space-y-4 animate-enter">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-heading font-bold text-amber-400">
                  📄 새 플레이리스트 기획안 로드 (TXT/텍스트 파싱)
                </h3>
                <button
                  onClick={handleResetToDefault}
                  className="text-xs text-red-400 hover:underline transition-colors"
                >
                  기본 야간비행 트랙으로 복구
                </button>
              </div>

              <p className="text-xs text-gray-400 leading-relaxed">
                플레이리스트 마스터 기획안 텍스트 파일(.txt)을 아래 영역에 드래그하거나 붙여넣어 주세요.<br />
                정규식 파서가 `Track XX`, `음악 장르`, `템포: XX BPM`, `가사 레퍼런스: 아티스트 - 곡명` 양식을 분석하여 실시간으로 카드 리스트를 재구축합니다.
              </p>

              <div className="flex gap-4">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="여기에 기획안 텍스트를 붙여넣어 주세요..."
                  className="flex-1 h-36 p-3 bg-[#0c1020]/80 border border-white/10 rounded-lg text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-amber-500/40"
                />
                
                <div className="w-48 flex flex-col justify-between">
                  <div className="border border-dashed border-white/10 hover:border-amber-500/30 rounded-lg p-3 text-center flex flex-col justify-center items-center h-24 cursor-pointer relative bg-white/5 transition-all">
                    <span className="text-lg mb-1">📁</span>
                    <span className="text-[10px] text-gray-500">기획안 파일 업로드</span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleApplyCustomPlan}
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/10"
                  >
                    파싱 적용하기
                  </button>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-red-400 font-medium">⚠️ {uploadError}</p>
              )}
            </div>
          )}

          {/* 스크래핑 프로그레스 제어 패널 */}
          <ScrapeControl
            progress={scrapeProgress}
            onStartScrape={handleStartScrape}
            onCancelScrape={handleCancelScrape}
          />
        </header>

        {/* 트랙 목록 그리드 */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tracksWithStatus.map((track) => (
            <TrackCard
              key={track.number}
              track={track}
              onClick={() => setSelectedTrack(track.number)}
            />
          ))}
        </section>

        {/* 로딩/공백 가이드 */}
        {tracksWithStatus.length === 0 && (
          <div className="text-center py-24 text-gray-500">
            <p className="text-4xl mb-4">✈️</p>
            <p className="font-heading text-lg">트랙 리스트가 비어 있습니다</p>
            <p className="text-xs mt-2">상단의 '새 기획안 파싱' 버튼을 눌러 기획안 텍스트를 로드해 주세요.</p>
          </div>
        )}
      </main>

      {/* 가사 모달 */}
      <LyricsModal
        trackNumber={selectedTrack}
        tracks={tracks}
        localCache={localCache}
        onClose={() => setSelectedTrack(null)}
        onScrapeTrack={handleScrapeSingleTrack}
      />

      {/* 다운로드 슬라이드업 패널 */}
      <DownloadPanel
        show={showDownload}
        format={exportFormat}
        tracks={tracks}
        localCache={localCache}
        onFormatChange={setExportFormat}
        onClose={() => setShowDownload(false)}
      />

      {/* API 설정 모달 */}
      <SettingsModal
        show={showSettings}
        onClose={() => setShowSettings(false)}
        token={geniusToken}
        onSave={handleSaveToken}
      />
    </div>
  );
}

export default App;
