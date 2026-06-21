// Locket Design System — Shared Components

const T = {
  paper: '#FDFBF9',
  cardWhite: '#FFFFFF',
  charcoal: '#2D2D2D',
  graphite: '#4A4A4A',
  ink: '#1B1C1B',
  fog: '#717783',
  inkBlue: '#004080',
  watermark: '#E6E2D8',
  whisper: '#8E8E93',
  paleLavender: '#F2F2F7',
  gold: '#D4AF37',
  alert: '#C0392B',
  nearBlack: '#1A1A1A',
  locketBlue: '#006EC7',
  locketBlueTint: '#E5F1FA',
  locketBlueBg: '#F2F8FD',
  menstrual: '#D1495B', menstrualTint: '#F8E5E7',
  follicular: '#2A9D8F', follicularTint: '#E4F3F1',
  ovulatory: '#FF9F00', ovulatoryTint: '#FFF2E0', ovulatoryDeep: '#E08C00',
  luteal: '#76489D', lutealTint: '#EDE7F2',
  logBg: '#F7F5FA',
  navBg: 'rgba(253,251,249,0.88)',
  shadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
  divider: '#E6E2D8',

  font: '"Public Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',

  phaseColor: (p) => ({ menstrual: '#D1495B', follicular: '#2A9D8F', ovulatory: '#FF9F00', luteal: '#76489D' }[p] || '#006EC7'),
  phaseTint:  (p) => ({ menstrual: '#F8E5E7', follicular: '#E4F3F1', ovulatory: '#FFF2E0', luteal: '#EDE7F2' }[p] || '#E5F1FA'),
  phaseIcon:  (p) => ({ menstrual: 'water_drop', follicular: 'eco', ovulatory: 'wb_sunny', luteal: 'mode_night' }[p] || 'lock'),
  phaseName:  (p) => ({ menstrual: 'Menstrual', follicular: 'Follicular', ovulatory: 'Ovulatory', luteal: 'Luteal' }[p] || 'Unknown'),
};

// ── Dark mode token overrides — design system colors_and_type.css dark layer ──
const T_DARK = {
  ...T,
  paper:          '#252628',
  cardWhite:      '#323336',
  charcoal:       '#FFFFFF',
  graphite:       '#EBEBF5',
  ink:            '#FFFFFF',
  fog:            '#A0A0A5',
  inkBlue:        '#6FA8DC',
  watermark:      'rgba(255,255,255,0.08)',
  whisper:        '#A0A0A5',
  paleLavender:   '#1C1C1E',
  nearBlack:      '#FFFFFF',
  locketBlueTint: 'rgba(0,110,199,0.20)',
  locketBlueBg:   '#1C1C1E',
  menstrualTint:  'rgba(209,73,91,0.20)',
  follicularTint: 'rgba(42,157,143,0.20)',
  ovulatoryTint:  'rgba(255,159,0,0.20)',
  lutealTint:     'rgba(118,72,157,0.20)',
  logBg:          '#252628',
  navBg:          'rgba(37,38,40,0.88)',
  shadow:         '0 4px 20px -2px rgba(0,0,0,0.25)',
  divider:        'rgba(255,255,255,0.07)',
  // Dark phaseTint returns 20% alpha phase colors
  phaseTint: (p) => ({
    menstrual:  'rgba(209,73,91,0.20)',
    follicular: 'rgba(42,157,143,0.20)',
    ovulatory:  'rgba(255,159,0,0.20)',
    luteal:     'rgba(118,72,157,0.20)',
  }[p] || 'rgba(0,110,199,0.20)'),
};

// ── Theme context + hook ──
window.ThemeContext = React.createContext({ dark: false });
const useT = () => {
  const { dark } = React.useContext(window.ThemeContext);
  return dark ? T_DARK : T;
};
window.useT = useT;

// ── Material Symbol helper ──
const Icon = ({ name, size = 22, color, fill = false, style = {} }) => (
  <span
    className={fill ? 'material-symbols-rounded' : 'material-symbols-outlined'}
    style={{
      fontSize: size,
      color,
      lineHeight: 1,
      fontVariationSettings: fill
        ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
        : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      ...style,
    }}
  >{name}</span>
);

// Sub-screen nav (back + title)
const NavBar = ({ title, onBack, right }) => {
  const th = useT();
  return (
    <div style={{
      height: 52, display: 'flex', alignItems: 'center', paddingInline: 16, gap: 8,
      background: th.navBg, backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${th.divider}`, flexShrink: 0, zIndex: 10,
    }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
          <Icon name="arrow_back" size={22} color={th.ink} />
        </button>
      )}
      <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: th.ink, paddingRight: onBack ? (right ? 0 : 36) : 0 }}>{title}</div>
      {right && <div style={{ minWidth: 36 }}>{right}</div>}
      {!right && onBack && <div style={{ width: 36 }} />}
    </div>
  );
};

// Main nav bar — floating right-aligned pill
const MainNavBar = ({ onCalendar, onInsights, onSettings, active, surface }) => {
  const th = useT();
  const { dark } = React.useContext(window.ThemeContext);
  const s = surface || {
    pillBg: th.navBg,
    pillBlur: 'blur(16px)',
    pillShadow: th.shadow,
  };
  const activeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';
  const NavBtn = ({ onClick, icon, imgSrc, isActive, label }) => (
    <button onClick={onClick} aria-label={label} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
      background: isActive ? activeBg : 'transparent',
      transition: 'background 150ms', padding: 0, flexShrink: 0,
    }}>
      {imgSrc
        ? <img src={imgSrc} width={18} height={18} alt={label} style={{ display: 'block', opacity: isActive ? 0.75 : 0.38, filter: dark ? 'invert(1)' : 'none' }} />
        : <Icon name={icon} size={19} color={th.ink} style={{ opacity: isActive ? 0.75 : 0.38 }} />}
    </button>
  );
  return (
    <div style={{
      height: 60, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      paddingInline: 16, flexShrink: 0, background: 'transparent',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        background: s.pillBg,
        backdropFilter: s.pillBlur,
        WebkitBackdropFilter: s.pillBlur,
        borderRadius: 999,
        padding: '4px 6px',
        boxShadow: s.pillShadow,
      }}>
        <NavBtn onClick={onCalendar} icon="calendar_month" isActive={active === 'ledger'} label="Calendar" />
        <NavBtn onClick={onInsights} imgSrc="locket-mark-mono-ink.svg" isActive={active === 'insights'} label="Insights" />
        <NavBtn onClick={onSettings} icon="settings" isActive={active === 'settings'} label="Settings" />
      </div>
    </div>
  );
};

// Floating circular button
const CircleButton = ({ children, onClick, ...rest }) => {
  const th = useT();
  return (
    <button onClick={onClick} {...rest} style={{
      width: 36, height: 36, borderRadius: '50%',
      background: th.cardWhite, border: `1px solid ${th.divider}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', padding: 0, flexShrink: 0,
    }}>{children}</button>
  );
};

// Tab bar (underline style)
const TabBar = ({ tabs, active, onChange }) => {
  const th = useT();
  return (
    <div style={{ display: 'flex', borderBottom: `1px solid ${th.divider}`, background: th.navBg, backdropFilter: 'blur(12px)', flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex: 1, padding: '10px 0', fontSize: 14, fontWeight: active === t ? 700 : 600,
          color: active === t ? th.locketBlue : th.fog,
          background: 'none', border: 'none',
          borderBottom: active === t ? `2px solid ${th.locketBlue}` : '2px solid transparent',
          cursor: 'pointer', fontFamily: th.font, transition: 'color 150ms',
        }}>{t}</button>
      ))}
    </div>
  );
};

// Card container
const Card = ({ children, style = {}, padding = 20, onClick }) => {
  const th = useT();
  return (
    <div onClick={onClick} style={{
      background: th.cardWhite, borderRadius: 16,
      boxShadow: th.shadow,
      padding, ...style,
    }}>{children}</div>
  );
};

// Icon badge
const IconBadge = ({ icon, tint, color, size = 40, fill = false }) => (
  <div style={{
    width: size, height: size, borderRadius: 12, background: tint,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <Icon name={icon} size={Math.round(size * 0.5)} color={color} fill={fill} />
  </div>
);

// Section header (CAPS, blue, icon)
const SectionHeader = ({ icon, children }) => {
  const th = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: th.locketBlue, marginBottom: 12 }}>
      {icon && <Icon name={icon} size={16} color={th.locketBlue} />}
      {children}
    </div>
  );
};

// Chip / pill
const Chip = ({ children, selected, phase, onPress, icon, variant = 'filled' }) => {
  const th = useT();
  const { dark } = React.useContext(window.ThemeContext);
  const phaseC = T.phaseColor(phase || 'menstrual');
  if (variant === 'outline') {
    // Dark mode: alpha-tint bg + phase color text, no border (matches dark-mode.html .chip-dark)
    // Light mode: transparent bg + phase color text + phase color border
    const darkBg    = th.phaseTint(phase || 'menstrual');   // rgba(phase, 0.20)
    const lightBg   = selected ? phaseC : 'transparent';
    const darkColor = phaseC;
    const lightColor = selected ? '#FFF' : phaseC;
    return (
      <button onClick={onPress} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 999,
        background: dark ? darkBg : lightBg,
        color: dark ? darkColor : lightColor,
        border: dark ? 'none' : `1.5px solid ${phaseC}`,
        fontSize: 13, fontWeight: 500, fontFamily: th.font, cursor: 'pointer',
        transition: 'all 150ms',
      }}>{children}</button>
    );
  }
  const bg    = selected ? th.phaseTint(phase || 'menstrual') : th.paleLavender;
  const color = selected ? phaseC : th.graphite;
  return (
    <button onClick={onPress} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '7px 14px', borderRadius: 999,
      background: bg, color, border: selected ? `1px solid ${color}` : '1px solid transparent',
      fontSize: 13, fontWeight: 500, fontFamily: th.font, cursor: 'pointer',
    }}>
      {icon && <Icon name={icon} size={15} color={color} fill />}
      {children}
    </button>
  );
};

// Primary button
const Btn = ({ children, onClick, disabled, style = {}, variant = 'primary' }) => {
  const th = useT();
  const { dark } = React.useContext(window.ThemeContext);
  const styles = {
    primary: { background: th.locketBlue, color: '#FFF', opacity: disabled ? 0.6 : 1 },
    outline: { background: 'transparent', color: th.locketBlue, border: `1.5px solid ${th.locketBlue}` },
    ghost:   { background: 'transparent', color: th.locketBlue, border: 'none' },
    danger:  { background: 'transparent', color: T.menstrual, border: 'none' },
    float:   { background: th.ink, color: th.paper, boxShadow: '0 4px 16px rgba(0,0,0,0.20)', borderRadius: 30 },
    luteal:  { background: T.luteal, color: '#FFF' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: th.font, fontSize: 15, fontWeight: 600,
      border: 'none', borderRadius: variant === 'float' ? 30 : 12,
      padding: '13px 20px', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'transform 120ms ease',
      width: ['primary', 'outline', 'luteal'].includes(variant) ? '100%' : 'auto',
      ...styles[variant], ...style,
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >{children}</button>
  );
};

// Accordion pill (LogScreen category row)
const AccordionPill = ({ icon, label, color, tint, expanded, onToggle, children }) => {
  const th = useT();
  return (
    <div>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center',
        padding: '12px 18px', borderRadius: 999,
        background: tint, border: 'none', cursor: 'pointer', fontFamily: th.font,
        transition: 'all 200ms',
      }}>
        <Icon name={icon} size={20} color={color} fill />
        <span style={{ flex: 1, textAlign: 'left', marginLeft: 12, fontSize: 15, fontWeight: 600, color }}>{label}</span>
        <Icon name={expanded ? 'expand_less' : 'add'} size={20} color={color} />
      </button>
      {expanded && (
        <div style={{ padding: '14px 14px 6px', border: `1px solid ${th.divider}`, borderRadius: 14, marginTop: 8, background: th.cardWhite }}>
          {children}
        </div>
      )}
    </div>
  );
};

// Integrity Seal
const IntegritySeal = ({ status = 'secure' }) => {
  const th = useT();
  const colors = { secure: T.gold, anchored: '#10B981', syncing: '#3B82F6', pending: th.watermark, compromised: T.alert };
  const c = colors[status] || th.watermark;
  return (
    <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: c, opacity: 0.8,
          animation: status === 'syncing' ? 'locketPulse 1.6s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  );
};

// Encryption badge
const EncryptionBadge = () => {
  const th = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: th.locketBlueBg, padding: '14px 16px', borderRadius: 12, border: `1px solid ${th.divider}` }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: th.locketBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="lock" size={20} color="#FFF" fill />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: th.ink }}>Data Encrypted</div>
        <div style={{ fontSize: 12, color: th.fog, marginTop: 2 }}>Your intimate data is safe.</div>
      </div>
    </div>
  );
};

// Footer encryption line
const EncryptionFooter = () => {
  const th = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: th.fog, padding: '8px 0' }}>
      <Icon name="lock" size={14} color={th.fog} fill />
      <span style={{ fontSize: 12, fontWeight: 500 }}>Data Encrypted</span>
    </div>
  );
};

// Orbit Gauge
const OrbitGauge = ({ phase = 'ovulatory', dayInCycle = 12, size = 248 }) => {
  const th = useT();
  const ring = `conic-gradient(from 0deg,
    ${T.menstrual} 0deg 90deg,
    ${T.follicular} 90deg 180deg,
    ${T.ovulatory} 180deg 270deg,
    ${T.luteal} 270deg 360deg)`;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: ring, boxShadow: '0 6px 22px -8px rgba(0,0,0,0.18)' }} />
      <div style={{
        position: 'absolute', inset: 16, borderRadius: '50%',
        background: th.paper,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          border: `1px solid ${th.fog}`, opacity: 0.18,
          backgroundImage: `repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(0,0,0,0.05) 10deg 11deg)`,
        }} />
        <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', border: `1px dashed ${th.fog}`, opacity: 0.30 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: th.ink, opacity: 0.78, marginBottom: 4 }}>Cycle day {dayInCycle}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: th.ink, letterSpacing: '-0.01em', lineHeight: 1.05 }}>{T.phaseName(phase)} Phase</div>
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)',
        width: 24, height: 24, borderRadius: '50%',
        background: th.cardWhite,
        border: `3px solid ${T.phaseColor(phase)}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={T.phaseIcon(phase)} size={11} color={T.phaseColor(phase)} fill />
      </div>
    </div>
  );
};

// Dot Phase Bar
const DotPhaseBar = ({ segments }) => {
  const th = useT();
  const colors = {
    menstrual: T.menstrual, follicular: T.follicular,
    ovulatory: T.ovulatory, luteal: T.luteal, future: th.paleLavender,
  };
  const dots = [];
  segments.forEach((s) => {
    for (let i = 0; i < s.count; i++) dots.push(colors[s.phase] || th.paleLavender);
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${dots.length}, 1fr)`, gap: 3, width: '100%', alignItems: 'center' }}>
      {dots.map((c, i) => (
        <div key={i} style={{ width: '100%', aspectRatio: '1', maxHeight: 10, height: 10, borderRadius: '50%', background: c }} />
      ))}
    </div>
  );
};

// Horizontal day strip
const DayStrip = ({ days, activeIndex, onDayPress }) => {
  const th = useT();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 6px' }}>
      {days.map((d, i) => {
        const active = i === activeIndex;
        return (
          <div key={i} onClick={() => onDayPress && d.date && onDayPress(d.date)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: active ? th.ovulatoryTint : 'transparent',
            cursor: onDayPress ? 'pointer' : 'default',
          }}>
            <span style={{ fontSize: 13, color: active ? T.ovulatoryDeep : th.fog, fontWeight: active ? 600 : 500 }}>{d.dow}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: active ? T.ovulatoryDeep : th.ink, letterSpacing: '-0.01em' }}>{d.day}</span>
            {active ? (
              <div style={{ width: 9, height: 9, borderRadius: '50%', border: `2px solid ${d.phaseColor}` }} />
            ) : (
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.phaseColor }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, {
  T, T_DARK, useT, Icon, NavBar, MainNavBar, CircleButton, TabBar, Card, IconBadge,
  SectionHeader, Chip, Btn, AccordionPill, IntegritySeal, EncryptionBadge, EncryptionFooter,
  OrbitGauge, DotPhaseBar, DayStrip,
});
