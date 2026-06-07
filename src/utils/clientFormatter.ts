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
 * 브라우저 상에서 Blob 파일을 생성해 즉시 다운로드 창을 띄웁니다.
 * WHY: 백엔드 서버 없이 브라우저 단독으로 로컬 디스크 파일 저장을 수행하기 위함
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
