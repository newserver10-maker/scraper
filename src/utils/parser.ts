import type { Track, Song } from '../types';

/**
 * 기획안 텍스트를 파싱하여 구조화된 Track[] 데이터로 변환합니다.
 * WHY: 사용자가 새로운 기획안 파일(텍스트)을 붙여넣거나 로드했을 때,
 *      프로그램이 트랙 번호, 제목, 장르, BPM, 레퍼런스 곡 목록을 자동으로 추출하기 위함
 */
export function parsePlaylistText(text: string): Track[] {
  const tracks: Track[] = [];
  
  // 'Track XX:' 패턴을 기준으로 전체 텍스트를 트랙 블록별로 분할합니다.
  const trackBlocks = text.split(/(?=Track \d+:)/g);
  
  for (const block of trackBlocks) {
    if (!block.trim().startsWith('Track')) continue;
    
    // 1. 트랙 번호 및 한글/영문 제목 추출
    // 예: "Track 01: 관제탑의 불빛 (Tower Lights)"
    const headerMatch = block.match(/Track (\d+):\s*([^\(\n\r]+)(?:\(([^\)\n\r]+)\))?/);
    if (!headerMatch) continue;
    
    const trackNum = parseInt(headerMatch[1], 10);
    const titleKo = headerMatch[2].trim();
    const titleEn = headerMatch[3] ? headerMatch[3].trim() : titleKo;
    
    // 2. 장르 추출
    // 예: "● 음악 장르: Ambient Pop"
    const genreMatch = block.match(/(?:장르|음악 장르):\s*([^\n\r]+)/);
    const genre = genreMatch ? genreMatch[1].trim() : '알 수 없음';
    
    // 3. BPM 추출
    // 예: "● 템포: 80 BPM"
    const bpmMatch = block.match(/(?:템포|BPM):\s*(\d+)/);
    const bpm = bpmMatch ? parseInt(bpmMatch[1], 10) : 80;
    
    // 4. 가사 레퍼런스(아티스트 - 곡명) 추출
    // 예: "● 가사 레퍼런스: 오존 (O3ohn) - Down, Cigarettes After Sex - K., Radiohead - Lift."
    const refMatch = block.match(/(?:가사 레퍼런스|레퍼런스):\s*([^\n\r]+)/);
    const references: Song[] = [];
    
    if (refMatch) {
      // 쉼표(,)나 마침표(.)를 기준으로 여러 곡들을 분리합니다.
      const songsRaw = refMatch[1].split(/[,.]/);
      for (const songRaw of songsRaw) {
        const parts = songRaw.split('-');
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          // 제목 내에 대시(-)가 있을 수도 있으므로, 첫 번째를 제외한 나머지를 다시 join합니다.
          const title = parts.slice(1).join('-').trim();
          
          // 아티스트명과 제목에 한글이 포함되어 있는지 확인하여 언어 코드를 판단합니다.
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
  
  // 트랙 번호 순으로 정렬하여 반환
  return tracks.sort((a, b) => a.number - b.number);
}
