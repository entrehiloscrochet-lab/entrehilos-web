import CatalogoClient from "./CatalogoClient";

// Slugs conocidos: se prerenderizan en el build y se sirven desde el CDN,
// sin invocar una función en cada visita (antes ~70ms de CPU por request).
// Los catálogos nuevos creados desde el admin se renderizan on-demand y siguen funcionando.
const KNOWN_SLUGS = [
  "ramos",
  "amigurumis",
  "cajas",
  "hotwheels",
  "personalizados",
  "dia-de-la-novia",
  "dia-de-la-mujer",
  "san-valentin",
  "dia-de-la-madre",
  "flores-amarillas",
];

export function generateStaticParams() {
  return KNOWN_SLUGS.map((slug) => ({ slug }));
}

export default async function CatalogoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CatalogoClient slug={slug} />;
}
