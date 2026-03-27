// InfoModal.jsx — Modal para descripcion y reglas del juego

export function InfoModal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1208 0%, #2d2010 100%)',
        border: '2px solid #c9a84c',
        borderRadius: '18px',
        padding: '32px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 0 60px rgba(0,0,0,0.8)',
        position: 'relative',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none',
          color: '#c9a84c', fontSize: '1.4em', cursor: 'pointer',
        }}>✕</button>
        <h2 style={{
          fontFamily: "'Cinzel', serif",
          color: '#c9a84c',
          fontSize: '1.2em',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '20px',
          paddingRight: '32px',
        }}>{title}</h2>
        <div style={{
          fontFamily: "'Crimson Text', serif",
          color: '#d4b896',
          fontSize: '1em',
          lineHeight: '1.7',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
