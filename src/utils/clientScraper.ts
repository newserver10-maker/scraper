import type { Song, LyricsData } from '../types';

// Genius API 상수
const GENIUS_API_BASE = 'https://api.genius.com';

// === 유사도 검증 유틸리티 ===

/**
 * 비교를 위한 문자열 정규화
 * WHY: 괄호 부제, 특수문자, feat. 표기 등이 검색 결과 매칭을 방해하므로
 *      비교 전에 모든 노이즈를 제거하여 핵심 키워드만 남깁니다.
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/\(.*?\)/g, '')          // 괄호와 그 내용 제거 (부제/영문명)
    .replace(/\[.*?\]/g, '')          // 대괄호와 그 내용 제거
    .replace(/feat\.?.*$/i, '')       // feat. 이후 전부 제거
    .replace(/ft\.?.*$/i, '')         // ft. 이후 전부 제거
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '') // 특수문자 제거 (한글/영문/숫자/공백만 보존)
    .replace(/\s+/g, ' ')            // 연속 공백 정리
    .trim();
}

/**
 * 문자열을 공백 기준 토큰 집합으로 분리
 */
function tokenize(str: string): Set<string> {
  const normalized = normalizeForComparison(str);
  return new Set(normalized.split(' ').filter(Boolean));
}

/**
 * Jaccard 유사도 계산: 두 문자열의 토큰 교집합 / 합집합 비율
 * WHY: 단순 문자열 일치(===)는 표기 변형에 취약하고, 편집 거리는 한글/영문 혼합에서
 *      불안정하므로, 의미 단위(단어 토큰)의 겹침 비율로 유사도를 측정합니다.
 * @returns 0.0 (완전 불일치) ~ 1.0 (완전 일치)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const tokens1 = tokenize(str1);
  const tokens2 = tokenize(str2);

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersectionSize = 0;
  tokens1.forEach((token) => {
    if (tokens2.has(token)) intersectionSize++;
  });

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return intersectionSize / unionSize;
}

/**
 * 부분 포함 기반 유사도 (보조 판단)
 * WHY: "검정치마"를 Genius가 "The Black Skirts"로 반환하면 토큰 겹침이 0이지만,
 *      아티스트 이름 자체가 결과의 일부에 포함되어 있는 경우를 커버하기 위함.
 */
function containsSubstring(query: string, target: string): boolean {
  const q = normalizeForComparison(query);
  const t = normalizeForComparison(target);
  return t.includes(q) || q.includes(t);
}

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
  
  // WHY: 유사도 판정 임계값 0.3 — 이보다 낮으면 완전히 다른 곡으로 간주
  //      토큰 기반 Jaccard이므로 아티스트명 한 단어만 일치해도 ~0.3 정도 나옵니다.
  const SIMILARITY_THRESHOLD = 0.3;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Genius API 검색 프록시 실패: ${response.statusText}`);
    }

    const data = await response.json();
    const hits = data?.response?.hits;
    if (!hits || hits.length === 0) return null;

    // 상위 5개 결과를 대상으로 유사도 비교 후 최적 결과 선택
    // WHY: hits[0]만 사용하면 "오존 - Down" 검색 시 "Jay Sean - Down" 같은
    //      인기곡이 먼저 올라와 엉뚱한 가사를 수집하는 문제가 발생합니다.
    const candidates = hits.slice(0, 5);
    let bestMatch: typeof hits[0]['result'] | null = null;
    let bestScore = -1;

    for (const hit of candidates) {
      const result = hit.result;
      const resultArtist = result.primary_artist?.name ?? '';
      const resultTitle = result.title ?? '';

      // 아티스트 유사도와 곡명 유사도를 각각 계산 후 가중 합산
      const artistSim = calculateSimilarity(artist, resultArtist);
      const titleSim = calculateSimilarity(title, resultTitle);
      
      // 부분 문자열 포함 여부로 보너스 점수 부여 (한국 아티스트명 대응)
      // WHY: 한국 아티스트가 Genius에 영문/한글 혼용으로 등록되어 있을 수 있으므로
      //      토큰 매칭이 안 돼도 부분 포함이면 가산합니다.
      const artistContains = containsSubstring(artist, resultArtist) ? 0.3 : 0;
      const titleContains = containsSubstring(title, resultTitle) ? 0.3 : 0;

      // 아티스트(40%) + 곡명(60%) 가중치 — 곡명이 더 중요
      const combinedScore = Math.max(
        artistSim * 0.4 + titleSim * 0.6,
        artistContains * 0.4 + titleContains * 0.6
      );

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestMatch = result;
      }
    }

    // 임계값 미달 시 null 반환 — 엉뚱한 곡 매칭 방지
    if (!bestMatch || bestScore < SIMILARITY_THRESHOLD) {
      console.warn(
        `[유사도 미달] "${query}" → 최고 점수 ${bestScore.toFixed(2)} (임계값 ${SIMILARITY_THRESHOLD})`
      );
      return null;
    }

    console.log(
      `[검색 매칭] "${query}" → "${bestMatch.primary_artist?.name} - ${bestMatch.title}" (점수: ${bestScore.toFixed(2)})`
    );

    return {
      id: bestMatch.id,
      url: bestMatch.url,
      artist: bestMatch.primary_artist?.name ?? artist,
      title: bestMatch.title
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
 * WHY: 한국 음악의 경우 괄호 안 영문명, 한글명, 혼합명이 모두 Genius에 다르게 등록되어
 *      있으므로 다단계 검색 전략으로 최대한 많은 곡을 찾아냅니다.
 */
export async function scrapeSongLyricsClient(
  artist: string,
  title: string,
  token: string
): Promise<{ lyrics: string | null; url: string | null }> {
  const englishNameMatch = artist.match(/\(([^)]+)\)/);
  const englishTitle = title.match(/\(([^)]+)\)/);
  
  // 괄호를 제거한 순수 아티스트명/곡명 (2차 검색용)
  const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim();
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim();

  let searchResult = null;

  // 1차: 괄호 안 영문명이 있으면 그걸로 검색 시도
  // WHY: Genius에 영문명으로 등록된 한국 아티스트가 많으므로 가장 먼저 시도
  if (englishNameMatch) {
    const engArtist = englishNameMatch[1];
    const engTitle = englishTitle ? englishTitle[1] : cleanTitle;
    searchResult = await searchSongClient(engArtist, engTitle, token);
    await delay(1000);
  }

  // 2차: 괄호를 제거한 순수 아티스트명 + 순수 곡명으로 검색
  // WHY: 1차 실패 시, "오존 (O3ohn)"에서 "오존"만 추출하여 검색하면
  //      Genius의 한글 인식 결과를 활용할 수 있습니다.
  if (!searchResult && cleanArtist) {
    searchResult = await searchSongClient(cleanArtist, cleanTitle, token);
    await delay(1000);
  }

  // 3차: 원본 문자열 전체를 그대로 검색 (괄호 포함)
  // WHY: "검정치마 - 섬 (Island)"처럼 괄호 안 부제가 Genius 곡명과
  //      더 정확히 매칭되는 경우가 있으므로 최후의 폴백으로 사용
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
