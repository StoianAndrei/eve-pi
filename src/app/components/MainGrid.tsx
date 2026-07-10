import { useContext, useEffect, useState } from "react";
import {
  Box,
  CssBaseline,
  Grid,
  ThemeProvider,
  createTheme,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Typography,
} from "@mui/material";
import { AccountCard } from "./Account/AccountCard";
import { AccessToken } from "@/types";
import { CharacterContext, SessionContext } from "../context/Context";
import ResponsiveAppBar from "./AppBar/AppBar";
import { EmpireSummaryStrip } from "./EmpireSummaryStrip";
import { PipelinePlanetCard } from "./PlanetaryInteraction/PipelinePlanetCard";
import { WeekManifest } from "./Manifest/WeekManifest";
import { RebalancePanel } from "./Rebalance/RebalancePanel";
import { findSwaps } from "./Rebalance/rebalance";
import { ChainExplorer } from "./Chain/ChainExplorer";
import { RankingPanel } from "./Chain/RankingPanel";
import { SystemPlanner } from "./System/SystemPlanner";
import { NotificationsPanel } from "./Notifications/NotificationsPanel";
import {
  deliverAlerts,
  evaluateAlerts,
  loadNotifyConfig,
  takeUnfired,
} from "./Notifications/notify";
import { Landing } from "./Landing/Landing";
import { CHAIN_TARGETS } from "@/pi-chain";
import { TIER_COLORS } from "@/pi-tiers";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

interface Grouped {
  [key: string]: AccessToken[];
}

type View =
  | "pipeline"
  | "week"
  | "rebalance"
  | "chain"
  | "ranking"
  | "system"
  | "notify"
  | "classic";
const VIEWS: View[] = [
  "pipeline",
  "week",
  "rebalance",
  "chain",
  "ranking",
  "system",
  "notify",
  "classic",
];

const FlowLegend = () => (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 1.5,
      bgcolor: "#191919",
      border: "1px solid rgba(255,255,255,.07)",
      borderRadius: "8px",
      px: 1.75,
      py: 1.1,
    }}
  >
    {[
      { color: TIER_COLORS.P0, label: "P0 extract — stays on planet" },
      { color: TIER_COLORS.P1, label: "P1 import — counterpart from your other bases" },
      { color: TIER_COLORS.P2, label: "P2 export — the only thing you carry out" },
    ].map((item, i) => (
      <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {i > 0 && (
          <Typography sx={{ color: "rgba(255,255,255,.25)", mr: 1.5 }}>→</Typography>
        )}
        <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: item.color }} />
        <Typography sx={{ fontSize: ".78rem", color: "text.secondary" }}>
          {item.label}
        </Typography>
      </Box>
    ))}
  </Box>
);

declare module "@mui/material/styles" {
  interface Theme {
    custom: {
      compactMode: boolean;
      smallText: string;
      cardImageSize: number;
      cardMinHeight: number;
      stoppedPosition: number;
    };
  }
  interface ThemeOptions {
    custom?: {
      compactMode?: boolean;
      smallText?: string;
      cardImageSize?: number;
      cardMinHeight?: number;
      stoppedPosition?: number;
    };
  }
}

export const MainGrid = () => {
  const { characters } = useContext(CharacterContext);
  const { compactMode, toggleCompactMode, alertMode, toggleAlertMode, planMode, togglePlanMode, extractionTimeMode, toggleExtractionTimeMode, piPrices, sessionReady } = useContext(SessionContext);
  const [accountOrder, setAccountOrder] = useState<string[]>([]);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [view, setView] = useState<View>("pipeline");
  const [chainTarget, setChainTarget] = useState<number>(
    CHAIN_TARGETS[0]?.id ?? 0,
  );

  useEffect(() => {
    setDemoMode(localStorage.getItem("demoMode") === "1");
    // Deep link (?view=chain&pi=2867) wins over the saved tab.
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get("view");
    const urlPi = Number(params.get("pi"));
    if (urlPi && CHAIN_TARGETS.some((t) => t.id === urlPi)) {
      setChainTarget(urlPi);
    }
    if (urlView && VIEWS.includes(urlView as View)) {
      setView(urlView as View);
      return;
    }
    const saved = localStorage.getItem("mainView");
    if (saved && VIEWS.includes(saved as View)) {
      setView(saved as View);
    }
  }, []);

  // R5 — background notification checks while the app is open.
  useEffect(() => {
    if (!characters.length) return;
    const check = () => {
      const config = loadNotifyConfig();
      if (!config.enabled) return;
      const alerts = takeUnfired(evaluateAlerts(characters, config));
      if (alerts.length) deliverAlerts(alerts, config);
    };
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [characters]);

  const openChain = (typeId: number) => {
    setChainTarget(typeId);
    changeView("chain");
  };

  const changeView = (next: View) => {
    setView(next);
    localStorage.setItem("mainView", next);
  };

  const lossCount = findSwaps(characters, piPrices).reduce(
    (n, r) => n + r.sides.length,
    0,
  );

  // Initialize account order when characters change
  useEffect(() => {
    const currentAccounts = Object.keys(
      characters.reduce<Grouped>((group, character) => {
        const { account } = character;
        group[account ?? ""] = group[account ?? ""] ?? [];
        group[account ?? ""].push(character);
        return group;
      }, {}),
    );

    const savedOrder = localStorage.getItem("accountOrder");
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        const validOrder = parsedOrder.filter((account: string) =>
          currentAccounts.includes(account),
        );
        const newAccounts = currentAccounts.filter(
          (account) => !validOrder.includes(account),
        );
        setAccountOrder([...validOrder, ...newAccounts]);
      } catch (e) {
        setAccountOrder(currentAccounts);
      }
    } else {
      setAccountOrder(currentAccounts);
    }
  }, [characters]);

  useEffect(() => {
    if (accountOrder.length > 0) {
      localStorage.setItem("accountOrder", JSON.stringify(accountOrder));
    }
  }, [accountOrder]);

  const groupByAccount = characters.reduce<Grouped>((group, character) => {
    const { account } = character;
    group[account ?? ""] = group[account ?? ""] ?? [];
    group[account ?? ""].push(character);
    return group;
  }, {});

  const [darkTheme, setDarkTheme] = useState(
    createTheme({
      palette: {
        mode: "dark",
      },
      custom: {
        compactMode,
        smallText: compactMode ? "0.6rem" : "0.8rem",
        cardImageSize: compactMode ? 80 : 120,
        cardMinHeight: compactMode ? 100 : 170,
        stoppedPosition: compactMode ? 32 : 48,
      },
    }),
  );

  useEffect(() => {
    setDarkTheme(
      createTheme({
        palette: {
          mode: "dark",
        },
        custom: {
          compactMode,
          smallText: compactMode ? "0.6rem" : "0.8rem",
          cardImageSize: compactMode ? 80 : 120,
          cardMinHeight: compactMode ? 100 : 170,
          stoppedPosition: compactMode ? 32 : 48,
        },
      }),
    );
  }, [compactMode]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(accountOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setAccountOrder(items);
  };

  const DragDropContextComponent = DragDropContext as any;
  const DroppableComponent = Droppable as any;
  const DraggableComponent = Draggable as any;

  const enterDemo = () => {
    localStorage.setItem("demoMode", "1");
    setDemoMode(true);
    changeView("chain");
  };

  const exitDemo = () => {
    localStorage.removeItem("demoMode");
    setDemoMode(false);
  };

  // Landing / login gate: logged-out visitors see the hero until they log in
  // or enter the demo. Logged-in users never see it.
  if (sessionReady && characters.length === 0 && !demoMode) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Landing onDemo={enterDemo} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <ResponsiveAppBar />
        {demoMode && characters.length === 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
              bgcolor: "rgba(144,202,249,.08)",
              borderBottom: "1px solid rgba(144,202,249,.25)",
              px: 2,
              py: 1,
            }}
          >
            <Typography sx={{ fontSize: ".82rem", color: "primary.main", fontWeight: 600 }}>
              Demo mode
            </Typography>
            <Typography sx={{ fontSize: ".8rem", color: "text.secondary", flex: 1, minWidth: 260 }}>
              Chain Explorer, Ranking and System Planner are fully live. Add a
              character to see your own colonies in the planet views.
            </Typography>
            <Button size="small" onClick={exitDemo}>
              Back to landing
            </Button>
          </Box>
        )}
        {/* Live empire KPI strip — folds the old Empire/Summary row (P9) */}
        <Box sx={{ px: 1, pt: 1 }}>
          <EmpireSummaryStrip characters={characters} />
        </Box>
        <Tabs
          value={view}
          onChange={(_, v: View) => changeView(v)}
          sx={{ px: 1, borderBottom: "1px solid rgba(255,255,255,.08)" }}
        >
          <Tab value="pipeline" label="Planets" />
          <Tab value="week" label="Your Week" />
          <Tab
            value="rebalance"
            label={
              <Badge badgeContent={lossCount} color="error">
                <Box sx={{ pr: lossCount ? 1.5 : 0 }}>Rebalance</Box>
              </Badge>
            }
          />
          <Tab value="chain" label="Chain Explorer" />
          <Tab value="ranking" label="Ranking" />
          <Tab value="system" label="System Planner" />
          <Tab value="notify" label="Notifications" />
          <Tab value="classic" label="Classic Table" />
        </Tabs>
        {view === "pipeline" && (
          <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <FlowLegend />
            {accountOrder.flatMap(
              (account) =>
                groupByAccount[account]?.flatMap((character) =>
                  character.planets.map((planet) => (
                    <PipelinePlanetCard
                      key={`${character.character.characterId}-${planet.planet_id}`}
                      planet={planet}
                      character={character}
                    />
                  )),
                ) ?? [],
            )}
          </Box>
        )}
        {view === "week" && (
          <Box sx={{ p: 1 }}>
            <WeekManifest characters={characters} />
          </Box>
        )}
        {view === "rebalance" && (
          <Box sx={{ p: 1 }}>
            <RebalancePanel characters={characters} />
          </Box>
        )}
        {view === "chain" && (
          <Box sx={{ p: 1 }}>
            <ChainExplorer target={chainTarget} onTargetChange={setChainTarget} />
          </Box>
        )}
        {view === "ranking" && (
          <Box sx={{ p: 1 }}>
            <RankingPanel onOpen={openChain} />
          </Box>
        )}
        {view === "system" && (
          <Box sx={{ p: 1 }}>
            <SystemPlanner />
          </Box>
        )}
        {view === "notify" && (
          <Box sx={{ p: 1 }}>
            <NotificationsPanel />
          </Box>
        )}
        {view === "classic" && (
        <>
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-start",
            padding: 1,
            gap: 1,
          }}
        >
          <Button
            startIcon={
              allCollapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />
            }
            onClick={() => setAllCollapsed(!allCollapsed)}
            size="small"
          >
            {allCollapsed ? "Expand All" : "Collapse All"}
          </Button>
          <Tooltip title="Toggle compact layout for widescreen">
            <Button
              size="small"
              style={{
                backgroundColor: compactMode
                  ? "rgba(144, 202, 249, 0.16)"
                  : "inherit",
              }}
              onClick={toggleCompactMode}
            >
              Compact mode
            </Button>
          </Tooltip>
          <Tooltip title="Toggle alert mode to show only accounts and planets that need action.">
            <Button
              size="small"
              style={{
                backgroundColor: alertMode
                  ? "rgba(144, 202, 249, 0.16)"
                  : "inherit",
              }}
              onClick={toggleAlertMode}
            >
              Alert mode
            </Button>
          </Tooltip>
          <Tooltip title="Toggle plan mode that show layout for widescreen">
            <Button
              size="small"
              style={{
                backgroundColor: planMode
                  ? "rgba(144, 202, 249, 0.16)"
                  : "inherit",
              }}
              onClick={togglePlanMode}
            >
              Plan mode
            </Button>
          </Tooltip>
          <Tooltip title="Toggle extraction time display mode">
            <Button
              size="small"
              style={{
                backgroundColor: extractionTimeMode
                  ? "rgba(144, 202, 249, 0.16)"
                  : "inherit",
              }}
              onClick={toggleExtractionTimeMode}
            >
              Extraction datetime
            </Button>
          </Tooltip>
        </Box>
        <DragDropContextComponent onDragEnd={handleDragEnd}>
          <DroppableComponent droppableId="accounts">
            {(provided: any) => (
              <Grid
                container
                spacing={1}
                sx={{ padding: 1, width: "100%" }}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {accountOrder.map((account, index) => (
                  <DraggableComponent
                    key={account}
                    draggableId={account}
                    index={index}
                  >
                    {(provided: any) => (
                      <Grid
                        item
                        xs={12}
                        sm={compactMode ? 6 : 12}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        sx={{
                          "& > *": {
                            width: "100%",
                          },
                        }}
                      >
                        {groupByAccount[account] &&
                          groupByAccount[account].length > 0 && (
                            <AccountCard
                              characters={groupByAccount[account]}
                              isCollapsed={allCollapsed}
                            />
                          )}
                      </Grid>
                    )}
                  </DraggableComponent>
                ))}
                {provided.placeholder}
              </Grid>
            )}
          </DroppableComponent>
        </DragDropContextComponent>
        </>
        )}
      </Box>
    </ThemeProvider>
  );
};
