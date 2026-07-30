import React from 'react';

// Clock dimensions
const CX = 300;
const CY = 300;
const OUTER_R = 268;      // decorative outer ring
const FACE_R = 250;       // clock face
const LABEL_R = 210;      // radius where location labels sit
const HAND_LENGTH = 165;  // distance from centre to avatar
const AVATAR_R = 22;      // avatar circle radius
const CENTRE_R = 12;      // centre boss

// 8 locations evenly spaced, starting at top (−90°) going clockwise
export const LOCATIONS = [
  'Home',
  'Work',
  'School',
  'Hospital',
  'Traveling',
  'Lost',
  'Mortal Peril',
  'Prison',
];

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}

function polarToXY(angleDeg, radius) {
  const r = deg2rad(angleDeg);
  return { x: CX + radius * Math.cos(r), y: CY + radius * Math.sin(r) };
}

// Pre-compute each location's angle and XY
const locationMeta = LOCATIONS.map((name, i) => {
  const angle = -90 + i * 45; // evenly distribute 8 positions
  const labelPt = polarToXY(angle, LABEL_R);
  const tickOuter = polarToXY(angle, FACE_R - 6);
  const tickInner = polarToXY(angle, FACE_R - 22);
  return { name, angle, labelPt, tickOuter, tickInner };
});

function locationAngle(locationName) {
  const idx = LOCATIONS.findIndex(
    (l) => l.toLowerCase() === (locationName || '').toLowerCase()
  );
  return idx === -1 ? -90 : -90 + idx * 45; // default to Home if unknown
}

// Decorative clock-hand path (tapered)
function HandPath({ angleDeg, length, color, personId }) {
  const rad = deg2rad(angleDeg);
  const tip = { x: CX + length * Math.cos(rad), y: CY + length * Math.sin(rad) };

  // Perpendicular offset for base width
  const baseWidth = 6;
  const perpRad = rad + Math.PI / 2;
  const bx = Math.cos(perpRad) * baseWidth;
  const by = Math.sin(perpRad) * baseWidth;

  const d = [
    `M ${CX + bx} ${CY + by}`,
    `Q ${CX + length * 0.5 * Math.cos(rad) + bx * 0.3} ${CY + length * 0.5 * Math.sin(rad) + by * 0.3}`,
    `  ${tip.x} ${tip.y}`,
    `Q ${CX + length * 0.5 * Math.cos(rad) - bx * 0.3} ${CY + length * 0.5 * Math.sin(rad) - by * 0.3}`,
    `  ${CX - bx} ${CY - by}`,
    'Z',
  ].join(' ');

  return (
    <path
      d={d}
      fill={color}
      stroke="#1a0800"
      strokeWidth="1"
      opacity="0.92"
      style={{ transition: 'all 1.2s ease-in-out' }}
    />
  );
}

function PersonHand({ person, locationName, colorIndex }) {
  const colors = [
    '#C0392B', '#2980B9', '#27AE60', '#8E44AD',
    '#D35400', '#16A085', '#2C3E50', '#F39C12',
  ];
  const color = colors[colorIndex % colors.length];
  const angle = locationAngle(locationName);
  const avatarPt = polarToXY(angle, HAND_LENGTH);
  const clipId = `clip-${person.id}`;
  const patternId = `pat-${person.id}`;

  return (
    <g style={{ transition: 'all 1.2s ease-in-out' }}>
      <HandPath angleDeg={angle} length={HAND_LENGTH - AVATAR_R} color={color} />

      {/* Avatar circle */}
      <defs>
        <clipPath id={clipId}>
          <circle cx={avatarPt.x} cy={avatarPt.y} r={AVATAR_R} />
        </clipPath>
        {person.imageUrl && (
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            x={avatarPt.x - AVATAR_R}
            y={avatarPt.y - AVATAR_R}
            width={AVATAR_R * 2}
            height={AVATAR_R * 2}
          >
            <image
              href={person.imageUrl}
              x="0"
              y="0"
              width={AVATAR_R * 2}
              height={AVATAR_R * 2}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>
        )}
      </defs>

      <circle
        cx={avatarPt.x}
        cy={avatarPt.y}
        r={AVATAR_R}
        fill={person.imageUrl ? `url(#${patternId})` : color}
        stroke="#D4AF37"
        strokeWidth="2.5"
        clipPath={`url(#${clipId})`}
      />

      {/* Initials fallback */}
      {!person.imageUrl && (
        <text
          x={avatarPt.x}
          y={avatarPt.y + 5}
          textAnchor="middle"
          fill="#fff"
          fontSize="13"
          fontFamily="Cinzel, serif"
          fontWeight="bold"
        >
          {person.name[0].toUpperCase()}
        </text>
      )}

      {/* Name tooltip near avatar */}
      <title>{`${person.name} – ${locationName || 'Unknown'}`}</title>
    </g>
  );
}

export default function WeasleyClock({ locations = [] }) {
  return (
    <div className="clock-wrapper">
      <svg
        viewBox="0 0 600 600"
        width="520"
        height="520"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Weasley Family Clock"
      >
        <defs>
          {/* Radial gradient for clock face */}
          <radialGradient id="faceGrad" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#fdf0d0" />
            <stop offset="70%" stopColor="#e8c87a" />
            <stop offset="100%" stopColor="#b8860b" />
          </radialGradient>

          {/* Outer ring gradient */}
          <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="#5c3a00" />
            <stop offset="100%" stopColor="#3b2200" />
          </radialGradient>

          {/* Parchment texture overlay */}
          <filter id="parchment">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
            <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blend" />
            <feComposite in="blend" in2="SourceGraphic" operator="in" />
          </filter>

          {/* Drop shadow */}
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="3" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* ── Outer decorative ring ── */}
        <circle cx={CX} cy={CY} r={OUTER_R + 12} fill="url(#ringGrad)" filter="url(#shadow)" />

        {/* Decorative knobs on outer ring */}
        {locationMeta.map(({ angle, name }) => {
          const knob = polarToXY(angle, OUTER_R + 4);
          return (
            <circle key={`knob-${name}`} cx={knob.x} cy={knob.y} r={6}
              fill="#D4AF37" stroke="#8B6914" strokeWidth="1" />
          );
        })}

        {/* ── Clock face ── */}
        <circle cx={CX} cy={CY} r={FACE_R} fill="url(#faceGrad)" filter="url(#parchment)" />
        <circle cx={CX} cy={CY} r={FACE_R} fill="none" stroke="#8B6914" strokeWidth="3" />

        {/* ── Location tick marks & labels ── */}
        {locationMeta.map(({ name, labelPt, tickOuter, tickInner, angle }) => {
          // Shift labels outward slightly to avoid overlap
          const shift = polarToXY(angle, LABEL_R - 20);
          const isMortalPeril = name === 'Mortal Peril';

          return (
            <g key={name}>
              {/* Tick line */}
              <line
                x1={tickInner.x} y1={tickInner.y}
                x2={tickOuter.x} y2={tickOuter.y}
                stroke="#8B6914"
                strokeWidth={isMortalPeril ? 3 : 1.5}
              />
              {/* Location label */}
              <text
                x={shift.x}
                y={shift.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="Cinzel, serif"
                fontSize={isMortalPeril ? '9.5' : '10.5'}
                fontWeight={isMortalPeril ? 'bold' : 'normal'}
                fill={isMortalPeril ? '#8B0000' : '#3b2200'}
                transform={`rotate(${angle + 90}, ${shift.x}, ${shift.y})`}
              >
                {name}
              </text>
            </g>
          );
        })}

        {/* ── Inner decorative circle ── */}
        <circle cx={CX} cy={CY} r={60} fill="none" stroke="#8B6914" strokeWidth="1" strokeDasharray="4 3" />

        {/* ── Person hands ── */}
        {locations.map((loc, idx) => (
          <PersonHand
            key={loc.id || idx}
            person={{ id: loc.id, name: loc.name, imageUrl: loc.imageUrl }}
            locationName={loc.location}
            colorIndex={idx}
          />
        ))}

        {/* ── Centre boss ── */}
        <circle cx={CX} cy={CY} r={CENTRE_R + 4} fill="#8B6914" />
        <circle cx={CX} cy={CY} r={CENTRE_R} fill="#D4AF37" stroke="#5c3a00" strokeWidth="1.5" />

        {/* ── Title on face ── */}
        <text
          x={CX}
          y={CY + 82}
          textAnchor="middle"
          fontFamily="Cinzel Decorative, Cinzel, serif"
          fontSize="13"
          fill="#5c3a00"
          letterSpacing="2"
        >
          WEASLEY
        </text>

        {/* ── Empty state hint ── */}
        {locations.length === 0 && (
          <text
            x={CX}
            y={CY - 20}
            textAnchor="middle"
            fontFamily="Cinzel, serif"
            fontSize="12"
            fill="#8B6914"
            opacity="0.7"
          >
            Add family members to begin
          </text>
        )}
      </svg>
    </div>
  );
}
