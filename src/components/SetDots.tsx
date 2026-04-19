// ABOUT: Row of dots indicating session progress: done/active/rest for each set.

type Props = {
  total: number;
  currentIdx: number;
  phase: 'work' | 'rest';
};

export function SetDots({ total, currentIdx, phase }: Props) {
  return (
    <div className="set-dots" role="list" aria-label={`Set ${currentIdx + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        let cls = 'dot';
        if (i < currentIdx) cls += ' done';
        else if (i === currentIdx) cls += phase === 'rest' ? ' rest' : ' active';
        return <div key={i} role="listitem" className={cls} />;
      })}
    </div>
  );
}
