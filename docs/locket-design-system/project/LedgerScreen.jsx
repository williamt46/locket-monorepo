// LedgerScreen — Vertical scroll calendar: previous, current, next month

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const SAMPLE_DATA = (() => {
  const d = {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = 1; i <= 5; i++) {
    d[`${y}-${m}-${i}`] = { isPeriod: true, isStart: i === 1, isEnd: i === 5 };
  }
  return d;
})();

const FUTURE_DATA = (() => {
  const d = {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  for (let i = 26; i <= 30; i++) {
    d[`${y}-${m}-${i}`] = true;
  }
  return d;
})();

const MonthGrid = ({ year, monthIndex, data, futureData, onDayPress }) => {
  const th = useT();
  const today = new Date();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {DAY_NAMES.map((d) =>
        <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: th.fog, padding: '4px 0' }}>{d}</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const key = `${year}-${monthIndex}-${day}`;
          const entry = data[key];
          const isPeriod = entry?.isPeriod;
          const isFuture = futureData?.[key];
          const isToday = today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === day;

          let bg = 'transparent';
          let color = th.charcoal;
          let border = 'none';
          if (isPeriod) {bg = T.menstrual;color = '#FFF';} else
          if (isFuture) {bg = th.watermark;color = th.graphite;} else
          if (isToday) {border = `2px solid ${T.locketBlue}`;color = T.locketBlue;}

          return (
            <div key={day} onClick={() => onDayPress && onDayPress(day)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              aspectRatio: '1', cursor: 'pointer'
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%', background: bg, border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: isToday ? 600 : 400, color,
                transition: 'all 120ms'
              }}>{day}</div>
            </div>);

        })}
      </div>
    </div>);

};

const LedgerScreen = ({ onInsights, onSettings, onDayPress, surface }) => {
  const th = useT();
  const { dark } = React.useContext(window.ThemeContext);
  const now = new Date();
  const sf = surface || {
    pageBg: th.paper,
    pillBg: th.navBg,
    pillBlur: 'blur(16px)',
    pillShadow: th.shadow
  };

  const months = [-1, 0, 1].map((offset) => {
    let m = now.getMonth() + offset;
    let y = now.getFullYear();
    if (m < 0) {m += 12;y -= 1;}
    if (m > 11) {m -= 12;y += 1;}
    return { month: m, year: y, isCurrent: offset === 0 };
  });

  const scrollRef = React.useRef(null);
  const currentMonthRef = React.useRef(null);

  const scrollToToday = () => {
    if (!scrollRef.current || !currentMonthRef.current) return;
    const container = scrollRef.current;
    const target = currentMonthRef.current;
    const scrollTo = target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
  };

  React.useEffect(() => {setTimeout(scrollToToday, 150);}, []);

  const pillBase = {
    background: sf.pillBg,
    backdropFilter: sf.pillBlur,
    WebkitBackdropFilter: sf.pillBlur,
    borderRadius: 999,
    boxShadow: sf.pillShadow
  };

  const activeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

  const NavBtn = ({ onClick, icon, imgSrc, isActive, label }) =>
  <button onClick={onClick} aria-label={label} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
    background: isActive ? activeBg : 'transparent',
    transition: 'background 150ms', padding: 0, flexShrink: 0
  }}>
      {imgSrc ?
    <img src={imgSrc} width={18} height={18} alt={label} style={{ display: 'block', opacity: isActive ? 0.75 : 0.38, filter: dark ? 'invert(1)' : 'none' }} data-comment-anchor="213da2943c-img-129-11" /> :
    <Icon name={icon} size={19} color={th.ink} style={{ opacity: isActive ? 0.75 : 0.38 }} />}
    </button>;


  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: sf.pageBg, overflow: 'hidden' }}>

      <div style={{
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', paddingInline: 16, flexShrink: 0
      }}>
        <button onClick={scrollToToday} style={{
          ...pillBase, padding: '8px 18px',
          border: 'none', cursor: 'pointer', fontFamily: th.font,
          fontSize: 13, fontWeight: 600, color: th.ink, opacity: 0.72
        }}>Today</button>

        <div style={{ ...pillBase, display: 'flex', alignItems: 'center', gap: 2, padding: '4px 6px' }}>
          <NavBtn onClick={() => {}} icon="calendar_month" isActive={true} label="Calendar" />
          <NavBtn onClick={onInsights} imgSrc="locket-mark-mono-ink.svg" isActive={false} label="Insights" />
          <NavBtn onClick={onSettings} icon="settings" isActive={false} label="Settings" />
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 48px' }}>
        {months.map(({ month, year, isCurrent }, i) =>
        <div key={`${year}-${month}`} ref={isCurrent ? currentMonthRef : null}
        style={{ marginBottom: i < 2 ? 36 : 0 }}>
            <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: th.ink, letterSpacing: '-0.01em' }}>{MONTH_NAMES[month]}</div>
              <div style={{ fontSize: 13, color: th.fog, marginTop: 2 }}>{year}</div>
            </div>
            <Card>
              <MonthGrid year={year} monthIndex={month} data={SAMPLE_DATA} futureData={FUTURE_DATA} onDayPress={onDayPress} />
            </Card>
          </div>
        )}
      </div>
    </div>);

};

Object.assign(window, { LedgerScreen, MonthGrid });