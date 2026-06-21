// InsightsScreen — Predictions (orbit wheel) + Cycle Trends (dot bars) + Reports

const PHASE_BODY = {
  menstrual:  "Rest and warmth support your body. Light movement and hydration ease discomfort.",
  follicular: "Rising estrogen brings clarity and stamina. A good time for new projects.",
  ovulatory:  "A time for rising energy and social connection. Ensure you're listening to your body's cues.",
  luteal:     "Progesterone encourages reflection. Honour your need for slower pace and nourishment.",
};

const PHASE_LABEL = {
  menstrual:  "You're in your menstrual phase",
  follicular: "You're in your follicular phase",
  ovulatory:  "You're in your ovulation phase",
  luteal:     "You're in your luteal phase",
};

const HISTORY = [
  { title: 'Current · 34 days', sub: 'Started Nov 10', segments: [
    { phase: 'menstrual', count: 5 }, { phase: 'follicular', count: 12 },
    { phase: 'ovulatory', count: 3 }, { phase: 'luteal', count: 9 },
    { phase: 'future', count: 5 } ] },
  { title: '28 days', sub: 'Started Oct 12', segments: [
    { phase: 'menstrual', count: 5 }, { phase: 'follicular', count: 9 },
    { phase: 'ovulatory', count: 3 }, { phase: 'luteal', count: 11 } ] },
  { title: '30 days', sub: 'Started Sep 13', segments: [
    { phase: 'menstrual', count: 6 }, { phase: 'follicular', count: 9 },
    { phase: 'ovulatory', count: 3 }, { phase: 'luteal', count: 12 } ] },
];

const PhaseBar = ({ segments, palette }) => {
  const th = useT();
  const total = segments.reduce((a, s) => a + s.count, 0);
  const pal = palette || {};
  const color = (phase) => ({
    menstrual:  pal.menstrual  || T.menstrual,
    follicular: pal.follicular || T.follicular,
    ovulatory:  pal.ovulatory  || T.ovulatory,
    luteal:     pal.luteal     || T.luteal,
    future:     th.paleLavender,
  }[phase] || th.paleLavender);
  return (
    <div style={{ width: '100%', height: 22, borderRadius: 100, overflow: 'hidden', display: 'flex' }}>
      {segments.map((s, i) => {
        const isFirst = i === 0;
        const isLast  = i === segments.length - 1;
        const isOnly  = segments.length === 1;
        const br = isOnly ? 100 : isFirst ? '100px 0 0 100px' : isLast ? '0 100px 100px 0' : 0;
        const showLabel = s.phase !== 'future' && s.count >= 3;
        return (
          <div key={i} style={{
            flex: s.count, height: '100%',
            background: color(s.phase),
            borderRadius: br,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {showLabel && (
              <span style={{
                fontSize: 9.5, fontWeight: 800, color: '#FFFFFF',
                letterSpacing: 0.3, textShadow: '0 1px 2px rgba(0,0,0,0.25)',
                lineHeight: 1, userSelect: 'none', whiteSpace: 'nowrap',
                overflow: 'hidden', maxWidth: '90%',
              }}>{s.count}d</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const buildDayStrip = (currentPhase, daysRemaining) => {
  const now = new Date();
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const items = [];
  for (let offset = -1; offset <= 3; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const phase = offset <= daysRemaining ? currentPhase : nextPhaseI(currentPhase);
    items.push({ dow: dow[d.getDay()], day: d.getDate(), date: d.toISOString(), phaseColor: T.phaseColor(phase) });
  }
  return items;
};

const nextPhaseI = (p) => ({ menstrual: 'follicular', follicular: 'ovulatory', ovulatory: 'luteal', luteal: 'menstrual' }[p]);

const InsightsScreen = ({ onCalendar, onSettings, onDayPress, phase = 'ovulatory', onPhaseChange, palette, surface }) => {
  const th = useT();
  const [tab, setTab] = React.useState('Insights');
  const daysRemaining = 2;
  const pal = palette || {
    menstrual: T.menstrual, menstrualTint: T.menstrualTint,
    follicular: T.follicular, follicularTint: T.follicularTint,
    ovulatory: T.ovulatory, ovulatoryTint: T.ovulatoryTint,
    luteal: T.luteal, lutealTint: T.lutealTint,
  };
  const phaseColor = pal[phase]          || T.phaseColor(phase);
  const phaseTint  = th.phaseTint(phase);
  const sf         = surface || { pageBg: th.paper };
  const days       = buildDayStrip(phase, daysRemaining);
  const monthName  = new Date().toLocaleDateString('en-US', { month: 'long' });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: sf.pageBg, position: 'relative' }}>

      <MainNavBar active="insights" onCalendar={onCalendar} onInsights={() => {}} onSettings={onSettings} surface={surface} />
      <TabBar tabs={['Insights','Cycle Trends']} active={tab} onChange={setTab} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>

        {/* ─── INSIGHTS TAB ────────────────── */}
        {tab === 'Insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>

            {/* Phase insight card */}
            <div style={{
              width: '100%', background: phaseTint, borderRadius: 16,
              padding: 20, display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: phaseColor, marginBottom: 2 }}>
                {T.phaseName(phase)} Phase
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: th.ink, letterSpacing: '-0.01em' }}>
                {PHASE_LABEL[phase]}
              </div>
              <div style={{ fontSize: 14, color: th.fog }}>{daysRemaining} days remaining</div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: th.fog, margin: '6px 0 0' }}>{PHASE_BODY[phase]}</p>
            </div>

            {/* Orbit gauge */}
            <div style={{ marginTop: 8 }}>
              <OrbitGauge phase={phase} dayInCycle={12} size={244} />
            </div>

            {/* Phase legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 4 }}>
              {['menstrual','follicular','ovulatory','luteal'].map(p => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: pal[p] || T.phaseColor(p), flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: th.fog, fontWeight: 500 }}>{T.phaseName(p)}</span>
                </div>
              ))}
            </div>

            {/* Month + day strip */}
            <div style={{ fontSize: 14, color: th.fog, fontWeight: 500, marginTop: 4 }}>{monthName}</div>
            <div style={{ width: '100%', paddingBottom: 16 }}>
              <DayStrip days={days} activeIndex={1} onDayPress={onDayPress} />
            </div>
          </div>
        )}

        {/* ─── CYCLE TRENDS TAB ────────────── */}
        {tab === 'Cycle Trends' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card padding={16}>
                <IconBadge icon="trending_up" tint={th.locketBlueTint} color={T.locketBlue} />
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.locketBlue, marginTop: 14, marginBottom: 2 }}>Avg Cycle</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: th.ink, letterSpacing: '-0.02em' }}>28 days</div>
                <div style={{ fontSize: 12, color: th.fog, marginTop: 3 }}>consistent with last 6 months</div>
              </Card>
              <Card padding={16}>
                <IconBadge icon="water_drop" tint={th.menstrualTint} color={T.menstrual} fill />
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.locketBlue, marginTop: 14, marginBottom: 2 }}>Avg Period</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: th.ink, letterSpacing: '-0.02em' }}>5 days</div>
                <div style={{ fontSize: 12, color: th.fog, marginTop: 3 }}>normal flow pattern</div>
              </Card>
            </div>

            <SectionHeader icon="history">Cycle History</SectionHeader>

            <Card padding={0}>
              {HISTORY.map((h, i) => (
                <div key={i} style={{ padding: '16px 18px', borderBottom: i < HISTORY.length - 1 ? `1px solid ${th.divider}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: th.ink }}>{h.title}</div>
                      <div style={{ fontSize: 11, color: th.fog, marginTop: 2 }}>{h.sub}</div>
                    </div>
                  </div>
                  <PhaseBar segments={h.segments} palette={palette} />
                </div>
              ))}
            </Card>

            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: th.font, fontSize: 14, fontWeight: 500,
              color: th.fog, padding: '4px 0 12px',
              opacity: 0.7, alignSelf: 'flex-start',
            }}>view full history →</button>
          </div>
        )}

      </div>
    </div>
  );
};

Object.assign(window, { InsightsScreen });
