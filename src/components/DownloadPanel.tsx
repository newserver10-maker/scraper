import { useState } from 'react';
import type { Track, LyricsData } from '../types';
import {
  formatAllAsMarkdown,
  formatAllAsText,
  formatAllAsJson,
  printLyricsPdf,
  downloadBlob
} from '../utils/clientFormatter';

interface DownloadPanelProps {
  show: boolean;
  format: 'md' | 'txt' | 'json' | 'pdf';
  tracks: Track[];
  localCache: Record<string, LyricsData>;
  onFormatChange: (format: 'md' | 'txt' | 'json' | 'pdf') => void;
  onClose: () => void;
}

const BLOCKS = [
  { id: 'A', name: 'Block A — 이륙과 이탈' },
  { id: 'B', name: 'Block B — 순항 고도' },
  { id: 'C', name: 'Block C — 시차 적응' },
  { id: 'D', name: 'Block D — 낯선 베란다' },
] as const;

const FORMAT_DESC = {
  md: '트랙별 메타데이터(BPM, 장르 등)와 가사들을 이쁜 마크다운 파일(.md)로 구조화합니다.',
  txt: '불필요한 서식을 제거하고 순수 가사 내용만 깔끔하게 구성된 파일(.txt)을 저장합니다.',
  json: '트랙 정보 및 가사 메타데이터 전체를 기계 판독이 용이한 구조화된 JSON 파일(.json)로 내보냅니다.',
  pdf: '한글 깨짐이 없는 최상의 화질을 보증하며, 트랙마다 새 페이지 처리가 적용된 가사집 PDF 파일로 인쇄 및 저장합니다.'
} as const;

function DownloadPanel({
  show,
  format,
  tracks,
  localCache,
  onFormatChange,
  onClose
}: DownloadPanelProps) {
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);

  // 전체 트랙 다운로드 핸들러
  const handleFullDownload = () => {
    if (format === 'md') {
      const content = formatAllAsMarkdown(tracks, localCache);
      downloadBlob(content, 'anti-gravity-all-lyrics.md', 'text/markdown;charset=utf-8');
    } else if (format === 'txt') {
      const content = formatAllAsText(tracks, localCache);
      downloadBlob(content, 'anti-gravity-all-lyrics.txt', 'text/plain;charset=utf-8');
    } else if (format === 'json') {
      const content = formatAllAsJson(tracks, localCache);
      downloadBlob(content, 'anti-gravity-all-lyrics.json', 'application/json;charset=utf-8');
    } else if (format === 'pdf') {
      printLyricsPdf(tracks, localCache);
    }
  };

  // 블록별 트랙 다운로드 핸들러
  const handleBlockDownload = (blockId: string) => {
    if (format === 'md') {
      const content = formatAllAsMarkdown(tracks, localCache, blockId);
      downloadBlob(content, `anti-gravity-block-${blockId.toLowerCase()}-lyrics.md`, 'text/markdown;charset=utf-8');
    } else if (format === 'txt') {
      const content = formatAllAsText(tracks, localCache, blockId);
      downloadBlob(content, `anti-gravity-block-${blockId.toLowerCase()}-lyrics.txt`, 'text/plain;charset=utf-8');
    } else if (format === 'json') {
      const content = formatAllAsJson(tracks, localCache, blockId);
      downloadBlob(content, `anti-gravity-block-${blockId.toLowerCase()}-lyrics.json`, 'application/json;charset=utf-8');
    } else if (format === 'pdf') {
      printLyricsPdf(tracks, localCache, blockId);
    }
    setShowBlockDropdown(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-64 right-0 z-40 animate-slide-up">
      <div className="glass-card bg-[#0a0e1a]/95 backdrop-blur-xl border-t border-amber-500/20 p-5 mx-4 mb-4 rounded-xl shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          {/* 포맷 설정 파트 */}
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">
              내보내기 파일 포맷 선택
            </p>

            {/* 4단 포맷 알약 버튼 토글 */}
            <div className="inline-flex rounded-lg bg-white/5 p-1 mb-2">
              {(['md', 'txt', 'json', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => onFormatChange(fmt)}
                  className={`
                    px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 uppercase
                    ${format === fmt
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-gray-400 hover:text-gray-200'
                    }
                  `}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-gray-500 max-w-xl leading-relaxed">
              {FORMAT_DESC[format]}
            </p>
          </div>

          {/* 다운로드 트리거 버튼 그룹 */}
          <div className="flex items-center gap-3 pt-3">
            <button
              onClick={handleFullDownload}
              className="btn-amber text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            >
              📥 {format === 'pdf' ? 'PDF 인쇄 / 저장' : '전체 다운로드'}
            </button>

            {/* 블록별 내보내기 드롭다운 */}
            <div className="relative">
              <button
                onClick={() => setShowBlockDropdown(!showBlockDropdown)}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all border border-white/10 flex items-center gap-1"
              >
                📦 블록별 다운로드
              </button>

              {showBlockDropdown && (
                <div className="absolute bottom-full mb-2 right-0 w-52 glass-card bg-[#0b0f1d]/95 backdrop-blur-xl p-1.5 space-y-1 animate-enter border border-white/10 rounded-lg shadow-xl">
                  {BLOCKS.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => handleBlockDownload(block.id)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-400 hover:bg-white/5 hover:text-amber-400 transition-colors"
                    >
                      {block.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={() => {
              setShowBlockDropdown(false);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0 mt-2"
            aria-label="패널 닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default DownloadPanel;
