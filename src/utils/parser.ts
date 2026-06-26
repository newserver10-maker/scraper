import type { Track, Song } from '../types';

// === 레퍼런스 유효성 검증 ===

/**
 * 기획안의 세부 메타데이터 속성명이나 음악 가이드 용어를 포함하는 텍스트를
 * 아티스트명으로 오인하지 않도록 하는 블랙리스트 패턴 목록
 * 
 * WHY: 기획안 형식은 프로젝트마다 달라질 수 있으므로, 특정 불릿 포맷에 의존하지 않고
 *      "이 텍스트가 음악 레퍼런스처럼 보이지만 실은 음악 가이드/설명인 경우"를
 *      키워드 기반으로 걸러냅니다.
 * 
 * 카테고리별로 분류하여 새 기획안에서 등장할 수 있는 용어를 쉽게 추가할 수 있도록 합니다.
 */
const BLACKLIST_KEYWORDS: string[] = [
  // --- 기획안 섹션 속성명 ---
  '공간 서사', '공간서사', '알고리즘', '프로젝트명', '부제',
  '기획의 본질', '기획의본질', '시각적 무드', '시각적무드',
  '영상 제목', '영상제목', '알고리즘 전술',
  '서사적 시간', '서사적시간',

  // --- 보컬/가창 관련 음악 가이드 용어 ---
  '보컬 가창법', '보컬가창법', '보컬 가창', '보컬가창',
  '가창자 성별', '가창자성별', '가창법', '창법',
  '벨팅', '팔세토', '비브라토', '포르타멘토', '멈블링',
  '위스퍼', '스타카토', '레이백', '스트레이트 톤',
  '보컬 런', 'Vocal Runs', '스포큰 워드',

  // --- 악기/연주 관련 음악 가이드 용어 ---
  '주요 악기', '주요악기', '연주법',
  '피아노', '기타', '베이스', '드럼', '신디사이저', '신스',
  '바이브라폰', '첼로', '콘트라베이스', '윈드차임',
  '아르페지오', '피치카토', '핑거 피킹', '핑거피킹',
  '페달', '하모닉스', '플래졸레',

  // --- 후킹/구성 관련 음악 가이드 용어 ---
  '청각적 후킹', '청각적후킹', '후킹 요소', '후킹요소',
  '음악 장르', '음악장르', '템포', 'BPM',
  '음악 구성', '음악구성',
  
  // --- 일반 음악 기술 용어 (아티스트명으로 오인될 만한 것들) ---
  '리버브', '딜레이', '이펙터', '컴프레서', '필터',
  '코러스 파트', '브릿지 구간', '인트로', '아웃트로',
  'Intro', 'Outro', 'Verse', 'Chorus', 'Bridge',
  '사이드체인', '로우패스', '하이패스',
  '스테레오', '패닝', '믹싱',

  // --- V4 기획안에서 새로 등장할 수 있는 섹션명 ---
  '무드 컬러', '무드컬러', '사운드 텍스처', '사운드텍스처',
  '서브 베이스', '서브베이스', '앰비언스', '톤 컬러',
  '프로듀서 노트', '프로듀서노트', '채널 전략', '채널전략',
  '제작 가이드', '제작가이드', '리스너 경험', '리스너경험',
  '공간 사운드', '공간사운드', '청취 환경', '청취환경',
];

/**
 * 파싱된 레퍼런스 후보가 실제 "아티스트 - 곡명"인지 다단계로 검증합니다.
 * 
 * WHY: 기획안의 형식이 바뀌면 정규식만으로는 오인을 100% 방지할 수 없으므로,
 *      파싱 후에도 결과물의 타당성을 검증하는 방어적 레이어가 필요합니다.
 *      이 함수는 "아티스트 이름처럼 보이는가?" + "곡명처럼 보이는가?"를
 *      여러 휴리스틱으로 판단합니다.
 */
function isValidReference(artist: string, title: string): boolean {
  // 1. 기본 길이 검증: 아티스트명은 최소 1자, 곡명은 비어있지 않아야 함
  if (!artist || !title) return false;
  if (artist.length < 1 || title.length < 1) return false;

  // 2. 블랙리스트 키워드 검증 (아티스트명에만 적용)
  //    WHY: 기획안 속성명이나 음악 가이드 용어가 아티스트명에 포함되면 레퍼런스가 아님.
  //         곡명에는 적용하지 않습니다 — "안다영 - 밤 패닝"처럼 기술 용어가
  //         곡 제목으로 쓰이는 경우가 있기 때문입니다.
  const isBlacklisted = BLACKLIST_KEYWORDS.some((keyword) => 
    artist.includes(keyword)
  );
  if (isBlacklisted) return false;

  // 3. 숫자/기호로만 이루어진 아티스트명 거부
  //    WHY: "80", "3분 12초" 같은 메타데이터 수치가 아티스트로 파싱되는 것 방지
  //    단, "10cm" 같은 밴드명은 숫자+문자라 통과되며, 
  //    "92914", "1975" 같은 순수 숫자 밴드명은 예외로 허용합니다.
  const strippedArtist = artist.replace(/[\s\-_()&]/g, '');
  if (/^\d+$/.test(strippedArtist)) {
    // 순수 숫자로만 이루어진 밴드 화이트리스트
    if (!['92914', '1975', '831'].includes(strippedArtist)) {
      return false;
    }
  }

  // 4. 아티스트명이 비정상적으로 긴 경우 거부 (50자 초과)
  //    WHY: 실제 아티스트명이 50자를 넘는 경우는 극히 드물며,
  //         기획안의 설명 문장이 아티스트로 잘못 파싱된 경우일 가능성이 높음
  if (artist.length > 50) return false;

  // 5. 곡명에 기획안 구조 마커가 포함된 경우 거부
  //    WHY: "(3분 12초)", "➔ Verse 1 (36s)" 같은 음악 구성 텍스트가 곡명에 혼입되는 것 방지
  if (/\d+s\)/.test(title) || /➔/.test(title)) return false;

  // 6. 아티스트명에 문장 부호가 과도하게 포함된 경우 거부
  //    WHY: 기획안의 설명 문장이 파싱된 경우 마침표, 쉼표 등이 다수 포함됨.
  //         단, 괄호 안의 마침표는 제외 — "디오 (D.O.)" 같은 약자명을 보호합니다.
  const artistWithoutParens = artist.replace(/\(.*?\)/g, '');
  const punctuationCount = (artistWithoutParens.match(/[。.!?]/g) || []).length;
  if (punctuationCount >= 2) return false;

  // 7. 곡명이 BPM 값이나 타임스탬프만인 경우 거부
  if (/^\d+\s*BPM$/i.test(title)) return false;
  if (/^\d+분\s*\d*초?$/.test(title)) return false;

  return true;
}

/**
 * 가사 레퍼런스 섹션을 감지하기 위한 키워드 패턴 목록
 * 
 * WHY: 기획안마다 '가사 레퍼런스', '음악 레퍼런스', 'Reference', '참고곡' 등
 *      다양한 명칭으로 레퍼런스 섹션을 기재할 수 있음.
 *      단순히 '레퍼런스'만 매칭하면 '알고리즘 레퍼런스' 등 오인 위험이 있으므로
 *      가사/음악에 특화된 복합 키워드를 사용합니다.
 */
const REFERENCE_SECTION_PATTERNS: RegExp[] = [
  // 가장 일반적인 형태
  /가사\s*레퍼런스\s*[:：]?\s*/,
  // '음악 레퍼런스' 형태
  /음악\s*레퍼런스\s*[:：]?\s*/,
  // '곡 레퍼런스' 형태
  /곡\s*레퍼런스\s*[:：]?\s*/,
  // '참고곡' 형태
  /참고\s*곡\s*[:：]?\s*/,
  // '레퍼런스 곡' 형태
  /레퍼런스\s*곡\s*[:：]?\s*/,
  // 영문 표기
  /(?:Lyric|Song|Music)\s*Reference\s*[:：]?\s*/i,
  // '가사 참고' 형태
  /가사\s*참고\s*[:：]?\s*/,
];

/**
 * 섹션 종료를 감지하기 위한 패턴 (레퍼런스 텍스트 이후 다음 섹션 시작)
 * 
 * WHY: 레퍼런스 텍스트 범위를 정확히 잘라내기 위해, 
 *      "다음 불릿 포인트", "다음 Track", "빈 줄 2개" 등의 조건을
 *      기획안 형식 변형에 맞춰 유연하게 감지합니다.
 */
function findReferenceSectionEnd(text: string, startPos: number): number {
  // WHY: 레퍼런스 텍스트가 끝나는 지점을 다양한 패턴으로 탐지합니다.
  //      우선순위: 1) 다음 불릿+키워드 2) 다음 Track 3) 다음 BLOCK/Part 4) 줄 끝
  
  const remainingText = text.substring(startPos);
  
  // 다양한 종료 패턴 (먼저 매칭되는 것을 선택)
  const endPatterns: RegExp[] = [
    // 다음 불릿 포인트 + 한글 키워드 (불릿이 있고 뒤에 한글이 따라오는 경우)
    /\n\s*[*●•◆▶○■◇▷★☆▪▸▹◦※·]\s*(?:[가-힣])/,
    // Track 패턴 (대소문자 무관, 다양한 숫자 형식)
    /\n\s*Track\s*\d/i,
    // BLOCK/Part 패턴 (앞에 이모지 등 기호가 있을 수 있음)
    /\n\s*(?:[^a-zA-Z가-힣0-9\n]{1,5}\s*)?(?:BLOCK|Part|파트|블록)\s/i,
    // 구분선 패턴
    /\n\s*[-=]{3,}\s*/,
    // PAGE BREAK 패턴
    /\n\s*---\s*PAGE\s*BREAK/i,
    // 빈 줄 2개 연속 (문단 분리)
    /\n\s*\n\s*\n/,
  ];

  let earliestEnd = remainingText.length;

  for (const pattern of endPatterns) {
    const match = remainingText.match(pattern);
    if (match && match.index !== undefined && match.index < earliestEnd) {
      earliestEnd = match.index;
    }
  }

  return earliestEnd;
}

/**
 * 레퍼런스 텍스트에서 개별 "아티스트 - 곡명" 쌍을 추출합니다.
 * 
 * WHY: 레퍼런스 곡 목록이 다양한 구분자(콤마, 마침표, 슬래시, 줄바꿈, 번호) 및
 *      다양한 대시 기호(-, –, —, ~)로 기술될 수 있으므로, 
 *      유연한 패턴 매칭과 다단계 파싱 전략을 적용합니다.
 * 
 * 핵심 전략: 
 *   1) 대시(-/–/—) 위치를 기준으로 "아티스트"와 "곡명"의 경계를 먼저 감지
 *   2) 인접한 두 대시 사이의 콤마를 곡 구분자로 사용
 *   이 방식은 아티스트명에 마침표가 포함된 경우(D.O.)나 
 *   곡명이 마침표로 끝나는 경우(K.)를 안전하게 보호합니다.
 */
function extractReferenceSongs(refText: string): Song[] {
  const references: Song[] = [];
  
  if (!refText || refText.trim().length < 3) return references;

  // 1단계: 줄바꿈과 연속 공백을 단일 공백으로 합침
  let cleaned = refText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // 전체 텍스트의 맨 끝 마침표만 제거 (곡명 중간의 마침표는 보존)
  cleaned = cleaned.replace(/\.\s*$/, '');
  
  // 2단계: 대시 위치 기반 분할 전략
  // WHY: "아티스트 - 곡명, 아티스트 - 곡명" 패턴에서 대시는 아티스트/곡명의 유일한 
  //      확정적 경계이므로, 대시 위치를 먼저 찾고 그 사이의 콤마로 곡을 분리합니다.
  //      이 방식은 "디오 (D.O.) - 괜찮아도 괜찮아" 처럼 마침표가 포함된 아티스트명도
  //      안전하게 처리할 수 있습니다.
  
  // 대시 패턴: 공백으로 둘러싸인 대시(-), 엔대시(–), 엠대시(—), 물결(~)
  const dashPattern = /\s+[-–—~]\s+/g;
  const dashPositions: Array<{ index: number; length: number }> = [];
  
  let dashMatch;
  while ((dashMatch = dashPattern.exec(cleaned)) !== null) {
    dashPositions.push({ index: dashMatch.index, length: dashMatch[0].length });
  }
  
  if (dashPositions.length === 0) {
    // 대시가 없으면 레퍼런스 형식이 아님
    return references;
  }
  
  // 3단계: 대시 사이의 콤마를 기준으로 "아티스트, 곡명" 쌍 분리
  // WHY: 첫 번째 대시의 앞부분이 첫 번째 아티스트,
  //      첫 번째 대시의 뒷부분에서 두 번째 대시 앞의 마지막 콤마까지가 첫 번째 곡명,
  //      그 콤마 이후가 두 번째 아티스트... 이런 식으로 연쇄 분리합니다.
  
  const songsRaw: Array<{ artist: string; title: string }> = [];
  
  for (let i = 0; i < dashPositions.length; i++) {
    const dashPos = dashPositions[i];
    
    // 아티스트명: 이전 구분점 ~ 현재 대시 위치
    let artistStart: number;
    if (i === 0) {
      artistStart = 0;
    } else {
      // 이전 대시 이후의 텍스트에서 마지막 콤마를 찾아 그 이후부터 시작
      const prevDashEnd = dashPositions[i - 1].index + dashPositions[i - 1].length;
      const betweenText = cleaned.substring(prevDashEnd, dashPos.index);
      
      // 콤마로 구분된 마지막 요소가 현재 아티스트명
      const lastCommaIdx = betweenText.lastIndexOf(',');
      if (lastCommaIdx !== -1) {
        artistStart = prevDashEnd + lastCommaIdx + 1;
      } else {
        // 콤마가 없으면 마침표(.) 뒤의 마지막 구분점을 찾기
        // WHY: "Radiohead - Lift. 다음 아티스트 - 곡명" 형식 대응
        const lastDotIdx = betweenText.lastIndexOf('.');
        if (lastDotIdx !== -1 && lastDotIdx < betweenText.length - 2) {
          artistStart = prevDashEnd + lastDotIdx + 1;
        } else {
          artistStart = prevDashEnd;
        }
      }
    }
    
    const rawArtist = cleaned.substring(artistStart, dashPos.index).trim();
    
    // 곡명: 현재 대시 이후 ~ 다음 곡의 아티스트 시작 전
    const titleStart = dashPos.index + dashPos.length;
    let titleEnd: number;
    
    if (i === dashPositions.length - 1) {
      // 마지막 곡이면 텍스트 끝까지
      titleEnd = cleaned.length;
    } else {
      // 다음 대시 앞의 마지막 콤마가 곡명의 끝
      const nextDashPos = dashPositions[i + 1];
      const betweenText = cleaned.substring(titleStart, nextDashPos.index);
      const lastCommaIdx = betweenText.lastIndexOf(',');
      
      if (lastCommaIdx !== -1) {
        titleEnd = titleStart + lastCommaIdx;
      } else {
        // 콤마가 없으면 마침표(.) 기준으로 분리
        const lastDotIdx = betweenText.lastIndexOf('.');
        if (lastDotIdx !== -1 && lastDotIdx < betweenText.length - 2) {
          titleEnd = titleStart + lastDotIdx;
        } else {
          titleEnd = nextDashPos.index;
        }
      }
    }
    
    const rawTitle = cleaned.substring(titleStart, titleEnd).trim()
      .replace(/[,;]+$/, '') // trailing 콤마/세미콜론 제거 (마침표는 보존!)
      .trim();
    
    if (rawArtist && rawTitle) {
      songsRaw.push({ artist: rawArtist, title: rawTitle });
    }
  }

  // 4단계: 유효성 검증 후 결과 배열에 추가
  for (const song of songsRaw) {
    // 앞뒤의 불필요한 리스트 기호 제거 (1. 1) 등은 제거하되 10cm의 10은 보호)
    const cleanArtist = song.artist
      .replace(/^[-•*#▪▸▹◦]+/, '')
      .replace(/^\d+[\.\)]\s+/, '')
      .trim();
    // 곡명의 trailing 마침표는 보존 (K. 같은 곡명), 단 곡 목록 끝의 trailing 점은 제거
    const cleanTitle = song.title.replace(/\.\s*$/, (m) => {
      // 곡명이 단일 문자+마침표(예: K.)이면 보존, 아니면 제거
      const titleWithoutDot = song.title.replace(/\.\s*$/, '').trim();
      if (titleWithoutDot.length <= 2) return m; // K. 같은 짧은 곡명 보존
      return '';
    }).trim();
    
    if (!isValidReference(cleanArtist, cleanTitle)) continue;
    
    // 언어 감지: 한글 포함 여부 기준
    const language = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cleanArtist + cleanTitle) ? 'ko' : 'en';
    
    references.push({ 
      artist: cleanArtist, 
      title: cleanTitle, 
      language: language as 'ko' | 'en' | 'is'
    });
  }

  return references;
}

/**
 * 기획안 텍스트를 파싱하여 구조화된 Track[] 데이터로 변환합니다.
 * 
 * WHY: 사용자가 새로운 기획안 텍스트나 메모장 파일을 업로드했을 때,
 *      멀티라인(줄바꿈)으로 나열되거나 하이픈 이외의 다양한 대시 기호가 섞여 있어도
 *      누락 없이 3~5곡 이상의 레퍼런스 곡들을 완벽하게 정규화하여 분석하기 위함.
 * 
 * 기획안 형식 변동 대응 전략:
 * - Track 패턴: 'Track XX', 'Track XX.', 'Track XX:', 'TrackXX' 다양한 표기 지원
 * - 레퍼런스 키워드: '가사 레퍼런스', '음악 레퍼런스', '참고곡', 'Reference' 등 7종 대응
 * - 섹션 종료 감지: 불릿(●, •, ◆, ▶, *, ○, ■ 등), 빈 줄, 다음 Track 패턴 모두 대응
 * - 구분자: 마침표(.)는 곡명 일부일 수 있으므로 구분자에서 제거, trailing만 후처리
 * - 결과 검증: isValidReference()로 파싱된 모든 후보를 다단계 검증
 * - 블록 감지: 'BLOCK A', 'Part 1', '파트 1', 숫자 기반 자동 감지 모두 대응
 */
export function parsePlaylistText(text: string): Track[] {
  const tracks: Track[] = [];
  
  // 0. UTF-8 BOM 및 윈도우 복사 시 유입될 수 있는 보이지 않는 유니코드 제어 문자 제거
  text = text.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // 'Track XX' 패턴을 기준으로 전체 텍스트를 트랙 블록별로 분할합니다.
  // WHY: 다양한 형식 지원 — 'Track 01', 'Track01', 'Track 1.', 'Track 1:' 등
  const trackBlocks = text.split(/(?=Track\s*\d+[\s\.\:]+)/gi);
  
  // BLOCK/Part 기반 블록 매핑 구축
  // WHY: 기획안에 'BLOCK A: ...', 'Part 1: ...' 등이 명시되어 있는 경우
  //      해당 정보를 활용하여 트랙의 블록을 정확히 지정합니다.
  const blockMap: Map<number, string> = new Map();
  
  // BLOCK 패턴 감지: 'BLOCK A: ... (Track 01~05)'
  const blockRegex = /BLOCK\s+([A-D])\s*[:：]?\s*[^\n]*?Track\s*(\d+)\s*[~～-]\s*(\d+)/gi;
  let blockMatch;
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const blockLabel = blockMatch[1].toUpperCase();
    const startTrack = parseInt(blockMatch[2], 10);
    const endTrack = parseInt(blockMatch[3], 10);
    for (let i = startTrack; i <= endTrack; i++) {
      blockMap.set(i, blockLabel);
    }
  }
  
  // Part 패턴 감지: 'Part 1: ... (Track 01~05)'
  const partRegex = /(?:Part|파트)\s*(\d+)\s*[:：]?\s*[^\n]*?Track\s*(\d+)\s*[~～-]\s*(\d+)/gi;
  let partMatch;
  while ((partMatch = partRegex.exec(text)) !== null) {
    const partNum = parseInt(partMatch[1], 10);
    const startTrack = parseInt(partMatch[2], 10);
    const endTrack = parseInt(partMatch[3], 10);
    // Part 1→A, Part 2→B, Part 3→C, Part 4→D
    const blockLabel = String.fromCharCode(64 + Math.min(partNum, 4));
    for (let i = startTrack; i <= endTrack; i++) {
      blockMap.set(i, blockLabel);
    }
  }

  for (const block of trackBlocks) {
    if (!/^\s*Track/i.test(block)) continue;
    
    // 1. 트랙 번호 및 한글/영문 제목 추출
    //    WHY: 다양한 구분자(콜론, 마침표, 공백)와 번호 형식(01, 1) 모두 지원
    const headerMatch = block.match(/Track\s*(\d+)[\s\.\:]+\s*([^\(\n\r]+)(?:\(([^\)\n\r]+)\))?/i);
    if (!headerMatch) continue;
    
    const trackNum = parseInt(headerMatch[1], 10);
    const titleKo = headerMatch[2].trim();
    const titleEn = headerMatch[3] ? headerMatch[3].trim() : titleKo;
    
    // 2. 장르 추출 (슬래시 구분자가 있는 경우 첫 번째 값만 장르명으로 사용)
    let genre = '알 수 없음';
    const genreMatch = block.match(/(?:장르|음악\s*장르|Genre)[^\n\r:：]*[:：]\s*([^\n\r]+)/i);
    if (genreMatch) {
      genre = genreMatch[1].trim();
      if (genre.includes('/')) {
        genre = genre.split('/')[0].trim();
      }
    }
    
    // 3. BPM 추출 (템포/BPM 라인에서 숫자를 파싱하거나, 전체 블록 내 폴백 검색)
    let bpm = 80;
    const bpmMatch = block.match(/(?:템포|BPM|Tempo)[^\n\r:：]*[:：]\s*([^\n\r]+)/i);
    if (bpmMatch) {
      const bpmLine = bpmMatch[1].trim();
      const numMatch = bpmLine.match(/\d+/);
      if (numMatch) {
        bpm = parseInt(numMatch[0], 10);
      }
    } else {
      // 폴백: 블록 내에서 BPM 숫자를 직접 찾기
      const fallbackBpm = block.match(/(?:템포|BPM|Tempo)[^\n\r]*?(\d+)/i);
      if (fallbackBpm) {
        bpm = parseInt(fallbackBpm[1], 10);
      }
    }
    
    // 4. 가사 레퍼런스 추출 — 다양한 키워드 패턴 지원
    const references: Song[] = [];
    
    for (const refPattern of REFERENCE_SECTION_PATTERNS) {
      const refMatch = block.match(refPattern);
      if (refMatch && refMatch.index !== undefined) {
        // 레퍼런스 키워드 이후의 텍스트 위치
        const refStartPos = refMatch.index + refMatch[0].length;
        
        // 레퍼런스 섹션 종료 위치 감지
        const refEndOffset = findReferenceSectionEnd(block, refStartPos);
        
        // 레퍼런스 텍스트 추출
        const refText = block.substring(refStartPos, refStartPos + refEndOffset).trim();
        
        // 개별 곡 파싱
        const parsed = extractReferenceSongs(refText);
        references.push(...parsed);
        
        // 첫 번째 매칭 패턴에서 성공적으로 추출했으면 중단
        if (parsed.length > 0) break;
      }
    }
    
    // 5. 트랙 번호에 따라 블록 지정
    //    WHY: 기획안에 명시된 BLOCK/Part 매핑이 있으면 우선 사용하고,
    //         없으면 5개 단위 기본 규칙으로 폴백합니다.
    let blockGroup: 'A' | 'B' | 'C' | 'D' = 'A';
    
    if (blockMap.has(trackNum)) {
      // 기획안에 명시된 블록 매핑 사용
      blockGroup = blockMap.get(trackNum) as 'A' | 'B' | 'C' | 'D';
    } else {
      // 기본 규칙: 5개 단위로 블록 분할
      if (trackNum > 5 && trackNum <= 10) blockGroup = 'B';
      else if (trackNum > 10 && trackNum <= 15) blockGroup = 'C';
      else if (trackNum > 15) blockGroup = 'D';
    }

    tracks.push({
      number: trackNum,
      titleKo,
      titleEn,
      block: blockGroup,
      genre,
      bpm,
      references
    });
  }
  
  return tracks.sort((a, b) => a.number - b.number);
}
