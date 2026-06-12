import type { Song, LyricsData } from '../types';

// Genius API 상수
const GENIUS_API_BASE = 'https://api.genius.com';

// === 한영 아티스트 번역 맵 ===
// WHY: Genius에는 한국 아티스트가 영문명으로만 등록되어 있거나, 한글/영문 혼용으로 
//      등록되어 있어 단순 토큰 매칭이 불가능한 경우가 많으므로 하드코딩 매핑 사전을 둡니다.
const ARTIST_TRANSLATION_MAP: Record<string, string[]> = {
  '검정치마': ['the black skirts', 'black skirts'],
  '오존': ['o3ohn'],
  '아이유': ['iu'],
  '백예린': ['yerin baek', 'baek yerin'],
  '혁오': ['hyukoh'],
  '잔나비': ['jannabi'],
  '볼빨간사춘기': ['bolbbalgan4', 'bol4', 'bolbbalgan puberty'],
  '방탄소년단': ['bts'],
  '적재': ['jukjae'],
  '이소라': ['lee sora', 'lee so ra'],
  '10cm': ['십센치'],
  '선우정아': ['sunwoojunga', 'sunwoo junga'],
  '새소년': ['se so neon', 'sesoneon'],
  '기리보이': ['giriboy'],
  '우원재': ['woo', 'woo won jae'],
  '카더가든': ['car the garden'],
  '자이언티': ['zion.t', 'zion t'],
  '크러쉬': ['crush'],
  '태연': ['taeyeon'],
  '악뮤': ['akmu', 'akdong musician', '악동뮤지션'],
};

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

/**
 * 두 아티스트가 동일인인지 엄격히 판정
 * WHY: 아티스트가 아예 다른데 곡명만 같다는 이유로 엉뚱한 가사를 긁어오는 문제를 
 *      방지하기 위해, 한글/영문 대응, Jaccard 유사도, 공백 제거 일치 여부를 복합 검증합니다.
 */
function checkArtistMatch(queryArtist: string, resultArtist: string, originalArtist: string = ''): boolean {
  const qClean = normalizeForComparison(queryArtist);
  const rClean = normalizeForComparison(resultArtist);
  const origClean = originalArtist ? normalizeForComparison(originalArtist) : '';

  const qNoSpace = qClean.replace(/\s+/g, '');
  const rNoSpace = rClean.replace(/\s+/g, '');
  const origNoSpace = origClean.replace(/\s+/g, '');

  // 1. 공백 제거 후 완전 일치 또는 포함 관계
  if (qNoSpace === rNoSpace || (origNoSpace && origNoSpace.includes(rNoSpace)) || rNoSpace.includes(qNoSpace)) {
    return true;
  }

  // 2. Jaccard 유사도 확인
  const similarityWithQuery = calculateSimilarity(queryArtist, resultArtist);
  const similarityWithOrig = originalArtist ? calculateSimilarity(originalArtist, resultArtist) : 0;
  if (similarityWithQuery >= 0.4 || similarityWithOrig >= 0.4) {
    return true;
  }

  // 3. 번역 맵 매칭 확인 (예: 검정치마 <-> The Black Skirts)
  const keys = Object.keys(ARTIST_TRANSLATION_MAP);
  for (const key of keys) {
    const keyClean = normalizeForComparison(key).replace(/\s+/g, '');
    const values = ARTIST_TRANSLATION_MAP[key].map(v => normalizeForComparison(v).replace(/\s+/g, ''));

    // 검색어나 원본에 한글명이 있고 결과가 영문명에 매핑되는 경우
    const inputMatchesKey = qNoSpace.includes(keyClean) || (origNoSpace && origNoSpace.includes(keyClean));
    const resultMatchesValue = values.some(val => rNoSpace.includes(val) || val.includes(rNoSpace));

    if (inputMatchesKey && resultMatchesValue) {
      return true;
    }

    // 그 반대인 경우 (검색어에 영문명이 있고 결과가 한글명에 매핑되는 경우)
    const inputMatchesValue = values.some(val => qNoSpace.includes(val) || (origNoSpace && origNoSpace.includes(val)));
    const resultMatchesKey = rNoSpace.includes(keyClean) || keyClean.includes(rNoSpace);

    if (inputMatchesValue && resultMatchesKey) {
      return true;
    }
  }

  // 4. 부분 문자열 포함 관계 (최소 2글자 이상 일치 필요, '오' 같은 1글자 매칭 방지)
  if (qClean.length >= 2 && rClean.length >= 2) {
    if (qClean.includes(rClean) || rClean.includes(qClean)) {
      return true;
    }
  }
  if (origClean.length >= 2 && rClean.length >= 2) {
    if (origClean.includes(rClean) || rClean.includes(origClean)) {
      return true;
    }
  }

  return false;
}

/**
 * 곡명이 일치하는지 엄격히 판정
 * WHY: 아티스트는 일치하더라도 아예 다른 트랙의 가사를 긁어오는 문제를 방지합니다.
 */
function checkTitleMatch(queryTitle: string, resultTitle: string, originalTitle: string = ''): boolean {
  const qClean = normalizeForComparison(queryTitle);
  const rClean = normalizeForComparison(resultTitle);
  const origClean = originalTitle ? normalizeForComparison(originalTitle) : '';

  const qNoSpace = qClean.replace(/\s+/g, '');
  const rNoSpace = rClean.replace(/\s+/g, '');
  const origNoSpace = origClean.replace(/\s+/g, '');

  // 1. 공백 제거 후 완전 일치
  if (qNoSpace === rNoSpace || (origNoSpace && origNoSpace.includes(rNoSpace)) || rNoSpace.includes(qNoSpace)) {
    return true;
  }

  // 2. Jaccard 유사도 확인 (곡명은 0.35 이상)
  const similarityWithQuery = calculateSimilarity(queryTitle, resultTitle);
  const similarityWithOrig = originalTitle ? calculateSimilarity(originalTitle, resultTitle) : 0;
  if (similarityWithQuery >= 0.35 || similarityWithOrig >= 0.35) {
    return true;
  }

  // 3. 부분 문자열 포함 관계 (최소 2글자 이상 일치)
  if (qClean.length >= 2 && rClean.length >= 2) {
    if (qClean.includes(rClean) || rClean.includes(qClean)) {
      return true;
    }
  }
  if (origClean.length >= 2 && rClean.length >= 2) {
    if (origClean.includes(rClean) || rClean.includes(origClean)) {
      return true;
    }
  }

  return false;
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
  token: string,
  originalArtist?: string,
  originalTitle?: string
): Promise<{ id: number; url: string; artist: string; title: string } | null> {
  if (!token) {
    throw new Error('Genius API 토큰이 설정되지 않았습니다. 설정 패널에서 토큰을 입력해 주세요.');
  }

  const query = `${artist} ${title}`;
  const targetUrl = `${GENIUS_API_BASE}/search?q=${encodeURIComponent(query)}&access_token=${token}`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
  
  // WHY: 아티스트와 타이틀이 모두 검증을 통과한 것에 대해, 최소 품질을 충족하는지 판단할 최종 임계치
  const SIMILARITY_THRESHOLD = 0.25;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Genius API 검색 프록시 실패: ${response.statusText}`);
    }

    const data = await response.json();
    const hits = data?.response?.hits;
    if (!hits || hits.length === 0) return null;

    // 상위 5개 결과를 대상으로 엄격 매칭 비교 수행
    const candidates = hits.slice(0, 5);
    let bestMatch: typeof hits[0]['result'] | null = null;
    let bestScore = -1;

    for (const hit of candidates) {
      const result = hit.result;
      const resultArtist = result.primary_artist?.name ?? '';
      const resultTitle = result.title ?? '';

      // 아티스트명과 곡명이 개별적으로 일치하는지 엄격히 상호 대조
      const isArtistMatched = checkArtistMatch(artist, resultArtist, originalArtist);
      const isTitleMatched = checkTitleMatch(title, resultTitle, originalTitle);

      // WHY: 아티스트나 곡명 중 하나라도 검증을 통과하지 못하면 후보군에서 즉시 제외시킵니다.
      //      이로써 아티스트가 아예 다른데 제목만 같아서 잘못 매칭되는 경우를 완전 차단합니다.
      if (!isArtistMatched || !isTitleMatched) {
        continue;
      }

      // 최종 최적 후보 판정을 위한 수치화 계산
      const artistSim = calculateSimilarity(artist, resultArtist);
      const titleSim = calculateSimilarity(title, resultTitle);
      
      const artistContains = containsSubstring(artist, resultArtist) ? 0.3 : 0;
      const titleContains = containsSubstring(title, resultTitle) ? 0.3 : 0;

      // 아티스트(40%) + 곡명(60%) 가중치
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

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const containers = doc.querySelectorAll('[data-lyrics-container="true"]');

    if (containers.length === 0) {
      const altContainer = doc.querySelector('.lyrics') || doc.querySelector('[class^="Lyrics__Container"]');
      if (!altContainer) {
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
  
  const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim();
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim();

  let searchResult = null;

  // 1차: 괄호 안 영문명이 있으면 그걸로 검색 시도 (원본 artist, title을 대조용 인자로 전달)
  if (englishNameMatch) {
    const engArtist = englishNameMatch[1];
    const engTitle = englishTitle ? englishTitle[1] : cleanTitle;
    searchResult = await searchSongClient(engArtist, engTitle, token, artist, title);
    await delay(1000);
  }

  // 2차: 괄호를 제거한 순수 아티스트명 + 순수 곡명으로 검색
  if (!searchResult && cleanArtist) {
    searchResult = await searchSongClient(cleanArtist, cleanTitle, token, artist, title);
    await delay(1000);
  }

  // 3차: 원본 문자열 전체를 그대로 검색 (괄호 포함)
  if (!searchResult) {
    searchResult = await searchSongClient(artist, title, token, artist, title);
    await delay(1000);
  }

  if (!searchResult) {
    return { lyrics: null, url: null };
  }

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
