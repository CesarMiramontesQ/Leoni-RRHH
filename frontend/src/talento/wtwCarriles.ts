/**
 * Reparto de career levels en carriles para el mapa WTW.
 *
 * Cada nivel ocupa un tramo del eje de global grades, y dos niveles del **mismo
 * career path pueden solaparse**: el modelo lo permite desde que un nivel abarca
 * varios grades, y no se prohibió. Dibujados en una sola fila se pisarían y el
 * gráfico diría algo falso, así que se reparten en carriles.
 *
 * El empaquetado es greedy y estable: los niveles se recorren ya ordenados y
 * cada uno entra en el primer carril donde no choque. Con un catálogo sano
 * —niveles consecutivos que no se solapan— sale un solo carril por path, que es
 * como se lee la lámina de Towers.
 */

export type TramoLike = {
  posicion_desde: number;
  posicion_hasta: number;
};

function seSolapan(a: TramoLike, b: TramoLike): boolean {
  return a.posicion_desde <= b.posicion_hasta && b.posicion_desde <= a.posicion_hasta;
}

export function repartirEnCarriles<T extends TramoLike>(niveles: T[]): T[][] {
  const carriles: T[][] = [];
  for (const nivel of niveles) {
    const carril = carriles.find((c) => !c.some((otro) => seSolapan(otro, nivel)));
    if (carril) {
      carril.push(nivel);
    } else {
      carriles.push([nivel]);
    }
  }
  return carriles;
}
