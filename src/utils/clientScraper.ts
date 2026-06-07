import type { Song, LyricsData } from '../types';

// Genius API 상수
const GENIUS_API_BASE = 'https://api.genius.com';

// 요청 간 딜레이 함수 (과다 요청 방지)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 로컬스토리지에서 Genius API 토큰 가져오기
 */
export function getGeniusToken(): string {
  return localStorage.getItem('genius_api_token') || '';
}

/**
 * 로컬스토리지에 Genius API 토큰 저장하기
 */
export function saveGeniusToken(token: string): void {
  localStorage.setItem('genius_api_token', token.trim());
}

/**
 * Genius API를 통해 곡 검색
 * WHY: 브라우저 단독 환경이므로 fetch API를 사용하며,
 *      한국어 곡의 경우 영문 아티스트명으로 먼저 검색한 후 실패 시 원본 검색
 */
export async function searchSongClient(
  artist: string,
  title: string,
  token: string
): Promise<{ id: number; url: string; artist: string; title: string } | null> {
  if (!token) {
    throw new Error('Genius API 토큰이 설정되지 않았습니다. 설정 패널에서 토큰을 입력해 주세요.');
  }

  const query = `${artist} ${title}`;
  
  try {
    const response = await fetch(`${GENIUS_API_BASE}/search?q=${encodeURIComponent(query)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Genius API 검색 실패: ${response.statusText}`);
    }

    const data = await response.json();
    const hits = data?.response?.hits;
    if (!hits || hits.length === 0) return null;

    const bestHit = hits[0].result;
    return {
      id: bestHit.id,
      url: bestHit.url,
      artist: bestHit.primary_artist?.name ?? artist,
      title: bestHit.title
    };
  } catch (error) {
    console.error(`[검색 실패] "${query}":`, error);
    return null;
  }
}

/**
 * AllOrigins CORS 프록시를 통해 가사 페이지 HTML을 긁어와 브라우저 DOMParser로 파싱
 * WHY: 브라우저 환경에서는 Genius 가사 페이지의 CORS 보안 제한에 걸리므로
 *      무료 CORS 프록시 서비스인 AllOrigins를 경유하여 HTML 콘텐츠를 안전하게 획득
 */
export async function fetchLyricsFromUrlClient(url: string): Promise<string> {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`CORS 프록시 연결 실패: ${response.statusText}`);
    }

    const data = await response.json();
    const html = data.contents; // AllOrigins는 HTML 콘텐츠를contents 필드에 반환함
    
    if (!html) {
      throw new Error('프록시로부터 페이지 데이터를 받아오지 못했습니다.');
    }

    // 브라우저 DOMParser를 이용한 가사 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]');

    if (containers.length === 0) {
      throw new Error('Genius 가사 레이아웃을 찾을 수 없습니다.');
    }

    let lyricsText = '';
    containers.forEach((container) => {
      // <br> 태그를 줄바꿈 문자(\n)로 가공하여 줄 구분을 유지합니다.
      const clone = container.cloneNode(true) as HTMLElement;
      const brs = clone.querySelectorAll('br');
      brs.forEach((br) => {
        br.parentNode?.replaceChild(doc.createTextNode('\n'), br);
      });
      lyricsText += clone.textContent + '\n';
    });

    return lyricsText.trim();
  } catch (error) {
    throw new Error(`가사 페이지 파싱 실패: ${(error as Error).message}`);
  }
}

/**
 * 클라이언트용 곡 검색 + 가사 추출 통합 함수
 */
export async function scrapeSongLyricsClient(
  artist: string,
  title: string,
  token: string
): Promise<{ lyrics: string | null; url: string | null }> {
  const englishNameMatch = artist.match(/\(([^)]+)\)/);
  const englishTitle = title.match(/\(([^)]+)\)/);

  let searchResult = null;

  // 1차: 괄호 안 영문명이 있으면 그걸로 검색 시도
  if (englishNameMatch) {
    const engArtist = englishNameMatch[1];
    const engTitle = englishTitle ? englishTitle[1] : title;
    searchResult = await searchSongClient(engArtist, engTitle, token);
    await delay(1000); // 레이트 리밋 준수
  }

  // 2차: 실패 시 원본 한글명으로 검색 시도
  if (!searchResult) {
    searchResult = await searchSongClient(artist, title, token);
    await delay(1000);
  }

  if (!searchResult) {
    return { lyrics: null, url: null };
  }

  // 가사 파싱
  const lyrics = await fetchLyricsFromUrlClient(searchResult.url);
  return { lyrics, url: searchResult.url };
}

// === 로컬 스토리지 캐시 인터페이스 ===
export interface ClientLyricsCache {
  [key: string]: LyricsData;
}

/**
 * 로컬스토리지에서 캐싱된 가사 데이터 로드
 */
export function loadLocalCache(): ClientLyricsCache {
  try {
    const data = localStorage.getItem('lyrics_cache');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/**
 * 로컬스토리지에 캐싱된 가사 데이터 저장
 */
export function saveLocalCache(cache: ClientLyricsCache): void {
  localStorage.setItem('lyrics_cache', JSON.stringify(cache));
}
