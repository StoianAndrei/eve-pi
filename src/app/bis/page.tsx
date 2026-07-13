import { BisLivingDataHero } from "../components/Bis/BisLivingDataHero";

export const metadata = {
  title: "BIS — Business Intelligence Signals",
  description:
    "Pour éclairer votre entreprise dans la bonne direction. Les annonces légales de toute la France, en un signal.",
};

export default function BisPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0d1b35" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..800&family=Playfair+Display:ital,wght@0,700;0,800;1,500&display=swap"
        rel="stylesheet"
      />
      <BisLivingDataHero />
    </main>
  );
}
