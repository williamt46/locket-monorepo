// AuthScreen — Lock screen with gold circle, tap to unlock
const AuthScreen = ({ onUnlock }) => {
  const th = useT();
  const { dark } = React.useContext(window.ThemeContext);
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', background: th.paper, cursor: 'pointer', userSelect: 'none',
    }} onClick={onUnlock}>
      <div style={{ width: 140, height: 140, marginBottom: 36 }}>
        <img
          src={dark ? 'locket-mark-dark.svg' : 'locket-mark-light.svg'}
          width="140" height="140" alt="Locket"
          style={{ display: 'block', filter: dark
            ? 'drop-shadow(0 8px 32px rgba(212,175,55,0.45))'
            : 'drop-shadow(0 8px 32px rgba(212,175,55,0.60))' }}
        />
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: th.ink, letterSpacing: '-0.01em', marginBottom: 10 }}>Locket</div>
      <div style={{ fontSize: 16, color: th.fog }}>Tap anywhere to unlock</div>
      <div style={{ position: 'absolute', bottom: 48, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IntegritySeal status="secure" />
        <span style={{ fontSize: 12, color: th.fog }}>Secured locally</span>
      </div>
    </div>
  );
};

Object.assign(window, { AuthScreen });
