import EventoClient from "./EventoClient";

// Slugs de eventos conocidos: prerenderizados y servidos desde el CDN.
// Antes cada visita a /evento/[slug] costaba ~70ms de CPU en una función.
const KNOWN_EVENT_SLUGS = [
  "dia-de-la-novia",
  "dia-de-la-mujer",
  "san-valentin",
  "dia-de-la-madre",
  "flores-amarillas",
  "personalizados",
  "hotwheels",
];

export function generateStaticParams() {
  return KNOWN_EVENT_SLUGS.map((slug) => ({ slug }));
}

export default async function EventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventoClient slug={slug} />;
}
