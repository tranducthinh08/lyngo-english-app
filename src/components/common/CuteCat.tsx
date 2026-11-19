'use client';

import React from 'react';

interface CuteCatProps {
  mood?: 'reading' | 'listening' | 'happy' | 'paw' | 'fish';
  className?: string;
  size?: number;
}

export default function CuteCat({ mood = 'reading', className = '', size = 64 }: CuteCatProps) {
  if (mood === 'paw') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* Đệm chân mèo cam */}
        <ellipse cx="24" cy="30" rx="11" ry="9" fill="#FB923C" />
        <ellipse cx="24" cy="30" rx="9" ry="7" fill="#FDBA74" />
        {/* 4 ngón chân tròn xoe */}
        <circle cx="12" cy="18" r="4.5" fill="#FB923C" />
        <circle cx="12" cy="18" r="3.5" fill="#FDBA74" />
        <circle cx="20" cy="13" r="4.5" fill="#FB923C" />
        <circle cx="20" cy="13" r="3.5" fill="#FDBA74" />
        <circle cx="28" cy="13" r="4.5" fill="#FB923C" />
        <circle cx="28" cy="13" r="3.5" fill="#FDBA74" />
        <circle cx="36" cy="18" r="4.5" fill="#FB923C" />
        <circle cx="36" cy="18" r="3.5" fill="#FDBA74" />
      </svg>
    );
  }

  if (mood === 'fish') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M36 24C36 29 28 34 20 34C15 34 8 28 6 24C8 20 15 14 20 14C28 14 36 19 36 24Z"
          fill="#38BDF8"
        />
        <path d="M34 24L42 16V32L34 24Z" fill="#0284C7" />
        <circle cx="14" cy="22" r="2" fill="#0F172A" />
        <path d="M18 19C20 22 20 26 18 29" stroke="#E0F2FE" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (mood === 'listening') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`animate-pulse ${className}`}
      >
        {/* Tai mèo */}
        <polygon points="22,35 12,12 40,24" fill="#EA580C" />
        <polygon points="25,32 18,17 38,25" fill="#FDA4AF" />
        <polygon points="78,35 88,12 60,24" fill="#EA580C" />
        <polygon points="75,32 82,17 62,25" fill="#FDA4AF" />

        {/* Đầu mèo cam tròn xoe */}
        <ellipse cx="50" cy="52" rx="36" ry="32" fill="#FB923C" />
        {/* Sọc vằn trên trán mèo cam */}
        <path d="M50 24V32M44 26L46 34M56 26L54 34" stroke="#C2410C" strokeWidth="3" strokeLinecap="round" />

        {/* Tai nghe nhạc to cute */}
        <path d="M14 52C14 30 86 30 86 52" stroke="#0284C7" strokeWidth="6" strokeLinecap="round" fill="none" />
        <rect x="8" y="44" width="12" height="20" rx="6" fill="#38BDF8" />
        <rect x="80" y="44" width="12" height="20" rx="6" fill="#38BDF8" />

        {/* Má hồng */}
        <ellipse cx="30" cy="58" rx="6" ry="4" fill="#FDA4AF" opacity="0.8" />
        <ellipse cx="70" cy="58" rx="6" ry="4" fill="#FDA4AF" opacity="0.8" />

        {/* Mắt nhắm tít vui vẻ nghe nhạc */}
        <path d="M34 50Q40 45 44 50" stroke="#431407" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M56 50Q60 45 66 50" stroke="#431407" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Mũi & Miệng chữ W mèo */}
        <polygon points="50,56 47,53 53,53" fill="#BE185D" />
        <path d="M46 58Q50 62 50 56Q50 62 54 58" stroke="#431407" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* Nốt nhạc bay bổng */}
        <path d="M84 25L92 20V30M86 30A3 3 0 1 1 80 30A3 3 0 1 1 86 30" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
      </svg>
    );
  }

  // Mặc định: 'reading' - Mèo Cam đeo kính đọc sách
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Tai Mèo */}
      <polygon points="30,40 18,12 50,26" fill="#F97316" />
      <polygon points="32,38 24,18 46,27" fill="#FDA4AF" />
      <polygon points="90,40 102,12 70,26" fill="#F97316" />
      <polygon points="88,38 96,18 74,27" fill="#FDA4AF" />

      {/* Đuôi mèo ngoe nguẩy bên cạnh */}
      <path
        d="M100 80C115 75 120 60 110 52C102 46 98 58 100 68"
        stroke="#F97316"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M109 53C114 55 116 62 110 65"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Thân Mèo Cam tròn ủng */}
      <ellipse cx="60" cy="85" rx="36" ry="28" fill="#F97316" />
      <ellipse cx="60" cy="88" rx="24" ry="18" fill="#FEF3C7" />

      {/* Đầu Mèo Cam */}
      <ellipse cx="60" cy="50" rx="38" ry="32" fill="#FB923C" />

      {/* Sọc vằn mèo cam */}
      <path d="M60 22V32M53 25L56 34M67 25L64 34" stroke="#C2410C" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 45L34 47M24 53L32 53" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M96 45L86 47M96 53L88 53" stroke="#C2410C" strokeWidth="2.5" strokeLinecap="round" />

      {/* Má hồng phúng phính */}
      <ellipse cx="35" cy="56" rx="7" ry="5" fill="#FDA4AF" opacity="0.85" />
      <ellipse cx="85" cy="56" rx="7" ry="5" fill="#FDA4AF" opacity="0.85" />

      {/* Kính gọng tròn tri thức cho Mèo Cam */}
      <circle cx="44" cy="48" r="13" stroke="#78350F" strokeWidth="3.5" fill="#FEF3C7" fillOpacity="0.3" />
      <circle cx="76" cy="48" r="13" stroke="#78350F" strokeWidth="3.5" fill="#FEF3C7" fillOpacity="0.3" />
      <path d="M57 48H63" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" />

      {/* Mắt to tròn long lanh */}
      <circle cx="44" cy="48" r="6" fill="#431407" />
      <circle cx="42" cy="46" r="2.2" fill="#FFFFFF" />
      <circle cx="76" cy="48" r="6" fill="#431407" />
      <circle cx="74" cy="46" r="2.2" fill="#FFFFFF" />

      {/* Mũi hồng hình tam giác nhỏ */}
      <polygon points="60,56 57,53 63,53" fill="#BE185D" />

      {/* Miệng mèo cười :3 */}
      <path d="M55 58Q60 62 60 57Q60 62 65 58" stroke="#431407" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Râu Mèo */}
      <path d="M26 56L12 53M26 60L10 62" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M94 56L108 53M94 60L110 62" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />

      {/* Cuốn sách trên tay Mèo Cam */}
      <path
        d="M32 82C44 76 58 78 60 84C62 78 76 76 88 82V104C76 98 62 100 60 106C58 100 44 98 32 104V82Z"
        fill="#FEF08A"
        stroke="#CA8A04"
        strokeWidth="2.5"
      />
      <path d="M60 84V106" stroke="#CA8A04" strokeWidth="2.5" />
      {/* Chữ mô phỏng trên sách */}
      <path d="M38 88H52M38 94H48M72 88H82M72 94H80" stroke="#A16207" strokeWidth="1.8" strokeLinecap="round" />

      {/* 2 bàn chân múp míp ôm sách */}
      <circle cx="38" cy="85" r="7" fill="#FB923C" stroke="#EA580C" strokeWidth="2" />
      <circle cx="82" cy="85" r="7" fill="#FB923C" stroke="#EA580C" strokeWidth="2" />
    </svg>
  );
}
