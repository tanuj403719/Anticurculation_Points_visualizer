// app.js - UI wiring and SVG rendering

const svg = document.getElementById('svg');
const clearBtn = document.getElementById('clearBtn');
const randomBtn = document.getElementById('randomBtn');
const runBtn = document.getElementById('runBtn');
const layoutBtn = document.getElementById('layoutBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const playBtn = document.getElementById('playBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const stepModeCheck = document.getElementById('stepMode');
const speedRange = document.getElementById('speed');
const status = document.getElementById('status');
const numNodesInput = document.getElementById('numNodes');
const componentsList = document.getElementById('componentsList');
const deleteBtn = document.getElementById('deleteBtn');
const renameBtn = document.getElementById('renameBtn');

let graph = new Graph();
let selected = null;
let nodeMap = new Map(); // id -> node object for quick lookup

// stepper state
let currentSteps = [];
let currentResult = null;
let stepIndex = -1;
let playInterval = null;
let compColors = [];

function setStatus(s){ status.textContent = s }

function render(result = null) {
  // clear
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // draw edges
  // draw edges (iterate edgeMap created in Graph)
  for (const [key, e] of graph.edgeMap.entries()) {
    const a = e.a; const b = e.b;
    const na = nodeMap.get(a) || graph.nodes.find(n => n.id === a);
    const nb = nodeMap.get(b) || graph.nodes.find(n => n.id === b);
    if (!na || !nb) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', na.x);
    line.setAttribute('y1', na.y);
    line.setAttribute('x2', nb.x);
    line.setAttribute('y2', nb.y);
    line.dataset.key = key;
    line.classList.add('edge');
    if (result) {
      const ek = graph.edgeKey(a,b);
      if (result.bridges.some(ed => (ed[0]===a && ed[1]===b) || (ed[0]===b && ed[1]===a))) {
        line.classList.add('bridge');
      } else {
        // non-bridge edges: keep default styling (black via CSS)
      }
    }
    svg.appendChild(line);
  }

  // draw nodes
  for (const n of graph.nodes) {
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', n.x);
    c.setAttribute('cy', n.y);
    c.setAttribute('r', 16);
    c.classList.add('node');
    c.dataset.id = n.id;
    if (result && result.articulationPoints.includes(n.id)) c.classList.add('art');

    c.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selected == null) {
        // select this node
        // remove previous selected visual if any
        const prev = svg.querySelector(`circle.node[data-id="${selected}"]`);
        if (prev) prev.classList.remove('selected');
        selected = n.id; c.classList.add('selected');
      } else if (selected === n.id) {
        // deselect
        selected = null; c.classList.remove('selected');
      } else {
        // add edge between previously selected and this
        graph.addEdge(selected, n.id);
        // clear selection visual
        const prev = svg.querySelector(`circle.node[data-id="${selected}"]`);
        if (prev) prev.classList.remove('selected');
        selected = null; render(result);
      }
    });

    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', n.x);
    t.setAttribute('y', n.y+4);
    t.setAttribute('text-anchor','middle');
    t.classList.add('nlabel');
    t.textContent = n.id;

    g.appendChild(c);
    g.appendChild(t);
    svg.appendChild(g);
    nodeMap.set(n.id, n);
  }

  // components list
  componentsList.innerHTML = '';
  if (result) {
    result.components.forEach((comp, idx) => {
      const div = document.createElement('div');
      const sw = document.createElement('span');
      sw.classList.add('comp-bullet');
      sw.style.background = colorForIndex(idx);
      div.appendChild(sw);
      const txt = document.createElement('span');
      txt.textContent = `Component ${idx}: verts=${comp.verts.join(', ')}`;
      div.appendChild(txt);
      componentsList.appendChild(div);
    });
  }
}

function colorForIndex(i) {
  const palette = [
    '#7b9ea8','#b69cc3','#9fbfa6','#e6b6b6','#e6d3b3','#9fc6cf','#f3caa1','#d8c6e8','#d99b9b'
  ];
  return palette[i % palette.length];
}

// controls
clearBtn.addEventListener('click', () => {
  graph.clear();
  selected = null;
  setStatus('Cleared');
  render();
});

// Delete selected node
deleteBtn.addEventListener('click', () => {
  if (selected == null) { setStatus('No node selected to delete'); return; }
  const ok = confirm(`Delete node ${selected} and all incident edges?`);
  if (!ok) return;
  graph.deleteNode(selected);
  selected = null; nodeMap.clear(); render(); setStatus('Node deleted');
});

// Rename selected node
renameBtn.addEventListener('click', () => {
  if (selected == null) { setStatus('No node selected to rename'); return; }
  const s = prompt('Enter new node id (integer):', String(selected));
  if (s === null) return;
  const newId = parseInt(s);
  if (Number.isNaN(newId)) { setStatus('Invalid id'); return; }
  const ok = graph.renameNode(selected, newId);
  if (!ok) { setStatus('Rename failed (id conflict)'); return; }
  // update selection and re-render
  selected = newId; nodeMap.clear(); render(); setStatus(`Renamed node to ${newId}`);
});

randomBtn.addEventListener('click', () => {
  const n = parseInt(numNodesInput.value) || 8;
  graph = Graph.randomGraph(n, 0.28);
  nodeMap.clear();
  setStatus('Random graph created');
  render();
});

// Export / Import
exportBtn.addEventListener('click', () => {
  const data = graph.toJSON();
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'graph.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  setStatus('Exported graph.json');
});

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (evt) => {
  const f = evt.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const g = Graph.fromJSON(ev.target.result);
      graph = g; nodeMap.clear(); render(); setStatus('Imported JSON');
    } catch (e) { setStatus('Import failed'); }
  };
  reader.readAsText(f);
});

runBtn.addEventListener('click', () => {
  if (stepModeCheck.checked) {
    const { result, steps } = graph.analyzeWithSteps();
    currentResult = result;
    currentSteps = steps;
    stepIndex = -1;
    compColors = [];
    // enable controls
    const hasSteps = Array.isArray(steps) && steps.length > 0;
    playBtn.disabled = !hasSteps; nextBtn.disabled = !hasSteps; prevBtn.disabled = !hasSteps;
    setStatus(hasSteps ? `Prepared ${steps.length} steps — use Play/Next` : 'No steps produced (empty graph?)');
    render(result);
    renderStepsPanel();
    if (hasSteps) {
      // start playback automatically so user sees the steps
      startPlayback();
    }
  } else {
    const res = graph.analyze();
    setStatus(`APs=${res.articulationPoints.length}, Bridges=${res.bridges.length}, Comps=${res.components.length}`);
    render(res);
    // Also prepare steps for inspection even when not in step mode (show steps panel)
    const { result: stepResult, steps } = graph.analyzeWithSteps();
    currentResult = stepResult;
    currentSteps = steps || [];
    stepIndex = -1;
    const hasSteps = Array.isArray(currentSteps) && currentSteps.length > 0;
    playBtn.disabled = !hasSteps; nextBtn.disabled = !hasSteps; prevBtn.disabled = !hasSteps;
    renderStepsPanel();
  }
});

// Stepper controls
nextBtn.addEventListener('click', () => stepNext());
prevBtn.addEventListener('click', () => stepPrev());
playBtn.addEventListener('click', () => {
  if (!currentSteps || currentSteps.length === 0) { setStatus('No prepared steps — check Step mode and Run Analysis'); return; }
  if (playInterval) { stopPlayback(); return; }
  startPlayback();
});

function startPlayback() {
  if (!currentSteps || currentSteps.length === 0) return;
  if (stepIndex >= currentSteps.length - 1) stepIndex = -1;
  // The slider value represents "speed" (higher = faster). Map it to an interval delay
  // so that larger speed values produce smaller delays.
  const minVal = parseInt(speedRange.min) || 100;
  const maxVal = parseInt(speedRange.max) || 2000;
  const speedVal = parseInt(speedRange.value) || 600;
  // Invert mapping: delay = maxVal + minVal - speedVal
  const delay = Math.max(10, Math.round(maxVal + minVal - speedVal));
  playInterval = setInterval(() => {
    const more = stepNext();
    if (!more) stopPlayback();
  }, delay);
  playBtn.textContent = 'Pause';
  playBtn.disabled = false;
}

// If user adjusts speed while playing, restart interval with new delay
speedRange.addEventListener('input', () => {
  if (playInterval) {
    stopPlayback();
    startPlayback();
  }
});

function stopPlayback() {
  if (playInterval) { clearInterval(playInterval); playInterval = null; }
  playBtn.textContent = 'Play';
}

function resetStepperView() {
  // reset coloring/marks
  compColors = [];
}

function stepNext() {
  if (!currentSteps || stepIndex >= currentSteps.length - 1) return false;
  stepIndex++;
  applyStepsUpTo(stepIndex);
  return stepIndex < currentSteps.length - 1;
}

function stepPrev() {
  if (!currentSteps || stepIndex <= -1) return false;
  stepIndex--;
  applyStepsUpTo(stepIndex);
  return stepIndex >= 0;
}

function applyStepsUpTo(idx) {
  // We'll reconstruct visible state by replaying from scratch up to idx.
  // Visible state: highlight current visited node, show pushed edges (in a set), color formed components permanently.
  const pushedEdges = new Set();
  const formedComps = [];
  const aps = new Set();
  const bridges = [];
  let currentVisit = null;
  const visitedNodes = new Set();
  for (let i = 0; i <= idx; i++) {
    const s = currentSteps[i];
    if (!s) continue;
    if (s.type === 'visit') { currentVisit = s.u; }
    if (s.type === 'visit') visitedNodes.add(s.u);
    else if (s.type === 'pushEdge') { pushedEdges.add(graph.edgeKey(s.u, s.v)); }
    else if (s.type === 'updateLow') { /* ignore for now */ }
    else if (s.type === 'markAP') { aps.add(s.u); }
    else if (s.type === 'markBridge') { bridges.push([s.u, s.v]); }
    else if (s.type === 'popComponent') {
      const color = colorForIndex(formedComps.length);
      formedComps.push({ idx: s.compIndex, edges: s.edges.map(e=>graph.edgeKey(e[0],e[1])), color });
    }
  }

  // Build a transient result object to pass to render
  const transient = {
    articulationPoints: Array.from(aps),
    bridges,
    components: formedComps.map((c,i)=>({ edges: c.edges.map(k=>k.split('-').map(x=>parseInt(x))), verts: [] })),
    edgeToComp: new Map(formedComps.flatMap((c, i) => c.edges.map(e => [e, i]))),
  };
  // Render and overlay highlights for pushed edges and current visit
  render(transient);
  // overlay pushed edges thicker
  for (const key of pushedEdges) {
    for (const line of svg.querySelectorAll('line')) {
      const a = parseInt(line.getAttribute('x1'));
    }
  }
  // highlight pushed edges by stroke-dasharray
  svg.querySelectorAll('line').forEach(l => {
    const x1 = parseFloat(l.getAttribute('x1'));
    const y1 = parseFloat(l.getAttribute('y1'));
    const x2 = parseFloat(l.getAttribute('x2'));
    const y2 = parseFloat(l.getAttribute('y2'));
    // find edge key by mapping endpoints from nodeMap positions
    const a = findNearestNodeId(x1, y1);
    const b = findNearestNodeId(x2, y2);
    const k = graph.edgeKey(a,b);
    if (pushedEdges.has(k)) { l.style.strokeDasharray = '6 4'; l.style.strokeWidth = '3'; }
    else { l.style.strokeDasharray = ''; }
    // keep non-bridge edges black; bridges already have .bridge class
    // toggle instack class for darker visualization steps
    if (pushedEdges.has(k)) l.classList.add('instack'); else l.classList.remove('instack');
  });

  // highlight current visiting node
  svg.querySelectorAll('circle.node').forEach(c => {
    const id = parseInt(c.dataset.id);
    c.classList.remove('current');
    c.classList.remove('step');
    if (visitedNodes.has(id)) c.classList.add('step');
    if (id === currentVisit) { c.classList.add('current'); }
  });

  setStatus(`Step ${Math.max(0, stepIndex+1)}/${currentSteps.length}`);
  // update steps panel highlight
  renderStepsPanel();
}

function findNearestNodeId(x, y) {
  // simple nearest by coordinates (works for our static layout)
  let best = null; let bestd = Infinity;
  for (const n of graph.nodes) {
    const dx = n.x - x; const dy = n.y - y; const d = dx*dx+dy*dy;
    if (d < bestd) { bestd = d; best = n.id; }
  }
  return best;
}

// --- Steps panel rendering & interactivity ---
const stepsPanel = document.getElementById('stepsPanel');
function formatStep(s, i){
  if (!s) return '';
  switch(s.type){
    case 'visit': return `visit ${s.u} (disc=${s.disc || ''} low=${s.low || ''})`;
    case 'pushEdge': return `push edge ${s.u}-${s.v}${s.back? ' (back)':''}`;
    case 'updateLow': return `update low[${s.u}] = ${s.low} ${s.child?('from child '+s.child):s.backTo?('from '+s.backTo):''}`;
    case 'markAP': return `mark articulation point ${s.u}`;
    case 'markBridge': return `mark bridge ${s.u}-${s.v}`;
    case 'popComponent': return `pop component ${s.compIndex}: verts=${(s.verts||[]).join(', ')}`;
    default: return JSON.stringify(s);
  }
}

function renderStepsPanel(){
  if (!stepsPanel) return;
  stepsPanel.innerHTML = '';
  if (!currentSteps || currentSteps.length === 0) return;
  for (let i = 0; i < currentSteps.length; i++){
    const s = currentSteps[i];
    const div = document.createElement('div');
    div.className = 'step-entry';
    if (i === stepIndex) div.classList.add('current');
    div.dataset.idx = i;
    div.innerHTML = `<div>${i+1}. ${escapeHtml(formatStep(s,i))}</div>`;
    div.addEventListener('click', () => {
      stepIndex = i; applyStepsUpTo(stepIndex);
    });
    stepsPanel.appendChild(div);
  }
  // scroll to current
  const cur = stepsPanel.querySelector('.step-entry.current');
  if (cur) cur.scrollIntoView({behavior:'smooth',block:'center'});
}

function escapeHtml(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// add node on click
svg.addEventListener('click', (e) => {
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const id = graph.addNode(x, y);
  setStatus(`Added node ${id}`);
  render();
});

// keyboard delete for selected node
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected != null) {
    const ok = confirm(`Delete node ${selected} and all incident edges?`);
    if (!ok) return;
    graph.deleteNode(selected);
    selected = null; nodeMap.clear(); render(); setStatus('Node deleted');
  }
});

// initial sample
graph = Graph.randomGraph(8,0.28);
graph.autoLayout();
nodeMap.clear(); render();
