import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { EVE_IMAGE_URL } from "@/const";
import {
  PiTemplate,
  TemplateAnalysis,
  TemplateListItem,
  analyzeTemplate,
  fetchTemplate,
  listTemplates,
  parseTemplate,
} from "@/templates";

const iconUrl = (typeId: number) =>
  `${EVE_IMAGE_URL}/types/${typeId}/icon?size=32`;

const CommodityChip = ({ typeId, name }: { typeId: number; name: string }) => (
  <Chip
    size="small"
    variant="outlined"
    avatar={<Avatar src={iconUrl(typeId)} alt={name} />}
    label={name}
  />
);

const AnalysisCard = ({
  analysis,
  template,
}: {
  analysis: TemplateAnalysis;
  template: PiTemplate;
}) => (
  <Paper sx={{ p: 2 }} elevation={2}>
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
      {analysis.planet && (
        <Avatar
          src={`/${analysis.planet.key}.png`}
          alt={analysis.planet.name}
          variant="rounded"
          sx={{ width: 48, height: 48 }}
        />
      )}
      <Box>
        <Typography variant="h6">
          {analysis.comment ?? "PI Template"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {analysis.planet?.name ?? `Planet #${template.Pln}`}
          {analysis.diameter ? ` · ${analysis.diameter.toLocaleString()} km` : ""}
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <Tooltip title="Required Command Center upgrade level">
        <Chip color="primary" label={`CC level ${analysis.ccLevel}`} />
      </Tooltip>
    </Stack>

    <Divider sx={{ my: 1 }} />

    <Typography variant="subtitle2" gutterBottom>
      Structures ({analysis.pinCount} pins
      {analysis.extractorHeads > 0
        ? `, ${analysis.extractorHeads} extractor heads`
        : ""}
      )
    </Typography>
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
      {analysis.structures.map((s) => (
        <Chip key={s.label} size="small" label={`${s.count}× ${s.label}`} />
      ))}
    </Stack>

    {analysis.schematics.length > 0 && (
      <>
        <Typography variant="subtitle2" gutterBottom>
          Production
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {analysis.schematics.map((s) => (
            <Chip
              key={s.schematicId}
              size="small"
              variant="outlined"
              avatar={<Avatar src={iconUrl(s.outputTypeIds[0])} alt={s.name} />}
              label={s.count > 1 ? `${s.count}× ${s.name}` : s.name}
            />
          ))}
        </Stack>
      </>
    )}

    {analysis.finalOutputs.length > 0 && (
      <>
        <Typography variant="subtitle2" gutterBottom>
          Final output
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          {analysis.finalOutputs.map((c) => (
            <CommodityChip key={c.typeId} typeId={c.typeId} name={c.name} />
          ))}
        </Stack>
      </>
    )}

    {analysis.requiredInputs.length > 0 && (
      <>
        <Typography variant="subtitle2" gutterBottom>
          Imported inputs
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {analysis.requiredInputs.map((c) => (
            <CommodityChip key={c.typeId} typeId={c.typeId} name={c.name} />
          ))}
        </Stack>
      </>
    )}
  </Paper>
);

export const TemplatesView = () => {
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const [selected, setSelected] = useState<PiTemplate | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    setListLoading(true);
    listTemplates()
      .then(setItems)
      .catch((e) => setListError(e.message))
      .finally(() => setListLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, TemplateListItem[]> = {};
    filtered.forEach((i) => {
      (groups[i.category] = groups[i.category] ?? []).push(i);
    });
    return groups;
  }, [filtered]);

  const loadItem = async (item: TemplateListItem) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const template = await fetchTemplate(item.downloadUrl);
      setSelected(template);
      setSelectedName(item.name);
    } catch (e) {
      setDetailError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadPasted = () => {
    setDetailError(null);
    try {
      setSelected(parseTemplate(pasted));
      setSelectedName("Pasted template");
    } catch (e) {
      setDetailError((e as Error).message);
    }
  };

  const analysis = useMemo(
    () => (selected ? analyzeTemplate(selected) : null),
    [selected],
  );

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={2}
        alignItems="baseline"
        sx={{ mb: 2 }}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="h6">PI Templates</Typography>
        <Typography variant="body2" color="text.secondary">
          Importable planet layouts from{" "}
          <Link
            href="https://github.com/DalShooth/EVE_PI_Templates"
            target="_blank"
            rel="noopener"
          >
            DalShooth/EVE_PI_Templates
          </Link>
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {/* Source panel */}
        <Box sx={{ width: { xs: "100%", md: 340 }, flexShrink: 0 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Filter templates…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ mb: 1 }}
          />
          {listLoading && <CircularProgress size={20} />}
          {listError && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {listError}
            </Alert>
          )}
          <Box sx={{ maxHeight: 420, overflowY: "auto", pr: 1 }}>
            {Object.entries(grouped).map(([category, list]) => (
              <Box key={category} sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary">
                  {category} ({list.length})
                </Typography>
                <Stack spacing={0.5}>
                  {list.map((item) => (
                    <Button
                      key={item.path}
                      size="small"
                      variant={
                        selectedName === item.name ? "contained" : "text"
                      }
                      sx={{ justifyContent: "flex-start", textTransform: "none" }}
                      onClick={() => loadItem(item)}
                    >
                      {item.variant ? `[${item.variant}] ` : ""}
                      {item.product}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />
          <Typography variant="overline" color="text.secondary">
            Or paste template JSON
          </Typography>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            placeholder='{"Pln":2016,"P":[...],...}'
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            sx={{ my: 1 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={loadPasted}
            disabled={!pasted.trim()}
          >
            Load pasted template
          </Button>
        </Box>

        {/* Detail panel */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {detailLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {detailError && <Alert severity="error">{detailError}</Alert>}
          {!detailLoading && !detailError && analysis && selected && (
            <AnalysisCard analysis={analysis} template={selected} />
          )}
          {!detailLoading && !detailError && !analysis && (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              Select a template on the left, or paste one, to inspect its planet
              type, required command-center level, structures and production
              chain.
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
};
