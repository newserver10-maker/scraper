// 참조곡 정보 — 가사를 스크래핑할 개별 곡 단위
export interface Song {
  artist: string;
  title: string;
  language: 'ko' | 'en' | 'is'; // 한국어 / 영어 / 아이슬란드어
}

// 트랙 정보 — 앨범 내 하나의 트랙과 그에 연결된 참조곡 목록
export interface Track {
  number: number;
  titleKo: string;
  titleEn: string;
  block: 'A' | 'B' | 'C' | 'D'; // 앨범을 4개 블록으로 구조화
  genre: string;
  bpm: number;
  references: Song[];
}

// 스크래핑된 가사 데이터 — Genius API 응답을 정규화한 구조
export interface LyricsData {
  artist: string;
  title: string;
  lyrics: string | null;
  geniusUrl: string | null;
  scrapedAt: string | null;
  error: string | null; // 실패 시 에러 메시지 보존 — 디버깅용
  isManual?: boolean;   // 사용자가 수동으로 입력/편집한 가사인지 여부
}

// 트랙 + 수집 상태 — UI에서 진행 상황을 시각적으로 표시하기 위한 확장 타입
export interface TrackWithStatus extends Track {
  scrapeStatus: 'none' | 'partial' | 'complete';
  lyricsCount: number; // 해당 트랙의 참조곡 중 수집 완료된 곡 수
}

// 스크래핑 진행 상태 — 전체 스크래핑 실행 시 실시간 UI 업데이트용
export interface ScrapeProgress {
  current: number;
  total: number;
  currentSong: string; // 현재 처리 중인 곡 이름 — UX를 위해 표시
  isRunning: boolean;
}
