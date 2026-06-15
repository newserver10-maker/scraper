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
  '림킴': ['lim kim', 'limkim'],
  '미노이': ['meenoi', 'minoi'],
  '권진아': ['kwon jin ah', 'kwon jinah'],
  '샘김': ['sam kim', 'samkim'],
  '신해경': ['shin hae gyeong', 'shin hae kyung'],
  '안다영': ['ahn da young', 'ahn dayoung'],
  '김광석': ['kim kwang seok', 'kim kwangseok'],
  '곽진언': ['kwak jin eon', 'kwak jineon'],
  '디오': ['d.o.', 'do', 'd.o. (exo)'],
  '루시드폴': ['lucid fall'],
};

// === 한글 로마자 변환기 ===
// WHY: 하드코딩 사전에 등록되지 않은 새로운 한글 아티스트나 곡명이 들어오더라도,
//      영어 발음 표기(로마자)로 변환해 Genius의 영문 표기와 대조할 수 있도록 동적 변환기를 둡니다.
function romanizeHangul(text: string): string {
  const chosungMap = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
    's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
  ];
  const jungsungMap = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'ye', 'ye', 'o', 'wa',
    'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
  ];
  const jongsungMap = [
    '', 'g', 'kk', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg',
    'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs',
    's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
  ];

  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const hangulCode = code - 0xAC00;
      const cho = Math.floor(hangulCode / 588);
      const jung = Math.floor((hangulCode % 588) / 28);
      const jong = hangulCode % 28;

      result += chosungMap[cho] + jungsungMap[jung] + jongsungMap[jong];
    } else {
      result += text[i];
    }
  }
  return result;
}

// 로마자 문자열 간소화 (발음 완화 규칙)
// WHY: 'seonwoojunga' <-> 'sunwoojunga'처럼 모음/자음 표기 편차를 줄이기 위해 
//      발음상 동치(eo->u, r->l 등)를 적용해 정밀 대조합니다.
function simplifyRoman(str: string): string {
  return str
    .toLowerCase()
    .replace(/eo/g, 'u')
    .replace(/wo/g, 'u')
    .replace(/oo/g, 'u')
    .replace(/wi/g, 'u')
    .replace(/wa/g, 'a')
    .replace(/ae/g, 'e')
    .replace(/oe/g, 'e')
    .replace(/ee/g, 'i')
    .replace(/r/g, 'l')
    .replace(/g/g, 'k')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/h/g, '') // ahn -> an, ah -> a 생략 대응
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}

// 로마자 발음 기반 매칭 여부 판단
function isRomanizedMatch(hangul: string, english: string): boolean {
  // 한글이 아예 포함되지 않은 문자열은 로마자 변환 비교가 무의미하므로 제외
  if (!/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(hangul)) return false;
  
  const rom = romanizeHangul(hangul);
  const simRom = simplifyRoman(rom);
  const simEng = simplifyRoman(english);
  
  return simRom.length >= 2 && simEng.length >= 2 && 
    (simRom === simEng || simRom.includes(simEng) || simEng.includes(simRom));
}

// === 괄호 내용 추출 및 멀티 매칭 ===
// WHY: '림킴 (Lim Kim)'이나 '섬 (Island)'처럼 괄호 안에 번역명/부제가 포함된 경우,
//      괄호를 지워버리지 않고 괄호 안팎의 텍스트를 모두 개별 이름 후보로 추출해 비교합니다.
function extractAlternativeNames(name: string): string[] {
  if (!name) return [];
  const results: string[] = [name];
  
  const regex = /([^([]+)(?:\(([^)]+)\)|\[([^\]]+)\])/;
  const match = name.match(regex);
  if (match) {
    if (match[1]) results.push(match[1].trim());
    const inside = match[2] || match[3];
    if (inside) results.push(inside.trim());
  }
  
  return Array.from(new Set(results));
}

// === 번역 맵 매칭 검사 ===
function checkTranslationMap(name1: string, name2: string): boolean {
  const n1Clean = normalizeForComparison(name1).replace(/\s+/g, '');
  const n2Clean = normalizeForComparison(name2).replace(/\s+/g, '');

  for (const [ko, engList] of Object.entries(ARTIST_TRANSLATION_MAP)) {
    const koClean = normalizeForComparison(ko).replace(/\s+/g, '');
    const engCleanList = engList.map(e => normalizeForComparison(e).replace(/\s+/g, ''));

    if (n1Clean === koClean && engCleanList.includes(n2Clean)) return true;
    if (n2Clean === koClean && engCleanList.includes(n1Clean)) return true;
  }
  return false;
}

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

// 단일 아티스트명 매칭 판정
function isSingleArtistMatch(query: string, result: string, original: string = ''): boolean {
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeForComparison(qAlt);
      const rClean = normalizeForComparison(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      // 1. 공백 제거 후 완전 일치
      if (qNoSpace === rNoSpace && qNoSpace.length > 0) return true;

      // 2. 번역 사전을 통한 매칭
      if (checkTranslationMap(qAlt, rAlt)) return true;

      // 3. 로마자 발음 대조 매칭
      if (isRomanizedMatch(qAlt, rAlt)) return true;

      // 4. Jaccard 유사도 확인
      if (calculateSimilarity(qAlt, rAlt) >= 0.4) return true;

      // 5. 부분 문자열 포함 관계
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) return true;
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeForComparison(oAlt);
      const rClean = normalizeForComparison(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) return true;
      if (checkTranslationMap(oAlt, rAlt)) return true;
      if (isRomanizedMatch(oAlt, rAlt)) return true;
      if (calculateSimilarity(oAlt, rAlt) >= 0.4) return true;
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || rClean.includes(oClean)) return true;
      }
    }
  }

  return false;
}

/**
 * 두 아티스트가 동일인인지 엄격히 판정
 * WHY: 아티스트가 아예 다른데 곡명만 같다는 이유로 엉뚱한 가사를 긁어오는 문제를 
 *      방지하기 위해, 한글/영문 대응, Jaccard 유사도, 공백 제거 일치 여부를 복합 검증합니다.
 */
function checkArtistMatch(queryArtist: string, resultArtist: string, originalArtist: string = ''): boolean {
  // '&', 'x', 'and', 'with', ',' 단위로 콜라보레이터 분할 대조
  const queryMembers = queryArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const resultMembers = resultArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
  const originalMembers = originalArtist ? originalArtist.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean) : [];

  return queryMembers.some(qMem =>
    resultMembers.some(rMem => isSingleArtistMatch(qMem, rMem))
  ) || (originalMembers.length > 0 && originalMembers.some(oMem =>
    resultMembers.some(rMem => isSingleArtistMatch(oMem, rMem))
  ));
}

// 곡 제목 정규화 및 한영 치환
function normalizeTitle(title: string): string {
  let cleaned = normalizeForComparison(title);
  // 한영 숫자 및 고주파 단어 변환
  cleaned = cleaned.replace(/트랙\s*(\d+)/g, 'track $1');
  cleaned = cleaned.replace(/(\d+)시/g, '$1');
  return cleaned;
}

// 단일 곡명 매칭 판정
function isSingleTitleMatch(query: string, result: string, original: string = ''): boolean {
  const qAlternatives = extractAlternativeNames(query);
  const rAlternatives = extractAlternativeNames(result);
  const oAlternatives = original ? extractAlternativeNames(original) : [];

  for (const qAlt of qAlternatives) {
    for (const rAlt of rAlternatives) {
      const qClean = normalizeTitle(qAlt);
      const rClean = normalizeTitle(rAlt);
      const qNoSpace = qClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      // 1. 공백 제거 후 완전 일치
      if (qNoSpace === rNoSpace && qNoSpace.length > 0) return true;

      // 2. 로마자 발음 대조
      if (isRomanizedMatch(qAlt, rAlt)) return true;

      // 3. Jaccard 유사도 확인
      if (calculateSimilarity(qAlt, rAlt) >= 0.35) return true;

      // 4. 부분 문자열 포함 관계
      if (qClean.length >= 2 && rClean.length >= 2) {
        if (qClean.includes(rClean) || rClean.includes(qClean)) return true;
      }
    }
  }

  for (const oAlt of oAlternatives) {
    for (const rAlt of rAlternatives) {
      const oClean = normalizeTitle(oAlt);
      const rClean = normalizeTitle(rAlt);
      const oNoSpace = oClean.replace(/\s+/g, '');
      const rNoSpace = rClean.replace(/\s+/g, '');

      if (oNoSpace === rNoSpace && oNoSpace.length > 0) return true;
      if (isRomanizedMatch(oAlt, rAlt)) return true;
      if (calculateSimilarity(oAlt, rAlt) >= 0.35) return true;
      if (oClean.length >= 2 && rClean.length >= 2) {
        if (oClean.includes(rClean) || rClean.includes(oClean)) return true;
      }
    }
  }

  return false;
}

/**
 * 곡명이 일치하는지 엄격히 판정
 * WHY: 아티스트는 일치하더라도 아예 다른 트랙의 가사를 긁어오는 문제를 방지합니다.
 */
function checkTitleMatch(queryTitle: string, resultTitle: string, originalTitle: string = ''): boolean {
  return isSingleTitleMatch(queryTitle, resultTitle, originalTitle);
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

  const query = artist ? `${artist} ${title}` : title;
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

  // 1. 번역 맵에서 매핑된 영어 아티스트 조합 생성 헬퍼
  const getMappedEnglishArtists = (artStr: string): string[] => {
    const members = artStr.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
    const resolvedMembersList: string[][] = [];

    for (const mem of members) {
      const memClean = normalizeForComparison(mem).replace(/\s+/g, '');
      let mapped = [mem];
      
      for (const [ko, engList] of Object.entries(ARTIST_TRANSLATION_MAP)) {
        if (normalizeForComparison(ko).replace(/\s+/g, '') === memClean) {
          mapped = [...mapped, ...engList];
          break;
        }
      }
      resolvedMembersList.push(mapped);
    }

    let results: string[] = [];
    const generateCombinations = (index: number, current: string[]) => {
      if (index === resolvedMembersList.length) {
        results.push(current.join(' & '));
        return;
      }
      for (const val of resolvedMembersList[index]) {
        generateCombinations(index + 1, [...current, val]);
      }
    };
    if (resolvedMembersList.length > 0) {
      generateCombinations(0, []);
    }
    return results.filter(r => r !== artStr);
  };

  // 2. 동적 로마자 변환 아티스트 조합 생성 헬퍼
  const getRomanizedArtist = (artStr: string): string => {
    const members = artStr.split(/\s*(?:&|x|and|with|,)\s*/i).map(s => s.trim()).filter(Boolean);
    const romMembers = members.map(m => {
      const pure = m.replace(/\s*\(.*?\)\s*/g, '').trim();
      return romanizeHangul(pure);
    });
    return romMembers.join(' & ');
  };

  let searchResult = null;
  const queryCandidates: Array<{ queryArtist: string; queryTitle: string }> = [];

  // A. [1단계] 괄호 내 영문 정보 우선 사용
  if (englishNameMatch) {
    const engArtist = englishNameMatch[1].trim();
    const engTitle = englishTitle ? englishTitle[1].trim() : cleanTitle;
    queryCandidates.push({ queryArtist: engArtist, queryTitle: engTitle });
  }

  // B. [2단계] 번역 사전 매핑 영어 조합 사용
  const mappedEngArtists = getMappedEnglishArtists(cleanArtist);
  for (const engArt of mappedEngArtists) {
    queryCandidates.push({ queryArtist: engArt, queryTitle: cleanTitle });
  }

  // C. [3단계] 동적 로마자 변환 결과 사용
  const romanizedArt = getRomanizedArtist(cleanArtist);
  if (romanizedArt && simplifyRoman(romanizedArt) !== simplifyRoman(cleanArtist)) {
    queryCandidates.push({ queryArtist: romanizedArt, queryTitle: cleanTitle });
  }

  // D. [4단계] 순수 한글 쿼리 (기존 2차 및 3차 폴백)
  queryCandidates.push({ queryArtist: cleanArtist, queryTitle: cleanTitle });
  queryCandidates.push({ queryArtist: artist, queryTitle: title });

  // E. [5단계] 최후의 보루: 아티스트명을 비우고 '곡 제목 단독 검색'
  // WHY: 아티스트명이 전혀 엉뚱하게 등록된 경우 제목으로 먼저 Genius에서 조회 후
  //      검색 결과들의 아티스트 명칭과 기획안의 아티스트명을 역매칭합니다.
  queryCandidates.push({ queryArtist: '', queryTitle: cleanTitle });
  queryCandidates.push({ queryArtist: '', queryTitle: title });

  // 중복 쿼리 제거
  const uniqueQueries: Array<{ queryArtist: string; queryTitle: string }> = [];
  const seen = new Set<string>();
  for (const q of queryCandidates) {
    const key = `${q.queryArtist.toLowerCase()}|||${q.queryTitle.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueQueries.push(q);
    }
  }

  // 다단계로 검색 시도
  for (const q of uniqueQueries) {
    searchResult = await searchSongClient(q.queryArtist, q.queryTitle, token, artist, title);
    if (searchResult) {
      break;
    }
    await delay(300); // API 과부하 및 속도 제한 방지 딜레이
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
