import { getVentifyProducts, Product } from "./ventify";

let cache: Product[] | null = null;
let promise: Promise<void> | null = null;

function filterExtras(allProducts: Product[]): Product[] {
  return allProducts.filter(
    (p) =>
      p.categoriaOriginal?.toLowerCase().includes("extras") ||
      p.sku.startsWith("Extra-")
  );
}

export function seedExtrasFromProducts(allProducts: Product[]): void {
  if (!cache && allProducts.length > 0) {
    cache = filterExtras(allProducts);
  }
}

export function loadExtras(callback: (extras: Product[]) => void): void {
  if (cache) {
    callback(cache);
    return;
  }
  if (promise) {
    promise.then(() => {
      if (cache) callback(cache);
    });
    return;
  }
  promise = getVentifyProducts().then((allProducts) => {
    cache = filterExtras(allProducts);
    callback(cache);
  });
}
