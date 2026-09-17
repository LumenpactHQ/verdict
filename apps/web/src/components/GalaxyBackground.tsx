import React from 'react';

export const GalaxyBackground: React.FC = () => {
  return (
    <div
      id="galaxy-background-container"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#030611]"
    >
      {/* 
        1. Deep Dark Base Canvas 
      */}
      <div className="absolute inset-0 bg-[#030611]" />

      {/* 
        2. Soft Diagonal Light Beam & Spotlight at 45°
        Enters from top-left corner, fading out toward the center.
        Soft white-to-blue radial/linear gradient with smooth gaussian falloff.
      */}
      {/* Corner Origin Ambient Glow (softened) */}
      <div
        className="absolute -top-[160px] -left-[160px] w-[800px] h-[800px] pointer-events-none rounded-full"
        style={{
          background:
            'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.22) 0%, rgba(219, 234, 254, 0.16) 22%, rgba(59, 130, 246, 0.08) 48%, rgba(29, 78, 216, 0.02) 70%, transparent 85%)',
          filter: 'blur(60px)',
        }}
      />

      {/* 45-Degree Directional Spotlight Beam shining from top-left toward center (softened) */}
      <div
        className="absolute -top-[120px] -left-[120px] w-[1400px] h-[600px] pointer-events-none opacity-80"
        style={{
          transform: 'rotate(45deg)',
          transformOrigin: '0% 0%',
        }}
      >
        {/* Soft Volumetric Cone Envelope */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 55% at 20% 50%, rgba(255, 255, 255, 0.20) 0%, rgba(191, 219, 254, 0.14) 24%, rgba(96, 165, 250, 0.08) 48%, rgba(37, 99, 235, 0.02) 72%, transparent 100%)',
            filter: 'blur(55px)',
          }}
        />

        {/* Focused Core Ray along 45-degree angle */}
        <div
          className="absolute top-[32%] left-[40px] w-[75%] h-[36%]"
          style={{
            background:
              'linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0%, rgba(224, 242, 254, 0.15) 25%, rgba(147, 197, 253, 0.07) 55%, transparent 90%)',
            filter: 'blur(30px)',
          }}
        />
      </div>

      {/* 
        3. Subtle Dotted Grid Pattern Overlaid Across the Whole Background
        Crisp SVG dot matrix with uniform 28px spacing.
      */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="sleek-dot-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#ffffff" fillOpacity="0.16" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sleek-dot-grid)" />
      </svg>

      {/* 
        4. Soft Ambient Peripheral Vignette
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(3, 6, 17, 0.5) 85%, #030611 100%)',
        }}
      />
    </div>
  );
};
