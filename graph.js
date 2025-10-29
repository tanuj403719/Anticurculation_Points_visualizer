// graph.js
// Graph model + Tarjan's algorithm for articulation points, bridges and vertex-biconnected components

class Graph {
  constructor() {
    this.nodes = []; // {id, x, y}
    this.adj = new Map(); // id -> Set(neighborId)
    this.nextId = 0;
    // edgeMap: key -> {a,b,directed}
    // key is `${a}-${b}` for undirected (with a<=b), or `${a}>${b}` for directed
    this.edgeMap = new Map();
  }

  addNode(x = 100, y = 100) {
    const id = this.nextId++;
    this.nodes.push({ id, x, y });
    this.adj.set(id, new Set());
    return id;
  }

  addEdge(a, b, directed = false) {
    if (a === b) return false;
    if (directed) {
      const key = `${a}>${b}`;
      if (this.edgeMap.has(key)) return false;
      this.edgeMap.set(key, { a, b, directed: true });
      // for analysis we keep adjacency undirected (treat as undirected)
      this.adj.get(a).add(b);
      this.adj.get(b).add(a);
      return true;
    } else {
      const u = Math.min(a, b);
      const v = Math.max(a, b);
      const key = `${u}-${v}`;
      if (this.edgeMap.has(key)) return false;
      this.edgeMap.set(key, { a: u, b: v, directed: false });
      this.adj.get(a).add(b);
      this.adj.get(b).add(a);
      return true;
    }
  }

  deleteEdge(a, b, directed = false) {
    if (directed) {
      const key = `${a}>${b}`;
      if (!this.edgeMap.has(key)) return false;
      this.edgeMap.delete(key);
      // remove adjacency both ways
      this.adj.get(a).delete(b);
      this.adj.get(b).delete(a);
      return true;
    } else {
      const u = Math.min(a, b);
      const v = Math.max(a, b);
      const key = `${u}-${v}`;
      if (!this.edgeMap.has(key)) return false;
      this.edgeMap.delete(key);
      this.adj.get(a).delete(b);
      this.adj.get(b).delete(a);
      return true;
    }
  }

  deleteEdgeByKey(key){
    if (!this.edgeMap.has(key)) return false;
    const e = this.edgeMap.get(key);
    this.edgeMap.delete(key);
    if (this.adj.has(e.a)) this.adj.get(e.a).delete(e.b);
    if (this.adj.has(e.b)) this.adj.get(e.b).delete(e.a);
    return true;
  }

  // Delete a node and all incident edges
  deleteNode(id) {
    // remove node object
    this.nodes = this.nodes.filter(n => n.id !== id);
    // remove adj entry and remove id from neighbors' sets
    if (this.adj.has(id)) {
      const neigh = Array.from(this.adj.get(id));
      for (const v of neigh) {
        if (this.adj.has(v)) this.adj.get(v).delete(id);
      }
      this.adj.delete(id);
    }
    // remove from any neighbor sets (in case id had no adj entry)
    for (const [k, s] of this.adj.entries()) {
      if (s.has(id)) s.delete(id);
    }
    // remove edges involving this node
    const keysToRemove = [];
    for (const [k, e] of this.edgeMap.entries()) {
      if (e.a === id || e.b === id) keysToRemove.push(k);
    }
    for (const k of keysToRemove) this.edgeMap.delete(k);
    return true;
  }

  // Rename a node id across nodes list, adjacency and edges.
  // newId must be an integer not already used.
  renameNode(oldId, newId) {
    if (oldId === newId) return true;
    if (this.nodes.some(n => n.id === newId)) return false; // conflict
    // update nodes array
    for (const n of this.nodes) if (n.id === oldId) n.id = newId;
    // update adj map: move old entry to new key
    const oldNeighbors = this.adj.get(oldId) || new Set();
    this.adj.delete(oldId);
    this.adj.set(newId, new Set(Array.from(oldNeighbors)));
    // update neighbors' sets to replace oldId with newId
    for (const [k, s] of this.adj.entries()) {
      if (k === newId) continue;
      if (s.has(oldId)) {
        s.delete(oldId);
        s.add(newId);
      }
    }
    // update edgeMap: rebuild keys and edge objects
    const newEdgeMap = new Map();
    for (const [k, e] of this.edgeMap.entries()) {
      let a = e.a; let b = e.b; let directed = !!e.directed;
      if (a === oldId) a = newId;
      if (b === oldId) b = newId;
      if (directed) {
        const key = `${a}>${b}`;
        newEdgeMap.set(key, { a, b, directed: true });
      } else {
        const u = Math.min(a, b);
        const v = Math.max(a, b);
        const key = `${u}-${v}`;
        newEdgeMap.set(key, { a: u, b: v, directed: false });
      }
    }
    this.edgeMap = newEdgeMap;
    // ensure nextId is ahead of any renamed id to avoid future conflicts
    if (typeof this.nextId === 'number') this.nextId = Math.max(this.nextId, newId + 1);
    return true;
  }

  clear() {
    this.nodes = [];
    this.adj = new Map();
    this.nextId = 0;
    this.edgeMap.clear();
  }

  // Return edge key normalized
  edgeKey(a, b) {
    const u = Math.min(a, b);
    const v = Math.max(a, b);
    return `${u}-${v}`;
  }

  // Tarjan: articulation points, bridges, vertex-biconnected components (blocks)
  analyze() {
    const n = this.nodes.length;
    const disc = new Array(this.nextId).fill(-1);
    const low = new Array(this.nextId).fill(0);
    const parent = new Array(this.nextId).fill(-1);
    const ap = new Set();
    const bridges = [];
    const components = [];
    const edgeStack = [];
    let time = 0;

    const nodesPresent = new Set(this.nodes.map((s) => s.id));

    const dfs = (u) => {
      disc[u] = low[u] = ++time;
      let children = 0;
      const neighbors = this.adj.get(u) || new Set();
      for (const v of neighbors) {
        if (!nodesPresent.has(v)) continue;
        if (disc[v] === -1) {
          parent[v] = u;
          children++;
          edgeStack.push([u, v]);
          dfs(v);
          low[u] = Math.min(low[u], low[v]);

          // articulation
          if (parent[u] === -1 && children > 1) ap.add(u);
          if (parent[u] !== -1 && low[v] >= disc[u]) ap.add(u);

          // bridge
          if (low[v] > disc[u]) {
            bridges.push([u, v]);
          }

          // Form a biconnected component when low[v] >= disc[u]
          if (low[v] >= disc[u]) {
            const compEdges = [];
            const compVerts = new Set();
            while (edgeStack.length) {
              const e = edgeStack.pop();
              compEdges.push(e);
              compVerts.add(e[0]);
              compVerts.add(e[1]);
              if ((e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) break;
            }
            if (compEdges.length) components.push({ edges: compEdges, verts: Array.from(compVerts) });
          }
        } else if (v !== parent[u] && disc[v] < disc[u]) {
          // back edge to ancestor
          edgeStack.push([u, v]);
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };

    for (const node of this.nodes) {
      if (disc[node.id] === -1) {
        dfs(node.id);
        // after finishing a component root, any remaining edges form a component
        if (edgeStack.length) {
          const compEdges = [];
          const compVerts = new Set();
          while (edgeStack.length) {
            const e = edgeStack.pop();
            compEdges.push(e);
            compVerts.add(e[0]);
            compVerts.add(e[1]);
          }
          if (compEdges.length) components.push({ edges: compEdges, verts: Array.from(compVerts) });
        }
      }
    }

    // Build edge -> component index map
    const edgeToComp = new Map();
    components.forEach((c, idx) => {
      for (const e of c.edges) {
        edgeToComp.set(this.edgeKey(e[0], e[1]), idx);
      }
    });

    return {
      articulationPoints: Array.from(ap),
      bridges,
      components,
      edgeToComp,
    };
  }

  // Run Tarjan but also return a sequence of steps for visualization.
  analyzeWithSteps() {
    const steps = [];
    const n = this.nodes.length;
    const disc = new Array(this.nextId).fill(-1);
    const low = new Array(this.nextId).fill(0);
    const parent = new Array(this.nextId).fill(-1);
    const ap = new Set();
    const bridges = [];
    const components = [];
    const edgeStack = [];
    let time = 0;

    const nodesPresent = new Set(this.nodes.map((s) => s.id));

    const pushStep = (step) => steps.push(step);

    const dfs = (u) => {
      disc[u] = low[u] = ++time;
      pushStep({type:'visit', u, disc: disc[u], low: low[u]});
      let children = 0;
      const neighbors = this.adj.get(u) || new Set();
      for (const v of neighbors) {
        if (!nodesPresent.has(v)) continue;
        if (disc[v] === -1) {
          parent[v] = u;
          children++;
          edgeStack.push([u, v]);
          pushStep({type:'pushEdge', u, v});
          dfs(v);
          low[u] = Math.min(low[u], low[v]);
          pushStep({type:'updateLow', u, low: low[u], child: v});

          if (parent[u] === -1 && children > 1) { ap.add(u); pushStep({type:'markAP', u}); }
          if (parent[u] !== -1 && low[v] >= disc[u]) { ap.add(u); pushStep({type:'markAP', u}); }

          if (low[v] > disc[u]) { bridges.push([u, v]); pushStep({type:'markBridge', u, v}); }

          if (low[v] >= disc[u]) {
            const compEdges = [];
            const compVerts = new Set();
            while (edgeStack.length) {
              const e = edgeStack.pop();
              compEdges.push(e);
              compVerts.add(e[0]);
              compVerts.add(e[1]);
              if ((e[0] === u && e[1] === v) || (e[0] === v && e[1] === u)) break;
            }
            if (compEdges.length) {
              const idx = components.length;
              components.push({ edges: compEdges, verts: Array.from(compVerts) });
              pushStep({type:'popComponent', compIndex: idx, edges: compEdges.map(e=>[e[0],e[1]]), verts: Array.from(compVerts)});
            }
          }
        } else if (v !== parent[u] && disc[v] < disc[u]) {
          edgeStack.push([u, v]);
          pushStep({type:'pushEdge', u, v, back:true});
          low[u] = Math.min(low[u], disc[v]);
          pushStep({type:'updateLow', u, low: low[u], backTo: v});
        }
      }
    };

    for (const node of this.nodes) {
      if (disc[node.id] === -1) {
        dfs(node.id);
        if (edgeStack.length) {
          const compEdges = [];
          const compVerts = new Set();
          while (edgeStack.length) {
            const e = edgeStack.pop();
            compEdges.push(e);
            compVerts.add(e[0]);
            compVerts.add(e[1]);
          }
          if (compEdges.length) {
            const idx = components.length;
            components.push({ edges: compEdges, verts: Array.from(compVerts) });
            pushStep({type:'popComponent', compIndex: idx, edges: compEdges.map(e=>[e[0],e[1]]), verts: Array.from(compVerts)});
          }
        }
      }
    }

    // Build edge -> component index map
    const edgeToComp = new Map();
    components.forEach((c, idx) => {
      for (const e of c.edges) {
        edgeToComp.set(this.edgeKey(e[0], e[1]), idx);
      }
    });

    const result = {
      articulationPoints: Array.from(ap),
      bridges,
      components,
      edgeToComp,
    };

    return { result, steps };
  }

  toJSON() {
    // export edges as objects including directed flag
    const edges = Array.from(this.edgeMap.entries()).map(([k,e]) => ({a:e.a,b:e.b,directed:!!e.directed,key:k}));
    return JSON.stringify({ nodes: this.nodes, edges });
  }

  static fromJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const g = new Graph();
    // reset
    g.clear();
    // add nodes with original ids mapping
    const mapping = new Map();
    for (const nd of data.nodes) {
      const id = g.addNode(nd.x, nd.y);
      mapping.set(nd.id, id);
    }
    // add edges by mapping ids
    for (const e of data.edges) {
      const aOld = e.a; const bOld = e.b; const directed = !!e.directed;
      const a = mapping.get(aOld); const b = mapping.get(bOld);
      if (a !== undefined && b !== undefined) g.addEdge(a, b, directed);
    }
    return g;
  }

  // simple auto-layout (circular)
  autoLayout(cx = 450, cy = 300, radius = 200) {
    const k = this.nodes.length;
    for (let i = 0; i < k; i++) {
      const angle = (2 * Math.PI * i) / k;
      this.nodes[i].x = cx + radius * Math.cos(angle);
      this.nodes[i].y = cy + radius * Math.sin(angle);
    }
  }

  // create a random graph (n nodes, p probability edge)
  static randomGraph(n = 8, p = 0.3) {
    const g = new Graph();
    for (let i = 0; i < n; i++) g.addNode();
    // random positions
    g.nodes.forEach((nd, i) => {
      nd.x = 150 + Math.random() * 600;
      nd.y = 80 + Math.random() * 420;
    });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.random() < p) g.addEdge(i, j, false);
    return g;
  }
}

// Expose Graph for app.js
if (typeof window !== 'undefined') window.Graph = Graph;
