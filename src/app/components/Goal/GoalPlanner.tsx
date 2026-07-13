"use client";

import { ReactNode, useContext, useMemo, useState } from "react";
import Image from "next/image";
import {
  Box,
  Typography,
  MenuItem,
  Select,
  TextField,
  Chip,
} from "@mui/material";
import { CharacterContext, SessionContext } from "@/app/context/Context";
import { TIER_COLORS, Tier } from "@/pi-tiers";
import { CHAIN_TARGETS } from "@/pi-chain";
import { goalAnalysis, groupBySystem } from "@/pi-goal";

/**
 * Goal Planner — "I want to build". Pick a target + plant count + system;
 * every table below derives from live colony data: factories want vs have,
 * raw extraction gaps, stockpile verdicts, planet-by-planet moves, and
 * per-alt extraction health.
 */
const controlLabel = {
  fontSize: ".68rem",
  color: "text.secondary",
  textTransform: "uppercase",
  letterSpacing: ".05em",
} as const;

const TierChip = ({ tier }: { tier: Tier | undefined }) =>
  tier ? (
    <Typography
      component="span"
      sx={{
        fontSize: ".62rem",
        fontWeight: 700,
        color: TIER_COLORS[tier],
        border: `1px solid ${TIER_COLORS[tier]}`,
        borderRadius: "4px",
        px: 0.5,
        mr: 0.75,
      }}
    >
      {tier}
    </Typography>
  ) : null;

const Section = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontSize: ".95rem", fontWeight: 600, mb: 0.25 }}>{title}</Typography>
    {sub && (
      <Typography sx={{ fontSize: ".72rem", color: "text.disabled", mb: 1 }}>{sub}</Typography>
    )}
    {children}
  </Box>
);

const cellHead = {
  fontSize: ".66rem",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  color: "text.secondary",
  py: 0.75,
  px: 1.5,
  textAlign: "left" as const,
};
const cell = { fontSize: ".8rem", py: 0.7, px: 1.5, borderTop: "1px solid rgba(255,255,255,.05)" };

export function GoalPlanner() {
  const { characters } = useContext(CharacterContext);
  const { piPrices } = useContext(SessionContext);
  const [target, setTarget] = useState<number>(2867); // Broadcast Node
  const [plants, setPlants] = useState(4);

  const systems = useMemo(() => groupBySystem(characters), [characters]);
  const [systemId, setSystemId] = useState<number | 0>(0);
  const activeSystem =
    systems.find((s) => s.systemId === systemId) ?? systems[0];

  const analysis = useMemo(
    () =>
      activeSystem
        ? goalAnalysis(activeSystem.colonies, target, plants, piPrices)
        : null,
    [activeSystem, target, plants, piPrices],
  );

  if (!characters.length) {
    return (
      <Typography sx={{ color: "text.secondary", py: 4 }}>
        Log in a character to plan against your live colonies.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography sx={{ fontSize: "1.05rem", fontWeight: 500 }}>
        I want to build{" "}
        <Typography component="span" sx={{ color: "text.disabled", fontSize: ".85rem" }}>
          · want vs. have from your live colonies — the data makes the decision
        </Typography>
      </Typography>
      <Typography sx={{ fontSize: ".75rem", color: "text.disabled", mb: 1.75 }}>
        &quot;Have&quot; counts live factories and running extractors in the selected system
        only. Extraction rates decay across a program — leave headroom on anything marked
        &quot;extract here&quot;.
      </Typography>

      {/* controls */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, alignItems: "flex-end", mb: 2.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Target</Typography>
          <Select
            size="small"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            sx={{ bgcolor: "#242424", minWidth: 230, fontSize: ".85rem" }}
          >
            {CHAIN_TARGETS.map((t) => (
              <MenuItem key={t.id} value={t.id} sx={{ fontSize: ".85rem" }}>
                <Box component="span" sx={{ color: TIER_COLORS[t.tier], fontWeight: 700, mr: 1, fontSize: ".7rem" }}>
                  {t.tier}
                </Box>
                {t.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>Top-tier plants</Typography>
          <TextField
            size="small"
            type="number"
            value={plants}
            onChange={(e) => setPlants(Math.max(1, parseInt(e.target.value) || 1))}
            sx={{ width: 100, bgcolor: "#242424" }}
          />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={controlLabel}>System</Typography>
          <Select
            size="small"
            value={activeSystem?.systemId ?? ""}
            onChange={(e) => setSystemId(Number(e.target.value))}
            sx={{ bgcolor: "#242424", minWidth: 160, fontSize: ".85rem" }}
          >
            {systems.map((s) => (
              <MenuItem key={s.systemId} value={s.systemId} sx={{ fontSize: ".85rem" }}>
                {s.label} · {s.colonies.length} colonies
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {analysis && activeSystem && (
        <>
          {/* factories want vs have */}
          <Section
            title="Factories — want vs. have in this system"
            sub={`${plants} × top-tier plant${plants > 1 ? "s" : ""}, full chain`}
          >
            <Box sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr>
                    <Box component="th" sx={cellHead}>Stage</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Want</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Have</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Need</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Stockpile</Box>
                  </tr>
                </thead>
                <tbody>
                  {analysis.stages.map((s) => (
                    <tr key={s.id}>
                      <Box component="td" sx={cell}>
                        <TierChip tier={s.tier} />
                        {s.name}
                      </Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>{s.want}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>{s.have}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right", fontWeight: 600, color: s.need > 0 ? "warning.main" : "success.main" }}>
                        {s.need > 0 ? `+${s.need}` : "✓"}
                      </Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right", color: "text.secondary" }}>
                        {s.stockpile ? s.stockpile.toLocaleString() : "0"}
                      </Box>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </Section>

          {/* raw materials */}
          <Section
            title="Raw materials — extraction want vs. have (units/hr)"
            sub={`Live head rates from running extractors in ${activeSystem.label}. Stockpile is on-planet storage here.`}
          >
            <Box sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr>
                    <Box component="th" sx={cellHead}>P0 resource</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Want/hr</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Have/hr</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Need/hr</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Stockpile</Box>
                    <Box component="th" sx={cellHead}>Sourcing</Box>
                  </tr>
                </thead>
                <tbody>
                  {analysis.raws.map((r) => (
                    <tr key={r.id}>
                      <Box component="td" sx={cell}>{r.name}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>{r.wantPerHour.toLocaleString()}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>{Math.round(r.havePerHour).toLocaleString()}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right", fontWeight: 600, color: r.needPerHour > 0 ? "warning.main" : "success.main" }}>
                        {r.needPerHour > 0 ? Math.round(r.needPerHour).toLocaleString() : "✓"}
                      </Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right", color: "text.secondary" }}>
                        {r.stockpile ? r.stockpile.toLocaleString() : "0"}
                      </Box>
                      <Box component="td" sx={cell}>
                        <Chip
                          size="small"
                          label={r.extractableHere ? "extract here" : "haul in"}
                          sx={{
                            height: 20,
                            fontSize: ".66rem",
                            bgcolor: r.extractableHere ? "rgba(102,187,106,.14)" : "rgba(255,167,38,.14)",
                            color: r.extractableHere ? "success.main" : "warning.main",
                          }}
                        />
                      </Box>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </Section>

          {/* planet-by-planet */}
          <Section
            title="What to change, planet by planet"
            sub={`${analysis.keepCount} keep · ${analysis.changeCount} to change. Planets already feeding the chain are kept; the rest get a concrete move.`}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {analysis.verdicts.map((v, i) => (
                <Box
                  key={`${v.characterName}-${v.planetName}-${i}`}
                  sx={{
                    bgcolor: "#1e1e1e",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderLeft: `3px solid ${v.verdict === "keep" ? "#66bb6a" : v.verdict === "repurpose" ? "#ffa726" : "#f44336"}`,
                    borderRadius: "8px",
                    px: 1.75,
                    py: 1.1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Image src={`/${v.planetType}.png`} alt="" width={22} height={22} style={{ borderRadius: 5 }} />
                    <Typography sx={{ fontSize: ".86rem", fontWeight: 500 }}>{v.planetName}</Typography>
                    <Typography sx={{ fontSize: ".72rem", color: "text.secondary" }}>
                      {v.planetType} · {v.characterName}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography
                      sx={{
                        fontSize: ".68rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                        color: v.verdict === "keep" ? "success.main" : v.verdict === "repurpose" ? "warning.main" : "error.main",
                      }}
                    >
                      {v.verdict === "keep" ? "keep" : v.verdict === "repurpose" ? "repurpose in place" : "destroy & rebuild"}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: ".74rem", color: "text.secondary", mt: 0.5 }}>
                    Now: extracts {v.extracts.join(", ") || "—"}; makes {v.makes.join(", ") || "—"}
                  </Typography>
                  {v.suggestion && (
                    <Typography sx={{ fontSize: ".78rem", color: "text.primary", mt: 0.5 }}>
                      {v.suggestion}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Section>

          {/* stockpile verdicts */}
          {analysis.stock.length > 0 && (
            <Section
              title="You have a lot of these — stop making more, repurpose the planet"
              sub="On-planet stock in this system vs. current production. Verdict is against the selected target chain."
            >
              <Box sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflowX: "auto" }}>
                <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead>
                    <tr>
                      <Box component="th" sx={cellHead}>Commodity</Box>
                      <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>In stock</Box>
                      <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Making/hr</Box>
                      <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Cover</Box>
                      <Box component="th" sx={cellHead}>Verdict</Box>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.stock.map((s) => (
                      <tr key={s.id}>
                        <Box component="td" sx={cell}>
                          <TierChip tier={s.tier} />
                          {s.name}
                        </Box>
                        <Box component="td" sx={{ ...cell, textAlign: "right" }}>{s.stock.toLocaleString()}</Box>
                        <Box component="td" sx={{ ...cell, textAlign: "right" }}>{Math.round(s.makingPerHour)}</Box>
                        <Box component="td" sx={{ ...cell, textAlign: "right" }}>
                          {isFinite(s.coverDays) ? `${Math.max(1, Math.round(s.coverDays))}d` : "—"}
                        </Box>
                        <Box component="td" sx={cell}>
                          <Chip
                            size="small"
                            label={s.keep ? "target uses it — keep" : "stop & repurpose"}
                            sx={{
                              height: 20,
                              fontSize: ".66rem",
                              bgcolor: s.keep ? "rgba(102,187,106,.14)" : "rgba(244,67,54,.14)",
                              color: s.keep ? "success.main" : "error.main",
                            }}
                          />
                        </Box>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Section>
          )}

          {/* alt health */}
          <Section
            title="Alts extraction health"
            sub="P0 pulled per 2 days at current head rates, per character in this system."
          >
            <Box sx={{ bgcolor: "#1e1e1e", border: "1px solid rgba(255,255,255,.08)", borderRadius: "10px", overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr>
                    <Box component="th" sx={cellHead}>Character</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>Extractors</Box>
                    <Box component="th" sx={{ ...cellHead, textAlign: "right" }}>P0 / 2d</Box>
                    <Box component="th" sx={cellHead}>Status</Box>
                    <Box component="th" sx={cellHead}>Pulling</Box>
                  </tr>
                </thead>
                <tbody>
                  {analysis.health.map((h) => (
                    <tr key={h.name}>
                      <Box component="td" sx={cell}>{h.name}</Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>
                        {h.extractorsRunning}/{h.extractorsTotal}
                      </Box>
                      <Box component="td" sx={{ ...cell, textAlign: "right" }}>
                        {Math.round(h.p0PerPeriod).toLocaleString()}
                      </Box>
                      <Box component="td" sx={cell}>
                        <Chip
                          size="small"
                          label={h.healthy ? "healthy" : "under target"}
                          sx={{
                            height: 20,
                            fontSize: ".66rem",
                            bgcolor: h.healthy ? "rgba(102,187,106,.14)" : "rgba(244,67,54,.14)",
                            color: h.healthy ? "success.main" : "error.main",
                          }}
                        />
                      </Box>
                      <Box component="td" sx={{ ...cell, color: "text.secondary" }}>
                        {h.pulling.join(", ")}
                      </Box>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </Section>
        </>
      )}
    </Box>
  );
}
