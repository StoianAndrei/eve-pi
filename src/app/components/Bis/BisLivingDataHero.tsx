"use client";

import React from "react";
import { select } from "d3-selection";
import { rgb } from "d3-color";

/**
 * BIS Living Data Hero v2 — animated landing hero for "Business Intelligence
 * Signals". An SVG city skyline where each tower is a French region sized by
 * its weekly count of legal notices, layered with canvas particles (sparks
 * rising off rooftops, data flowing along inter-tower links, ambient motes).
 * Hovering the "I" of the BIS wordmark sweeps a golden searchlight over the
 * city that follows the cursor and reveals per-tower counts; hovering a tower
 * shows a tooltip with region, count, weekly delta and a 12-week sparkline.
 *
 * Ported from the Claude Design component `BIS Living Data Hero v2.dc.html`.
 */

export type BisLivingDataHeroProps = {
  /** Weekly notice count shown in the badge; scales lit windows and spark rate. */
  notices?: number;
  /** Number of foreground towers (regions), 9–20. */
  density?: number;
  /** Global animation speed multiplier. */
  motionSpeed?: number;
  /** Opacity multiplier for the background ridge lines, 0–1.6. */
  atmosphere?: number;
  /** Show per-tower value labels only on hover/beam, or always. */
  labelMode?: "hover" | "always";
};

const CSS = `
@keyframes bisPing{0%{transform:scale(.6);opacity:.85}70%{transform:scale(2.8);opacity:0}100%{opacity:0}}
@keyframes bisDot{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes bisTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes bisGridFloat{from{background-position:0 0,0 0}to{background-position:60px 60px,60px 60px}}
.bis-title:hover{text-shadow:0 0 90px rgba(240,217,139,0.5),0 2px 42px rgba(0,0,0,0.5)!important}
.bis-cta-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(201,168,76,0.5)}
.bis-cta-secondary:hover{background:rgba(255,255,255,0.14)!important;border-color:rgba(255,255,255,0.4)!important}
.bis-nav-link{color:rgba(255,255,255,0.72);font-size:14px;font-weight:500;text-decoration:none;transition:color .2s ease}
.bis-nav-link:hover{color:#fff}
.bis-nav-cta{transition:opacity .2s,transform .2s}
.bis-nav-cta:hover{opacity:.9;transform:translateY(-1px)}
`;

const TICKER = [
  "Constitution — SAS LUMEN CONSEIL · Paris 8ᵉ",
  "Procédure collective — MARTIN & FILS · Lyon 3ᵉ",
  "Vente de fonds — LE FOURNIL D'OR · Bordeaux",
  "Modification — ATELIER BLEU SARL · Nantes",
  "Dissolution — GARAGE DU PORT · Marseille",
  "Radiation — SCI HORIZON · Lille",
  "Constitution — NOVA ÉNERGIE SAS · Toulouse",
  "Cession de parts — CABINET RIVET · Rennes",
];

const REGIONS = [
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Hauts-de-France",
  "Grand Est",
  "Provence-Alpes",
  "Bretagne",
  "Normandie",
  "Pays de la Loire",
  "Bourgogne-FC",
  "Centre-Val",
  "Corse",
  "Alsace",
];

const NAV_LINKS: Array<[string, string]> = [
  ["#sources", "Sources"],
  ["#how", "Fonctionnement"],
  ["#preview", "Aperçu"],
  ["#carte", "Carte"],
  ["#pricing", "Tarifs"],
  ["#faq", "FAQ"],
];

type Particle = {
  dead: boolean;
  type?: "spark" | "flow" | "mote";
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  life?: number;
  max?: number;
  r?: number;
  spr?: HTMLCanvasElement;
  a0?: number;
  alpha?: number;
  ph?: number;
  node?: SVGPathElement;
  len?: number;
  u?: number;
  sp?: number;
  li?: number;
};

type Tower = {
  i: number;
  x: number;
  w: number;
  cx: number;
  topY: number;
  h: number;
  links: number[];
  region?: string;
  value?: number;
  delta?: number;
  spark?: number[];
  gSel?: any;
  labelSel?: any;
  beamGlow?: any;
  beamF?: number;
  baseLabelOp?: number;
};

type Link = {
  sel: any;
  node: SVGPathElement;
  len: number;
  mx: number;
  my: number;
  a: number;
  b: number;
};

export class BisLivingDataHero extends React.Component<BisLivingDataHeroProps> {
  private rootRef = React.createRef<HTMLDivElement>();
  private svgRef = React.createRef<SVGSVGElement>();
  private canvasRef = React.createRef<HTMLCanvasElement>();
  private tooltipRef = React.createRef<HTMLDivElement>();
  private countRef = React.createRef<HTMLSpanElement>();
  private iRef = React.createRef<HTMLSpanElement>();
  private scrimRef = React.createRef<HTMLDivElement>();

  private raf: number | null = null;
  private t = 0;
  private hover = -1;
  private P: Particle[] = [];
  private last = 0;
  private _ready = false;
  private mx = -9999;
  private my = -9999;
  private mReveal = 0;
  private hoverEase = 0;
  private _lastMoveMs = -9999;
  private _burst = 0;
  private beamOn = false;
  private beamEase = 0;
  private beamX = 720;
  private beam: { ax: number; ay: number; bx: number; baseY: number; halfW: number; apexHalf: number } | null = null;
  private _accB = 0;
  private _beamWasOn = false;

  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private tip: HTMLDivElement | null = null;
  private _mm: ((e: MouseEvent) => void) | null = null;

  private speed = 1;
  private atmos = 1;
  private notices = 456;
  private labelMode: "hover" | "always" = "hover";
  private CY = "#4a9ee0";
  private DEEP = "#1e3f7a";
  private LIT = "#f0d98b";
  private GOLD = "#c9a84c";
  private W = 1440;
  private H = 820;
  private BASE = 706;
  private spr!: HTMLCanvasElement;
  private sprL!: HTMLCanvasElement;
  private _accS = 0;
  private _accF = 0;
  private pulsers: Array<{ sel: any; base: number; ph: number; sp: number }> = [];
  private _flk = 0;
  private gHorizon: any;
  private gRidge: any;
  private gBack: any;
  private gFront: any;
  private gLinks: any;
  private gHidden: any;
  private ridges: Array<{ bumps: Array<{ mu: number; sig: number; amp: number; dr: number; df: number; ph: number }>; yb: number; col: string }> = [];
  private ridgeN = 64;
  private ridgeLine: any[] = [];
  private FB: Tower[] = [];
  private TOPS: Array<{ x: number; topY: number; w: number }> = [];
  private links: Link[] = [];

  componentDidMount() {
    this.build();
  }

  componentWillUnmount() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this._mm && this.root) this.root.removeEventListener("mousemove", this._mm);
  }

  componentDidUpdate(prev: BisLivingDataHeroProps) {
    if (!this._ready) return;
    const a = prev || {};
    const b = this.props || {};
    if (a.density !== b.density || a.labelMode !== b.labelMode || a.notices !== b.notices) {
      this.build();
      return;
    }
    this.applyLive();
  }

  private rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private mix(a: string, b: string, t: number) {
    const A = rgb(a);
    const B = rgb(b);
    return (
      "rgb(" +
      Math.round(A.r + (B.r - A.r) * t) +
      "," +
      Math.round(A.g + (B.g - A.g) * t) +
      "," +
      Math.round(A.b + (B.b - A.b) * t) +
      ")"
    );
  }

  private rgba(c: string, a: number) {
    const C = rgb(c);
    return "rgba(" + Math.round(C.r) + "," + Math.round(C.g) + "," + Math.round(C.b) + "," + a + ")";
  }

  private makeSprite(col: string) {
    const s = 64;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d")!;
    const cc = rgb(col);
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.28, "rgba(" + (cc.r | 0) + "," + (cc.g | 0) + "," + (cc.b | 0) + ",0.85)");
    g.addColorStop(0.7, "rgba(" + (cc.r | 0) + "," + (cc.g | 0) + "," + (cc.b | 0) + ",0.14)");
    g.addColorStop(1, "rgba(" + (cc.r | 0) + "," + (cc.g | 0) + "," + (cc.b | 0) + ",0)");
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return c;
  }

  private slot(): Particle {
    const P = this.P;
    for (let i = 0; i < P.length; i++) {
      if (P[i].dead) return P[i];
    }
    if (P.length >= 300) return P[(Math.random() * P.length) | 0];
    const o: Particle = { dead: true };
    P.push(o);
    return o;
  }

  private build() {
    const root = this.rootRef.current;
    const svgNode = this.svgRef.current;
    const canvas = this.canvasRef.current;
    if (!root || !svgNode || !canvas) return;
    this.root = root;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tip = this.tooltipRef.current;
    if (this.raf) cancelAnimationFrame(this.raf);
    const P = this.props || {};
    this.speed = P.motionSpeed != null ? +P.motionSpeed : 1;
    this.atmos = P.atmosphere != null ? +P.atmosphere : 1;
    this.notices = P.notices != null ? Math.round(+P.notices) : 456;
    this.labelMode = P.labelMode || "hover";
    const CY = "#4a9ee0",
      DEEP = "#1e3f7a",
      LIT = "#f0d98b",
      GOLD = "#c9a84c";
    this.CY = CY;
    this.DEEP = DEEP;
    this.LIT = LIT;
    this.GOLD = GOLD;
    const W = 1440,
      H = 820,
      BASE = 706;
    this.W = W;
    this.H = H;
    this.BASE = BASE;
    const svg = select(svgNode);
    svg.selectAll("*").remove();
    svg.attr("viewBox", "0 0 " + W + " " + H).attr("preserveAspectRatio", "xMidYMid slice");
    this.spr = this.makeSprite(CY);
    this.sprL = this.makeSprite(LIT);
    this.P = [];
    this.hover = -1;
    this._accS = 0;
    this._accF = 0;
    this.pulsers = [];
    this._flk = 0;
    if (this.countRef.current) this.countRef.current.textContent = this.notices.toLocaleString("fr-FR");

    const defs = svg.append("defs");
    const mkGlow = (id: string, sd: number) => {
      const f = defs
        .append("filter")
        .attr("id", id)
        .attr("x", "-80%")
        .attr("y", "-80%")
        .attr("width", "260%")
        .attr("height", "260%");
      f.append("feGaussianBlur").attr("stdDeviation", sd).attr("result", "b");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in", "b");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    };
    mkGlow("glow", 3);
    mkGlow("glowSoft", 9);
    const bg = defs.append("linearGradient").attr("id", "barGrad").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    bg.append("stop").attr("offset", "0%").attr("stop-color", CY).attr("stop-opacity", 0);
    bg.append("stop").attr("offset", "34%").attr("stop-color", CY).attr("stop-opacity", 0.6);
    bg.append("stop").attr("offset", "70%").attr("stop-color", this.mix(CY, DEEP, 0.7)).attr("stop-opacity", 0.95);
    bg.append("stop").attr("offset", "100%").attr("stop-color", DEEP).attr("stop-opacity", 1);
    const bgB = defs.append("linearGradient").attr("id", "barGradB").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    bgB.append("stop").attr("offset", "0%").attr("stop-color", CY).attr("stop-opacity", 0);
    bgB.append("stop").attr("offset", "60%").attr("stop-color", this.mix(CY, DEEP, 0.6)).attr("stop-opacity", 0.5);
    bgB.append("stop").attr("offset", "100%").attr("stop-color", this.mix(DEEP, "#081120", 0.45)).attr("stop-opacity", 0.85);

    const rnd = this.rng(4127);
    this.gHorizon = svg.append("g");
    this.gRidge = svg.append("g");
    this.gBack = svg.append("g");
    this.gFront = svg.append("g");
    this.gLinks = svg.append("g").attr("fill", "none");
    this.gHidden = svg.append("g").attr("fill", "none").attr("stroke", "none");

    // horizon: cool blue haze + warm gold dawn core + luminous line
    const hg = defs.append("radialGradient").attr("id", "hgl").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
    hg.append("stop").attr("offset", "0%").attr("stop-color", CY).attr("stop-opacity", 0.45);
    hg.append("stop").attr("offset", "100%").attr("stop-color", CY).attr("stop-opacity", 0);
    const hgG = defs.append("radialGradient").attr("id", "hglG").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
    hgG.append("stop").attr("offset", "0%").attr("stop-color", LIT).attr("stop-opacity", 0.5);
    hgG.append("stop").attr("offset", "100%").attr("stop-color", LIT).attr("stop-opacity", 0);
    this.gHorizon
      .append("ellipse")
      .attr("cx", W / 2)
      .attr("cy", BASE)
      .attr("rx", W * 0.62)
      .attr("ry", 60)
      .attr("fill", "url(#hgl)")
      .attr("opacity", 0.5);
    this.gHorizon
      .append("ellipse")
      .attr("cx", W / 2)
      .attr("cy", BASE)
      .attr("rx", W * 0.26)
      .attr("ry", 32)
      .attr("fill", "url(#hglG)")
      .attr("opacity", 0.38);
    this.gHorizon
      .append("rect")
      .attr("x", 0)
      .attr("y", BASE - 1.2)
      .attr("width", W)
      .attr("height", 2.4)
      .attr("fill", this.mix(LIT, "#ffffff", 0.25))
      .attr("opacity", 0.5)
      .attr("filter", "url(#glowSoft)");

    this.buildRidge(rnd);
    this.buildSkyline(rnd);
    this.buildLinks(rnd);

    const gh = svg.append("g");
    const self = this;
    this.FB.forEach((b) => {
      gh.append("rect")
        .attr("x", b.x - 5)
        .attr("y", 120)
        .attr("width", b.w + 10)
        .attr("height", BASE - 120)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("mouseenter", () => self.highlight(b.i))
        .on("mouseleave", () => self.clear());
    });

    if (this._mm) root.removeEventListener("mousemove", this._mm);
    this._mm = (e: MouseEvent) => {
      const r = root.getBoundingClientRect();
      const cw = r.width,
        ch = r.height;
      const sc = Math.max(cw / W, ch / H);
      const ox = (cw - W * sc) / 2,
        oy = (ch - H * sc) / 2;
      self.mx = (e.clientX - r.left - ox) / sc;
      self.my = (e.clientY - r.top - oy) / sc;
      self._lastMoveMs = performance.now();
    };
    root.addEventListener("mousemove", this._mm);

    this._ready = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  private buildRidge(rnd: () => number) {
    const W = this.W;
    const g = this.gRidge;
    const R = 3;
    const ridges: typeof this.ridges = [];
    const cols = ["#24509a", "#2e6fbf", "#4a9ee0"];
    for (let r = 0; r < R; r++) {
      const bumps = [];
      const nb = 3 + ((rnd() * 2) | 0);
      for (let b = 0; b < nb; b++)
        bumps.push({
          mu: rnd() * W,
          sig: 150 + rnd() * 260,
          amp: 26 + rnd() * 54,
          dr: 26 + rnd() * 60,
          df: 0.012 + rnd() * 0.02,
          ph: rnd() * 6.28,
        });
      ridges.push({ bumps, yb: 352 + r * 30, col: cols[r] });
    }
    this.ridges = ridges;
    this.ridgeN = 64;
    this.ridgeLine = [];
    ridges.forEach((r) => {
      this.ridgeLine.push(g.append("path").attr("fill", "none").attr("stroke", r.col).attr("stroke-width", 1.1));
    });
    this.updateRidge();
  }

  private updateRidge() {
    const W = this.W,
      N = this.ridgeN,
      t = this.t,
      a = this.atmos;
    const xs = (i: number) => -20 + i * ((W + 40) / (N - 1));
    const hx = this.hover >= 0 ? this.FB[this.hover].cx : null;
    this.ridges.forEach((r, idx) => {
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < N; i++) {
        const x = xs(i);
        let v = 0;
        for (const b of r.bumps) {
          const mu = b.mu + b.dr * Math.sin(t * b.df + b.ph);
          const dx = x - mu;
          v += b.amp * Math.exp(-(dx * dx) / (2 * b.sig * b.sig));
        }
        if (hx != null && idx === this.ridges.length - 1) {
          const dx = x - hx;
          v += 46 * this.hoverEase * Math.exp(-(dx * dx) / (2 * 90 * 90));
        }
        pts.push([x, r.yb - v]);
      }
      let dl = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
      for (let i = 1; i < N; i++) dl += " L" + pts[i][0].toFixed(1) + "," + pts[i][1].toFixed(1);
      this.ridgeLine[idx].attr("d", dl).attr("stroke-opacity", (0.05 + idx * 0.025) * a);
    });
  }

  private buildSkyline(rnd: () => number) {
    const W = this.W,
      BASE = this.BASE;
    const n = Math.round(this.props && this.props.density != null ? +this.props.density : 14);
    const nb = n + 7;
    const gapB = 6;
    const relB: number[] = [];
    for (let i = 0; i < nb; i++) relB.push(0.5 + rnd() * 1.0);
    const sumB = relB.reduce((a, b) => a + b, 0);
    const usableB = W - 40 - gapB * (nb - 1);
    let xb = 20;
    for (let i = 0; i < nb; i++) {
      const w = (usableB * relB[i]) / sumB;
      const cx = xb + w / 2;
      const edge = Math.min(1, Math.abs(cx - W / 2) / 620);
      const h = 54 + edge * 120 + rnd() * 70;
      this.gBack
        .append("rect")
        .attr("x", xb)
        .attr("y", BASE - 18 - h)
        .attr("width", w)
        .attr("height", h + 18)
        .attr("rx", Math.min(6, w / 6))
        .attr("fill", "url(#barGradB)")
        .attr("opacity", 0.32 + edge * 0.12);
      xb += w + gapB;
    }

    const rel: number[] = [];
    for (let i = 0; i < n; i++) rel.push(0.6 + rnd() * 1.05);
    const relSum = rel.reduce((a, b) => a + b, 0);
    const spanL = 76,
      spanR = W - 76,
      gap = 13;
    const usable = spanR - spanL - gap * (n - 1);
    const B: Tower[] = [];
    let x = spanL;
    for (let i = 0; i < n; i++) {
      const w = (usable * rel[i]) / relSum;
      const cx = x + w / 2;
      const distC = Math.abs(cx - W / 2);
      const edge = Math.min(1, distC / 560);
      let h = 96 + edge * 150 + rnd() * (50 + edge * 70);
      if (distC > 340 && rnd() < 0.26) h += 64 + rnd() * 70;
      let topY = BASE - h;
      const capTop = distC > 310 ? 362 : 512;
      if (topY < capTop) topY = capTop + rnd() * 16;
      h = BASE - topY;
      B.push({ i, x, w, cx, topY, h, links: [] });
      x += w + gap;
    }
    const order = B.map((b) => b.i).sort((p, q) => B[q].h - B[p].h);
    const sumH = B.reduce((a, b) => a + b.h, 0);
    order.forEach((bi, rank) => {
      const b = B[bi];
      b.region = REGIONS[rank % REGIONS.length];
      b.value = Math.max(3, Math.round((this.notices * b.h) / sumH));
      const d = rnd() * 15 - 4;
      b.delta = d;
      b.spark = [];
      let sv = 0.4 + rnd() * 0.3;
      for (let k = 0; k < 12; k++) {
        sv = Math.max(0.06, Math.min(0.96, sv + (rnd() - 0.44) * 0.22));
        b.spark.push(sv);
      }
    });
    const maxV = Math.max.apply(
      null,
      B.map((b) => b.value!)
    );
    this.FB = B;
    this.TOPS = B.map((b) => ({ x: b.cx, topY: b.topY, w: b.w }));

    B.forEach((b) => {
      const g = this.gFront.append("g");
      b.gSel = g;
      g.style("transform-box", "fill-box")
        .style("transform-origin", "50% 100%")
        .style("transition", "transform .32s cubic-bezier(.2,.7,.3,1), filter .32s ease");
      g.append("rect")
        .attr("x", b.x)
        .attr("y", b.topY)
        .attr("width", b.w)
        .attr("height", b.h)
        .attr("rx", Math.min(7, b.w / 7))
        .attr("fill", "url(#barGrad)");
      g.append("rect")
        .attr("x", b.x + 1)
        .attr("y", b.topY)
        .attr("width", b.w - 2)
        .attr("height", 2)
        .attr("rx", 1)
        .attr("fill", this.LIT)
        .attr("opacity", 0.38)
        .attr("filter", "url(#glow)");
      const colGap = 12,
        rowGap = 13,
        inset = 9;
      const cols = Math.max(1, Math.min(6, Math.floor((b.w - 2 * inset) / colGap) + 1));
      const gridW = (cols - 1) * colGap;
      const sx = b.cx - gridW / 2;
      const litFrac = Math.max(0.12, Math.min(0.92, b.value! / maxV));
      const cells: Array<{ x: number; y: number }> = [];
      for (let ry = 0; ; ry++) {
        const wy = b.topY + 22 + ry * rowGap;
        if (wy > BASE - 14) break;
        for (let c = 0; c < cols; c++) cells.push({ x: sx + c * colGap, y: wy });
        if (cells.length > 44) break;
      }
      cells.forEach((cell) => {
        const lit = rnd() < litFrac;
        const dot = g
          .append("circle")
          .attr("cx", cell.x)
          .attr("cy", cell.y)
          .attr("r", 1.7)
          .attr("fill", lit ? this.LIT : this.CY)
          .attr("opacity", lit ? 0.9 : 0.12);
        if (lit) {
          dot.attr("filter", rnd() < 0.5 ? "url(#glow)" : null);
          if (rnd() < 0.34) this.pulsers.push({ sel: dot, base: 0.9, ph: rnd() * 6.28, sp: 0.5 + rnd() * 0.8 });
        }
      });
      b.baseLabelOp = this.labelMode === "always" ? 0.55 : 0;
      b.labelSel = g
        .append("text")
        .attr("x", b.cx)
        .attr("y", b.topY - 10)
        .attr("text-anchor", "middle")
        .attr("fill", this.LIT)
        .attr("fill-opacity", b.baseLabelOp)
        .attr("font-size", 10)
        .attr("font-weight", 600)
        .attr("font-family", "DM Sans,sans-serif")
        .text(b.value!.toLocaleString("fr-FR"));
      b.beamGlow = g
        .append("rect")
        .attr("x", b.x)
        .attr("y", b.topY)
        .attr("width", b.w)
        .attr("height", b.h)
        .attr("rx", Math.min(7, b.w / 7))
        .attr("fill", this.LIT)
        .attr("opacity", 0);
      b.beamF = 0;
    });
  }

  private buildLinks(rnd: () => number) {
    const B = this.FB;
    const links: Link[] = [];
    const hidden = this.gHidden;
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      const cand: number[] = [];
      if (i + 1 < B.length) cand.push(i + 1);
      if (i + 2 < B.length && rnd() < 0.5) cand.push(i + 2);
      cand.forEach((j) => {
        const b = B[j];
        const x0 = a.cx,
          y0 = a.topY,
          x1 = b.cx,
          y1 = b.topY;
        const lift = 40 + Math.abs(x1 - x0) * 0.22;
        const mx = (x0 + x1) / 2,
          my = Math.min(y0, y1) - lift;
        const dd = "M" + x0 + "," + y0 + " Q" + mx + "," + my + " " + x1 + "," + y1;
        const sel = this.gLinks
          .append("path")
          .attr("d", dd)
          .attr("stroke", this.CY)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.03)
          .attr("stroke-linecap", "round");
        const node = hidden.append("path").attr("d", dd).node() as SVGPathElement;
        const L: Link = { sel, node, len: node.getTotalLength(), mx, my, a: i, b: j };
        const idx = links.length;
        a.links.push(idx);
        b.links.push(idx);
        links.push(L);
      });
    }
    this.links = links;
  }

  private highlight(i: number) {
    if (!this.FB) return;
    this.hover = i;
    const b = this.FB[i];
    this.FB.forEach((bb, j) => {
      if (j === i) {
        bb.gSel.style("transform", "scale(1.028,1.055)").attr("filter", "url(#glow)");
      } else {
        bb.gSel.style("transform", "none").attr("filter", null);
      }
    });
    this.showTip(b);
  }

  private clear() {
    this.hover = -1;
    if (this.FB)
      this.FB.forEach((bb) => {
        bb.gSel.style("transform", "none").attr("filter", null);
      });
    if (this.tip) this.tip.style.opacity = "0";
  }

  private showTip(b: Tower) {
    const tip = this.tip;
    if (!tip) return;
    const LIT = this.LIT,
      up = b.delta! >= 0;
    const sp = b.spark!,
      w = 138,
      h = 30,
      pad = 3;
    const X = (k: number) => pad + k * ((w - 2 * pad) / (sp.length - 1));
    const Y = (v: number) => h - pad - v * (h - 2 * pad);
    let d = "M" + X(0).toFixed(1) + "," + Y(sp[0]).toFixed(1);
    for (let k = 1; k < sp.length; k++) d += " L" + X(k).toFixed(1) + "," + Y(sp[k]).toFixed(1);
    const area = d + " L" + X(sp.length - 1).toFixed(1) + "," + (h - pad) + " L" + X(0).toFixed(1) + "," + (h - pad) + " Z";
    tip.innerHTML =
      '<div style="display:flex;align-items:center;gap:7px;">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:' +
      this.GOLD +
      ";box-shadow:0 0 8px " +
      this.GOLD +
      '"></span>' +
      '<span style="font-weight:600;font-size:12.5px;color:#fff;">' +
      b.region +
      "</span></div>" +
      '<div style="display:flex;align-items:baseline;gap:8px;margin-top:5px;"><span style="font-size:21px;font-weight:700;color:#fff;">' +
      b.value!.toLocaleString("fr-FR") +
      "</span>" +
      '<span style="font-size:11.5px;color:rgba(198,214,238,0.62);">annonces</span>' +
      '<span style="font-size:11.5px;font-weight:600;color:' +
      (up ? "#6fcf97" : "#e88b7d") +
      ';">' +
      (up ? "▲" : "▼") +
      " " +
      Math.abs(b.delta!).toFixed(1) +
      "%</span></div>" +
      '<svg width="' +
      w +
      '" height="' +
      h +
      '" style="margin-top:7px;display:block;"><path d="' +
      area +
      '" fill="' +
      this.rgba(LIT, 0.13) +
      '"/><path d="' +
      d +
      '" fill="none" stroke="' +
      LIT +
      '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    const root = this.root!;
    const cw = root.clientWidth,
      ch = root.clientHeight;
    const sc = Math.max(cw / this.W, ch / this.H);
    const ox = (cw - this.W * sc) / 2,
      oy = (ch - this.H * sc) / 2;
    let cx = ox + b.cx * sc;
    const cy = oy + b.topY * sc;
    cx = Math.max(100, Math.min(cw - 100, cx));
    tip.style.left = cx + "px";
    tip.style.top = Math.max(84, cy) + "px";
    tip.style.opacity = "1";
  }

  private cheer() {
    this._burst = (this._burst || 0) + 1.3;
  }

  private updateBeam(dt: number) {
    const e = this.beamEase;
    const iEl = this.iRef.current;
    if (e < 0.005 || !iEl || !this.root) {
      if (this._beamWasOn) {
        this._beamWasOn = false;
        this.beam = null;
        if (this.FB)
          this.FB.forEach((b) => {
            b.beamF = 0;
            if (b.beamGlow) b.beamGlow.attr("opacity", 0);
            if (b.labelSel) b.labelSel.attr("fill-opacity", b.baseLabelOp);
          });
        if (iEl) {
          iEl.style.color = "";
          iEl.style.textShadow = "";
        }
        const scr0 = this.scrimRef.current;
        if (scr0) scr0.style.opacity = "1";
      }
      return;
    }
    this._beamWasOn = true;
    const rr = this.root.getBoundingClientRect();
    const ir = iEl.getBoundingClientRect();
    const cw = rr.width,
      ch = rr.height;
    const sc = Math.max(cw / this.W, ch / this.H);
    const ox = (cw - this.W * sc) / 2,
      oy = (ch - this.H * sc) / 2;
    const ax = ((ir.left + ir.right) / 2 - rr.left - ox) / sc;
    const ay = (ir.bottom - rr.top - oy) / sc - 6;
    const apexHalf = Math.max(5, (ir.width / sc) * 0.32);
    const baseY = this.BASE + 36;
    const tgt = this.mx > -9000 ? Math.max(ax - 380, Math.min(ax + 380, this.mx)) : ax;
    this.beamX += (tgt - this.beamX) * Math.min(1, dt * 4);
    this.beam = { ax, ay, bx: this.beamX, baseY, halfW: 150, apexHalf };
    iEl.style.color = "#f0d98b";
    iEl.style.textShadow =
      "0 0 34px rgba(240,217,139," + (0.85 * e).toFixed(3) + "), 0 0 90px rgba(240,217,139," + (0.5 * e).toFixed(3) + ")";
    const scr1 = this.scrimRef.current;
    if (scr1) scr1.style.opacity = String(1 - 0.5 * e);
    const bm = this.beam;
    const span = Math.max(1, bm.baseY - bm.ay);
    this.FB.forEach((b) => {
      const yTest = Math.max(b.topY, bm.ay + 40);
      const k = (yTest - bm.ay) / span;
      const cxa = bm.ax + (bm.bx - bm.ax) * k;
      const hw = bm.apexHalf + (bm.halfW - bm.apexHalf) * k;
      const dn = Math.abs(b.cx - cxa) / Math.max(20, hw);
      const f = e * Math.max(0, 1 - dn * dn);
      b.beamF! += (f - b.beamF!) * Math.min(1, dt * 8);
      if (b.beamGlow) b.beamGlow.attr("opacity", (0.13 * b.beamF!).toFixed(3));
      if (b.labelSel) b.labelSel.attr("fill-opacity", Math.max(b.baseLabelOp!, b.beamF!).toFixed(3));
    });
    this._accB += 22 * e * dt;
    while (this._accB >= 1) {
      this._accB -= 1;
      let tries = 4,
        b: Tower | null = null;
      while (tries-- > 0) {
        const c = this.FB[(Math.random() * this.FB.length) | 0];
        if (c.beamF! > 0.35) {
          b = c;
          break;
        }
      }
      if (b) {
        const s = this.slot();
        s.dead = false;
        s.type = "spark";
        s.x = b.cx + (Math.random() - 0.5) * b.w * 0.6;
        s.y = b.topY + Math.random() * 24;
        s.vx = (Math.random() - 0.5) * 7;
        s.vy = -26 - Math.random() * 30;
        s.max = 2 + Math.random() * 2.4;
        s.life = s.max;
        s.r = 1.0 + Math.random() * 1.4;
        s.spr = this.sprL;
        s.a0 = 0.9;
        s.ph = Math.random() * 6.28;
      }
    }
  }

  private applyLive() {
    const P = this.props || {};
    this.speed = P.motionSpeed != null ? +P.motionSpeed : 1;
    this.atmos = P.atmosphere != null ? +P.atmosphere : 1;
  }

  private spawnSpark(fast: boolean) {
    const tops = this.TOPS;
    if (!tops.length) return;
    let t: { x: number; topY: number; w: number };
    if (fast && this.hover >= 0) {
      const b = this.FB[this.hover];
      t = { x: b.cx, topY: b.topY, w: b.w };
    } else {
      t = tops[(Math.random() * tops.length) | 0];
    }
    const s = this.slot();
    s.dead = false;
    s.type = "spark";
    s.x = t.x + (Math.random() - 0.5) * t.w * 0.66;
    s.y = t.topY + Math.random() * 30;
    s.vx = (Math.random() - 0.5) * 7;
    s.vy = -(fast ? 34 : 16) - Math.random() * (fast ? 40 : 26);
    s.max = 2.4 + Math.random() * 3.2;
    s.life = s.max;
    s.r = 1.0 + Math.random() * 1.5;
    s.spr = fast || Math.random() < 0.4 ? this.sprL : this.spr;
    s.a0 = 0.85;
    s.ph = Math.random() * 6.28;
  }

  private spawnFlow() {
    const L = this.links;
    if (!L || !L.length) return;
    const li = (Math.random() * L.length) | 0;
    const l = L[li];
    const s = this.slot();
    s.dead = false;
    s.type = "flow";
    s.node = l.node;
    s.len = l.len;
    s.u = Math.random();
    s.sp = 0.045 + Math.random() * 0.08;
    s.r = 1.2 + Math.random() * 0.9;
    s.spr = this.spr;
    s.a0 = 0;
    s.li = li;
  }

  private spawnMote() {
    const s = this.slot();
    s.dead = false;
    s.type = "mote";
    s.x = Math.random() * this.W;
    s.y = 60 + Math.random() * 380;
    s.vx = (Math.random() - 0.5) * 3;
    s.vy = (Math.random() - 0.5) * 2;
    s.max = 6 + Math.random() * 8;
    s.life = s.max;
    s.r = 0.7 + Math.random() * 1.0;
    s.spr = this.spr;
    s.a0 = 0.22 + Math.random() * 0.18;
    s.ph = Math.random() * 6.28;
  }

  private updateParticles(dt: number) {
    const P = this.P;
    let ns = 0,
      nf = 0,
      nm = 0;
    for (const s of P) {
      if (s.dead) continue;
      if (s.type === "spark") ns++;
      else if (s.type === "flow") nf++;
      else nm++;
    }
    const nScale = Math.max(0.3, Math.min(2.2, this.notices / 456));
    const sparkCap = Math.round(46 * nScale * (1 + this._burst * 2)),
      flowCap = 32,
      moteCap = 42;
    this._accS += (16 * nScale * (1 + this._burst * 5) + (this.hover >= 0 ? 26 : 0)) * dt;
    while (this._accS >= 1) {
      this._accS -= 1;
      if (ns < sparkCap) {
        this.spawnSpark(this.hover >= 0);
        ns++;
      }
    }
    this._accF += (10 * this.mReveal + 5 + (this.hover >= 0 ? 16 : 0)) * dt;
    while (this._accF >= 1) {
      this._accF -= 1;
      if (nf < flowCap) {
        this.spawnFlow();
        nf++;
      }
    }
    if (nm < moteCap) this.spawnMote();
    for (const s of P) {
      if (s.dead) continue;
      if (s.type === "spark") {
        s.life! -= dt;
        if (s.life! <= 0) {
          s.dead = true;
          continue;
        }
        s.x! += s.vx! * dt + Math.sin(this.t * 1.4 + s.ph!) * 8 * dt;
        s.y! += s.vy! * dt;
        s.vy! += 7 * dt;
        s.alpha = (s.life! / s.max!) * s.a0! * Math.min(1, (s.max! - s.life!) / 0.4);
      } else if (s.type === "mote") {
        s.life! -= dt;
        if (s.life! <= 0) {
          s.dead = true;
          continue;
        }
        s.x! += s.vx! * dt;
        s.y! += s.vy! * dt;
        const f = Math.min(s.life!, s.max! - s.life!);
        s.alpha = s.a0! * Math.min(1, f / 1.4) * (0.6 + 0.4 * Math.sin(this.t * 0.8 + s.ph!));
      } else {
        const hovLink = this.hover >= 0 && this.FB[this.hover].links.indexOf(s.li!) >= 0;
        s.u! += s.sp! * (hovLink ? 2.4 : 1) * dt;
        if (s.u! >= 1) {
          s.u! -= 1;
        }
        let pt: DOMPoint;
        try {
          pt = s.node!.getPointAtLength(s.u! * s.len!);
        } catch (e) {
          s.dead = true;
          continue;
        }
        s.x = pt.x;
        s.y = pt.y;
        const near = Math.max(0, 1 - Math.hypot(this.links[s.li!].mx - this.mx, this.links[s.li!].my - this.my) / 240);
        const vis = Math.max(this.mReveal * near, hovLink ? 1 : 0);
        s.alpha = 0.7 * vis * Math.min(1, Math.min(s.u!, 1 - s.u!) / 0.1);
      }
    }
  }

  private drawParticles() {
    const cv = this.canvas,
      ctx = this.ctx;
    if (!cv || !ctx) return;
    const cw = cv.clientWidth,
      ch = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
    }
    const sc = Math.max(cw / this.W, ch / this.H);
    const ox = (cw - this.W * sc) / 2,
      oy = (ch - this.H * sc) / 2;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    ctx.clearRect(-80, -80, this.W + 160, this.H + 160);
    ctx.globalCompositeOperation = "lighter";
    if (this.beam && this.beamEase > 0.01) {
      const bm = this.beam,
        e = this.beamEase;
      const g0 = ctx.createLinearGradient(0, bm.ay, 0, bm.baseY);
      g0.addColorStop(0, "rgba(240,217,139,0.85)");
      g0.addColorStop(0.55, "rgba(240,217,139,0.28)");
      g0.addColorStop(1, "rgba(240,217,139,0.05)");
      ctx.fillStyle = g0;
      const passes: Array<[number, number]> = [
        [1, 0.09],
        [0.6, 0.13],
        [0.3, 0.19],
      ];
      for (const p of passes) {
        const hw = bm.halfW * p[0],
          ah = Math.max(3, bm.apexHalf * p[0]);
        ctx.globalAlpha = p[1] * e;
        ctx.beginPath();
        ctx.moveTo(bm.ax - ah, bm.ay);
        ctx.lineTo(bm.ax + ah, bm.ay);
        ctx.lineTo(bm.bx + hw, bm.baseY);
        ctx.lineTo(bm.bx - hw, bm.baseY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 0.85 * e;
      ctx.drawImage(this.sprL, bm.ax - 26, bm.ay - 30, 52, 52);
    }
    for (const s of this.P) {
      if (s.dead || !s.alpha || s.alpha < 0.02) continue;
      const d = s.r! * 7;
      ctx.globalAlpha = Math.min(1, s.alpha);
      ctx.drawImage(s.spr!, s.x! - d / 2, s.y! - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private tick(ts: number) {
    this.raf = requestAnimationFrame((t) => this.tick(t));
    if (!this._ready) return;
    let dt = (ts - this.last) / 1000;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(0.05, dt);
    this.last = ts;
    this.t += dt * this.speed;
    const idle = performance.now() - this._lastMoveMs;
    const mt = idle < 520 ? 1 : 0;
    this.mReveal += (mt - this.mReveal) * Math.min(1, dt * 5);
    const ht = this.hover >= 0 ? 1 : 0;
    this.hoverEase += (ht - this.hoverEase) * Math.min(1, dt * 6);
    if (this._burst > 0) this._burst = Math.max(0, this._burst - dt);
    if (this.beamEase == null || isNaN(this.beamEase)) {
      this.beamEase = 0;
      this.beamX = 720;
      this._accB = 0;
      this._beamWasOn = false;
      this.beamOn = false;
    }
    const bt = this.beamOn ? 1 : 0;
    this.beamEase += (bt - this.beamEase) * Math.min(1, dt * (this.beamOn ? 4 : 2.5));
    this.updateBeam(dt);
    this.updateRidge();
    if (this.links) {
      const hv = this.hover;
      const hset = hv >= 0 ? this.FB[hv].links : null;
      for (let idx = 0; idx < this.links.length; idx++) {
        const L = this.links[idx];
        let op = 0.028;
        if (this.mReveal > 0.01) {
          const dd = Math.hypot(L.mx - this.mx, L.my - this.my);
          op = Math.max(op, Math.max(0, 1 - dd / 240) * 0.42 * this.mReveal);
        }
        if (hset && hset.indexOf(idx) >= 0) op = Math.max(op, 0.6 * this.hoverEase);
        L.sel
          .attr("stroke-opacity", op)
          .attr("stroke", op > 0.28 ? this.LIT : this.CY)
          .attr("stroke-width", op > 0.28 ? 1.5 : 1);
      }
    }
    this._flk += dt;
    if (this._flk > 0.16 && this.pulsers.length) {
      this._flk = 0;
      for (const p of this.pulsers) {
        p.sel.attr("opacity", p.base * (0.5 + 0.5 * Math.sin(this.t * p.sp * 3 + p.ph)));
      }
    }
    this.updateParticles(dt);
    this.drawParticles();
  }

  render() {
    const tickerItems = TICKER.concat(TICKER);
    return (
      <div
        ref={this.rootRef}
        id="bis-root"
        style={{
          position: "relative",
          width: "100%",
          height: "100vh",
          minHeight: 640,
          overflow: "hidden",
          fontFamily: "'DM Sans',system-ui,sans-serif",
          color: "#fff",
          isolation: "isolate",
          background:
            "radial-gradient(80% 60% at 70% 40%, rgba(46,111,191,0.20) 0%, transparent 70%), radial-gradient(50% 50% at 20% 80%, rgba(201,168,76,0.10) 0%, transparent 60%), radial-gradient(120% 80% at 50% 104%, rgba(74,158,224,0.13) 0%, rgba(30,63,122,0.10) 26%, transparent 56%), linear-gradient(175deg,#0d1b35 0%,#0a1628 100%)",
        }}
      >
        <style>{CSS}</style>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.65,
            backgroundImage:
              "linear-gradient(rgba(46,111,191,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(46,111,191,0.09) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            animation: "bisGridFloat 24s linear infinite",
          }}
        />
        <svg ref={this.svgRef} id="bis-svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
        <canvas
          ref={this.canvasRef}
          id="bis-canvas"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        />
        <div
          ref={this.scrimRef}
          id="bis-scrim"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(52% 40% at 50% 42%, rgba(10,22,40,0.74) 0%, rgba(10,22,40,0.34) 46%, rgba(10,22,40,0) 72%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(8,17,33,0.5) 0%, rgba(8,17,33,0) 20%, rgba(8,17,33,0) 74%, rgba(8,17,33,0.5) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ transform: "translateY(-2.5vh)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 16px",
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: 20,
                background: "rgba(201,168,76,0.13)",
                backdropFilter: "blur(6px)",
                fontSize: 12,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#f0d98b",
                fontWeight: 600,
              }}
            >
              <span style={{ position: "relative", width: 8, height: 8 }}>
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#c9a84c",
                    animation: "bisDot 2.4s ease-in-out infinite",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: "#c9a84c",
                    animation: "bisPing 2.4s ease-out infinite",
                  }}
                />
              </span>
              <span ref={this.countRef}>456</span>&nbsp;annonces cette semaine
            </div>
            <h1
              className="bis-title"
              onMouseEnter={() => {
                this.beamOn = true;
              }}
              onMouseLeave={() => {
                this.beamOn = false;
              }}
              style={{
                margin: "16px 0 0",
                fontFamily: "'Playfair Display',Georgia,serif",
                fontSize: "clamp(76px,12.5vw,178px)",
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 0.95,
                color: "#fff",
                textShadow: "0 0 70px rgba(74,158,224,0.42), 0 2px 42px rgba(0,0,0,0.5)",
                pointerEvents: "auto",
                cursor: "default",
                transition: "text-shadow .35s ease",
              }}
            >
              B
              <span ref={this.iRef} id="bis-i" style={{ display: "inline-block", transition: "color .35s ease" }}>
                I
              </span>
              S
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
              <span style={{ width: 46, height: 1, background: "rgba(201,168,76,0.55)" }} />
              <span
                style={{
                  fontSize: "clamp(12px,1.4vw,19px)",
                  fontWeight: 600,
                  letterSpacing: "0.4em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.88)",
                  paddingLeft: "0.4em",
                }}
              >
                Business Intelligence Signals
              </span>
              <span style={{ width: 46, height: 1, background: "rgba(201,168,76,0.55)" }} />
            </div>
            <p
              style={{
                margin: "22px 0 0",
                maxWidth: 540,
                fontSize: "clamp(15px,1.35vw,19px)",
                fontWeight: 300,
                lineHeight: 1.6,
                color: "rgba(233,240,250,0.8)",
              }}
            >
              Pour <em style={{ fontStyle: "normal", fontWeight: 500, color: "#f0d98b" }}>éclairer</em> votre entreprise dans la
              bonne direction.
            </p>
            <div
              style={{
                marginTop: 30,
                display: "flex",
                gap: 14,
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "center",
                pointerEvents: "auto",
              }}
            >
              <button
                className="bis-cta-primary"
                onClick={() => this.cheer()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 26px",
                  border: "none",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: "#0d1b35",
                  cursor: "pointer",
                  background: "linear-gradient(135deg,#c9a84c 0%,#b8903e 100%)",
                  boxShadow: "0 4px 20px rgba(201,168,76,0.4)",
                  transition: "transform .2s ease, box-shadow .2s ease",
                  letterSpacing: 0.2,
                }}
              >
                Commencer gratuitement
                <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
              </button>
              <button
                className="bis-cta-secondary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 24px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 14.5,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.08)",
                  transition: "background .2s ease, border-color .2s ease",
                }}
              >
                Voir les formules
              </button>
            </div>
            <div style={{ marginTop: 16, fontSize: 12.5, letterSpacing: "0.02em", color: "rgba(255,255,255,0.48)" }}>
              Survolez « BIS » pour éclairer la ville · une tour pour le détail
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 8,
            background: "linear-gradient(90deg,#c9a84c 0%,#b8903e 100%)",
            padding: "9px 0",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", width: "max-content", whiteSpace: "nowrap", animation: "bisTicker 46s linear infinite" }}>
            {tickerItems.map((item, i) => (
              <span
                key={i}
                style={{
                  color: "#0d1b35",
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "0 26px",
                  borderRight: "1px solid rgba(13,27,53,0.22)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
        <div
          ref={this.tooltipRef}
          id="bis-tip"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: "translate(-50%,-118%)",
            opacity: 0,
            transition: "opacity .18s ease",
            pointerEvents: "none",
            zIndex: 6,
            padding: "11px 13px",
            borderRadius: 10,
            background: "rgba(13,27,53,0.93)",
            border: "1px solid rgba(201,168,76,0.32)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            fontSize: 12,
            color: "#eaf1fb",
            whiteSpace: "nowrap",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 68,
            zIndex: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 clamp(20px,4vw,56px)",
            background: "rgba(13,27,53,0.86)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 23, color: "#fff" }}>BIS</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a84c" }} />
            <span
              style={{
                fontSize: 10.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                fontWeight: 600,
              }}
            >
              France
            </span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            {NAV_LINKS.map(([href, label]) => (
              <a key={href} href={href} className="bis-nav-link">
                {label}
              </a>
            ))}
            <a
              href="#signup"
              className="bis-nav-cta"
              style={{
                background: "linear-gradient(135deg,#c9a84c,#b8903e)",
                color: "#0d1b35",
                padding: "8px 22px",
                borderRadius: 6,
                fontWeight: 700,
                fontSize: 13.5,
                textDecoration: "none",
              }}
            >
              Essai gratuit
            </a>
          </div>
        </div>
      </div>
    );
  }
}
