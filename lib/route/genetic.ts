import { pathLengthKm } from "@/lib/route/distance";
import type { GeneticOptimizeOptions } from "@/lib/route/types";

function createRng(seed = Date.now()): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function orderKey(order: number[]): string {
  return order.join(",");
}

/** Exhaustive best path for tiny sets (n ≤ 7). */
function bruteForceBest(
  indices: number[],
  matrix: number[][]
): { order: number[]; length: number } {
  let best = [...indices];
  let bestLen = pathLengthKm(best, matrix);

  const permute = (start: number) => {
    if (start === indices.length) {
      const len = pathLengthKm(indices, matrix);
      if (len < bestLen) {
        bestLen = len;
        best = [...indices];
      }
      return;
    }
    for (let i = start; i < indices.length; i++) {
      [indices[start], indices[i]] = [indices[i], indices[start]];
      permute(start + 1);
      [indices[start], indices[i]] = [indices[i], indices[start]];
    }
  };

  permute(0);
  return { order: best, length: bestLen };
}

/**
 * Genetic algorithm for open-path TSP (visit each point once, no return).
 * Chromosome = permutation of point indices into the distance matrix.
 */
export function optimizeRouteGenetic(
  pointCount: number,
  matrix: number[][],
  options: GeneticOptimizeOptions = {}
): { order: number[]; lengthKm: number } {
  const indices = Array.from({ length: pointCount }, (_, i) => i);
  if (pointCount <= 1) {
    return { order: indices, lengthKm: 0 };
  }
  if (pointCount <= 7) {
    const exact = bruteForceBest([...indices], matrix);
    return { order: exact.order, lengthKm: exact.length };
  }

  const populationSize = options.populationSize ?? 60;
  const generations = options.generations ?? 120;
  const mutationRate = options.mutationRate ?? 0.2;
  const eliteCount = options.eliteCount ?? 4;
  const rand = createRng(options.seed);

  let population = Array.from({ length: populationSize }, () =>
    shuffle(indices, rand)
  );

  const fitness = (order: number[]) => 1 / (1 + pathLengthKm(order, matrix));

  const tournament = (pool: number[][]): number[] => {
    const a = pool[Math.floor(rand() * pool.length)];
    const b = pool[Math.floor(rand() * pool.length)];
    return fitness(a) >= fitness(b) ? a : b;
  };

  /** Order crossover (OX) */
  const crossover = (p1: number[], p2: number[]): number[] => {
    const n = p1.length;
    let a = Math.floor(rand() * n);
    let b = Math.floor(rand() * n);
    if (a > b) [a, b] = [b, a];
    const child: (number | null)[] = Array(n).fill(null);
    for (let i = a; i <= b; i++) child[i] = p1[i];
    const used = new Set(child.filter((v): v is number => v !== null));
    let fillAt = (b + 1) % n;
    for (let i = 0; i < n; i++) {
      const gene = p2[(b + 1 + i) % n];
      if (used.has(gene)) continue;
      child[fillAt] = gene;
      fillAt = (fillAt + 1) % n;
    }
    return child as number[];
  };

  const mutate = (order: number[]): number[] => {
    if (rand() > mutationRate) return order;
    const next = [...order];
    const i = Math.floor(rand() * next.length);
    const j = Math.floor(rand() * next.length);
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  let best = population[0];
  let bestFit = fitness(best);

  for (const individual of population) {
    const f = fitness(individual);
    if (f > bestFit) {
      best = individual;
      bestFit = f;
    }
  }

  for (let gen = 0; gen < generations; gen++) {
    const ranked = [...population].sort((a, b) => fitness(b) - fitness(a));
    const nextPop: number[][] = ranked.slice(0, eliteCount).map((o) => [...o]);
    const seen = new Set(nextPop.map(orderKey));

    while (nextPop.length < populationSize) {
      const child = mutate(crossover(tournament(ranked), tournament(ranked)));
      const key = orderKey(child);
      if (seen.has(key) && nextPop.length + 5 < populationSize) continue;
      seen.add(key);
      nextPop.push(child);
      const f = fitness(child);
      if (f > bestFit) {
        best = child;
        bestFit = f;
      }
    }
    population = nextPop;
  }

  return { order: best, lengthKm: pathLengthKm(best, matrix) };
}
