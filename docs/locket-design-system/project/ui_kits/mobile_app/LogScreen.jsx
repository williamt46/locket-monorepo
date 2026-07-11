// LogScreen — Data entry / Inscription (v2 redesign)

const CATEGORIES_V2 = [
  { key: 'symptoms', label: 'Symptoms', icon: 'healing',             color: T.luteal,        tint: T.lutealTint,      phase: 'luteal',
    chips: ['bleeding','cramps','discharge','headache','acne','bloating','nausea','diarrhea','constipation'] },
  { key: 'mood',     label: 'Mood',     icon: 'sentiment_satisfied', color: T.ovulatoryDeep, tint: T.ovulatoryTint,   phase: 'ovulatory',
    chips: ['low mood','anxious','irritable','calm','happy','tired'] },
  { key: 'sex',      label: 'Sex',      icon: 'favorite',            color: T.menstrual,     tint: T.menstrualTint,   phase: 'menstrual',
    chips: ['solo','partnered','protected','unprotected'] },
  { key: 'triggers', label: 'Triggers', icon: 'bolt',                color: T.follicular,    tint: T.follicularTint,  phase: 'follicular',
    chips: ['stress','poor sleep','travel','alcohol','caffeine'] },
];

const LogScreen = ({ date, onBack, onSave }) => {
  const th = useT();
  const [isStart,  setIsStart]  = React.useState(false);
  const [isEnd,    setIsEnd]    = React.useState(false);
  const [openCat,  setOpenCat]  = React.useState(null);
  const [selected, setSelected] = React.useState({});
  const [note,     setNote]     = React.useState('');

  const toggleChip = (cat, key) => setSelected(s => {
    const next = { ...s };
    const set = new Set(next[cat] || []);
    set.has(key) ? set.delete(key) : set.add(key);
    next[cat] = set;
    return next;
  });

  const displayDate = date
    ? `Today, ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'Today';

  const periodBtnStyle = (active) => ({
    flex: 1, padding: '14px 18px', borderRadius: 14,
    background: active ? T.luteal : T.lutealTint, color: active ? '#FFF' : T.luteal,
    fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
    fontFamily: th.font,
    boxShadow: active ? `0 4px 14px -4px ${T.luteal}` : 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 150ms',
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: th.logBg, position: 'relative' }}>

      {/* Header */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', paddingInline: 16,
        background: th.logBg, flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="Close"
          style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={22} color={th.ink} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: th.ink, paddingRight: 36 }}>{displayDate}</div>
      </div>

      {/* Scroll body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Period Start / End */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setIsStart(v => !v)} style={periodBtnStyle(isStart)} aria-pressed={isStart}>
            {isStart && <span style={{ marginRight: 6 }}>✓</span>}Start <span style={{ opacity: 0.5, margin: '0 6px' }}>|</span> <span>→</span>
          </button>
          <button onClick={() => setIsEnd(v => !v)} style={periodBtnStyle(isEnd)} aria-pressed={isEnd}>
            {isEnd && <span style={{ marginRight: 6 }}>✓</span>}<span>←</span> <span style={{ opacity: 0.5, margin: '0 6px' }}>|</span> End
          </button>
        </div>

        {/* Log experiences card */}
        <Card padding={18} style={{ border: `1px solid ${th.divider}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: th.ink, marginBottom: 14 }}>Log experiences</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CATEGORIES_V2.map(cat => {
              const sel = selected[cat.key] || new Set();
              const isOpen = openCat === cat.key;
              // In dark mode use 20%-alpha phase tint (matches dark-mode.html .chip-dark)
              const pillTint = th.phaseTint(cat.phase);
              return (
                <AccordionPill
                  key={cat.key}
                  icon={cat.icon}
                  label={cat.label}
                  color={cat.color}
                  tint={pillTint}
                  expanded={isOpen}
                  onToggle={() => setOpenCat(o => o === cat.key ? null : cat.key)}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 6 }}>
                    {cat.chips.map(c => (
                      <Chip key={c} variant="outline"
                        phase={cat.phase}
                        selected={sel.has(c)}
                        onPress={() => toggleChip(cat.key, c)}>{c}</Chip>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button onClick={() => setOpenCat(null)} aria-label="Confirm"
                      style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: cat.color, border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Icon name="check" size={18} color="#FFF" />
                    </button>
                  </div>
                </AccordionPill>
              );
            })}
          </div>
        </Card>

        {/* Notes */}
        <div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Share how you feel..."
            style={{
              width: '100%', minHeight: 120, padding: '14px 16px',
              borderRadius: 14, background: th.cardWhite,
              border: `1px solid ${th.divider}`,
              fontFamily: th.font, fontSize: 15, color: th.ink,
              resize: 'none', outline: 'none',
              boxShadow: th.shadow,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Save + clear */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Btn onClick={onSave}>Save / Inscribe</Btn>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', color: T.menstrual,
            fontSize: 15, fontWeight: 500, fontFamily: th.font, padding: '10px 0', cursor: 'pointer',
          }}>Clear Entry</button>
        </div>

        <EncryptionFooter />

      </div>
    </div>
  );
};

Object.assign(window, { LogScreen });
