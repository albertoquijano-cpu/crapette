// SplashScreen.jsx
import { useState, useEffect } from 'react';

export function SplashScreen({ onStart }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#000',
      cursor: 'pointer',
    }} onClick={onStart}>
      <img
        src="/splash.jpg"
        alt="Banca Rusa"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
        }}
      />
      {ready && (
        <div style={{
          position: 'absolute',
          bottom: '8%',
          padding: '14px 44px',
          background: 'rgba(0,0,0,0.65)',
          border: '2px solid #c9a84c',
          borderRadius: '12px',
          color: '#c9a84c',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          animation: 'pulse 1.5s infinite',
        }}>
          Toca para jugar
        </div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
