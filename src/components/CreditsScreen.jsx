// CreditsScreen.jsx
export function CreditsScreen({ onContinue }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #2d2010 0%, #1a1208 100%)',
      padding: '20px',
    }} onClick={onContinue}>
      <div style={{
        background: 'rgba(0,0,0,0.6)',
        border: '2px solid #c9a84c',
        borderRadius: '18px',
        padding: '48px 40px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 0 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          fontSize: '2em',
          marginBottom: '24px',
        }}>🃏</div>
        <h2 style={{
          fontFamily: "'Cinzel', serif",
          color: '#c9a84c',
          fontSize: '1.1em',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '24px',
        }}>Créditos</h2>
        <p style={{
          fontFamily: "'Crimson Text', serif",
          color: '#d4b896',
          fontSize: '1.1em',
          lineHeight: '1.8',
          fontStyle: 'italic',
        }}>
          Este juego fue desarrollado por<br/>
          <strong style={{ color: '#c9a84c', fontStyle: 'normal' }}>Alberto Quijano D</strong><br/>
          en Medellín, Colombia.<br/>
          Marzo de 2026.
        </p>
        <div style={{
          marginTop: '32px',
          color: 'rgba(201,168,76,0.5)',
          fontSize: '0.75em',
          letterSpacing: '0.15em',
          fontFamily: "'Cinzel', serif",
          animation: 'pulse 2s infinite',
        }}>
          Toca para continuar
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
