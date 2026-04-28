import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, StepForward } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const YEARS = Array.from({ length: 12 }, (_, i) => 1970 + i);
const SHOCK_YEAR = 1975;

const companyPalette = [
  "#2563eb", // blue
  "#16a34a", // green
  "#f97316", // orange
  "#7c3aed", // purple
  "#0891b2", // cyan
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickWeighted(items, weights, seedBase) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seededRandom(seedBase) * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function combinations(arr) {
  const pairs = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) pairs.push([arr[i], arr[j]]);
  }
  return pairs;
}

function clusteringCoefficient(nodes, edgeSet) {
  if (nodes.length === 0) return 0;
  const neighbours = new Map(nodes.map((n) => [n.id, new Set()]));
  edgeSet.forEach((key) => {
    const [a, b] = key.split("--");
    neighbours.get(a)?.add(b);
    neighbours.get(b)?.add(a);
  });

  let total = 0;
  let counted = 0;
  nodes.forEach((node) => {
    const ns = Array.from(neighbours.get(node.id) || []);
    const k = ns.length;
    if (k < 2) return;
    const possible = (k * (k - 1)) / 2;
    let actual = 0;
    combinations(ns).forEach(([a, b]) => {
      const key = [a, b].sort().join("--");
      if (edgeSet.has(key)) actual += 1;
    });
    total += actual / possible;
    counted += 1;
  });
  return counted === 0 ? 0 : total / counted;
}

function generateYear(yearIndex, shockStrength, mixerRate) {
  const year = YEARS[yearIndex];
  const postShock = year >= SHOCK_YEAR;
  const yearsAfterShock = Math.max(0, year - SHOCK_YEAR + 1);

  const baseCompanies = 4;
  const basePerformersPerCompany = 11;
  const newcomerBoost = postShock ? Math.round(yearsAfterShock * shockStrength * 1.1) : 0;
  const performancesBoost = postShock ? Math.round(yearsAfterShock * shockStrength * 1.4) : 0;

  const companies = Array.from({ length: baseCompanies }, (_, c) => ({ id: c, name: `Company ${String.fromCharCode(65 + c)}` }));

  const nodes = [];
  companies.forEach((company) => {
    const extra = postShock ? Math.floor(newcomerBoost / baseCompanies) + (company.id < newcomerBoost % baseCompanies ? 1 : 0) : 0;
    const count = basePerformersPerCompany + extra;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const centerAngle = (Math.PI * 2 * company.id) / baseCompanies - Math.PI / 4;
      const cx = 320 + Math.cos(centerAngle) * 180;
      const cy = 250 + Math.sin(centerAngle) * 130;
      const jitter = 22 + seededRandom(year * 100 + company.id * 10 + i) * 18;
      nodes.push({
        id: `c${company.id}p${i}`,
        company: company.id,
        newcomer: postShock && i >= basePerformersPerCompany,
        x: cx + Math.cos(angle) * jitter,
        y: cy + Math.sin(angle) * jitter,
      });
    }
  });

  const edgeSet = new Set();
  const productions = [];
  const performanceCount = 22 + performancesBoost;
  const effectiveMixerRate = postShock ? Math.min(0.7, mixerRate * yearsAfterShock * 0.08) : 0.03;

  for (let p = 0; p < performanceCount; p++) {
    const castSize = 4 + Math.floor(seededRandom(year * 1000 + p) * 3);
    const isMixer = seededRandom(year * 2000 + p) < effectiveMixerRate;
    const homeCompany = Math.floor(seededRandom(year * 3000 + p) * baseCompanies);
    const cast = [];

    for (let s = 0; s < castSize; s++) {
      const weights = nodes.map((n) => {
        if (!isMixer) return n.company === homeCompany ? 1 : 0.05;
        const same = n.company === homeCompany ? 0.55 : 0.45;
        const newcomerBias = n.newcomer ? 1.25 : 1;
        return same * newcomerBias;
      });
      const candidate = pickWeighted(nodes, weights, year * 4000 + p * 37 + s * 13);
      if (!cast.includes(candidate.id)) cast.push(candidate.id);
    }

    productions.push({ id: `prod-${year}-${p}`, cast, isMixer });
    combinations(cast).forEach(([a, b]) => edgeSet.add([a, b].sort().join("--")));
  }

  const edges = Array.from(edgeSet).map((key) => {
    const [source, target] = key.split("--");
    const a = nodes.find((n) => n.id === source);
    const b = nodes.find((n) => n.id === target);
    return { source, target, a, b, crossCompany: a.company !== b.company };
  });

  return {
    year,
    nodes,
    edges,
    productions,
    performers: nodes.length,
    performances: performanceCount,
    clustering: clusteringCoefficient(nodes, edgeSet),
    mixerShare: productions.filter((p) => p.isMixer).length / productions.length,
  };
}

function MiniMetric({ label, value, note, tone = "blue" }) {
  const toneClass = {
    blue: "text-blue-700",
    orange: "text-orange-700",
    green: "text-green-700",
    red: "text-red-700",
  }[tone];
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</div>
        <div className="mt-1 text-sm leading-snug text-slate-600">{note}</div>
      </CardContent>
    </Card>
  );
}

export default function ABMNetworkShockVisualization() {
  const [yearIndex, setYearIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shockStrength, setShockStrength] = useState(5);
  const [mixerRate, setMixerRate] = useState(5);
  const [stage, setStage] = useState(0);

  const years = useMemo(
    () => YEARS.map((_, i) => generateYear(i, shockStrength, mixerRate)),
    [shockStrength, mixerRate]
  );

  const current = years[yearIndex];
  const visibleData = years.slice(0, yearIndex + 1).map((d) => ({
    year: d.year,
    performers: d.performers,
    performances: d.performances,
    clustering: Number(d.clustering.toFixed(2)),
    mixerShare: Number((d.mixerShare * 100).toFixed(0)),
  }));

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setYearIndex((i) => {
        if (i >= YEARS.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(t);
  }, [playing]);

  const stageText = [
    {
      title: "1. Stable field",
      text: "Companies mostly cast within their own circles. Performers repeatedly co-occur, creating dense local triangles and high clustering.",
    },
    {
      title: "2. Funding shock",
      text: "In 1975, funding expands the system: more productions are mounted and new performers enter the field.",
    },
    {
      title: "3. Mixer mechanism",
      text: "Some new productions cross company boundaries. These bridges add many ties, but not all of them close into triangles.",
    },
    {
      title: "4. Intuition",
      text: "Growth alone does not guarantee lower clustering. The drop appears when new activity creates cross-company ties faster than local triangles can form.",
    },
  ];

  const reset = () => {
    setYearIndex(0);
    setPlaying(false);
    setStage(0);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <div className="text-sm font-medium uppercase tracking-wide text-slate-500">Agent-based intuition builder</div>
          <h1 className="text-3xl font-bold tracking-tight">Why might funding-driven growth lower network clustering?</h1>
          <p className="max-w-3xl text-base leading-relaxed text-slate-600">
            A simplified theatre-field ABM: performers are nodes, yearly co-appearances create edges, and funding changes the casting ecology.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Narrative stage</div>
                  <div className="mt-1 text-sm text-slate-600">{stageText[stage].title}</div>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">{stageText[stage].text}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setStage(Math.max(0, stage - 1))}>Back</Button>
                  <Button className="rounded-xl" onClick={() => setStage(Math.min(stageText.length - 1, stage + 1))}>Next</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Simulation controls</div>
                  <div className="text-sm text-slate-600">Tune the post-1975 shock mechanism.</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Funding shock size</span><strong>{shockStrength}</strong></div>
                  <Slider value={[shockStrength]} min={1} max={10} step={1} onValueChange={(v) => setShockStrength(v[0])} />
                  <div className="text-xs text-slate-500">Higher values add more newcomers and productions after 1975.</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Cross-company mixer rate</span><strong>{mixerRate}</strong></div>
                  <Slider value={[mixerRate]} min={0} max={10} step={1} onValueChange={(v) => setMixerRate(v[0])} />
                  <div className="text-xs text-slate-500">Higher values make new productions more likely to cast across companies.</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Year</span><strong>{current.year}</strong></div>
                  <Slider value={[yearIndex]} min={0} max={YEARS.length - 1} step={1} onValueChange={(v) => setYearIndex(v[0])} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button className="rounded-xl" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} /> : <Play size={16} />}</Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setYearIndex(Math.min(YEARS.length - 1, yearIndex + 1))}><StepForward size={16} /></Button>
                  <Button variant="outline" className="rounded-xl" onClick={reset}><RotateCcw size={16} /></Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-3">
              <MiniMetric label="Performers" value={current.performers} note="Nodes active this year" tone="blue" />
              <MiniMetric label="Performances" value={current.performances} note="Productions cast this year" tone="orange" />
              <MiniMetric label="Clustering" value={current.clustering.toFixed(2)} note="Average local closure" tone={current.year >= SHOCK_YEAR ? "red" : "green"} />
            </div>
          </aside>

          <main className="space-y-5">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Yearly co-occurrence network</h2>
                    <p className="text-sm text-slate-600">Grey edges are within-company co-appearances; red edges are cross-company mixer ties.</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-sm font-semibold ${current.year >= SHOCK_YEAR ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                    {current.year >= SHOCK_YEAR ? "Post-funding shock" : "Baseline"}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <svg viewBox="0 0 680 500" className="h-[520px] w-full">
                    <rect x="0" y="0" width="680" height="500" fill="white" />
                    {current.year === SHOCK_YEAR && (
                      <text x="32" y="44" className="fill-orange-700 text-lg font-bold">Funding shock begins</text>
                    )}
                    {current.edges.map((e, idx) => (
                      <line
                        key={`${e.source}-${e.target}`}
                        x1={e.a.x}
                        y1={e.a.y}
                        x2={e.b.x}
                        y2={e.b.y}
                        stroke={e.crossCompany ? "#ef4444" : "#cbd5e1"}
                        strokeWidth={e.crossCompany ? 1.6 : 1}
                        opacity={e.crossCompany ? 0.58 : 0.38}
                      />
                    ))}
                    {current.nodes.map((n) => (
                      <circle
                        key={n.id}
                        cx={n.x}
                        cy={n.y}
                        r={n.newcomer ? 5.8 : 4.4}
                        fill={n.newcomer ? "#f97316" : companyPalette[n.company]}
                        stroke="white"
                        strokeWidth="1.5"
                        opacity="0.95"
                      />
                    ))}
                    {companyPalette.slice(0, 4).map((color, i) => {
                      const angle = (Math.PI * 2 * i) / 4 - Math.PI / 4;
                      return (
                        <text key={i} x={320 + Math.cos(angle) * 245} y={250 + Math.sin(angle) * 175} textAnchor="middle" className="fill-slate-500 text-xs font-semibold">
                          Company {String.fromCharCode(65 + i)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-lg font-bold">System growth</h2>
                  <p className="mb-3 text-sm text-slate-600">Funding increases both the number of performers and productions.</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={visibleData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="performers" stroke="#2563eb" strokeWidth={3} dot={false} name="Performers" />
                        <Line type="monotone" dataKey="performances" stroke="#f97316" strokeWidth={3} dot={false} name="Performances" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <h2 className="text-lg font-bold">Network structure</h2>
                  <p className="mb-3 text-sm text-slate-600">Clustering falls when cross-company ties accumulate without closing into triangles.</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={visibleData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" domain={[0, 1]} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="clustering" stroke="#dc2626" strokeWidth={3} dot={false} name="Clustering" />
                        <Line yAxisId="right" type="monotone" dataKey="mixerShare" stroke="#16a34a" strokeWidth={3} dot={false} name="Mixer share %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-lg font-bold">Interpretive claim</h2>
                <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600">
                  This toy model separates <span className="font-semibold text-blue-700">growth</span> from <span className="font-semibold text-green-700">mixing</span>. If funding only adds more productions inside existing company clusters, clustering tends to remain high. If funding also creates cross-company casting opportunities, the network can grow while clustering falls, because many new ties are bridges rather than closed triads.
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
