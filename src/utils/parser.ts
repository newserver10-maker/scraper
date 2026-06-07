import type { Track, Song } from '../types';

/**
 * 기획안 텍스트를 파싱하여 구조화된 Track[] 데이터로 변환합니다.
 * WHY: 사용자가 새로운 기획안 텍스트나 메모장 파일을 업로드했을 때,
 *      멀티라인(줄바꿈)으로 나열되거나 하이픈 이외의 다양한 대시 기호가 섞여 있어도
 *      누락 없이 3~5곡 이상의 레퍼런스 곡들을 완벽하게 정규화하여 분석하기 위함
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
    // WHY: 레퍼런스 곡들이 줄바꿈(\n)되어 여러 행으로 나열되거나 다른 기호가 섞여 있는 경우를 위해
    //      다음 불릿 기호(●) 또는 다음 트랙 표시가 오기 전까지의 텍스트 블록 전체를 매칭합니다.
    const refMatch = block.match(/(?:가사 레퍼런스|레퍼런스):\s*([\s\S]*?)(?=\n\s*●|\n\s*Track|$)/);
    const references: Song[] = [];
    
    if (refMatch) {
      // 콤마(,), 마침표(.), 세미콜론(;), 줄바꿈(\n)을 모두 구분자로 사용하여 곡들을 쪼갭니다.
      const songsRaw = refMatch[1].split(/[,.;\n\r]/);
      for (const songRaw of songsRaw) {
        // 앞뒤 공백 제거 및 행 첫머리에 오는 대시(-), 불릿(•, * 등) 리스트 표시 기호 삭제
        const cleaned = songRaw.trim().replace(/^[-•*#]\s*/, '');
        if (!cleaned) continue;
        
        // 아티스트와 제목을 가르는 구분자를 하이픈(-) 이외에 다양한 대시 기호(–, —, ~) 및 콜론(:)까지 허용
        const parts = cleaned.split(/\s*[-–—~:]\s*/);
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          
          // WHY: 줄바꿈 파싱 범위가 다음 속성 텍스트까지 넘어가 오용 파싱되는 것을 원천 방지하기 위해
          //      기획안 본문의 세부 메타데이터 속성명은 아티스트명에서 블랙리스트 제외 처리합니다.
          const blacklist = [
            '공간 서사', '공간서사', '알고리즘', '보컬 가창법', '보컬가창법', 
            '청각적 후킹', '청각적후킹', '주요 악기', '주요악기', '음악 장르', 
            '음악장르', '템포', 'BPM', '가창자 성별', '가창자성별', '음악 구성', 
            '음악구성', '프로젝트명', '부제', '기획의 본질', '기획의본질', 
            '시각적 무드', '시각적무드', '영상 제목', '영상제목', '보컬 가창',
            '보컬가창', '후킹 요소', '후킹요소', '연주법'
          ];
          
          const isBlacklisted = blacklist.some((item) => artist.includes(item));
          if (isBlacklisted) continue;
          
          // 제목 안에 하이픈이 다시 들어갈 수 있으므로 join으로 원복
          const title = parts.slice(1).join('-').trim();
          const language = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(artist + title) ? 'ko' : 'en';
          
          if (artist && title) {
            references.push({ artist, title, language });
          }
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
