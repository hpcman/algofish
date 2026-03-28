import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { ReactFlow, Background, Controls, MiniMap, type Edge, type Node, type NodeMouseHandler } from '@xyflow/react';
import 'katex/dist/katex.min.css';
import '@xyflow/react/dist/style.css';

// Prerequisite graph data structure
interface AlgoNode {
  id: string;
  name: string;
  prerequisites: string[];
}

interface RecommendationItem {
  id: string;
  query: string;
  result: string;
  createdAt: string;
}

// Full algorithm database for prerequisite resolution
const FULL_ALGORITHM_DB: Record<string, AlgoNode> = {
  "time-space": { id: "time-space", name: "Time/Space Complexity", prerequisites: [] },
  "array": { id: "array", name: "Arrays", prerequisites: ["time-space"] },
  "linked-list": { id: "linked-list", name: "Linked Lists", prerequisites: ["time-space"] },
  "stack": { id: "stack", name: "Stack", prerequisites: ["array"] },
  "queue": { id: "queue", name: "Queue", prerequisites: ["linked-list"] },
  "sorting": { id: "sorting", name: "Sorting", prerequisites: ["array", "time-space"] },
  "binary-search": { id: "binary-search", name: "Binary Search", prerequisites: ["array", "sorting"] },
  "tree": { id: "tree", name: "Trees", prerequisites: ["linked-list"] },
  "bst": { id: "bst", name: "Binary Search Tree", prerequisites: ["tree", "binary-search"] },
  "graph": { id: "graph", name: "Graph Fundamentals", prerequisites: ["array", "queue", "stack"] },
  "dfs": { id: "dfs", name: "DFS", prerequisites: ["graph", "stack"] },
  "bfs": { id: "bfs", name: "BFS", prerequisites: ["graph", "queue"] },
  "dijkstra": { id: "dijkstra", name: "Dijkstra's Algorithm", prerequisites: ["dfs", "bfs", "graph"] },
  "dp": { id: "dp", name: "Dynamic Programming", prerequisites: ["time-space"] },
  "dp-memoization": { id: "dp-memoization", name: "Memoization", prerequisites: ["dp"] },
  "greedy": { id: "greedy", name: "Greedy Algorithm", prerequisites: ["sorting"] },
};

// Extract all prerequisite dependencies recursively
const expandPrerequisites = (algoIds: string[]): Set<string> => {
  const expanded = new Set<string>();
  const toProcess = [...algoIds];
  
  while (toProcess.length > 0) {
    const algoId = toProcess.pop()!;
    if (expanded.has(algoId)) continue;
    expanded.add(algoId);
    
    const algo = FULL_ALGORITHM_DB[algoId];
    if (algo) {
      algo.prerequisites.forEach(prereq => {
        if (!expanded.has(prereq)) toProcess.push(prereq);
      });
    }
  }
  return expanded;
};

const buildFlowGraph = (graphAlgos: Set<string>, learnedAlgos: Set<string>): { nodes: Node[]; edges: Edge[] } => {
  const algoIds = Array.from(graphAlgos);
  const levelMemo = new Map<string, number>();

  const getLevel = (id: string): number => {
    if (levelMemo.has(id)) return levelMemo.get(id)!;
    const algo = FULL_ALGORITHM_DB[id];
    if (!algo || algo.prerequisites.length === 0) {
      levelMemo.set(id, 0);
      return 0;
    }
    const validPrereqs = algo.prerequisites.filter((pid) => graphAlgos.has(pid));
    if (validPrereqs.length === 0) {
      levelMemo.set(id, 0);
      return 0;
    }
    const level = Math.max(...validPrereqs.map((pid) => getLevel(pid))) + 1;
    levelMemo.set(id, level);
    return level;
  };

  const levels = new Map<number, string[]>();
  algoIds.forEach((id) => {
    const level = getLevel(id);
    const current = levels.get(level) ?? [];
    current.push(id);
    levels.set(level, current);
  });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const levelGapX = 260;
  const rowGapY = 120;

  Array.from(levels.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, ids]) => {
      ids.sort((a, b) => FULL_ALGORITHM_DB[a].name.localeCompare(FULL_ALGORITHM_DB[b].name));
      ids.forEach((id, index) => {
        const algo = FULL_ALGORITHM_DB[id];
        const isLearned = learnedAlgos.has(id);
        nodes.push({
          id,
          position: { x: level * levelGapX, y: index * rowGapY },
          data: { label: `${isLearned ? '✓ ' : ''}${algo.name}` },
          style: {
            width: 210,
            borderRadius: 12,
            border: isLearned ? '2px solid #059669' : '1px solid #cbd5e1',
            background: isLearned ? '#d1fae5' : '#f8fafc',
            color: '#0f172a',
            fontWeight: 600,
            fontSize: 13,
            padding: '10px 12px',
            boxShadow: isLearned ? '0 8px 22px rgba(16, 185, 129, 0.22)' : '0 4px 10px rgba(15, 23, 42, 0.08)',
          },
        });
      });
    });

  algoIds.forEach((id) => {
    const algo = FULL_ALGORITHM_DB[id];
    algo.prerequisites.forEach((pid) => {
      if (graphAlgos.has(pid)) {
        edges.push({
          id: `${pid}->${id}`,
          source: pid,
          target: id,
          animated: false,
          style: { stroke: '#64748b', strokeWidth: 1.4 },
        });
      }
    });
  });

  return { nodes, edges };
};

const App = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [learnedAlgos, setLearnedAlgos] = useState<Set<string>>(new Set());
  const [graphAlgos, setGraphAlgos] = useState<Set<string>>(new Set()); // Start empty
  const [history, setHistory] = useState<RecommendationItem[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const flowGraph = useMemo(() => buildFlowGraph(graphAlgos, learnedAlgos), [graphAlgos, learnedAlgos]);
  const onNodeClick: NodeMouseHandler = (_, node) => {
    toggleLearned(node.id);
  };

  // Load persisted learning state on mount
  useEffect(() => {
    const savedLearned = localStorage.getItem('algofish_learned');
    const savedGraph = localStorage.getItem('algofish_graph');
    const savedHistory = localStorage.getItem('algofish_history');

    let graphSet = new Set<string>();
    if (savedGraph) {
      try {
        const parsedGraph = JSON.parse(savedGraph) as string[];
        graphSet = new Set(parsedGraph.filter((id) => Boolean(FULL_ALGORITHM_DB[id])));
      } catch {
        graphSet = new Set<string>();
      }
    }
    setGraphAlgos(graphSet);

    if (savedLearned) {
      try {
        const parsedLearned = JSON.parse(savedLearned) as string[];
        // Keep learned entries only if they exist in graph for a consistent view.
        const filteredLearned = parsedLearned.filter((id) => graphSet.has(id));
        setLearnedAlgos(new Set(filteredLearned));
      } catch {
        setLearnedAlgos(new Set<string>());
      }
    }

    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory) as RecommendationItem[];
        setHistory(parsedHistory);
      } catch {
        setHistory([]);
      }
    }

    setIsHydrated(true);
  }, []);

  // Save learned algorithms to localStorage whenever they change
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('algofish_learned', JSON.stringify(Array.from(learnedAlgos)));
  }, [isHydrated, learnedAlgos]);

  // Save discovered graph algorithms whenever they change
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('algofish_graph', JSON.stringify(Array.from(graphAlgos)));
  }, [graphAlgos, isHydrated]);

  // Save recommendation history whenever it changes
  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem('algofish_history', JSON.stringify(history));
  }, [history, isHydrated]);

  const toggleLearned = (algoId: string) => {
    setLearnedAlgos((prev) => {
      const updated = new Set(prev);
      if (updated.has(algoId)) {
        updated.delete(algoId);
      } else {
        updated.add(algoId);
      }
      return updated;
    });
  };

  const handleLearn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setError('');
    setResult('');

    try {
      // Connects to your FastAPI /api/learn endpoint
      const response = await axios.post('http://localhost:8000/api/learn', {
        query: query,
      });
      setResult(response.data.result);

      const historyItem: RecommendationItem = {
        id: `${Date.now()}`,
        query,
        result: String(response.data.result ?? ''),
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [historyItem, ...prev].slice(0, 30));
      
      // Extract relevant algorithms from the response using keyword matching
      const responseText = response.data.result.toLowerCase();
      const detectedAlgos = new Set<string>();
      
      Object.entries(FULL_ALGORITHM_DB).forEach(([id, algo]) => {
        const keywords = [algo.name.toLowerCase(), id.replace(/-/g, ' ')];
        if (keywords.some(kw => responseText.includes(kw))) {
          detectedAlgos.add(id);
        }
      });
      
      // Add detected algorithms and their prerequisites to the graph
      if (detectedAlgos.size > 0) {
        const newAlgos = expandPrerequisites(Array.from(detectedAlgos));
        setGraphAlgos(prev => new Set([...prev, ...newAlgos]));
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const backendDetail = err.response?.data?.detail;
        setError(backendDetail ? String(backendDetail) : err.message);
      } else {
        setError('The AI Agent encountered an unknown error.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 pt-2 text-center">
        <h1 className="inline-block pb-1 text-5xl leading-[1.15] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 mb-2">
          AlgoFish
        </h1>
        <p className="text-slate-500 text-lg font-medium">
          GPT-5.4 Powered Algorithm Teacher & Practice Engine
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <button
            onClick={() => setShowGraph(!showGraph)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
          >
            {showGraph ? '📖 Hide' : '📚 Show'} Prerequisite Graph
          </button>
          <div className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg font-medium">
            Progress: {learnedAlgos.size}/{graphAlgos.size} algorithms learned {graphAlgos.size > 0 ? `(${Math.round((learnedAlgos.size / graphAlgos.size) * 100)}%)` : '(0%)'}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {/* Prerequisite Graph Section */}
        {showGraph && (
          <div className="mb-8 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Algorithm Prerequisite Graph</h2>
            {graphAlgos.size === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg font-medium">📚 Your graph is empty</p>
                <p className="text-sm mt-2">Ask about algorithms to build your learning path!</p>
              </div>
            ) : (
              <div className="h-[560px] w-full rounded-2xl border border-slate-200 overflow-hidden">
                <ReactFlow
                  nodes={flowGraph.nodes}
                  edges={flowGraph.edges}
                  onNodeClick={onNodeClick}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  proOptions={{ hideAttribution: true }}
                >
                  <MiniMap zoomable pannable nodeStrokeWidth={2} />
                  <Controls showInteractive={false} />
                  <Background gap={16} size={1} color="#e2e8f0" />
                </ReactFlow>
              </div>
            )}
          </div>
        )}

        {/* Search Section */}
        <form onSubmit={handleLearn} className="relative mb-8">
          <input
            type="text"
            className="w-full p-5 pr-32 text-lg rounded-2xl border-2 border-white shadow-xl focus:border-blue-400 focus:outline-none transition-all"
            placeholder="Paste URL or type (e.g., 'CF 1503D' or 'Dijkstra')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
          >
            {loading ? 'Thinking...' : 'Analyze'}
          </button>
        </form>

        {/* Past Recommendations */}
        {history.length > 0 && (
          <div className="mb-8 p-6 bg-white rounded-3xl shadow-xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900">Past Recommendations</h3>
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('algofish_history');
                }}
                className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="space-y-3 max-h-72 overflow-auto pr-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setQuery(item.query);
                    setResult(item.result);
                    setError('');
                  }}
                >
                  <div className="font-semibold text-slate-800">{item.query}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-blue-600 font-medium animate-pulse">
              TinyFish is navigating the open web & GPT-5.4 is synthesizing...
            </p>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 mb-6 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg">
            {error}
          </div>
        )}

        {/* Results Card */}
        {result && (
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 prose prose-slate max-w-none prose-headings:text-blue-700 prose-strong:text-blue-900">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {result}
            </ReactMarkdown>
          </div>
        )}
      </main>

      <footer className="max-w-6xl mx-auto mt-20 text-center text-slate-400 text-sm">
        Built for TinyFish SG Hackathon 2026 • Powered by GPT-5.4
      </footer>
    </div>
  );
};

export default App;