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
  '유라': ['youra', 'youra (유라)'],
};

// === 다이어크리틱(액센트) 제거 ===
function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// === 오타 및 표기 오류 보정 사전 ===
// WHY: 기획안 자체에 아예 엉뚱한 정보로 잘못 기록되어 물리적으로 음원 검색이 불가능한 
//      극소수의 곡에 한해서만 최소한의 매핑 사전을 유지합니다.
//      (예: '림킴 - 민들레'는 멜론/Genius 모두에 실재하지 않는 곡이며 실제 곡은 'Awoo'임)
const SONG_TITLE_CORRECTION_MAP: Record<string, string> = {
  '낭만파': '명왕성',
  '보이지 않는 날들': '봄눈',
  '민들레': 'awoo',
  '하류': 'ral 9002',
};

const ARTIST_NAME_CORRECTION_MAP: Record<string, string> = {
  'sigur ros': 'sigur rós',
  '유라': 'youra',
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
  return removeDiacritics(str)
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
  return removeDiacritics(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\(.*?\)/g, '')          // 괄호와 그 내용 제거 (부제/영문명)
    .replace(/\[.*?\]/g, '')          // 대괄호와 그 내용 제거
    .replace(/feat\.?.*$/i, '')       // feat. 이후 전부 제거
    .replace(/ft\.?.*$/i, '')         // ft. 이후 전부 제거
    .replace(/[^\w\s\u3130-\u318F\uAC00-\uD7A3]/g, '') // 특수문자 제거 (한글/영문/숫자/공백만 보존)
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

  // 오타 보정 맵 적용
  const artistLower = artist.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();
  const correctedArtist = ARTIST_NAME_CORRECTION_MAP[artistLower] || artist;
  const correctedTitle = SONG_TITLE_CORRECTION_MAP[titleLower] || title;

  // 괄호가 제거된 정규화 쿼리 문자열 사용 (Genius 검색 매칭률 극대화)
  const cleanQueryArtist = correctedArtist.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  const cleanQueryTitle = correctedTitle.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();

  const isBrowser = typeof window !== 'undefined';
  const SIMILARITY_THRESHOLD = 0.25;

  let currentTitleQuery = cleanQueryTitle;
  let attemptCount = 0;
  
  // 최대 3회 백오프 재시도 (단어 단위로 뒤에서 하나씩 잘라냄)
  while (attemptCount < 3) {
    const query = cleanQueryArtist ? `${cleanQueryArtist} ${currentTitleQuery}` : currentTitleQuery;
    const targetUrl = `${GENIUS_API_BASE}/search?q=${encodeURIComponent(query)}&access_token=${token}`;
    const proxyUrl = isBrowser ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` : targetUrl;

    try {
      let response;
      if (isBrowser) {
        response = await fetch(proxyUrl);
      } else {
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
      }
      if (!response.ok) {
        throw new Error(`Genius API 검색 프록시 실패: ${response.statusText}`);
      }

      const data = await response.json();
      const hits = data?.response?.hits;

      if (hits && hits.length > 0) {
        // 상위 5개 결과를 대상으로 엄격 매칭 비교 수행
        const candidates = hits.slice(0, 5);
        let bestMatch: typeof hits[0]['result'] | null = null;
        let bestScore = -1;

        for (const hit of candidates) {
          const result = hit.result;
          const resultArtist = result.primary_artist?.name ?? '';
          const resultTitle = result.title ?? '';

          // 아티스트명과 곡명이 개별적으로 일치하는지 엄격히 상호 대조
          const isArtistMatched = checkArtistMatch(correctedArtist, resultArtist, originalArtist);
          
          // 동적 백오프 루즈 검색: 
          // 만약 단어를 잘라 검색했을 때(2차 시도 이후) 아티스트가 완전히 일치한다면
          // 곡명 매칭 기준을 조금 더 완화하여(Jaccard 0.2 이상) 오타 보정 사전 없이도 매칭되게 유도합니다.
          let isTitleMatched = false;
          if (attemptCount > 0 && isArtistMatched) {
            isTitleMatched = calculateSimilarity(correctedTitle, resultTitle) >= 0.2 || 
                             isSingleTitleMatch(correctedTitle, resultTitle, originalTitle);
          } else {
            isTitleMatched = checkTitleMatch(correctedTitle, resultTitle, originalTitle);
          }

          if (!isArtistMatched || !isTitleMatched) {
            continue;
          }

          // 최종 최적 후보 판정을 위한 수치화 계산
          const qArtAlts = extractAlternativeNames(correctedArtist);
          const rArtAlts = extractAlternativeNames(resultArtist);
          let artistSim = 0;
          let artistContains = 0;
          for (const qArt of qArtAlts) {
            for (const rArt of rArtAlts) {
              artistSim = Math.max(artistSim, calculateSimilarity(qArt, rArt));
              if (containsSubstring(qArt, rArt)) {
                artistContains = 0.3;
              }
            }
          }

          const qTitleAlts = extractAlternativeNames(correctedTitle);
          const rTitleAlts = extractAlternativeNames(resultTitle);
          let titleSim = 0;
          let titleContains = 0;
          for (const qTitle of qTitleAlts) {
            for (const rTitle of rTitleAlts) {
              titleSim = Math.max(titleSim, calculateSimilarity(qTitle, rTitle));
              if (containsSubstring(qTitle, rTitle)) {
                titleContains = 0.3;
              }
            }
          }
          
          const combinedScore = Math.max(
            artistSim * 0.4 + titleSim * 0.6,
            artistContains * 0.4 + titleContains * 0.6
          );

          if (combinedScore > bestScore) {
            bestScore = combinedScore;
            bestMatch = result;
          }
        }

        // 임계값 통과 시 최적 후보 즉시 반환
        if (bestMatch && bestScore >= SIMILARITY_THRESHOLD) {
          console.log(
            `[Genius 검색 성공] "${query}" → "${bestMatch.primary_artist?.name} - ${bestMatch.title}" (점수: ${bestScore.toFixed(2)}, 시도회수: ${attemptCount + 1})`
          );
          return {
            id: bestMatch.id,
            url: bestMatch.url,
            artist: bestMatch.primary_artist?.name ?? artist,
            title: bestMatch.title
          };
        }
      }
    } catch (error) {
      console.error(`[Genius 검색 실패] "${query}":`, error);
    }

    // 타이틀 쿼리 단어 백오프 적용
    const words = currentTitleQuery.split(' ');
    if (words.length <= 1) {
      break; // 더 이상 쪼갤 단어가 없으면 중단
    }
    words.pop(); // 맨 끝 단어 제거
    currentTitleQuery = words.join(' ');
    attemptCount++;

    await delay(200); // 연속 API 요청 속도 조절을 위한 미세 딜레이
  }

  return null;
}

/**
 * CORS 프록시(corsproxy.io)를 통해 가사 페이지 HTML을 긁어와 브라우저 DOMParser로 파싱
 */
export async function fetchLyricsFromUrlClient(url: string): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const proxyUrl = isBrowser ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;
  
  try {
    let response;
    if (isBrowser) {
      response = await fetch(proxyUrl);
    } else {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
    }
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
 * 멜론 검색 API를 이용해 곡 검색
 * WHY: 한국 인디 음악이나 최신 앨범의 경우 Genius 데이터베이스에 없는 경우가 많습니다.
 *      이를 해결하기 위해 멜론 곡 검색을 보조 채널로 작동시킵니다.
 */
export async function searchSongMelonClient(
  artist: string,
  title: string,
  originalArtist?: string,
  originalTitle?: string
): Promise<{ songId: string; title: string; artist: string } | null> {
  const isBrowser = typeof window !== 'undefined';
  
  // 오타 보정 맵 적용
  const artistLower = artist.toLowerCase().trim();
  const titleLower = title.toLowerCase().trim();
  const correctedArtist = ARTIST_NAME_CORRECTION_MAP[artistLower] || artist;
  const correctedTitle = SONG_TITLE_CORRECTION_MAP[titleLower] || title;
  
  // 멜론 검색 쿼리 구성: 곡 제목만을 우선 사용합니다. 
  // WHY: 아티스트명과 함께 검색할 경우 검색어 정밀도로 인해 아예 검색결과가 누락될 위험이 큽니다.
  const cleanTitle = correctedTitle.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  const query = cleanTitle;
  
  const targetUrl = `https://www.melon.com/search/song/index.htm?q=${encodeURIComponent(query)}`;
  const proxyUrl = isBrowser ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` : targetUrl;

  try {
    let response;
    if (isBrowser) {
      response = await fetch(proxyUrl);
    } else {
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
    }

    if (!response.ok) {
      throw new Error(`멜론 검색 실패: ${response.statusText}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // tbody 내의 tr 태그 목록 가져오기
    const trs = doc.querySelectorAll('.section_song tbody tr');
    if (trs.length === 0) {
      return null;
    }

    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i];
      const titleLink = tr.querySelector('a[href*="goSongDetail"]');
      if (!titleLink) continue;

      const href = (titleLink as any).href || titleLink.getAttribute('href') || '';
      const songIdMatch = href.match(/goSongDetail\('(\d+)'\)/);
      if (!songIdMatch) continue;
      const songId = songIdMatch[1];

      // 제목 가공
      const rawTitleText = titleLink.textContent || '';
      const cleanTitleText = rawTitleText
        .replace(/\s*상세정보 페이지 이동\s*$/i, '')
        .replace(/\u00a0/g, ' ')
        .trim();

      // 아티스트 가공
      const artistLink = tr.querySelector('#artistName a');
      const rawArtistText = artistLink ? artistLink.textContent || '' : '';
      const cleanArtistText = rawArtistText
        .replace(/\u00a0/g, ' ')
        .trim();

      // 유사도 비교 검증
      const isArtistMatched = checkArtistMatch(correctedArtist, cleanArtistText, originalArtist);
      const isTitleMatched = checkTitleMatch(correctedTitle, cleanTitleText, originalTitle);

      if (isArtistMatched && isTitleMatched) {
        console.log(`[Melon 검색 성공] "${query}" → "${cleanArtistText} - ${cleanTitleText}" (songId: ${songId})`);
        return {
          songId,
          title: cleanTitleText,
          artist: cleanArtistText
        };
      }
    }
  } catch (error) {
    console.error(`[Melon 검색 에러] "${query}":`, error);
  }

  return null;
}

/**
 * 멜론 곡 상세 페이지에서 가사를 파싱
 */
export async function fetchLyricsFromMelonUrlClient(songId: string): Promise<string> {
  const isBrowser = typeof window !== 'undefined';
  const targetUrl = `https://www.melon.com/song/detail.htm?songId=${songId}`;
  const proxyUrl = isBrowser ? `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` : targetUrl;

  try {
    let response;
    if (isBrowser) {
      response = await fetch(proxyUrl);
    } else {
      response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      });
    }

    if (!response.ok) {
      throw new Error(`멜론 가사 페이지 연결 실패: ${response.statusText}`);
    }

    const html = await response.text();
    if (!html) {
      throw new Error('멜론 가사 페이지 HTML을 받아오지 못했습니다.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const lyricDiv = doc.querySelector('.lyric');

    if (!lyricDiv) {
      if (html.includes('가사가 없습니다')) {
        return '가사가 없습니다.';
      }
      throw new Error('가사 텍스트 영역(.lyric)을 찾을 수 없습니다.');
    }

    const clone = lyricDiv.cloneNode(true) as HTMLElement;
    const brs = clone.querySelectorAll('br');
    brs.forEach((br) => {
      br.parentNode?.replaceChild(doc.createTextNode('\n'), br);
    });

    return clone.textContent?.trim() || '';
  } catch (error) {
    throw new Error(`멜론 가사 페이지 파싱 실패: ${(error as Error).message}`);
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

  // Genius 다단계 검색 시도
  for (const q of uniqueQueries) {
    searchResult = await searchSongClient(q.queryArtist, q.queryTitle, token, artist, title);
    if (searchResult) {
      break;
    }
    await delay(300); // API 과부하 및 속도 제한 방지 딜레이
  }

  let lyrics: string | null = null;
  let lyricUrl: string | null = null;

  if (searchResult) {
    try {
      lyrics = await fetchLyricsFromUrlClient(searchResult.url);
      lyricUrl = searchResult.url;
    } catch (error) {
      console.warn(`[Genius 가사 파싱 실패] ${searchResult.url} : ${(error as Error).message}. 멜론 폴백으로 전환합니다.`);
    }
  }

  // Genius 가사를 찾지 못했거나 가사 가져오기가 실패한 경우 -> 멜론 폴백 적용
  if (!lyrics || lyrics.length < 50) {
    console.log(`[Melon 폴백] "${artist} - ${title}" -> 멜론 검색을 시도합니다.`);
    const melonResult = await searchSongMelonClient(artist, title, artist, title);
    if (melonResult) {
      try {
        const melonLyrics = await fetchLyricsFromMelonUrlClient(melonResult.songId);
        if (melonLyrics && melonLyrics.length > 50) {
          lyrics = melonLyrics;
          lyricUrl = `https://www.melon.com/song/detail.htm?songId=${melonResult.songId}`;
        }
      } catch (err) {
        console.error(`[Melon 가사 수집 실패] songId ${melonResult.songId}:`, err);
      }
    }
  }

  return { lyrics, url: lyricUrl };
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
