import React from "react";

interface DelishLogoProps {
  className?: string;
  size?: number | string;
}

export const DelishLogo: React.FC<DelishLogoProps> = ({ className = "w-11 h-11", size }) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full shadow-sm select-none overflow-hidden ${className}`}
      style={style}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="100" cy="100" r="96" fill="#3B482B" stroke="#C9A84E" strokeWidth="6" />
        <circle cx="100" cy="100" r="91" fill="none" stroke="#C9A84E" strokeWidth="1" strokeOpacity="0.4" />
        
        {/* Prominent White Serif D */}
        <text
          x="97"
          y="138"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Playfair Display', 'Times New Roman', Georgia, serif"
          fontWeight="900"
          fontSize="124"
        >
          D
        </text>

        {/* DELISH text banner overlay across center of D */}
        <rect x="44" y="93" width="112" height="22" fill="#3B482B" rx="2" opacity="0.95" />
        <text
          x="100"
          y="109"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Playfair Display', 'Times New Roman', Georgia, serif"
          fontWeight="800"
          fontSize="19"
          letterSpacing="2.5"
        >
          DELISH
        </text>
      </svg>
    </div>
  );
};
