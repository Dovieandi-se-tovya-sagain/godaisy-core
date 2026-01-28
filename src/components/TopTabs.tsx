interface Props {
  active: "home" | "marine" | "activity";
  onTabChange: (val: "home" | "marine" | "activity") => void;
}

export default function TopTabs({ active, onTabChange }: Props) {
  const items = [
    { id: "home", label: "Home" },
    { id: "marine", label: "Marine" },
    { id: "activity", label: "Activity" },
  ] as const;

  return (
    <nav className="top-tabs" aria-label="Primary weather sections">
      {items.map(it => (
        <button
          key={it.id}
          role="tab"
          aria-selected={active === it.id}
          className={active === it.id ? "active" : ""}
          onClick={() => onTabChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
