// Demo-signaler som vises på Plus-dashboardet inntil den ekte Grok-pipelinen
// (lib/grok-plus.ts) er live. Hold tonen pedagogisk og evidensbasert — speiler
// formatet Grok skal returnere fra blueprintens system-prompt.
import type { PlusRegion } from '@/lib/blueprints/plus';
import type { PlusLang } from '@/lib/i18n/plus-lang';

export type PlusAction = 'BUY' | 'SELL' | 'HOLD' | 'WATCH';
export type PlusHorizon = 'short' | 'medium' | 'long';

type LangText = Record<PlusLang, string>;
type LangList = Record<PlusLang, string[]>;

export interface PlusSignal {
  id: string;
  ticker: string;
  region: PlusRegion;
  action: PlusAction;
  confidence: number;
  timeHorizon: PlusHorizon;
  reasoning: LangText;
  catalysts: LangList;
  risks: LangList;
}

export const SEED_SIGNALS: readonly PlusSignal[] = [
  {
    id: 'seed-nvda',
    ticker: 'NVDA',
    region: 'US',
    action: 'BUY',
    confidence: 78,
    timeHorizon: 'medium',
    reasoning: {
      no: 'NVIDIA dominerer fortsatt AI-akseleratormarkedet, og hyperscaler-capex-trenden har ikke snudd. Trend-kanalen er intakt over SMA200, RSI 62 viser sunt momentum uten å være ekstremt overkjøpt. Nyhets-sentiment etter siste kvartalsrapport peker mot fortsatt etterspørsels-overskudd. Risikoen er konsentrert i kunde-konsentrasjon (de 4 hyperscalerne) og US-eksportkontroller mot Kina.',
      en: 'NVIDIA still dominates AI accelerators and hyperscaler capex has not turned. Trend channel intact above SMA200, RSI 62 shows healthy momentum without extreme overbought. Post-earnings sentiment continues to point to demand outpacing supply. Risk is concentrated in customer concentration (4 hyperscalers) and US export controls toward China.',
      de: 'NVIDIA dominiert weiterhin den Markt für KI-Beschleuniger und der Capex-Trend der Hyperscaler hat sich nicht gedreht. Trendkanal über SMA200, RSI 62 zeigt gesundes Momentum ohne Extremüberkauf. Sentiment nach den Quartalszahlen weist weiter auf Nachfrageüberhang. Hauptrisiken: Kundenkonzentration und US-Exportkontrollen.',
      es: 'NVIDIA sigue dominando los aceleradores de IA y el capex de hiperescaladores no ha girado. Canal de tendencia intacto sobre SMA200, RSI 62 muestra momentum saludable sin extremo. Sentimiento posterior a resultados sigue apuntando a demanda superior a oferta. Riesgo concentrado en clientes y controles de exportación de EEUU.',
      zh: 'NVIDIA 仍主导 AI 加速器市场，超大规模云厂商资本开支趋势未转。SMA200 上方趋势通道完好，RSI 62 显示健康动量。财报后情绪继续指向供不应求。风险集中在客户集中度和美国对华出口管制。',
    },
    catalysts: {
      no: ['Hyperscaler-capex øker i 2026-prognoser', 'Blackwell-rampingen treffer på lager', 'CUDA-økosystemets bytte-kostnad'],
      en: ['Hyperscaler capex rising in 2026 guidance', 'Blackwell ramp hitting supply', 'CUDA ecosystem switching cost'],
      de: ['Hyperscaler-Capex steigt in 2026-Prognosen', 'Blackwell-Hochlauf erreicht Lager', 'CUDA-Wechselkosten'],
      es: ['Capex de hiperescaladores subiendo en guía 2026', 'Rampa Blackwell golpea oferta', 'Coste de cambio del ecosistema CUDA'],
      zh: ['超大规模厂商 2026 资本开支预期上升', 'Blackwell 上量影响供给', 'CUDA 生态切换成本'],
    },
    risks: {
      no: ['Kundekonsentrasjon — 4 kunder = >40 % av salg', 'Eksportkontroller mot Kina kan strammes', 'AMD MI300/MI400 kan ta markedsandel'],
      en: ['Customer concentration — 4 buyers = >40% of revenue', 'China export controls may tighten', 'AMD MI300/MI400 could take share'],
      de: ['Kundenkonzentration — 4 Kunden = >40 % Umsatz', 'Verschärfung der China-Exportkontrollen', 'AMD MI300/MI400 könnten Anteile gewinnen'],
      es: ['Concentración — 4 clientes = >40% ingresos', 'Controles a China pueden endurecerse', 'AMD MI300/MI400 podría ganar cuota'],
      zh: ['客户集中——4 家客户超 40% 营收', '对华出口管制可能收紧', 'AMD MI300/MI400 或抢占份额'],
    },
  },
  {
    id: 'seed-eqnr',
    ticker: 'EQNR.OL',
    region: 'NO',
    action: 'WATCH',
    confidence: 55,
    timeHorizon: 'medium',
    reasoning: {
      no: 'Equinor handles tett opp mot 200-dagers og Brent-balansen er pris-positiv kortsiktig, men gass-prisene i Europa har normalisert. Selskapets fornybar-pivot drar capex uten umiddelbar EBITDA-bidrag. Vent på enten et tydelig brudd over SMA200 eller en olje-rekyl på +5 USD før vurdering.',
      en: 'Equinor trades right against the 200-day MA and Brent balance is short-term price-supportive, but European gas prices have normalized. The renewable pivot drags capex without immediate EBITDA contribution. Wait for either a clean break above SMA200 or an oil rebound of +$5 before reassessing.',
      de: 'Equinor notiert nahe an SMA200; die Brent-Bilanz stützt kurzfristig, aber europäische Gaspreise haben sich normalisiert. Der Renewables-Pivot bindet Capex ohne sofortigen EBITDA-Beitrag. Auf klaren Ausbruch über SMA200 oder Ölerholung +5 USD warten.',
      es: 'Equinor cotiza pegado a la SMA200 y el balance Brent apoya a corto plazo, pero el gas europeo se ha normalizado. El giro a renovables consume capex sin contribución inmediata al EBITDA. Esperar ruptura limpia sobre SMA200 o rebote del crudo +5 USD.',
      zh: 'Equinor 紧贴 200 日均线，布伦特短期价格平衡偏多，但欧洲天然气已回归常态。新能源转型占用资本支出，未立即贡献 EBITDA。等待 SMA200 上方清晰突破或油价反弹 +5 USD 后再评估。',
    },
    catalysts: {
      no: ['OPEC+ kuttforlengelse', 'Norsk gass eksport-vekst', 'Q-rapport viser kostnadskontroll'],
      en: ['OPEC+ cut extension', 'Norwegian gas export growth', 'Quarterly cost discipline'],
      de: ['OPEC+ Förderkürzungen verlängert', 'Norwegisches Gas-Exportwachstum', 'Quartalsweise Kostendisziplin'],
      es: ['Extensión del recorte OPEC+', 'Crecimiento exportación gas noruego', 'Disciplina de costes trimestral'],
      zh: ['OPEC+ 减产延长', '挪威天然气出口增长', '季度成本控制'],
    },
    risks: {
      no: ['Brent under 70 USD', 'Renewables-capex spiser kontantstrøm', 'NOK-styrking mot USD'],
      en: ['Brent below $70', 'Renewables capex eats cashflow', 'NOK strength vs USD'],
      de: ['Brent unter 70 USD', 'Renewables-Capex frisst Cashflow', 'NOK-Stärke gegenüber USD'],
      es: ['Brent bajo 70 USD', 'Capex renovables consume caja', 'Fortaleza de NOK vs USD'],
      zh: ['布伦特跌破 70 美元', '新能源资本开支吞噬现金流', '挪威克朗对美元走强'],
    },
  },
  {
    id: 'seed-asml',
    ticker: 'ASML.AS',
    region: 'EU',
    action: 'BUY',
    confidence: 72,
    timeHorizon: 'long',
    reasoning: {
      no: 'ASML har strukturell monopol på EUV-litografi, og High-NA-rampingen treffer kvartalsvise milestones. Bestillingsboken har stabilisert seg etter Kina-eksport-bekymringene, og lead-time gir 12–18 mnd inntektssikt. Verdsettelsen er fortsatt rik (P/E ~35), men kompenseres av cash conversion og tilbakekjøp.',
      en: 'ASML has a structural monopoly on EUV lithography and the High-NA ramp is hitting quarterly milestones. Order book has stabilized after China-export concerns, and lead times give 12–18 months of revenue visibility. Valuation is still rich (P/E ~35), offset by cash conversion and buybacks.',
      de: 'ASML hat ein strukturelles EUV-Litho-Monopol; High-NA-Hochlauf erfüllt quartalsweise Meilensteine. Auftragsbuch hat sich nach den China-Exportsorgen stabilisiert, Lead-Time gibt 12–18 Monate Umsatz-Sicht. Bewertung weiterhin hoch (KGV ~35), aber durch Cash-Conversion und Rückkäufe kompensiert.',
      es: 'ASML tiene monopolio estructural en EUV; la rampa High-NA cumple hitos trimestrales. Cartera de pedidos estabilizada tras las preocupaciones por exportaciones a China, lead-time da visibilidad 12–18 meses. Valoración aún elevada (P/E ~35), compensada por conversión de caja y recompras.',
      zh: 'ASML 在 EUV 光刻具有结构性垄断，High-NA 量产达成季度里程碑。在对华出口担忧之后订单簿企稳，交付周期提供 12–18 个月营收可见度。估值仍偏高（P/E ~35），但现金转化与回购可补偿。',
    },
    catalysts: {
      no: ['High-NA-leveranser akselererer', 'TSMC/Samsung capex 2026 høy', 'Kina-spesifikk kapasitetsvekst'],
      en: ['High-NA deliveries accelerating', 'TSMC/Samsung 2026 capex high', 'China-specific capacity growth'],
      de: ['High-NA-Lieferungen beschleunigen', 'TSMC/Samsung Capex 2026 hoch', 'China-spezifisches Kapazitätswachstum'],
      es: ['Aceleran entregas High-NA', 'Capex TSMC/Samsung 2026 alto', 'Crecimiento de capacidad en China'],
      zh: ['High-NA 出货加速', 'TSMC/三星 2026 资本开支高位', '中国本地产能增长'],
    },
    risks: {
      no: ['Strammere EU-eksportregler mot Kina', 'Memory-syklus-svekkelse', 'Multipler-kontraksjon hvis renten stiger'],
      en: ['Tighter EU export rules to China', 'Memory cycle weakening', 'Multiple contraction if rates rise'],
      de: ['Strengere EU-Exportregeln gegen China', 'Schwächerer Memory-Zyklus', 'Multiple-Kompression bei steigenden Zinsen'],
      es: ['Normas UE más estrictas contra China', 'Debilidad ciclo memoria', 'Contracción de múltiplos si suben tipos'],
      zh: ['欧盟对华出口规则收紧', '存储周期走弱', '利率上升致估值压缩'],
    },
  },
  {
    id: 'seed-2330tw',
    ticker: '2330.TW',
    region: 'TW',
    action: 'BUY',
    confidence: 80,
    timeHorizon: 'long',
    reasoning: {
      no: 'TSMC kombinerer monopol-aktig posisjon i avanserte noder (3 nm og under) med rask amerikansk og japansk fabriks-utbygging som diversifiserer geopolitisk eksponering. Margin-rampingen i 3 nm fortsetter, og 2 nm-pipelinen har konkrete kunde-bestillinger. Verdsettelsen er moderat sammenlignet med direkte amerikanske AI-eksponeringer.',
      en: 'TSMC pairs near-monopoly position in advanced nodes (3 nm and below) with rapid US and Japan fab buildout that diversifies geopolitical exposure. 3 nm margin ramp continues; 2 nm pipeline has concrete customer commitments. Valuation moderate vs direct US AI plays.',
      de: 'TSMC verbindet eine monopolartige Position bei fortgeschrittenen Nodes (3 nm und darunter) mit schnellem Fab-Ausbau in den USA und Japan, was die geopolitische Exposition diversifiziert. 3-nm-Margenhochlauf läuft, 2-nm-Pipeline mit konkreten Kundenbestellungen. Bewertung moderat im Vergleich zu US-KI-Werten.',
      es: 'TSMC combina posición casi-monopólica en nodos avanzados (3 nm e inferiores) con expansión rápida de fábricas en EEUU y Japón que diversifica la exposición geopolítica. Rampa de margen 3 nm continúa; pipeline 2 nm con compromisos de clientes. Valoración moderada vs jugadores IA directos en EEUU.',
      zh: 'TSMC 在先进制程（3 nm 及以下）的近乎垄断地位，叠加美日快速建厂以分散地缘风险。3 nm 毛利率爬坡持续，2 nm 管线有客户订单。相较于美国直接 AI 标的估值适中。',
    },
    catalysts: {
      no: ['2 nm tape-out for Apple/NVIDIA', 'Arizona/Kumamoto-fabrikkene rampes', 'AI-akselerator-bestillinger fra alle hyperscalere'],
      en: ['2 nm tape-out for Apple/NVIDIA', 'Arizona and Kumamoto fab ramps', 'AI accelerator orders from all hyperscalers'],
      de: ['2-nm-Tape-out für Apple/NVIDIA', 'Hochlauf der Fabs in Arizona und Kumamoto', 'KI-Beschleuniger-Aufträge aller Hyperscaler'],
      es: ['Tape-out 2 nm para Apple/NVIDIA', 'Rampas Arizona y Kumamoto', 'Órdenes IA de todos los hiperescaladores'],
      zh: ['Apple/NVIDIA 2 nm tape-out', '亚利桑那与熊本厂上量', '所有超大规模厂商的 AI 加速器订单'],
    },
    risks: {
      no: ['Geopolitisk Taiwan-risiko', 'Capex-volatilitet hvis hyperscaler-syklusen snur', 'TWD-styrking som demper EPS'],
      en: ['Taiwan geopolitical risk', 'Capex volatility if hyperscaler cycle turns', 'TWD strength dampening EPS'],
      de: ['Geopolitisches Taiwan-Risiko', 'Capex-Volatilität bei Hyperscaler-Zyklus-Wende', 'TWD-Stärke dämpft EPS'],
      es: ['Riesgo geopolítico de Taiwán', 'Volatilidad capex si gira el ciclo hiperescalador', 'Fortaleza TWD reduce BPA'],
      zh: ['台湾地缘政治风险', '若超大规模周期转向则资本开支波动', '新台币走强压制 EPS'],
    },
  },
  {
    id: 'seed-rhmde',
    ticker: 'RHM.DE',
    region: 'EU',
    action: 'HOLD',
    confidence: 60,
    timeHorizon: 'medium',
    reasoning: {
      no: 'Rheinmetall har solid ordrebok og strukturell medvind fra europeisk forsvars-opprusting. Aksjen har imidlertid løpt langt og handler ~22x forward EBIT, noe som gir lite margin for skuffelse. Vent på en pullback til SMA50 før ny eksponering.',
      en: 'Rheinmetall has a solid backlog and structural tailwind from European defense rearmament. The stock has run far and trades at ~22x forward EBIT, leaving little room for disappointment. Wait for a pullback to SMA50 before adding exposure.',
      de: 'Rheinmetall hat solides Auftragsbuch und strukturellen Rückenwind aus europäischer Aufrüstung. Aktie ist weit gelaufen und notiert mit ~22x Forward-EBIT — wenig Spielraum für Enttäuschungen. Auf Rücksetzer auf SMA50 warten.',
      es: 'Rheinmetall tiene cartera sólida y viento estructural por rearme europeo. La acción ha corrido mucho y cotiza ~22x EBIT futuro, deja poco margen ante decepciones. Esperar retroceso a SMA50.',
      zh: 'Rheinmetall 订单饱满，受益于欧洲防务再武装的结构性顺风。股价已上涨较多，远期 EBIT 约 22 倍，容错空间有限。等待回落至 SMA50 再加码。',
    },
    catalysts: {
      no: ['NATO-2 %-mandat tilfører ordre', 'Ammunisjons-kapasitet utvides', 'Polen og Tyskland skalerer kontrakter'],
      en: ['NATO 2% mandate adds orders', 'Ammunition capacity expansion', 'Poland and Germany scaling contracts'],
      de: ['NATO-2 %-Mandat sorgt für Aufträge', 'Munitions-Kapazitätsausbau', 'Polen und Deutschland skalieren Verträge'],
      es: ['Mandato OTAN 2% suma pedidos', 'Expansión capacidad munición', 'Polonia y Alemania escalan contratos'],
      zh: ['北约 2% 标准带来订单', '弹药产能扩张', '波兰和德国合同扩大'],
    },
    risks: {
      no: ['Politisk press på defensive aksjer', 'Multiplikator-kompresjon på sektor-nivå', 'Forsinkelser i ammunisjons-rampingen'],
      en: ['Political pressure on defense names', 'Sector-wide multiple compression', 'Ammunition ramp delays'],
      de: ['Politischer Druck auf Defense-Werte', 'Multiplenkompression sektorweit', 'Verzögerungen beim Munitions-Hochlauf'],
      es: ['Presión política sobre defensa', 'Compresión de múltiplos sectorial', 'Retrasos en rampa munición'],
      zh: ['防务股政治压力', '行业估值收缩', '弹药上量延迟'],
    },
  },
  {
    id: 'seed-9988hk',
    ticker: '9988.HK',
    region: 'HK',
    action: 'WATCH',
    confidence: 50,
    timeHorizon: 'medium',
    reasoning: {
      no: 'Alibaba viser bedring i kjernevirksomheten (Taobao/Tmall GMV) og cloud-veksten har stabilisert seg. Verdsettelsen er svært lav (forward P/E ~10), men politisk usikkerhet rundt Kina holder utenlandsk kapital tilbake. WATCH til vi ser konkret regulatorisk avklaring eller breakout på chartet.',
      en: 'Alibaba shows improvement in core commerce (Taobao/Tmall GMV) and cloud growth has stabilized. Valuation very low (forward P/E ~10), but political uncertainty on China keeps foreign capital sidelined. WATCH until concrete regulatory clarity or chart breakout.',
      de: 'Alibaba zeigt Erholung im Kerngeschäft (Taobao/Tmall GMV); Cloud-Wachstum stabilisiert. Sehr niedrige Bewertung (Forward-KGV ~10), aber politische Unsicherheit bei China hält ausländisches Kapital zurück. WATCH bis regulatorische Klarheit oder Chart-Ausbruch.',
      es: 'Alibaba mejora en el comercio núcleo (Taobao/Tmall GMV) y la nube se estabiliza. Valoración muy baja (P/E adelantado ~10), pero la incertidumbre política sobre China mantiene al capital extranjero al margen. WATCH hasta claridad regulatoria o ruptura del gráfico.',
      zh: '阿里巴巴核心商业（淘宝/天猫 GMV）改善，云增长企稳。估值极低（前瞻 P/E ~10），但中国政治不确定性使外资观望。在监管明朗或图表突破前保持观察。',
    },
    catalysts: {
      no: ['Cloud-marginer >10 %', 'Taobao GMV-vekst akselererer', 'Storfond-ipo / spin-off klargjør verdi'],
      en: ['Cloud margins >10%', 'Taobao GMV growth accelerating', 'Spin-off / IPO crystallizes value'],
      de: ['Cloud-Margen >10 %', 'Taobao-GMV-Wachstum beschleunigt', 'Spin-off / IPO macht Wert sichtbar'],
      es: ['Márgenes cloud >10%', 'GMV Taobao acelera', 'Spin-off / IPO cristaliza valor'],
      zh: ['云利润率 >10%', '淘宝 GMV 增速加快', '分拆/IPO 释放价值'],
    },
    risks: {
      no: ['Ny regulatorisk innstramming', 'CNY-svekkelse', 'Forbruker-svakhet i Kina vedvarer'],
      en: ['New regulatory tightening', 'CNY weakness', 'Persistent China consumer softness'],
      de: ['Neue regulatorische Verschärfung', 'CNY-Schwäche', 'Anhaltende Konsumschwäche in China'],
      es: ['Nuevas restricciones regulatorias', 'Debilidad del CNY', 'Debilidad de consumo en China persistente'],
      zh: ['新一轮监管收紧', '人民币走弱', '中国消费持续疲软'],
    },
  },
  {
    id: 'seed-lly',
    ticker: 'LLY',
    region: 'US',
    action: 'HOLD',
    confidence: 65,
    timeHorizon: 'long',
    reasoning: {
      no: 'Eli Lilly har strukturell vekst fra GLP-1-segmentet (Mounjaro/Zepbound), men forward P/E ~50 priser inn betydelig kapasitetsutvidelse. HOLD reflekterer at fundamentene er sterke men entry-prisen er strukket; vurder å trimme posisjonsstørrelsen i pullback.',
      en: 'Eli Lilly has structural growth from the GLP-1 franchise (Mounjaro/Zepbound), but a forward P/E of ~50 prices in major capacity expansion. HOLD reflects strong fundamentals at a stretched entry price; consider trimming on pullbacks.',
      de: 'Eli Lilly hat strukturelles Wachstum aus dem GLP-1-Geschäft (Mounjaro/Zepbound), aber Forward-KGV ~50 preist eine erhebliche Kapazitätsausweitung ein. HOLD spiegelt starke Fundamentaldaten bei gestrecktem Einstieg.',
      es: 'Eli Lilly tiene crecimiento estructural del franchise GLP-1 (Mounjaro/Zepbound), pero el P/E adelantado ~50 ya descuenta gran expansión de capacidad. HOLD refleja fundamentos sólidos a precio estirado.',
      zh: 'Eli Lilly 受 GLP-1 业务（Mounjaro/Zepbound）结构性增长驱动，但前瞻 P/E ~50 已计入大幅产能扩张。HOLD 反映基本面强但入场价偏高。',
    },
    catalysts: {
      no: ['Oral GLP-1 fase 3-data', 'Manufacturing-capex slår plan', 'Indikasjons-utvidelse til kardio/Alzheimer'],
      en: ['Oral GLP-1 phase 3 data', 'Manufacturing capex on schedule', 'Label expansion into cardio/Alzheimer'],
      de: ['Orale-GLP-1 Phase-3-Daten', 'Manufacturing-Capex im Plan', 'Indikationserweiterung Kardio/Alzheimer'],
      es: ['Datos fase 3 GLP-1 oral', 'Capex de fabricación a tiempo', 'Ampliación de indicaciones cardio/Alzheimer'],
      zh: ['口服 GLP-1 三期数据', '产能资本开支按计划', '心血管/阿尔茨海默适应症扩展'],
    },
    risks: {
      no: ['Konkurranse fra Novo og biosimilarer', 'Forsikrings-pricing-press i USA', 'Multipler-kompresjon ved renteoppgang'],
      en: ['Novo and biosimilar competition', 'US insurance pricing pressure', 'Multiple compression on higher rates'],
      de: ['Wettbewerb durch Novo und Biosimilars', 'US-Pricing-Druck der Versicherer', 'Multiplenkompression bei höheren Zinsen'],
      es: ['Competencia Novo y biosimilares', 'Presión precios aseguradoras EEUU', 'Compresión múltiplos por tipos altos'],
      zh: ['Novo 与生物类似药竞争', '美国保险定价压力', '利率上升致估值压缩'],
    },
  },
  {
    id: 'seed-005930ks',
    ticker: '005930.KS',
    region: 'KR',
    action: 'BUY',
    confidence: 68,
    timeHorizon: 'medium',
    reasoning: {
      no: 'Samsung Electronics handler under bok-verdi-justert NAV og minne-syklusen er bunnet. HBM3E-rampingen for NVIDIA er på sporet, og foundry-business begynner å vise kapasitetsutnyttelse over 80 %. Asymmetrisk oppside hvis HBM-volumer slår 2026-mål.',
      en: 'Samsung trades below adjusted NAV and the memory cycle has bottomed. HBM3E ramp for NVIDIA on track, foundry utilization climbing past 80%. Asymmetric upside if HBM volumes beat 2026 targets.',
      de: 'Samsung notiert unter bereinigtem NAV; Memory-Zyklus hat den Boden erreicht. HBM3E-Hochlauf für NVIDIA im Plan, Foundry-Auslastung über 80 %. Asymmetrisches Upside bei HBM-Übertreffen der 2026-Ziele.',
      es: 'Samsung cotiza bajo el NAV ajustado y el ciclo de memoria tocó fondo. Rampa HBM3E para NVIDIA en marcha, utilización foundry sobre 80%. Upside asimétrico si HBM supera objetivos 2026.',
      zh: '三星电子股价低于调整后 NAV，存储周期触底。供应 NVIDIA 的 HBM3E 量产顺利，代工产能利用率突破 80%。若 HBM 出货超 2026 目标，存在不对称上行。',
    },
    catalysts: {
      no: ['HBM4-kvalifisering hos hyperscalere', 'NAND-pris-rebound', 'Foundry-kunde-vinner mot TSMC'],
      en: ['HBM4 qualification at hyperscalers', 'NAND price rebound', 'Foundry customer wins vs TSMC'],
      de: ['HBM4-Qualifizierung bei Hyperscalern', 'NAND-Preiserholung', 'Foundry-Kundengewinne vs. TSMC'],
      es: ['Calificación HBM4 en hiperescaladores', 'Rebote precios NAND', 'Ganar clientes foundry vs TSMC'],
      zh: ['HBM4 在超大规模厂商完成验证', 'NAND 价格回升', '代工业务从 TSMC 抢单'],
    },
    risks: {
      no: ['HBM-yield-utfordringer', 'KRW-styrking demper EPS', 'Geopolitisk Korea-risiko'],
      en: ['HBM yield challenges', 'KRW strength dampens EPS', 'Korea geopolitical risk'],
      de: ['HBM-Yield-Probleme', 'KRW-Stärke dämpft EPS', 'Geopolitisches Korea-Risiko'],
      es: ['Desafíos de rendimiento HBM', 'Fortaleza KRW reduce BPA', 'Riesgo geopolítico Corea'],
      zh: ['HBM 良率挑战', '韩元走强压制 EPS', '韩国地缘政治风险'],
    },
  },
];
