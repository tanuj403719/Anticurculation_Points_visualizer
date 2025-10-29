# Biconnected Components Visualizer

This is a small static web app that visualizes articulation points, bridges, and vertex-biconnected components using a DFS (Tarjan) algorithm.

How to use

- Open `index.html` in your browser (no server required).
- Click on the SVG canvas to add nodes. Click one node then another to add an edge.
- Use `Random Graph` to generate a sample graph. Use `Run Analysis` to compute articulation points and bridges.
- Articulation points are highlighted. Bridges are shown in red. Edge colors indicate which biconnected component they belong to.

Files

- `index.html` — UI and layout
- `style.css` — minimal styling
- `graph.js` — Graph model and Tarjan algorithm
- `app.js` — UI wiring and SVG rendering

Notes

- This is a simple educational tool. It currently computes vertex-biconnected components (blocks) using an edge stack. It doesn't persist graphs.
# Anticurculation_Points_visualizer