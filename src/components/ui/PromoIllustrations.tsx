/* Ilustrações SVG transparentes para os PromoCards da HomePage */

export function IllustrationEnem() {
  return (
    <svg width="160" height="176" viewBox="0 0 160 176" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Folha de prova */}
      <rect x="18" y="16" width="90" height="128" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(74,222,128,0.28)" strokeWidth="1.5"/>
      {/* Cabeçalho da folha */}
      <rect x="18" y="16" width="90" height="28" rx="8" fill="rgba(74,222,128,0.13)"/>
      <rect x="18" y="34" width="90" height="10" fill="rgba(74,222,128,0.07)"/>
      <rect x="30" y="24" width="54" height="7" rx="3.5" fill="rgba(74,222,128,0.45)"/>
      {/* Linha da questão */}
      <rect x="30" y="56" width="68" height="4" rx="2" fill="rgba(255,255,255,0.14)"/>
      {/* Alternativas A B C D */}
      <circle cx="32" cy="74" r="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
      <text x="29.5" y="78" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="rgba(255,255,255,0.45)">A</text>
      <rect x="44" y="70" width="52" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>

      <circle cx="32" cy="92" r="7" fill="rgba(74,222,128,0.2)" stroke="rgba(74,222,128,0.7)" strokeWidth="1.5"/>
      <text x="29.5" y="96" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="rgba(74,222,128,1)">B</text>
      <rect x="44" y="88" width="52" height="4" rx="2" fill="rgba(74,222,128,0.18)"/>
      <path d="M27 92 L31 96 L37 87" stroke="rgba(74,222,128,0.95)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

      <circle cx="32" cy="110" r="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
      <text x="29.5" y="114" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="rgba(255,255,255,0.45)">C</text>
      <rect x="44" y="106" width="52" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>

      <circle cx="32" cy="128" r="7" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
      <text x="29.5" y="132" fontSize="7.5" fontFamily="monospace" fontWeight="bold" fill="rgba(255,255,255,0.45)">D</text>
      <rect x="44" y="124" width="52" height="4" rx="2" fill="rgba(255,255,255,0.1)"/>

      {/* Lápis inclinado */}
      <g transform="translate(126,18) rotate(28)">
        <rect x="-5.5" y="-8" width="11" height="8" rx="1" fill="rgba(252,165,165,0.65)"/>
        <rect x="-6" y="-10" width="12" height="3.5" fill="rgba(156,163,175,0.5)"/>
        <rect x="-5.5" y="0" width="11" height="50" fill="rgba(253,224,71,0.82)"/>
        <rect x="-5.5" y="14" width="11" height="3" fill="rgba(234,179,8,0.55)"/>
        <polygon points="-5.5,50 5.5,50 0,62" fill="rgba(253,224,71,0.5)"/>
        <polygon points="-3,55 3,55 0,62" fill="rgba(20,20,20,0.75)"/>
      </g>

      {/* Pontos decorativos */}
      <circle cx="136" cy="108" r="3.5" fill="rgba(253,224,71,0.5)"/>
      <circle cx="148" cy="80" r="2.5" fill="rgba(74,222,128,0.4)"/>
      <circle cx="140" cy="138" r="2" fill="rgba(255,255,255,0.25)"/>
    </svg>
  );
}

export function IllustrationNota1000() {
  return (
    <svg width="160" height="176" viewBox="0 0 160 176" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Diploma */}
      <rect x="16" y="100" width="112" height="66" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(165,180,252,0.3)" strokeWidth="1.5"/>
      <rect x="16" y="100" width="112" height="20" rx="8" fill="rgba(165,180,252,0.12)"/>
      <rect x="16" y="112" width="112" height="8" fill="rgba(165,180,252,0.06)"/>
      <rect x="32" y="130" width="80" height="5" rx="2.5" fill="rgba(255,255,255,0.1)"/>
      <rect x="42" y="140" width="60" height="5" rx="2.5" fill="rgba(255,255,255,0.07)"/>
      <rect x="52" y="150" width="40" height="5" rx="2.5" fill="rgba(255,255,255,0.05)"/>

      {/* Selo "1000" */}
      <circle cx="72" cy="112" r="16" fill="rgba(165,180,252,0.22)" stroke="rgba(165,180,252,0.65)" strokeWidth="2"/>
      <text x="72" y="117" textAnchor="middle" fontSize="11" fontWeight="bold" fontFamily="monospace" fill="rgba(199,210,254,0.95)">1000</text>

      {/* Capelo — aba */}
      <polygon points="72,32 138,58 72,84 6,58" fill="rgba(99,102,241,0.32)" stroke="rgba(165,180,252,0.42)" strokeWidth="1.5"/>
      {/* Capelo — topo */}
      <circle cx="72" cy="32" r="5.5" fill="rgba(165,180,252,0.65)"/>
      {/* Capelo — parte superior mais escura */}
      <ellipse cx="72" cy="58" rx="30" ry="8" fill="rgba(79,70,229,0.25)"/>
      {/* Borla */}
      <line x1="138" y1="58" x2="138" y2="80" stroke="rgba(165,180,252,0.55)" strokeWidth="2"/>
      <circle cx="138" cy="82" r="4.5" fill="rgba(165,180,252,0.4)" stroke="rgba(165,180,252,0.65)" strokeWidth="1"/>

      {/* Estrelas */}
      <path d="M28 42 L30 36 L32 42 L38 44 L32 46 L30 52 L28 46 L22 44 Z" fill="rgba(253,224,71,0.62)"/>
      <path d="M108 30 L110 25 L112 30 L117 32 L112 34 L110 39 L108 34 L103 32 Z" fill="rgba(253,224,71,0.48)"/>
      <circle cx="16" cy="70" r="3" fill="rgba(253,224,71,0.38)"/>
      <circle cx="145" cy="88" r="2.5" fill="rgba(165,180,252,0.4)"/>
    </svg>
  );
}

export function IllustrationPDV() {
  return (
    <svg width="160" height="176" viewBox="0 0 160 176" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Terminal body */}
      <rect x="32" y="18" width="82" height="100" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(52,211,153,0.3)" strokeWidth="1.5"/>
      {/* Tela */}
      <rect x="41" y="28" width="64" height="46" rx="6" fill="rgba(52,211,153,0.09)" stroke="rgba(52,211,153,0.28)" strokeWidth="1"/>
      {/* Barras do gráfico na tela */}
      <rect x="50" y="55" width="8" height="15" rx="2" fill="rgba(52,211,153,0.45)"/>
      <rect x="62" y="47" width="8" height="23" rx="2" fill="rgba(52,211,153,0.65)"/>
      <rect x="74" y="51" width="8" height="19" rx="2" fill="rgba(52,211,153,0.5)"/>
      <rect x="86" y="42" width="8" height="28" rx="2" fill="rgba(52,211,153,0.9)"/>
      {/* Eixo x da tela */}
      <line x1="48" y1="72" x2="98" y2="72" stroke="rgba(52,211,153,0.2)" strokeWidth="1"/>
      {/* Teclado */}
      {[0,1,2].flatMap(row => [0,1,2].map(col => (
        <rect
          key={`${row}-${col}`}
          x={46 + col * 20} y={83 + row * 11}
          width="14" height="7" rx="3.5"
          fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
        />
      )))}
      {/* Papel do recibo saindo embaixo */}
      <rect x="54" y="118" width="38" height="52" rx="2" fill="rgba(255,255,255,0.08)" stroke="rgba(52,211,153,0.22)" strokeWidth="1"/>
      {/* Dentinhos do papel */}
      {[0,4,8,12,16,20,24,28,32,36].map(x => (
        <path key={x} d={`M${54+x},118 L${56+x},113 L${58+x},118`} stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" fill="none"/>
      ))}
      {/* Código de barras */}
      {[0,3,5,8,11,13,16,19,21,24,27,30].map((offset, i) => (
        <rect key={i} x={58 + offset} y="125" width={i % 3 === 0 ? 2.5 : 1.5} height="18" rx="0.5" fill="rgba(255,255,255,0.28)"/>
      ))}
      {/* Linhas do recibo */}
      <rect x="59" y="148" width="28" height="3.5" rx="1.75" fill="rgba(255,255,255,0.12)"/>
      <rect x="62" y="155" width="22" height="3.5" rx="1.75" fill="rgba(255,255,255,0.08)"/>
      <rect x="59" y="162" width="28" height="4" rx="2" fill="rgba(52,211,153,0.3)"/>

      {/* Círculo de confirmação */}
      <circle cx="130" cy="75" r="18" fill="rgba(52,211,153,0.18)" stroke="rgba(52,211,153,0.6)" strokeWidth="2"/>
      <path d="M121 75 L126 81 L139 67" stroke="rgba(52,211,153,0.95)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IllustrationServicos() {
  return (
    <svg width="160" height="176" viewBox="0 0 160 176" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Base do notebook */}
      <rect x="8" y="148" width="144" height="10" rx="5" fill="rgba(124,58,237,0.2)" stroke="rgba(167,139,250,0.3)" strokeWidth="1"/>
      <rect x="18" y="138" width="124" height="14" rx="3" fill="rgba(124,58,237,0.14)"/>
      {/* Tela */}
      <rect x="22" y="24" width="116" height="118" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(167,139,250,0.3)" strokeWidth="1.5"/>
      <rect x="28" y="30" width="104" height="106" rx="5" fill="rgba(124,58,237,0.08)"/>
      {/* Barra de título do terminal */}
      <rect x="28" y="30" width="104" height="20" rx="5" fill="rgba(124,58,237,0.16)"/>
      <rect x="28" y="44" width="104" height="6" fill="rgba(124,58,237,0.08)"/>
      {/* Dots da barra */}
      <circle cx="41" cy="40" r="4.5" fill="rgba(248,113,113,0.65)"/>
      <circle cx="55" cy="40" r="4.5" fill="rgba(253,224,71,0.65)"/>
      <circle cx="69" cy="40" r="4.5" fill="rgba(74,222,128,0.65)"/>
      {/* Símbolo </> central */}
      <text x="80" y="104" textAnchor="middle" fontSize="34" fontFamily="monospace" fontWeight="bold" fill="rgba(167,139,250,0.88)">&lt;/&gt;</text>
      {/* Linhas de código */}
      <rect x="36" y="116" width="48" height="4" rx="2" fill="rgba(167,139,250,0.28)"/>
      <rect x="36" y="124" width="76" height="4" rx="2" fill="rgba(103,232,249,0.22)"/>
      <rect x="36" y="132" width="60" height="4" rx="2" fill="rgba(167,139,250,0.16)"/>
      {/* Cursor piscando */}
      <rect x="116" y="124" width="3" height="14" rx="1.5" fill="rgba(167,139,250,0.72)"/>
      {/* Badges flutuantes */}
      <circle cx="146" cy="42" r="9" fill="rgba(103,232,249,0.15)" stroke="rgba(103,232,249,0.42)" strokeWidth="1.2"/>
      <text x="146" y="46" textAnchor="middle" fontSize="7.5" fontFamily="monospace" fill="rgba(103,232,249,0.85)">JS</text>
      <circle cx="12" cy="88" r="9" fill="rgba(253,224,71,0.1)" stroke="rgba(253,224,71,0.38)" strokeWidth="1.2"/>
      <text x="12" y="92" textAnchor="middle" fontSize="7" fontFamily="monospace" fill="rgba(253,224,71,0.75)">AI</text>
      <circle cx="148" cy="110" r="7" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.35)" strokeWidth="1"/>
      <text x="148" y="114" textAnchor="middle" fontSize="6.5" fontFamily="monospace" fill="rgba(74,222,128,0.7)">TS</text>
    </svg>
  );
}

export function IllustrationLandingPage() {
  return (
    <svg width="160" height="176" viewBox="0 0 160 176" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Frame do celular */}
      <rect x="42" y="10" width="72" height="140" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(253,211,77,0.35)" strokeWidth="1.5"/>
      {/* Tela */}
      <rect x="48" y="22" width="60" height="116" rx="8" fill="rgba(253,211,77,0.06)"/>
      {/* Notch câmera */}
      <rect x="66" y="13" width="24" height="8" rx="4" fill="rgba(255,255,255,0.12)"/>
      {/* Botão home */}
      <circle cx="78" cy="155" r="5.5" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.14)" strokeWidth="1"/>
      {/* Header site na tela */}
      <rect x="48" y="22" width="60" height="20" rx="8" fill="rgba(253,211,77,0.14)"/>
      <rect x="53" y="29" width="22" height="6" rx="3" fill="rgba(253,211,77,0.52)"/>
      <rect x="95" y="29" width="8" height="6" rx="3" fill="rgba(253,211,77,0.3)"/>
      {/* Hero section */}
      <rect x="53" y="48" width="52" height="24" rx="4" fill="rgba(255,255,255,0.05)"/>
      <rect x="56" y="52" width="36" height="5" rx="2.5" fill="rgba(255,255,255,0.22)"/>
      <rect x="56" y="60" width="28" height="4" rx="2" fill="rgba(255,255,255,0.12)"/>
      {/* Botão CTA na tela */}
      <rect x="56" y="67" width="24" height="7" rx="3.5" fill="rgba(253,211,77,0.42)"/>
      {/* Blocos de conteúdo */}
      <rect x="53" y="78" width="24" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <rect x="81" y="78" width="24" height="20" rx="3" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
      <rect x="53" y="104" width="52" height="4" rx="2" fill="rgba(255,255,255,0.09)"/>
      <rect x="53" y="112" width="42" height="4" rx="2" fill="rgba(255,255,255,0.06)"/>
      <rect x="53" y="120" width="48" height="4" rx="2" fill="rgba(255,255,255,0.06)"/>
      {/* Barra de navegação inferior na tela */}
      <rect x="48" y="128" width="60" height="10" rx="0" fill="rgba(253,211,77,0.08)"/>
      <rect x="48" y="128" width="60" height="10" rx="0" fill="none" stroke="rgba(253,211,77,0.15)" strokeWidth="0.5"/>

      {/* Bolha WhatsApp */}
      <circle cx="128" cy="96" r="22" fill="rgba(37,211,102,0.22)" stroke="rgba(37,211,102,0.65)" strokeWidth="2"/>
      {/* Ícone telefone simplificado */}
      <path
        d="M118 96 C118 91.5 121.5 88 126 88 C130.5 88 134 91.5 134 96 C134 100.5 130.5 104 126 104 C124.3 104 122.7 103.4 121.5 102.4 L118 104 L119.6 100.5 C118.6 99.1 118 97.6 118 96 Z"
        fill="rgba(37,211,102,0.35)"
        stroke="rgba(37,211,102,0.92)"
        strokeWidth="1.8"
      />
      {/* Triângulo da bolha */}
      <path d="M128 118 L122 110 L134 110 Z" fill="rgba(37,211,102,0.22)" stroke="rgba(37,211,102,0.4)" strokeWidth="0.5"/>

      {/* Sparkles */}
      <circle cx="34" cy="52" r="4" fill="rgba(253,211,77,0.32)"/>
      <circle cx="144" cy="46" r="3" fill="rgba(253,211,77,0.26)"/>
      <circle cx="28" cy="130" r="2.5" fill="rgba(37,211,102,0.32)"/>
      <circle cx="148" cy="136" r="2" fill="rgba(253,211,77,0.25)"/>
    </svg>
  );
}
