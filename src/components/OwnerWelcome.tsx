import React, { useEffect, useState } from 'react';

interface OwnerWelcomeProps {
  onDismiss: () => void;
}

const OwnerWelcome: React.FC<OwnerWelcomeProps> = ({ onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Fade in
    const fadeInTimer = setTimeout(() => setVisible(true), 50);
    // Auto dismiss after 4 seconds
    const dismissTimer = setTimeout(() => handleDismiss(), 4500);
    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  const handleDismiss = () => {
    setFadeOut(true);
    setTimeout(() => onDismiss(), 700);
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0a00 0%, #2d1500 40%, #1a0a00 100%)',
        opacity: fadeOut ? 0 : visible ? 1 : 0,
        transition: 'opacity 0.7s ease',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      dir="rtl"
    >
      {/* Animated background particles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${Math.random() * 4 + 1}px`,
              height: `${Math.random() * 4 + 1}px`,
              borderRadius: '50%',
              background: `rgba(217, 119, 6, ${Math.random() * 0.5 + 0.1})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-particle ${Math.random() * 4 + 3}s ease-in-out infinite alternate`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
        {/* Gold decorative lines */}
        <div style={{
          position: 'absolute', top: '15%', left: '5%', right: '5%',
          height: '1px', background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.4), transparent)'
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', left: '5%', right: '5%',
          height: '1px', background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.4), transparent)'
        }} />
        <div style={{
          position: 'absolute', top: '5%', bottom: '5%', left: '10%',
          width: '1px', background: 'linear-gradient(180deg, transparent, rgba(217,119,6,0.3), transparent)'
        }} />
        <div style={{
          position: 'absolute', top: '5%', bottom: '5%', right: '10%',
          width: '1px', background: 'linear-gradient(180deg, transparent, rgba(217,119,6,0.3), transparent)'
        }} />
      </div>

      {/* Corner ornaments */}
      <svg style={{ position: 'absolute', top: 20, right: 20, opacity: 0.4 }} width="60" height="60" viewBox="0 0 60 60">
        <path d="M60,0 L0,0 L0,60" stroke="#d97706" strokeWidth="2" fill="none" />
        <path d="M50,0 L0,0 L0,50" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.5" />
        <circle cx="5" cy="5" r="3" fill="#d97706" opacity="0.8" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 20, left: 20, opacity: 0.4 }} width="60" height="60" viewBox="0 0 60 60">
        <path d="M0,60 L60,60 L60,0" stroke="#d97706" strokeWidth="2" fill="none" />
        <path d="M10,60 L60,60 L60,10" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.5" />
        <circle cx="55" cy="55" r="3" fill="#d97706" opacity="0.8" />
      </svg>
      <svg style={{ position: 'absolute', top: 20, left: 20, opacity: 0.4 }} width="60" height="60" viewBox="0 0 60 60">
        <path d="M0,0 L60,0 L60,60" stroke="#d97706" strokeWidth="2" fill="none" />
        <circle cx="55" cy="5" r="3" fill="#d97706" opacity="0.8" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 20, right: 20, opacity: 0.4 }} width="60" height="60" viewBox="0 0 60 60">
        <path d="M60,60 L0,60 L0,0" stroke="#d97706" strokeWidth="2" fill="none" />
        <circle cx="5" cy="55" r="3" fill="#d97706" opacity="0.8" />
      </svg>

      {/* Main content */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        padding: '60px 40px',
        maxWidth: '600px',
        width: '90%',
      }}>
        {/* Logo / Icon */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100px',
          height: '100px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(245,158,11,0.1))',
          border: '2px solid rgba(217,119,6,0.5)',
          marginBottom: '32px',
          boxShadow: '0 0 40px rgba(217,119,6,0.25)',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}>
          <svg viewBox="0 0 100 100" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
            <path d="M 10 75 Q 50 95 90 75 L 80 60 Q 50 75 20 60 Z" fill="#d97706" />
            <path d="M 15 72 L 85 72 M 18 68 L 82 68 M 22 64 L 78 64" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="3,3" />
            <path d="M 10 75 L 5 82 M 20 81 L 15 87 M 30 84 L 25 90 M 40 86 L 35 92 M 50 87 L 45 93 M 60 86 L 55 92 M 70 84 L 65 90 M 80 81 L 75 87 M 90 75 L 85 82" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
            <polygon points="50,18 66,55 34,55" fill="#f59e0b" />
            <polygon points="50,18 66,55 50,55" fill="#d97706" />
            <polygon points="30,33 41,55 19,55" fill="#fcd34d" />
            <polygon points="30,33 41,55 30,55" fill="#f59e0b" />
            <polygon points="70,33 81,55 59,55" fill="#fcd34d" />
            <polygon points="70,33 81,55 70,55" fill="#f59e0b" />
          </svg>
        </div>

        {/* Golden divider top */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', marginBottom: '28px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, #d97706)' }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', boxShadow: '0 0 8px #d97706' }} />
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706', boxShadow: '0 0 8px #d97706' }} />
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #d97706, transparent)' }} />
        </div>

        {/* Welcome text */}
        <p style={{
          fontSize: '16px',
          letterSpacing: '3px',
          color: '#f59e0b',
          fontWeight: 500,
          marginBottom: '14px',
          fontFamily: 'Cairo, sans-serif',
          textTransform: 'uppercase',
        }}>
          أهلاً وسهلاً
        </p>

        {/* Company name */}
        <h1 style={{
          fontSize: 'clamp(36px, 7vw, 64px)',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 40%, #d97706 70%, #fcd34d 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '10px',
          lineHeight: 1.2,
          fontFamily: 'Cairo, sans-serif',
          textShadow: 'none',
          filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.3))',
          letterSpacing: '2px',
        }}>
          Carpet Land
        </h1>
        <p style={{
          fontSize: '15px',
          color: 'rgba(253,211,77,0.6)',
          marginBottom: '32px',
          letterSpacing: '1px',
          fontFamily: 'Cairo, sans-serif',
        }}>
          الأصالة والفخامة في عالم السجاد
        </p>

        {/* Golden divider */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', marginBottom: '32px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(217,119,6,0.5))' }} />
          <div style={{ color: '#d97706', fontSize: '18px' }}>✦</div>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(217,119,6,0.5), transparent)' }} />
        </div>

        {/* Owner name */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(245,158,11,0.08))',
          border: '1px solid rgba(217,119,6,0.35)',
          borderRadius: '16px',
          padding: '20px 36px',
          display: 'inline-block',
          boxShadow: '0 0 30px rgba(217,119,6,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          <p style={{
            fontSize: '13px',
            color: 'rgba(253,211,77,0.6)',
            letterSpacing: '2px',
            marginBottom: '6px',
            fontFamily: 'Cairo, sans-serif',
          }}>
            صاحب الشركة
          </p>
          <p style={{
            fontSize: 'clamp(22px, 4vw, 32px)',
            fontWeight: 700,
            color: '#fcd34d',
            fontFamily: 'Cairo, sans-serif',
            letterSpacing: '1px',
            textShadow: '0 0 20px rgba(252,211,77,0.3)',
          }}>
            الأستاذ / أحمد السويفي
          </p>
        </div>

        {/* Bottom hint */}
        <p style={{
          marginTop: '36px',
          fontSize: '12px',
          color: 'rgba(217,119,6,0.5)',
          letterSpacing: '2px',
          fontFamily: 'Cairo, sans-serif',
          animation: 'blink 1.5s ease-in-out infinite',
        }}>
          انقر في أي مكان للمتابعة
        </p>
      </div>

      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0px) translateX(0px); }
          100% { transform: translateY(-20px) translateX(10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 40px rgba(217,119,6,0.25); }
          50% { box-shadow: 0 0 60px rgba(217,119,6,0.45), 0 0 20px rgba(245,158,11,0.2); }
        }
        @keyframes blink {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default OwnerWelcome;
