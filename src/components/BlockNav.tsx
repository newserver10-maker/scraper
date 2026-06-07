interface BlockNavProps {
  activeBlock: string;
  onBlockChange: (block: string) => void;
  completedCount: number;
  totalCount: number;
}

// 블록 정의 — 앨범의 4개 섹션, 각각 고유한 테마와 트랙 범위를 가짐
const BLOCKS = [
  { id: 'A', name: '이륙과 이탈', range: 'Track 01~05' },
  { id: 'B', name: '순항 고도',   range: 'Track 06~10' },
  { id: 'C', name: '시차 적응',   range: 'Track 11~15' },
  { id: 'D', name: '낯선 베란다', range: 'Track 16~20' },
] as const;

function BlockNav({ activeBlock, onBlockChange, completedCount, totalCount }: BlockNavProps) {
  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-night-800/80 backdrop-blur-lg border-r border-white/10 flex flex-col z-30">
      {/* 로고 & 타이틀 영역 */}
      <div className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl" role="img" aria-label="비행기">✈️</span>
          <h1 className="font-heading text-xl font-bold text-white tracking-wide">
            NOCTURNAL FLIGHT
          </h1>
        </div>
        <p className="text-xs text-amber-400/80 font-medium tracking-wider ml-9">
          가사 레퍼런스 수집기
        </p>
      </div>

      {/* 네비게이션 목록 */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {/* 전체 보기 — 필터 해제 용도 */}
        <button
          onClick={() => onBlockChange('all')}
          className={`
            w-full text-left px-4 py-3 rounded-lg transition-all duration-300
            ${activeBlock === 'all'
              ? 'bg-amber-500/10 text-amber-400 border-l-2 border-amber-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-l-2 border-transparent'
            }
          `}
        >
          <span className="font-heading font-semibold text-sm">전체 보기</span>
          <span className="block text-xs opacity-60 mt-0.5">Track 01~20</span>
        </button>

        {/* 블록별 버튼 — 활성 상태에서 앰버 왼쪽 보더 + 글로우 */}
        {BLOCKS.map(block => {
          const isActive = activeBlock === block.id;
          return (
            <button
              key={block.id}
              onClick={() => onBlockChange(block.id)}
              className={`
                w-full text-left px-4 py-3 rounded-lg transition-all duration-300
                ${isActive
                  ? 'bg-amber-500/10 border-l-2 border-amber-500'
                  : 'hover:bg-white/5 border-l-2 border-transparent'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`
                    font-heading font-bold text-lg
                    ${isActive ? 'text-amber-400 text-glow-amber' : 'text-gray-500'}
                  `}
                >
                  {block.id}
                </span>
                <div>
                  <p className={`text-sm font-medium ${isActive ? 'text-amber-300' : 'text-gray-300'}`}>
                    {block.name}
                  </p>
                  <p className="text-xs text-gray-500">{block.range}</p>
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* 하단 통계 — 전체 수집 진행률을 한눈에 파악 */}
      <div className="p-4 border-t border-white/5">
        <div className="glass-card p-3">
          <p className="text-xs text-gray-400 mb-2">수집 현황</p>
          {/* 프로그레스 바 — 시각적으로 진행률 표시 */}
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
            <div
              className="h-full progress-amber rounded-full transition-all duration-500"
              style={{
                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%',
              }}
            />
          </div>
          <p className="text-sm font-medium">
            <span className="text-amber-400">{completedCount}</span>
            <span className="text-gray-500"> / {totalCount}곡 수집 완료</span>
          </p>
        </div>
      </div>
    </aside>
  );
}

export default BlockNav;
