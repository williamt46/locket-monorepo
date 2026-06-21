// SettingsScreen

const SettingsScreen = ({ onBack, sealStatus = 'secure' }) => {
  const th = useT();

  const sections = [
    {
      title: 'Data Management',
      rows: [
        { label: 'Import Logs (JSON/CSV)',      action: () => {} },
        { label: 'Export Encrypted Backup',     action: () => {} },
        { label: 'Restore Encrypted Backup',    action: () => {} },
      ]
    },
    {
      title: 'Network & Security',
      rows: [
        { label: 'Cryptographic Integrity', right: <IntegritySeal status={sealStatus} /> },
        { label: 'Force Cloud Sync', sub: 'Securing to decentralised storage…', action: () => {} },
      ]
    },
    {
      title: 'Danger Zone',
      danger: true,
      rows: [
        { label: 'Factory Reset', danger: true, action: () => {} },
      ]
    }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: th.paper }}>
      <NavBar title="Settings" onBack={onBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
        {sections.map(sec => (
          <div key={sec.title} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              color: sec.danger ? T.alert : T.locketBlue, marginBottom: 8,
            }}>{sec.title}</div>
            <div style={{
              background: th.cardWhite, borderRadius: 12, overflow: 'hidden',
              boxShadow: th.shadow,
            }}>
              {sec.rows.map((row, ri) => (
                <div key={ri} onClick={row.action} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderBottom: ri < sec.rows.length - 1 ? `1px solid ${th.divider}` : 'none',
                  cursor: row.action ? 'pointer' : 'default',
                }}>
                  <div>
                    <div style={{ fontSize: 15, color: row.danger ? T.alert : th.ink, fontWeight: row.danger ? 700 : 400 }}>{row.label}</div>
                    {row.sub && <div style={{ fontSize: 12, color: T.locketBlue, marginTop: 3 }}>{row.sub}</div>}
                  </div>
                  {row.right
                    ? row.right
                    : row.action && !row.danger && <span style={{ color: th.fog, fontSize: 18 }}>›</span>
                  }
                </div>
              ))}
            </div>
          </div>
        ))}

        <EncryptionBadge />
      </div>
    </div>
  );
};

Object.assign(window, { SettingsScreen });
