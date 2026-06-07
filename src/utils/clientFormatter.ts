import type { Track, LyricsData } from '../types';

export interface LyricEntry {
  artist: string;
  title: string;
  lyrics: string | null;
}

const blockNames: Record<string, string> = {
  A: '이륙과 이탈',
  B: '순항과 난기류',
  C: '착륙과 도시',
  D: '체류와 회귀',
};

/**
 * 단일 트랙의 가사를 Markdown으로 포맷
 */
export function formatAsMarkdown(
  track: Track,
  lyrics: LyricEntry[]
): string {
  const trackNum = String(track.number).padStart(2, '0');
  const blockLabel = blockNames[track.block] ?? track.block;

  const lines: string[] = [
    `# Track ${trackNum}: ${track.titleKo} (${track.titleEn})`,
    `> 🎵 ${track.genre} | ${track.bpm} BPM | Block ${track.block}: ${blockLabel}`,
    '',
    '---',
    '',
  ];

  lyrics.forEach((entry, idx) => {
    lines.push(`## ${idx + 1}. ${entry.artist} - ${entry.title}`);
    lines.push('');

    if (entry.lyrics) {
      lines.push(entry.lyrics);
    } else {
      lines.push('*가사를 찾을 수 없습니다.*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 전체 또는 블록별 트랙을 하나의 Markdown 문서로 결합
 */
export function formatAllAsMarkdown(
  tracks: Track[],
  allLyrics: Record<string, LyricsData>,
  blockId?: string
): string {
  const filteredTracks = blockId
    ? tracks.filter((t) => t.block === blockId)
    : tracks;

  const blockText = blockId ? ` - Block ${blockId}` : '';

  const header = [
    `# 🌙 Anti-Gravity: Nocturnal Flight — 가사 레퍼런스 모음${blockText}`,
    '',
    `> 생성일: ${new Date().toLocaleDateString('ko-KR')}`,
    `> 전체 트랙: ${filteredTracks.length}개 | 전체 레퍼런스: ${filteredTracks.length * 3}곡`,
    '',
    '---',
    '',
    '',
  ];

  const sections: string[] = [];
  let currentBlock = '';

  for (const track of filteredTracks) {
    if (track.block !== currentBlock) {
      currentBlock = track.block;
      const blockLabel = blockNames[track.block] ?? track.block;
      sections.push(`\n# ═══ Block ${track.block}: ${blockLabel} ═══\n`);
    }

    const lyrics: LyricEntry[] = track.references.map((ref, idx) => {
      const entry = allLyrics[`${track.number}-${idx}`];
      return {
        artist: ref.artist,
        title: ref.title,
        lyrics: entry?.lyrics ?? null,
      };
    });

    sections.push(formatAsMarkdown(track, lyrics));
  }

  return header.join('\n') + sections.join('\n');
}

/**
 * 단일 트랙의 가사를 순수 텍스트로 포맷
 */
export function formatAsText(
  track: Track,
  lyrics: LyricEntry[]
): string {
  const trackNum = String(track.number).padStart(2, '0');
  const separator = '========================================';
  const divider = '----------------------------------------';

  const lines: string[] = [
    separator,
    `Track ${trackNum}: ${track.titleKo} (${track.titleEn})`,
    `${track.genre} | ${track.bpm} BPM`,
    separator,
    '',
  ];

  lyrics.forEach((entry, idx) => {
    lines.push(`[ ${entry.artist} - ${entry.title} ]`);
    lines.push('');

    if (entry.lyrics) {
      lines.push(entry.lyrics);
    } else {
      lines.push('(가사를 찾을 수 없습니다)');
    }

    lines.push('');

    if (idx < lyrics.length - 1) {
      lines.push(divider);
      lines.push('');
    }
  });

  return lines.join('\n');
}

/**
 * 전체 또는 블록별 트랙을 하나의 TXT 문서로 결합
 */
export function formatAllAsText(
  tracks: Track[],
  allLyrics: Record<string, LyricsData>,
  blockId?: string
): string {
  const filteredTracks = blockId
    ? tracks.filter((t) => t.block === blockId)
    : tracks;

  const blockText = blockId ? ` - Block ${blockId}` : '';

  const header = [
    '╔══════════════════════════════════════════════╗',
    `║  Anti-Gravity: Nocturnal Flight${blockText.padEnd(14)}║`,
    '║  가사 레퍼런스 모음                              ║',
    '╚══════════════════════════════════════════════╝',
    '',
    `생성일: ${new Date().toLocaleDateString('ko-KR')}`,
    `전체 트랙: ${filteredTracks.length}개 | 전체 레퍼런스: ${filteredTracks.length * 3}곡`,
    '',
    '',
  ];

  const sections: string[] = [];
  let currentBlock = '';

  for (const track of filteredTracks) {
    if (track.block !== currentBlock) {
      currentBlock = track.block;
      const blockLabel = blockNames[track.block] ?? track.block;
      sections.push('');
      sections.push(`══════ Block ${track.block}: ${blockLabel} ══════`);
      sections.push('');
    }

    const lyrics: LyricEntry[] = track.references.map((ref, idx) => {
      const entry = allLyrics[`${track.number}-${idx}`];
      return {
        artist: ref.artist,
        title: ref.title,
        lyrics: entry?.lyrics ?? null,
      };
    });

    sections.push(formatAsText(track, lyrics));
    sections.push('');
  }

  return header.join('\n') + sections.join('\n');
}

/**
 * 수집 완료된 전체 또는 블록별 가사 데이터를 정형화된 JSON 파일 포맷으로 빌드
 * WHY: 외부 데이터 연동이나 타 프로그램 연동 및 기계 가독성을 확보하기 위함
 */
export function formatAllAsJson(
  tracks: Track[],
  allLyrics: Record<string, LyricsData>,
  blockId?: string
): string {
  const filteredTracks = blockId
    ? tracks.filter((t) => t.block === blockId)
    : tracks;

  const data = filteredTracks.map((track) => {
    const songs = track.references.map((ref, idx) => {
      const entry = allLyrics[`${track.number}-${idx}`];
      return {
        artist: ref.artist,
        title: ref.title,
        language: ref.language,
        lyrics: entry?.lyrics ?? null,
        geniusUrl: entry?.geniusUrl ?? null,
        scrapedAt: entry?.scrapedAt ?? null,
        error: entry?.error ?? null,
      };
    });

    return {
      trackNumber: track.number,
      titleKo: track.titleKo,
      titleEn: track.titleEn,
      block: track.block,
      blockName: blockNames[track.block] ?? track.block,
      genre: track.genre,
      bpm: track.bpm,
      references: songs,
    };
  });

  return JSON.stringify(data, null, 2);
}

/**
 * 가사집 내용을 담아 인코딩/한글 깨짐 현상이 없는 고품질 PDF 인쇄(Print to PDF) 대화 상자를 띄웁니다.
 * WHY: 클라이언트 웹 환경에서 한글 깨짐 없이 트랙별 강제 페이지네이션(Page break)이
 *      적용된 고품질 가사집 책자 PDF 파일을 무료로 저장할 수 있는 최선의 방법입니다.
 */
export function printLyricsPdf(
  tracks: Track[],
  allLyrics: Record<string, LyricsData>,
  blockId?: string
): void {
  const filteredTracks = blockId
    ? tracks.filter((t) => t.block === blockId)
    : tracks;

  const blockText = blockId ? ` - Block ${blockId}` : '';
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    alert('팝업 차단이 설정되어 있습니다. 브라우저 설정에서 팝업 허용 후 다시 시도해 주세요.');
    return;
  }

  // 프린트용 HTML 조립
  let html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Nocturnal Flight 가사집${blockText}</title>
      <style>
        body {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
          color: #1a1a1a;
          line-height: 1.7;
          padding: 40px;
          background: #ffffff;
        }
        h1, h2, h3 {
          color: #0b0f1d;
          font-weight: bold;
        }
        h1 {
          border-bottom: 3px solid #FF8C42;
          padding-bottom: 12px;
          font-size: 26px;
          margin-bottom: 30px;
        }
        .meta-global {
          font-size: 13px;
          color: #777;
          margin-bottom: 40px;
        }
        .track-block {
          page-break-before: always; /* 트랙 번호 바뀔 때마다 새 페이지 강제 적용 */
        }
        .track-block:first-of-type {
          page-break-before: avoid;
        }
        .track-header {
          border-bottom: 1px solid #eee;
          padding-bottom: 8px;
          margin-top: 30px;
        }
        .track-header h2 {
          font-size: 20px;
          margin: 0;
        }
        .meta-track {
          font-size: 12px;
          color: #888;
          margin: 4px 0 20px 0;
        }
        .song-block {
          margin-bottom: 35px;
        }
        .song-title {
          font-size: 15px;
          margin-top: 25px;
          margin-bottom: 12px;
          border-left: 4px solid #FF8C42;
          padding-left: 10px;
          color: #0f172a;
        }
        .lyrics {
          font-size: 12px;
          white-space: pre-wrap;
          color: #334155;
          margin-left: 14px;
          font-family: inherit;
          line-height: 1.8;
        }
        .section-header {
          font-weight: bold;
          color: #475569;
          margin-top: 10px;
          margin-bottom: 5px;
          display: block;
        }
        @media print {
          body { padding: 0; }
          .track-block { page-break-before: always; }
          .track-block:first-of-type { page-break-before: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>🌙 Anti-Gravity: Nocturnal Flight 가사집${blockText}</h1>
      <p class="meta-global">생성일: ${new Date().toLocaleDateString('ko-KR')} | 전체 트랙: ${filteredTracks.length}개 | 전체 참조곡: ${filteredTracks.length * 3}곡</p>
  `;

  filteredTracks.forEach((track) => {
    const trackNum = String(track.number).padStart(2, '0');
    const blockLabel = blockNames[track.block] ?? track.block;
    
    html += `
      <div class="track-block">
        <div class="track-header">
          <h2>Track ${trackNum}: ${track.titleKo} (${track.titleEn})</h2>
          <p class="meta-track">🎵 ${track.genre} | ${track.bpm} BPM | Block ${track.block}: ${blockLabel}</p>
        </div>
    `;

    track.references.forEach((ref, idx) => {
      const entry = allLyrics[`${track.number}-${idx}`];
      let lyricsContent = '(가사를 찾을 수 없습니다)';
      
      if (entry?.lyrics) {
        // [Verse 1] 등 가사 섹션 타이틀에 볼드 스타일 처리 적용
        lyricsContent = entry.lyrics.replace(/(\[[^\]]+\])/g, '<span class="section-header">$1</span>');
      }

      html += `
        <div class="song-block">
          <h3 class="song-title">${idx + 1}. ${ref.artist} - ${ref.title}</h3>
          <div class="lyrics">${lyricsContent}</div>
        </div>
      `;
    });

    html += `</div>`; // track-block close
  });

  html += `
      <script>
        window.onload = function() {
          window.print();
          // 인쇄 완료 또는 취소 후 팝업 윈도우 자동 종료 처리
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * 브라우저 상에서 Blob 파일을 생성해 즉시 다운로드 창을 띄웁니다.
 */
export function downloadBlob(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
