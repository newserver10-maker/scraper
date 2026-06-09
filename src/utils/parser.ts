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
  const strippedArtist = artist.replace(/[\s\-_()&]/g, '');
  if (/^\d+$/.test(strippedArtist)) return false;

  // 4. 아티스트명이 비정상적으로 긴 경우 거부 (40자 초과)
  //    WHY: 실제 아티스트명이 40자를 넘는 경우는 극히 드물며,
  //         기획안의 설명 문장이 아티스트로 잘못 파싱된 경우일 가능성이 높음
  if (artist.length > 40) return false;

  // 5. 곡명에 기획안 구조 마커가 포함된 경우 거부
  //    WHY: "(3분 12초)", "➔ Verse 1 (36s)" 같은 음악 구성 텍스트가 곡명에 혼입되는 것 방지
  if (/\d+s\)/.test(title) || /➔/.test(title)) return false;

  // 6. 아티스트명에 문장 부호가 과도하게 포함된 경우 거부
  //    WHY: 기획안의 설명 문장이 파싱된 경우 마침표, 쉼표 등이 다수 포함됨.
  //         단, 괄호 안의 마침표는 제외 — "디오 (D.O.)" 같은 약자명을 보호합니다.
  const artistWithoutParens = artist.replace(/\(.*?\)/g, '');
  const punctuationCount = (artistWithoutParens.match(/[。.!?]/g) || []).length;
  if (punctuationCount >= 2) return false;

  return true;
}

/**
 * 기획안 텍스트를 파싱하여 구조화된 Track[] 데이터로 변환합니다.
 * 
 * WHY: 사용자가 새로운 기획안 텍스트나 메모장 파일을 업로드했을 때,
 *      멀티라인(줄바꿈)으로 나열되거나 하이픈 이외의 다양한 대시 기호가 섞여 있어도
 *      누락 없이 3~5곡 이상의 레퍼런스 곡들을 완벽하게 정규화하여 분석하기 위함.
 * 
 * 기획안 형식 변동 대응 전략:
 * - 레퍼런스 섹션 키워드: "가사 레퍼런스" 필수, 단순 "레퍼런스"는 오인 위험으로 제외
 * - 섹션 종료 감지: 다양한 불릿(●, •, ◆, ▶, ○, ■ 등), 빈 줄, 다음 Track 패턴 모두 대응
 * - 구분자: 마침표(.)는 곡명 일부일 수 있으므로 구분자에서 제거, trailing만 후처리
 * - 결과 검증: isValidReference()로 파싱된 모든 후보를 다단계 검증
 */
export function parsePlaylistText(text: string): Track[] {
  const tracks: Track[] = [];
  
  // 'Track XX:' 패턴을 기준으로 전체 텍스트를 트랙 블록별로 분할합니다.
  const trackBlocks = text.split(/(?=Track \d+:)/g);
  
  for (const block of trackBlocks) {
    if (!block.trim().startsWith('Track')) continue;
    
    // 1. 트랙 번호 및 한글/영문 제목 추출
    const headerMatch = block.match(/Track (\d+):\s*([^\(\n\r]+)(?:\(([^\)\n\r]+)\))?/);
    if (!headerMatch) continue;
    
    const trackNum = parseInt(headerMatch[1], 10);
    const titleKo = headerMatch[2].trim();
    const titleEn = headerMatch[3] ? headerMatch[3].trim() : titleKo;
    
    // 2. 장르 추출
    const genreMatch = block.match(/(?:장르|음악 장르):\s*([^\n\r]+)/);
    const genre = genreMatch ? genreMatch[1].trim() : '알 수 없음';
    
    // 3. BPM 추출
    const bpmMatch = block.match(/(?:템포|BPM):\s*(\d+)/);
    const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 80;
    
    // 4. 가사 레퍼런스 추출
    // WHY: "가사 레퍼런스"로만 한정하여 매칭합니다.
    //      단순 "레퍼런스"는 기획안 내 다른 맥락(영상 레퍼런스, 비주얼 레퍼런스 등)에서도
    //      등장할 수 있어 오인 위험이 높습니다.
    //
    // 섹션 종료 감지를 유연하게 구성:
    //   - 다양한 불릿 기호 (●, •, ◆, ▶, ○, ■, ◇, ▷, ★, ☆ 등)
    //   - "BLOCK" 또는 "Track" 시작 패턴
    //   - 줄바꿈 후 빈 줄 2개 이상 (섹션 간 구분)
    //   - ---PAGE BREAK--- 같은 구분선
    const refMatch = block.match(
      /가사 레퍼런스:\s*([\s\S]*?)(?=\n\s*[●•◆▶○■◇▷★☆]\s|\n\s*Track\s|\n\s*BLOCK\s|\n\s*---|\n\s*\n\s*\n|$)/
    );
    const references: Song[] = [];
    
    if (refMatch) {
      let refText = refMatch[1].trim();
      
      // 전체 레퍼런스 텍스트의 줄바꿈을 공백으로 합침
      // WHY: 기획안의 레퍼런스 섹션은 논리적으로 항상 한 줄이며, 줄바꿈은 단지
      //       에디터/PDF의 물리적 줄넘김입니다. "James\nBlake - Lindisfarne"가
      //       "James Blake - Lindisfarne"으로 올바르게 복원됩니다.
      refText = refText.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      
      // 맨 끝의 trailing 마침표 제거
      refText = refText.replace(/\.\s*$/, '');
      
      // 콤마 기반 분할 + 아티스트-곡명 패턴 인식
      // WHY: 단순 콤마 분할은 "Cocteau Twins - Sea, Swallow Me" 같은 곡명을
      //       쪼개버리므로, "콤마 뒤에 [아티스트] - [곡명] 패턴이 있는 콤마"만
      //       진짜 구분자로 인식합니다.
      //
      // 전략: 정규식으로 "아티스트 - 곡명" 단위를 직접 매칭합니다.
      //   아티스트: 대시 앞의 텍스트 (다음 아티스트-곡명 쌍이 올 때까지)
      //   곡명: 대시 뒤부터 다음 콤마+아티스트 패턴 직전까지
      //
      // 패턴: [아티스트] - [곡명] (, [아티스트] - [곡명])*
      //        곡명에는 콤마가 포함될 수 있음 (ex: "Sea, Swallow Me")
      const songPattern = /([^,]+?)\s+[-–—~]\s+(.+?)(?=,\s*[^,]+?\s+[-–—~]\s|$)/g;
      const songsRaw: string[] = [];
      
      let match;
      while ((match = songPattern.exec(refText)) !== null) {
        const rawArtist = match[1].trim();
        const rawTitle = match[2].trim();
        // 조합하여 원본 형태로 보존
        songsRaw.push(`${rawArtist} - ${rawTitle}`);
      }
      
      // 패턴 매칭이 실패한 경우 폴백: 단순 콤마 분할
      if (songsRaw.length === 0) {
        const splits = refText.split(/\s*,\s*|;/);
        songsRaw.push(...splits);
      }
      
      for (const songRaw of songsRaw) {
        // 앞뒤 공백 제거 및 행 첫머리에 오는 다양한 리스트 기호 삭제
        const cleaned = songRaw.trim().replace(/^[-•*#▪▸▹◦\d+).\s]+/, '');
        if (!cleaned || cleaned.length < 3) continue;
        
        // 아티스트와 제목을 가르는 구분자: 하이픈(-), 대시(–, —), 틸드(~) 허용
        // WHY: 콜론(:)은 기획안 속성명 구분자로도 쓰이므로 여기서는 제외
        //      (이전에 콜론을 포함하면 "음악 장르: Ambient Pop" 같은 것이 매칭됨)
        const parts = cleaned.split(/\s*[-–—~]\s*/);
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          
          // 제목 안에 하이픈이 다시 들어갈 수 있으므로 join으로 원복
          const songTitle = parts.slice(1).join('-').trim();
          
          // 다단계 유효성 검증
          if (!isValidReference(artist, songTitle)) continue;
          
          const language = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(artist + songTitle) ? 'ko' : 'en';
          
          references.push({ artist, title: songTitle, language });
        }
      }
    }
    
    // 5. 트랙 번호에 따라 5개 단위로 블록 A, B, C, D 지정
    let blockGroup: 'A' | 'B' | 'C' | 'D' = 'A';
    if (trackNum > 5 && trackNum <= 10) blockGroup = 'B';
    else if (trackNum > 10 && trackNum <= 15) blockGroup = 'C';
    else if (trackNum > 15) blockGroup = 'D';

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
