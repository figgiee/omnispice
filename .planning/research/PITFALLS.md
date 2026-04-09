# Domain Pitfalls

**Domain:** Web-based SPICE circuit simulator (educational)
**Researched:** 2026-04-09

---

## Critical Pitfalls

Mistakes that cause rewrites, credibility loss, or project failure.

### Pitfall 1: WASM Memory Growth Causes Silent Crashes on Complex Simulations

**What goes wrong:** ngspice-wasm runs inside Emscripten's linear memory, which defaults to a small initial heap. When students simulate circuits with many nodes (op-amp cascades, multi-stage amplifiers), memory grows dynamically. If `ALLOW_MEMORY_GROWTH` is enabled, every heap access goes through `GROWABLE_HEAP_*` wrappers that add measurable overhead. If it is NOT enabled, the simulation silently crashes or throws a cryptic `memory access out of bounds` error when it exceeds the initial allocation.

**Why it happens:** Developers test with simple RC/RLC circuits during development. Real university assignments involve 50-200 node circuits with BSIM4 MOSFET models that consume significantly more memory than toy examples.

**Consequences:** Students lose trust immediately. "It crashes on my homework circuit" is a death sentence for university adoption. Professors will revert to LTspice within one bad assignment cycle.

**Prevention:**
- Set `INITIAL_MEMORY` to 256MB and `ALLOW_MEMORY_GROWTH=1` with `MAXIMUM_MEMORY=2GB` from day one.
- Implement a memory usage monitor that warns users at 70% consumption before crashes occur.
- Test with the largest circuits professors would assign (full CMOS differential amplifier with biasing, 100+ nodes) during every CI run.
- Pre-allocate memory pools for common simulation sizes to reduce growth events.

**Detection:** Users report "simulation failed" with no error message. Memory usage spikes in browser DevTools. Works on desktop Chrome but fails on Chromebooks (less RAM).

**Phase:** Must be addressed in Phase 1 (WASM integration). Non-negotiable for any simulation to be trusted.

**Confidence:** HIGH -- Emscripten documentation explicitly warns about memory growth overhead and the pthreads+growth interaction.

---

### Pitfall 2: Cross-Origin Isolation Breaks Third-Party Embeds and OAuth

**What goes wrong:** If you want WASM threading (SharedArrayBuffer for parallel simulation), the page must set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This breaks: OAuth popup flows, third-party iframe embeds (LMS integration), analytics scripts, CDN-loaded fonts/images without CORS headers, and payment provider widgets.

**Why it happens:** Developers enable COOP/COEP to get SharedArrayBuffer working, then discover weeks later that Canvas LMS integration or Google OAuth is broken. The headers are all-or-nothing at the page level.

**Consequences:** You either get multi-threaded WASM (faster simulations) or you get LMS integration and OAuth. Choosing wrong means an architecture rewrite.

**Prevention:**
- Do NOT use SharedArrayBuffer/threading in Phase 1. ngspice single-threaded performance is adequate for undergrad circuits. OpenMP is not supported in Emscripten WASM anyway.
- If threading is needed later, isolate the simulation into a separate origin (subdomain) loaded via iframe, keeping the main app free of COOP/COEP restrictions.
- Alternatively, use `credentialless` COEP mode (Chrome 96+), but this is NOT supported in Firefox/Safari as of early 2026.
- Design the architecture from day one assuming the WASM worker runs in an iframe or dedicated Worker without SharedArrayBuffer.

**Detection:** OAuth login fails silently. LMS embed shows blank page. Third-party scripts throw CORS errors in console.

**Phase:** Architecture decision in Phase 1. Must be decided before any deployment infrastructure is built. Revisit only if simulation performance is proven insufficient for target circuits.

**Confidence:** HIGH -- web.dev documentation explicitly describes this tradeoff, and multiple projects have hit it.

---

### Pitfall 3: ngspice Convergence Failures Presented as Application Bugs

**What goes wrong:** Students build circuits with floating nodes, missing ground connections, ideal voltage source loops, or parallel inductors. ngspice correctly fails to converge, but the error message is `"singular matrix: check node 7"` or `"doAnalyses: Too many iterations without convergence"`. Students (and professors) interpret this as the simulator being broken, not the circuit being wrong.

**Why it happens:** LTspice users are accustomed to the same errors but blame LTspice less because it is "the standard." A new tool gets zero grace period -- any error is assumed to be a bug in OmniSpice rather than the student's circuit.

**Consequences:** This is the single biggest credibility risk. One professor who encounters unexplained convergence failures during a live lecture demo will never use the tool again. Word of mouth in EE departments is small and fast.

**Prevention:**
- Build a convergence error interpreter that maps ngspice error codes to human-readable explanations: "Node 7 (labeled 'Vout') has no DC path to ground. Try adding a large resistor (1M ohm) from Vout to ground."
- Implement pre-simulation validation that catches common mistakes before ngspice even runs: floating nodes, voltage source loops, missing ground, inductor loops without resistance.
- Add "Fix it for me" suggestions: auto-insert parasitic resistances that ngspice would need anyway.
- Build a curated test suite of 50+ "circuits students commonly get wrong" and verify OmniSpice produces helpful errors for each.

**Detection:** Support tickets saying "simulation doesn't work." Error messages containing raw ngspice output visible to users.

**Phase:** Phase 1-2. Pre-simulation validation in Phase 1 (schematic editor knows the topology). Error translation in Phase 2 (after WASM integration is stable). This is a continuous improvement area.

**Confidence:** HIGH -- ngspice forums are dominated by convergence questions. This is the #1 ngspice user pain point across all platforms.

---

### Pitfall 4: Over-Engineering Before Professor Validation

**What goes wrong:** Team spends 6+ months building real-time collaboration, guided labs, LMS integration, and Circuit Insights before a single professor has used the basic simulator in a real class. Then discovers professors actually need: (a) the ability to import their existing LTspice netlists, (b) specific component models they already use, and (c) grade export in a specific CSV format their department requires. None of which were built.

**Why it happens:** Engineering teams build what is technically interesting (CRDTs, AI insights) rather than what professors actually need to switch tools. EdTech adoption research consistently shows that "lack of educator involvement in development" is the top reason tools fail to gain traction.

**Consequences:** Revenue target of 200K becomes impossible. The sales cycle for university site licenses is 6-12 months minimum. Every month spent building the wrong features delays revenue by more than a month (because you also have to rebuild).

**Prevention:**
- Phase 1 deliverable must be a functional simulator (schematic editor + ngspice + waveform viewer) that a professor can use for ONE real assignment. No collaboration, no LMS, no insights.
- Get 3-5 professors using it in actual classes by end of Phase 2, even if free. Their feedback determines Phase 3 priorities.
- Build an "import LTspice netlist" feature early -- professors have years of existing content they will not recreate.
- Every feature beyond basic simulation needs professor sign-off before implementation begins.

**Detection:** No professor has used the product in a real class after 4+ months of development. Feature backlog is full of engineering ideas with zero professor input.

**Phase:** Discipline required across ALL phases. Phase 1 must ship to professors. Phase 2 priorities must come from professor feedback, not roadmap assumptions.

**Confidence:** HIGH -- EdTech failure research is unambiguous on this point. Multiple sources confirm 5-10 year timelines for EdTech adoption when educator input is lacking.

---

### Pitfall 5: Emscripten Virtual Filesystem Breaks Model Loading

**What goes wrong:** ngspice uses `.include` and `.lib` directives to load SPICE model files (e.g., BSIM4 parameters for specific MOSFETs). In native ngspice, these resolve to filesystem paths. In WASM, there is no filesystem -- Emscripten provides MEMFS (in-memory) or IDBFS (IndexedDB-backed). Developers must pre-load all model files into the virtual filesystem before simulation runs, or `.include` directives fail silently or with cryptic errors.

**Why it happens:** Simple test circuits use inline model definitions. Real circuits reference external model files via `.include "/path/to/model.lib"`. The path resolution logic in ngspice assumes a real filesystem.

**Consequences:** Any netlist that uses `.include` (which is most real-world netlists, especially imported LTspice ones) fails. This blocks the critical "import existing content" workflow that professors need.

**Prevention:**
- Pre-populate MEMFS with a curated library of common educational models (BSIM3/4 for standard MOSFET processes, 2N2222/2N3904 BJTs, LM741 op-amp, standard passives).
- Intercept `.include` directives in the netlist before passing to ngspice. Resolve them against the pre-loaded model library, not filesystem paths.
- For user-uploaded models, load into MEMFS dynamically before simulation starts.
- Implement a model manager UI where professors can upload their department's model files once and have them persist via IndexedDB.

**Detection:** Simulations that work with inline models fail when switching to `.include` syntax. Import of LTspice netlists produces "file not found" errors.

**Phase:** Phase 1 (WASM integration). Must be solved before any real netlists can run. The model library curation is ongoing through all phases.

**Confidence:** HIGH -- this is a fundamental Emscripten constraint documented in their filesystem API.

---

## Moderate Pitfalls

### Pitfall 6: Canvas Performance Cliff with Large Schematics

**What goes wrong:** The schematic editor performs well with 20-50 components. At 200+ components (a full CMOS logic circuit, a multi-stage power supply), frame rates drop below 30fps during pan/zoom, making the editor feel broken.

**Why it happens:** Canvas 2D redraws the entire scene each frame. SVG-based renderers (React DOM) create thousands of DOM nodes. Neither scales linearly. Wire routing recalculations on every frame compound the problem.

**Prevention:**
- Use tldraw (which already implements viewport culling, R-tree spatial indexing, and canvas-based indicator rendering) rather than building a custom canvas from scratch. tldraw handles 10,000+ shapes by only rendering visible ones.
- Implement level-of-detail: at zoom levels where individual pin labels are <2px, replace components with simplified rectangles.
- Separate wire routing from rendering -- only recalculate routes on topology changes, not on pan/zoom.
- Profile with 500-component schematics during development, not just 10-component demos.

**Detection:** Users report lag when zooming on larger circuits. CPU usage spikes during pan operations in browser profiler.

**Phase:** Phase 1 (schematic editor). The canvas library choice locks in performance characteristics. Switching canvas libraries later is a near-complete rewrite.

**Confidence:** MEDIUM -- tldraw's documented performance features should handle educational circuit sizes (typically <500 components). Unverified for worst-case EE schematics.

---

### Pitfall 7: ngspice Output Parsing is Fragile and Format-Dependent

**What goes wrong:** ngspice raw output format (both ASCII and binary) has undocumented quirks. Variable naming differs between analysis types (DC uses `v(node)`, AC uses `v(node)` but values are complex, transient uses different timestamp formats). Parsing code that works for transient analysis breaks for AC analysis or parametric sweeps.

**Why it happens:** Developers test with `.tran` output, ship, then discover `.ac` output has complex number pairs that the parser doesn't handle. Parametric sweeps nest multiple datasets in a single output stream.

**Prevention:**
- Use ngspice's shared library API (`ngSpice_Init`, `ngSpice_Command`, callback functions) instead of parsing raw file output. The WASM build from danchitnis/ngspice exposes these callbacks.
- If file parsing is necessary, use the existing JavaScript raw file parser (ngrp) as a starting point, but extend it for all analysis types immediately -- not incrementally.
- Build parser test fixtures for every analysis type: DC operating point, DC sweep, AC, transient, parametric, Monte Carlo, noise. Test all of these before claiming "simulation works."

**Detection:** Waveform viewer shows garbage data for AC analysis. Parametric sweep results are missing or jumbled. Complex impedance values display as NaN.

**Phase:** Phase 1-2. The API callback approach should be chosen in Phase 1. Full analysis type coverage in Phase 2.

**Confidence:** MEDIUM -- based on ngspice documentation and the existence of multiple independent parsers, all with different coverage gaps.

---

### Pitfall 8: Real-Time Collaboration State Conflicts with Simulation State

**What goes wrong:** Two students edit the same circuit simultaneously via Yjs/CRDT. Student A changes a resistor value from 1K to 10K. Student B starts a simulation. The simulation runs with an intermediate CRDT state that neither student intended. Worse: Student A's schematic shows 10K but the simulation used 1K because the CRDT merge hadn't propagated to the simulation engine.

**Why it happens:** The schematic (collaborative, CRDT-managed) and the netlist (snapshot for simulation, non-collaborative) are two different representations. Any mismatch between them produces results that don't correspond to what either user sees on screen.

**Prevention:**
- Simulation must snapshot the CRDT state at a specific version, and display that version number to the user: "Simulating circuit as of edit #47."
- Lock the circuit (or at least display a warning) while simulation is running: "Simulation in progress -- edits will apply to the next run."
- Never auto-merge during an active simulation. Queue CRDT updates and apply after simulation completes.
- Show a visual diff when the circuit has changed since the last simulation: "Circuit modified since last simulation. Re-run?"

**Detection:** Simulation results don't match the visible schematic. Two users see different simulation results for "the same" circuit.

**Phase:** Phase 3+ (collaboration). This is a design problem, not a coding problem -- the architecture must be decided before collaboration is built, but implementation is later.

**Confidence:** MEDIUM -- Yjs handles data merging well, but the semantic meaning of a circuit state during simulation is domain-specific and not covered by any CRDT library.

---

### Pitfall 9: Chromebook Compatibility as an Afterthought

**What goes wrong:** University students increasingly use Chromebooks (especially in lower-income institutions). WASM runs on Chrome, but Chromebooks have 4GB RAM, weak CPUs, and aggressive tab killing. A simulator that "works" on a developer's 32GB MacBook crashes or runs 10x slower on a Chromebook.

**Why it happens:** Developers test on high-end machines. Performance is "good enough" until a professor assigns homework and 30 students on Chromebooks report failures simultaneously.

**Prevention:**
- Establish a Chromebook test target from day one: simulation of a 50-node circuit must complete in <5 seconds on a Chromebook with 4GB RAM.
- Set WASM initial memory conservatively (64-128MB) and grow as needed rather than pre-allocating 256MB.
- Implement circuit complexity warnings: "This circuit has 150 nodes. Simulation may be slow on lower-powered devices."
- Profile on actual Chromebook hardware (or use Chrome DevTools CPU throttling + memory limits) in CI.

**Detection:** Works on developer machines, fails on student devices. Reports of "killed" tabs (Chrome OOM killer).

**Phase:** Phase 1 performance targets. Must be tested throughout, not bolted on.

**Confidence:** HIGH -- Chromebook market share in US K-12 and higher ed is well-documented. This is where OmniSpice's students actually are.

---

### Pitfall 10: Building a Component Library That Doesn't Match Course Textbooks

**What goes wrong:** The simulator ships with generic component symbols and models. But Professor X uses Sedra/Smith, which labels NMOS differently than Professor Y who uses Razavi. The op-amp model defaults to ideal, but the homework requires an LM741 with specific offset voltage and slew rate.

**Why it happens:** Developers build a "generic" component library without understanding that EE courses are tightly coupled to specific textbook conventions and component models.

**Prevention:**
- Research the top 5 EE textbooks used in US universities (Sedra/Smith, Razavi, Horowitz/Hill, Neamen, Jaeger/Blalock). Ensure component symbols and default models match their conventions.
- Ship with textbook-specific "model packs" that professors can select: "Using Sedra/Smith? Enable this model pack for matching component defaults."
- Make the component library extensible: professors must be able to add custom components without touching code.
- Include models for the 20 most commonly assigned components: 2N2222, 2N3904, 2N3906, LM741, UA741, CD4007, standard CMOS process models.

**Detection:** Professors report "the MOSFET parameters don't match my textbook." Students get different results than the textbook solutions manual.

**Phase:** Phase 2 (component library curation). Phase 1 needs a minimal but correct set. Textbook alignment is an ongoing effort.

**Confidence:** MEDIUM -- based on understanding of EE pedagogy, not direct professor feedback yet. Needs validation.

---

## Minor Pitfalls

### Pitfall 11: Neglecting Netlist Export/Import Compatibility

**What goes wrong:** Professors have years of LTspice `.asc` files and SPICE netlists. If OmniSpice cannot import them, adoption requires professors to recreate all content from scratch -- which they will not do.

**Prevention:** Build an LTspice `.asc` file importer in Phase 2. Even a 90% accurate import that requires manual fixup is vastly better than no import at all. Also support standard SPICE netlist (`.cir`, `.sp`) import.

**Phase:** Phase 2. Not Phase 1 (basic simulator first), but before any university pilot.

---

### Pitfall 12: Waveform Viewer That Cannot Handle Dense Transient Data

**What goes wrong:** A 10ms transient simulation with 1ns timestep produces 10 million data points. Naive plotting libraries (Chart.js, Recharts) choke. Even uPlot needs data downsampling to remain interactive.

**Prevention:** Use uPlot (designed for millions of points) with Largest-Triangle-Three-Bucket downsampling for display. Keep full-resolution data in a typed array for cursor measurements. Never pass raw simulation data to a charting library without decimation.

**Phase:** Phase 1 (waveform viewer). uPlot handles this well if configured correctly from the start.

---

### Pitfall 13: Service Worker Caching Serves Stale WASM Binaries

**What goes wrong:** Offline mode via service worker caches the `.wasm` binary. When you ship a bug fix to ngspice-wasm, students' browsers serve the old cached version indefinitely.

**Prevention:** Version-stamp WASM binaries in the filename (`ngspice-v42.wasm`). Configure the service worker with a network-first strategy for `.wasm` files. Include a "check for updates" mechanism that compares WASM checksums.

**Phase:** Phase 3+ (offline mode). Easy to get right if planned for; painful to retrofit.

---

### Pitfall 14: Underestimating the University Sales Cycle

**What goes wrong:** Product is ready in September, but university procurement cycles run January-March for the following academic year. A 200K revenue target "within months" is structurally impossible if the sales cycle isn't understood.

**Prevention:** Target individual professors for free pilots immediately (no procurement needed). Use pilot success to drive department-level purchases in the next procurement cycle. Build relationships 6-12 months before expecting revenue. The friend with university connections should be doing sales outreach in parallel with Phase 1 development.

**Phase:** Ongoing from day one. This is a business pitfall, not a technical one, but it determines whether the project survives.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| WASM Integration | Memory crashes on real circuits (#1), filesystem model loading (#5) | Test with complex circuits from day one, pre-load model library |
| Schematic Editor | Canvas library lock-in (#6), wrong component symbols (#10) | Choose tldraw early, validate symbols with professors |
| Simulation Engine | Convergence errors destroying credibility (#3), output parsing gaps (#7) | Build error translator, use callback API not file parsing |
| Waveform Viewer | Dense data choking charts (#12) | Use uPlot with downsampling from the start |
| Collaboration | CRDT/simulation state mismatch (#8) | Snapshot-based simulation, version-tagged results |
| LMS Integration | COOP/COEP header conflicts (#2) | Design for no SharedArrayBuffer from day one |
| University Pilots | Over-engineering before validation (#4), textbook mismatch (#10) | Ship minimal simulator to professors ASAP |
| Offline Mode | Stale WASM cache (#13) | Version-stamped binaries, network-first for WASM |
| Revenue | Sales cycle mismatch (#14) | Start professor outreach during Phase 1 |

---

## Sources

- [Emscripten Compiler Settings (memory growth)](https://emscripten.org/docs/tools_reference/settings_reference.html)
- [Emscripten Pthreads support](https://emscripten.org/docs/porting/pthreads.html)
- [Cross-origin isolation COOP/COEP (web.dev)](https://web.dev/articles/coop-coep)
- [SharedArrayBuffer and cross-origin isolation (LogRocket)](https://blog.logrocket.com/understanding-sharedarraybuffer-and-cross-origin-isolation/)
- [ngspice convergence troubleshooting (SourceForge)](https://sourceforge.net/p/ngspice/discussion/133842/thread/3afb94e1/)
- [ngspice problems and learnings FAQ (GitHub Gist)](https://gist.github.com/is-already-taken/2cf7722df5455c99842aa3eb680846c9)
- [ngspice singular matrix discussion](https://sourceforge.net/p/ngspice/discussion/133842/thread/22ccad12/)
- [Emscripten Filesystem API](https://emscripten.org/docs/api_reference/Filesystem-API.html)
- [danchitnis/ngspice WASM tools](https://github.com/danchitnis/ngspice)
- [ngrp: ngspice ASCII rawfile parser (JS)](https://github.com/dragonman225/ngrp)
- [tldraw Performance documentation](https://tldraw.dev/sdk-features/performance)
- [tldraw Shape Rendering and Culling](https://deepwiki.com/tldraw/tldraw/3.4-shape-rendering-and-culling)
- [WebGL vs Canvas for CAD tools](https://altersquare.io/webgl-vs-canvas-best-choice-for-browser-based-cad-tools/)
- [EEcircuit repository](https://github.com/eelab-dev/EEcircuit)
- [wokwi/ngspice-wasm](https://github.com/wokwi/ngspice-wasm)
- [CircuitLab simulation speedup](https://www.circuitlab.com/blog/2012/08/02/80-simulation-speedup-circuitlab-browser-shootout/)
- [EdTech adoption stalls in higher ed (WGU Labs)](https://www.wgulabs.org/posts/3-reasons-edtech-adoption-stalls-in-higher-education)
- [Education startup failures (AppInventiv)](https://appinventiv.com/blog/why-education-startups-fail/)
- [EdTech sales mistakes (Inside Higher Ed)](https://www.insidehighered.com/digital-learning/blogs/default/how-avoid-ed-tech-sales-mistakes)
- [V8 4GB WASM memory](https://v8.dev/blog/4gb-wasm-memory)
- [ngspice model parameters](https://ngspice.sourceforge.io/modelparams.html)
