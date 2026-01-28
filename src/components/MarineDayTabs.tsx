interface Props {
  activeIdx: number;
  onChange: (idx: number) => void;
}

export default function MarineDayTabs({ activeIdx, onChange }: Props) {
  const labels = ["Today", "Tomorrow", "Day 3", "Day 4", "Day 5"];
  return (
    <nav className="sub-tabs" aria-label="Marine forecast days">
      {labels.map((l, i) => (
        <button
          key={i}
          role="tab"
          aria-selected={activeIdx === i}
          className={activeIdx === i ? "active" : ""}
          onClick={() => onChange(i)}
        >
          {l}
        </button>
      ))}
    </nav>
  );
}