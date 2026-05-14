/**
 * Infrastructure Control Center Page
 * Isolated page used for demonstration purposes.
 * Allows the presenter to inject faults into the simulated microservices and monitor logs.
 */
"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { Activity, Server, Database, ServerCrash, RefreshCw, AlertTriangle, ShieldCheck, Terminal } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const [faults, setFaults] = useState({ isRedisDown: false, isDbLatencyHigh: false, isPaymentTimeout: false });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Poll for the current state of faults and logs
  const fetchState = async () => {
    try {
      const [faultsRes, logsRes] = await Promise.all([
        fetch("/api/admin/faults"),
        fetch("/api/logs")
      ]);
      setFaults(await faultsRes.json());
      setLogs(await logsRes.json());
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000); // Polling for logs
    return () => clearInterval(interval);
  }, []);

  // Toggles a fault state on the server
  const toggleFault = async (fault: string, active: boolean) => {
    await fetch("/api/admin/faults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fault, active })
    });
    fetchState();
  };

  // Triggers manual remediation for demo purposes
  const manualRemediate = async (action: string) => {
    await fetch("/api/admin/remediate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    fetchState();
  };

  const clearLogs = async () => {
    await fetch("/api/logs", { method: "DELETE" });
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-[#050814] text-slate-300">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Activity className="text-brand-cyan h-8 w-8" /> 
              Infrastructure Control Center
            </h1>
            <p className="text-slate-400 mt-2">Manage service health, inject faults, and monitor self-healing</p>

          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-full text-sm font-medium">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            System Telemetry Active
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Topology & Faults */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Topology Map */}
            <div className="bg-[#0a1128] border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Server className="h-5 w-5 text-brand-blue-500" /> Distributed Topology
              </h2>
              
              <div className="relative h-64 flex items-center justify-center">
                {/* Connections (Visual only) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                  <line x1="20%" y1="50%" x2="40%" y2="20%" stroke={faults.isDbLatencyHigh ? "#ef4444" : "#3b82f6"} strokeWidth="2" strokeDasharray="4" className={faults.isDbLatencyHigh ? "" : "animate-pulse"} />
                  <line x1="20%" y1="50%" x2="40%" y2="80%" stroke={faults.isRedisDown ? "#ef4444" : "#3b82f6"} strokeWidth="2" strokeDasharray="4" className={faults.isRedisDown ? "" : "animate-pulse"} />
                  <line x1="20%" y1="50%" x2="70%" y2="50%" stroke={faults.isPaymentTimeout ? "#ef4444" : "#3b82f6"} strokeWidth="2" strokeDasharray="4" className={faults.isPaymentTimeout ? "" : "animate-pulse"} />
                </svg>

                {/* Nodes */}
                <div className="absolute left-[15%] z-10 text-center">
                  <div className="h-16 w-16 bg-brand-blue-900 border-2 border-brand-blue-500 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    <Server className="text-white h-8 w-8" />
                  </div>
                  <span className="text-xs font-bold">API Gateway</span>
                </div>

                <div className="absolute left-[35%] top-[10%] z-10 text-center">
                  <div className={`h-16 w-16 rounded-xl flex items-center justify-center mx-auto mb-2 border-2 transition-colors ${faults.isDbLatencyHigh ? 'bg-red-900/50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-brand-blue-900 border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.3)]'}`}>
                    <Database className={`h-8 w-8 ${faults.isDbLatencyHigh ? 'text-red-400' : 'text-brand-cyan'}`} />
                  </div>
                  <span className="text-xs font-bold">Product DB</span>
                  {faults.isDbLatencyHigh && <span className="block text-[10px] text-red-400 mt-1">High Latency</span>}
                </div>

                <div className="absolute left-[35%] bottom-[10%] z-10 text-center">
                  <div className={`h-16 w-16 rounded-xl flex items-center justify-center mx-auto mb-2 border-2 transition-colors ${faults.isRedisDown ? 'bg-red-900/50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-brand-blue-900 border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.3)]'}`}>
                    <Database className={`h-8 w-8 ${faults.isRedisDown ? 'text-red-400' : 'text-brand-cyan'}`} />
                  </div>
                  <span className="text-xs font-bold">Cart Cache (Redis)</span>
                  {faults.isRedisDown && <span className="block text-[10px] text-red-400 mt-1">Offline</span>}
                </div>

                <div className="absolute right-[20%] top-[40%] z-10 text-center">
                  <div className={`h-16 w-16 rounded-xl flex items-center justify-center mx-auto mb-2 border-2 transition-colors ${faults.isPaymentTimeout ? 'bg-red-900/50 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-brand-blue-900 border-brand-cyan shadow-[0_0_15px_rgba(0,240,255,0.3)]'}`}>
                    <Server className={`h-8 w-8 ${faults.isPaymentTimeout ? 'text-red-400' : 'text-brand-cyan'}`} />
                  </div>
                  <span className="text-xs font-bold">Payment Gateway</span>
                  {faults.isPaymentTimeout && <span className="block text-[10px] text-red-400 mt-1">Timeout</span>}
                </div>
              </div>
            </div>

            {/* Fault Injection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0a1128] border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-white">Cart Outage</h3>
                    <p className="text-xs text-slate-400 mt-1">Kill Redis Connection</p>
                  </div>
                  <ServerCrash className={`h-5 w-5 ${faults.isRedisDown ? 'text-red-500' : 'text-slate-600'}`} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFault('isRedisDown', true)} disabled={faults.isRedisDown} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 text-xs font-bold py-2 rounded">INJECT</button>
                  <button onClick={() => manualRemediate('RESTART_REDIS')} disabled={!faults.isRedisDown} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 disabled:opacity-50 text-xs font-bold py-2 rounded">HEAL (RESTART)</button>
                </div>
              </div>

              <div className="bg-[#0a1128] border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-white">DB Latency</h3>
                    <p className="text-xs text-slate-400 mt-1">Add 3s Query Delay</p>
                  </div>
                  <AlertTriangle className={`h-5 w-5 ${faults.isDbLatencyHigh ? 'text-yellow-500' : 'text-slate-600'}`} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFault('isDbLatencyHigh', true)} disabled={faults.isDbLatencyHigh} className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 disabled:opacity-50 text-xs font-bold py-2 rounded">INJECT</button>
                  <button onClick={() => manualRemediate('SCALE_DB_REPLICAS')} disabled={!faults.isDbLatencyHigh} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 disabled:opacity-50 text-xs font-bold py-2 rounded">HEAL (SCALE)</button>
                </div>
              </div>

              <div className="bg-[#0a1128] border border-slate-800 rounded-xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-white">Payment Fail</h3>
                    <p className="text-xs text-slate-400 mt-1">Timeout Gateway API</p>
                  </div>
                  <ShieldCheck className={`h-5 w-5 ${faults.isPaymentTimeout ? 'text-red-500' : 'text-slate-600'}`} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFault('isPaymentTimeout', true)} disabled={faults.isPaymentTimeout} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 text-xs font-bold py-2 rounded">INJECT</button>
                  <button onClick={() => manualRemediate('RESET_PAYMENT_GATEWAY')} disabled={!faults.isPaymentTimeout} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 disabled:opacity-50 text-xs font-bold py-2 rounded">HEAL (RESET)</button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Logs */}
          <div className="bg-[#0a1128] border border-slate-800 rounded-2xl flex flex-col h-[600px] overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#050814]">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Live Log Stream
              </h2>
              <div className="flex items-center gap-4">
                <button 
                  onClick={clearLogs}
                  className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700 transition-colors uppercase font-bold"
                >
                  Clear Logs
                </button>
                <div className="flex items-center gap-2 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-cyan opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-cyan"></span>
                  </span>
                  Streaming
                </div>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-3 custom-scrollbar">
              {logs.map((log: any, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx} 
                  className={`border-l-2 pl-3 py-1 ${
                    log.level === 'error' ? 'border-red-500 text-red-400 bg-red-500/5' : 
                    log.level === 'warn' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/5' : 
                    'border-brand-blue-500 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 opacity-70">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800">{log.service}</span>
                  </div>
                  <p className={log.level === 'error' ? 'text-red-300' : 'text-slate-300'}>{log.message}</p>
                </motion.div>
              ))}
              {logs.length === 0 && <div className="text-center text-slate-500 py-10">No logs captured yet</div>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
