import { Box } from "@mui/material";
import { PlanetType } from "@/pi-planets";
import { PLANET_COLORS } from "@/pi-investigate";

/** Capital letter shown inside each planet-type circle so types are legible. */
export const PLANET_LETTER: Record<PlanetType, string> = {
  temperate: "T",
  barren: "B",
  oceanic: "O",
  ice: "I",
  gas: "G",
  lava: "L",
  storm: "S",
  plasma: "P",
};

/** A colored circle with the planet type's letter (B for barren, S storm, …). */
export function PlanetBadge({ type, size = 16 }: { type: PlanetType; size?: number }) {
  return (
    <Box
      title={type}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: PLANET_COLORS[type],
        color: "#fff",
        textShadow: "0 0 2px rgba(0,0,0,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.62,
        fontWeight: 700,
        lineHeight: 1,
        flex: "none",
      }}
    >
      {PLANET_LETTER[type]}
    </Box>
  );
}
