export default function WaterTempKey(){
  const items=[
    {c:"very-cold", label:"0-15°C"},
    {c:"cold",      label:"15-18°C"},
    {c:"cool",      label:"18-20°C"},
    {c:"comfort",   label:"20-24°C"},
    {c:"warm",      label:"24-28°C"},
    {c:"hot",       label:"28-35°C"}
  ] as const;
  return(
    <div className="water-temp-key" aria-label="Water temperature colour guide">
      {items.map(i=>(
        <span key={i.c} className={i.c}>
          <span role="img" aria-label="Water temperature">💧</span>&nbsp;{i.label}
        </span>
      ))}
    </div>
  );
}
