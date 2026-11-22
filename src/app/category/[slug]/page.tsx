export { default } from "../../catalogo/[slug]/page";

// Mismos slugs que /catalogo/[slug] para que /category/[slug] también se
// prerenderice y no consuma una función en cada visita.
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
