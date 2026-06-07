import type { Song, LyricsData } from '../types';

// Genius API 상수
const GENIUS_API_BASE = 'https://api.genius.com';

// 요청 간 딜레이 함수
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
 * WHY: 브라우저 환경에서는 Genius API 직접 호출 시 CORS 에러가 발생하므로,
 *      corsproxy.io 프록시를 통해 우회합니다. corsproxy.io는 원본 JSON 응답을
 *      그대로 반환하므로 JSON.parse(contents) 과정 없이 직접 가용이 가능하여 빠르고 안전합니다.
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
  // access_token을 URL 쿼리 파라미터에 포함하여 CORS 프록시를 태웁니다.
  const targetUrl = `${GENIUS_API_BASE}/search?q=${encodeURIComponent(query)}&access_token=${token}`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Genius API 검색 프록시 실패: ${response.statusText}`);
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
 * CORS 프록시(corsproxy.io)를 통해 가사 페이지 HTML을 긁어와 브라우저 DOMParser로 파싱
 * WHY: corsproxy.io는 타겟 주소의 원본 HTML을 그대로 반환하며 CORS 헤더만 교정해주므로
 *      가장 빠르고 챌린지 차단 우회율이 높습니다.
 */
export async function fetchLyricsFromUrlClient(url: string): Promise<string> {
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`CORS 프록시 연결 실패: ${response.statusText}`);
    }

    const html = await response.text();
    if (!html) {
      throw new Error('프록시로부터 페이지 HTML을 받아오지 못했습니다.');
    }

    // 브라우저 DOMParser를 이용한 가사 파싱
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Genius 가사 본문 영역 셀렉터
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]');

    if (containers.length === 0) {
      // 대체 셀렉터 지원 (간혹 지니어스 레이아웃 변경 대응)
      const altContainer = doc.querySelector('.lyrics') || doc.querySelector('[class^="Lyrics__Container"]');
      if (!altContainer) {
        // Cloudflare 로봇 차단 검출 및 피드백 제공
        if (html.includes('Cloudflare') || html.includes('captcha') || html.includes('Security')) {
          throw new Error('Genius 서버의 자동 로봇 차단(Cloudflare 챌린지)에 걸렸습니다. 브라우저에서 직접 Genius 웹사이트에 한 번 방문한 뒤 다시 스크래핑을 시도해 보세요.');
        }
        throw new Error('가사 텍스트 영역을 찾을 수 없습니다.');
      }
      
      const clone = altContainer.cloneNode(true) as HTMLElement;
      const brs = clone.querySelectorAll('br');
      brs.forEach((br) => {
        br.parentNode?.replaceChild(doc.createTextNode('\n'), br);
      });
      return clone.textContent?.trim() || '';
    }

    let lyricsText = '';
    containers.forEach((container) => {
      // <br> 태그를 줄바꿈 문자(\n)로 가공
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
    await delay(1000);
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
