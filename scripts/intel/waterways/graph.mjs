// Waterway graph prototype (OFFLINE, experimental).
//
//   npm run waterways:graph
//
// Builds a connectivity graph from the EEC waterway extract:
//   node — waterway endpoint / junction (coordinates snapped to ~55 m grid)
//   edge — connected waterway segment, weighted by lengthKm
//
// Supports: connected/not-connected checks, shortest network path, network
// distance (Dijkstra via graphology-shortest-path). This is a spatial
// relationship tool — NO ecological spread prediction is claimed.
//
// The graph is built in memory from the committed GeoJSON; nothing is
// persisted and no new tables are created.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Graph } from 'graphology';

const require = createRequire(import.meta.url);
const { dijkstra } = require('graphology-shortest-path');

const SNAP = 0.0005; // ~55 m grid — endpoints closer than this are one junction
const features = JSON.parse(readFileSync(join(process.cwd(), 'data', 'eec-waterways.geojson'), 'utf8')).features;

function nodeKey(lon, lat) {
  return `${Math.round(lon / SNAP) * SNAP},${Math.round(lat / SNAP) * SNAP}`;
}

function buildGraph() {
  const graph = new Graph();
  for (const feature of features) {
    const coords = feature.geometry.coordinates;
    if (coords.length < 2) continue;
    const a = nodeKey(coords[0][0], coords[0][1]);
    const b = nodeKey(coords[coords.length - 1][0], coords[coords.length - 1][1]);
    if (a === b) continue; // degenerate loop
    if (!graph.hasNode(a)) graph.addNode(a, { lon: coords[0][0], lat: coords[0][1] });
    if (!graph.hasNode(b)) graph.addNode(b, { lon: coords[coords.length - 1][0], lat: coords[coords.length - 1][1] });
    const weight = feature.properties.lengthKm ?? 0;
    if (graph.hasEdge(a, b)) {
      // parallel segment — keep the shortest connection
      if (graph.getEdgeAttribute(a, b, 'weight') > weight) {
        graph.setEdgeAttribute(a, b, 'weight', weight);
      }
    } else {
      graph.addEdge(a, b, { weight, name: feature.properties.name ?? null });
    }
  }
  return graph;
}

function components(graph) {
  const seen = new Set();
  const sizes = [];
  for (const node of graph.nodes()) {
    if (seen.has(node)) continue;
    const stack = [node];
    seen.add(node);
    let size = 0;
    while (stack.length) {
      const current = stack.pop();
      size += 1;
      for (const neighbor of graph.neighbors(current)) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

function nearestNode(graph, lon, lat) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of graph.nodes()) {
    const attributes = graph.getNodeAttributes(node);
    const dLon = (attributes.lon - lon) * 111.32 * Math.cos(lat * (Math.PI / 180));
    const dLat = (attributes.lat - lat) * 110.57;
    const distance = Math.sqrt(dLon * dLon + dLat * dLat);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node;
    }
  }
  return { node: best, km: bestDistance };
}

async function main() {
  const graph = buildGraph();
  const sizes = components(graph);
  const totalKm = features.reduce((sum, feature) => sum + (feature.properties.lengthKm ?? 0), 0);
  console.log(`graph: ${graph.order} nodes, ${graph.size} edges, ${totalKm.toFixed(0)} km of waterways`);
  console.log(`connected components: ${sizes.length} (largest: ${sizes[0]} nodes = ${((sizes[0] / graph.order) * 100).toFixed(1)}%)`);

  // Demo A — two nodes in the largest component: farthest node from the root
  // via BFS, then a real shortest path with network distance.
  const componentSizes = sizes;
  const largestSize = componentSizes[0];
  const root = [...graph.nodes()].find((node) => graph.getNodeAttributes(node).lon < 101.5);
  const seen = new Set([root]);
  const queue = [root];
  let farthest = root;
  let hops = 0;
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of graph.neighbors(current)) {
      if (!seen.has(neighbor)) {
        seen.add(neighbor);
        queue.push(neighbor);
        hops += 1;
        if (seen.size <= largestSize) farthest = neighbor;
      }
    }
  }
  const path = dijkstra.bidirectional(graph, root, farthest, { weight: 'weight' });
  if (path) {
    const distance = path.slice(1).reduce((sum, node, index) => {
      return sum + (graph.getEdgeAttribute(path[index], node, 'weight') ?? 0);
    }, 0);
    console.log(`demo A (largest component, ${largestSize} nodes): ${root} → ${farthest} — ${path.length} nodes, ${distance.toFixed(1)} km network distance`);
  } else {
    console.log('demo A: not connected');
  }

  // Demo B — cross-region synthetic points (Bang Pakong → Rayong): expected
  // NOT connected, demonstrating the connected/not-connected determination.
  const from = nearestNode(graph, 101.05, 13.6); // upper Bang Pakong, Chachoengsao
  const to = nearestNode(graph, 101.2, 12.8); // Rayong canal network
  const cross = dijkstra.bidirectional(graph, from.node, to.node, { weight: 'weight' });
  console.log(`demo B (Bang Pakong → Rayong): ${cross ? `connected, ${cross.length} nodes` : 'not connected'}`);
}

main().catch((error) => {
  console.error('graph failed:', error);
  process.exitCode = 1;
});
