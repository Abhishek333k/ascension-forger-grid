import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, processWorkoutAndLevelUp, getXPRequiredForLevel, ensurePlayerInitialized } from './db';

// Custom SVG-based Cybernetic Radar Chart mapping normal baseline metrics
function RadarChart({ stats }) {
  const cx = 100;
  const cy = 100;
  const r = 60;
  const labels = ['STR', 'END', 'AGI', 'VIT', 'CORE'];
  const keys = ['str', 'end', 'agi', 'vit', 'core'];
  
  // Safe value maps
  const values = keys.map(k => stats[k] || 10);
  const maxVal = Math.max(15, ...values) * 1.15;

  const getCoordinates = (index, value) => {
    const angle = (index * 2 * Math.PI / 5) - Math.PI / 2;
    const factor = value / maxVal;
    const x = cx + r * factor * Math.cos(angle);
    const y = cy + r * factor * Math.sin(angle);
    return { x, y };
  };

  // Concentric grid rings
  const gridPentagons = [0.25, 0.5, 0.75, 1.0].map((lvl) => {
    return Array.from({ length: 5 }).map((_, i) => {
      const coord = getCoordinates(i, maxVal * lvl);
      return `${coord.x},${coord.y}`;
    }).join(' ');
  });

  const dataPoints = keys.map((key, i) => getCoordinates(i, stats[key] || 10));
  const dataPathString = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Position labels slightly offset from max radius
  const labelPositions = Array.from({ length: 5 }).map((_, i) => {
    const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const offsetR = r + 15;
    const x = cx + offsetR * Math.cos(angle);
    const y = cy + offsetR * Math.sin(angle);
    return { x, y };
  });

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full max-h-[190px] mx-auto select-none">
      <defs>
        <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff003c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff003c" stopOpacity="0.0" />
        </radialGradient>
      </defs>
      
      {/* Outer grid rings */}
      {gridPentagons.map((points, idx) => (
        <polygon 
          key={idx} 
          points={points} 
          fill="none" 
          stroke="rgba(255, 0, 60, 0.25)" 
          strokeWidth="0.75" 
          strokeDasharray={idx === 3 ? "none" : "2,2"}
        />
      ))}

      {/* Axis wires */}
      {Array.from({ length: 5 }).map((_, i) => {
        const coord = getCoordinates(i, maxVal);
        return (
          <line 
            key={i} 
            x1={cx} 
            y1={cy} 
            x2={coord.x} 
            y2={coord.y} 
            stroke="rgba(255, 0, 60, 0.2)" 
            strokeWidth="0.75"
          />
        );
      })}

      {/* Attributes Polygon */}
      <polygon 
        points={dataPathString} 
        fill="url(#radarGlow)" 
        stroke="#ff003c" 
        strokeWidth="1.5"
        className="drop-shadow-[0_0_6px_rgba(255,0,60,0.5)]"
      />

      {/* Neon data points */}
      {dataPoints.map((pt, i) => (
        <circle 
          key={i} 
          cx={pt.x} 
          cy={pt.y} 
          r="2.5" 
          fill="#fce100" 
          stroke="#fff" 
          strokeWidth="0.5" 
        />
      ))}

      {/* Text labels */}
      {labels.map((lbl, i) => {
        const pos = labelPositions[i];
        let textAnchor = "middle";
        if (i === 1 || i === 2) textAnchor = "start";
        if (i === 3 || i === 4) textAnchor = "end";
        
        let dy = 3;
        if (i === 0) dy = -5;
        if (i === 2 || i === 3) dy = 6;

        return (
          <text 
            key={lbl} 
            x={pos.x} 
            y={pos.y + dy} 
            fill="#00f0ff" 
            fontSize="8px" 
            fontWeight="bold"
            fontFamily="'Share Tech Mono', monospace"
            textAnchor={textAnchor}
          >
            {lbl}
          </text>
        );
      })}
    </svg>
  );
}

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activity, setActivity] = useState('pushups');
  const [intensity, setIntensity] = useState(10);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  // Interactive console & dynamic status
  const [cliInput, setCliInput] = useState('');
  const [toast, setToast] = useState({ show: false, msg: '', type: 'sync' });
  const [cacheSizeText, setCacheSizeText] = useState('0 KB');
  const [cachePercent, setCachePercent] = useState(0);

  // Level Up Breached State (Phase 2 Visual Alerts)
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ old: 1, new: 1 });
  const prevLevelRef = useRef(null);

  // Database hook sources
  const player = useLiveQuery(() => db.player_status.get('player_1'));
  const workoutLogs = useLiveQuery(() => 
    db.workout_logs.orderBy('timestamp').reverse().toArray()
  ) || [];
  const unsyncedCount = useLiveQuery(() => 
    db.workout_logs.where('sync_status').equals(0).count()
  ) || 0;

  // Intercept rating rank ups (Phase 2)
  useEffect(() => {
    if (player && player.current_level) {
      if (prevLevelRef.current !== null && player.current_level > prevLevelRef.current) {
        setLevelUpData({ old: prevLevelRef.current, new: player.current_level });
        setShowLevelUp(true);
      }
      prevLevelRef.current = player.current_level;
    }
  }, [player?.current_level]);

  // Live monitor of local bytes
  useEffect(() => {
    let totalBytes = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += ((localStorage[key].length + key.length) * 2);
      }
    }
    const kb = (totalBytes / 1024).toFixed(1);
    setCacheSizeText(`${kb} KB`);
    setCachePercent(Math.min((totalBytes / 5000000) * 100, 100));
  }, [workoutLogs]);

  // Toast triggers
  const showToast = (msg, type = 'sync') => {
    setToast({ show: true, msg, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('UPLINK DETECTED: LOCAL BUFFER SYNCHRONIZING', 'deploy');
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('UPLINK FAILED: LOCAL OFFLINE STANDALONE ACTIVE', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    ensurePlayerInitialized();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Telemetry Mock
  const triggerSync = async () => {
    const unsynced = await db.workout_logs.where('sync_status').equals(0).toArray();
    if (unsynced.length === 0) {
      showToast('SYNC: LEDGER IS FULLY ALIGNED WITH CLOUD');
      return;
    }

    setSyncing(true);
    setSyncMessage(`Pushing ${unsynced.length} records to cloud...`);
    showToast(`UPLINKING ${unsynced.length} ACTION COMMIT RECORDS...`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await db.transaction('rw', db.workout_logs, async () => {
        for (const log of unsynced) {
          log.sync_status = 1;
          await db.workout_logs.put(log);
        }
      });
      setSyncMessage('Uplink synchronized successfully.');
      showToast('UPLINK PROCESS COMPLETED.', 'deploy');
    } catch (err) {
      console.error('Uplink synchronization failed:', err);
      setSyncMessage('Uplink failed. Local buffer preserved.');
      showToast('UPLINK OPERATION REJECTED.', 'error');
    } finally {
      setTimeout(() => {
        setSyncing(false);
        setSyncMessage('');
      }, 2500);
    }
  };

  // Submit manual training sequence
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (intensity <= 0) return;
    await processWorkoutAndLevelUp(activity, intensity, isOnline);
    setIntensity(10);
    showToast('ACTION COMMIT REGISTRY COMPLETED.', 'deploy');
  };

  // CLI execution handler
  const handleCLI = async (e) => {
    if (e.key === 'Enter') {
      const cmd = cliInput.trim().toLowerCase();
      setCliInput('');
      
      if (!cmd) return;
      
      if (cmd === 'purge' || cmd === 'reset') {
        await hardResetNode();
      } else if (cmd === 'export') {
        await exportTelemetry();
      } else if (cmd === 'sync') {
        await triggerSync();
      } else if (cmd.startsWith('commit ') || cmd.startsWith('log ')) {
        const parts = cmd.split(/\s+/);
        if (parts.length >= 3) {
          let type = parts[1];
          const val = parseInt(parts[2]);
          
          // Map acronyms
          if (type.includes('str') || type.includes('strength') || type.includes('push')) {
            type = 'pushups';
          } else if (type.includes('end') || type.includes('endurance') || type.includes('run')) {
            type = 'running';
          } else if (type.includes('agi') || type.includes('agility') || type.includes('pull')) {
            type = 'pullups';
          } else if (type.includes('vit') || type.includes('vitality') || type.includes('squat')) {
            type = 'squats';
          } else if (type.includes('core') || type.includes('plank')) {
            type = 'plank';
          }
          
          const validTypes = ['pushups', 'running', 'pullups', 'squats', 'plank'];
          if (validTypes.includes(type) && val > 0) {
            await processWorkoutAndLevelUp(type, val, isOnline);
            showToast(`COMMITTED ${type.toUpperCase()}: ${val}`, 'deploy');
          } else {
            showToast(`INVALID PROTOCOL. TRY 'commit str 15'`, 'error');
          }
        } else {
          showToast(`SYNTAX: commit <protocol> <val>`, 'error');
        }
      } else if (cmd === 'help') {
        showToast("CMDS: commit [str|end|agi|vit|core] [val] | sync | export | purge");
      } else {
        showToast(`CMD NOT RECOGNIZED: '${cmd}'`, 'error');
      }
    }
  };

  // Data Sovereignty (Phase 3)
  const exportTelemetry = async () => {
    showToast('COMPILING TELEMETRY ARCHIVE...');
    const statusData = await db.player_status.toArray();
    const logsData = await db.workout_logs.toArray();
    const dataStr = JSON.stringify({ player_status: statusData, workout_logs: logsData }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `afg_telemetry_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('TELEMETRY EXPORT COMPLETED', 'deploy');
  };

  const hardResetNode = async () => {
    if (window.confirm("WARNING: INITIALIZING COMPLETE SYSTEM PURGE. ALL LOCAL DATA WILL BE DELETED. PROCEED?")) {
      await db.transaction('rw', db.player_status, db.workout_logs, async () => {
        await db.player_status.clear();
        await db.workout_logs.clear();
      });
      await ensurePlayerInitialized();
      showToast('MEMORY PURGED. REBOOTING SYSTEM...', 'error');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Calculations
  const currentLevel = player?.current_level || 1;
  const currentXp = player?.total_xp || 0;
  const xpNeeded = getXPRequiredForLevel(currentLevel);
  const xpPercent = Math.min(100, Math.floor((currentXp / xpNeeded) * 100));

  return (
    <div className="w-full h-full min-h-screen lg:h-screen lg:overflow-hidden p-3 sm:p-[15px] bg-[#050102] flex flex-col justify-between relative select-none font-rajdhani">
      {/* Visual background and scanlines */}
      <div className="bg-matrix"></div>
      <div className="scanlines"></div>

      {/* Flashing Alert Modal (Phase 2 Visual Alerts) */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/95 z-[999] flex flex-col items-center justify-center backdrop-blur-md p-4">
          <div className="bg-[#20050a] border-2 border-[#ff003c] p-6 sm:p-8 max-w-md w-full cp-cut-tr shadow-[0_0_50px_rgba(255,0,60,0.6)] animate-warning-flash text-center relative">
            <div className="absolute top-2 right-3 font-mono text-[9px] text-[#ff003c]/60">SYS_INTERCEPT_ALARM</div>
            
            <h2 className="text-[#ff003c] text-xl sm:text-2xl font-black uppercase tracking-widest mb-4 border-b border-[#ff003c]/30 pb-2 animate-text-glitch">
              OUTPUT_RATING_UPGRADE
            </h2>
            
            <div className="bg-black/60 border border-[#ff003c]/30 p-4 mb-6">
              <p className="text-white/80 font-mono text-xs leading-relaxed mb-4">
                OPERATOR OUTPUT RATING HAS COMPLETED SYNTACTIC BREACH. EVOLVING SYSTEM STATE...
              </p>
              
              <div className="flex justify-center items-center gap-6 font-mono text-2xl font-black">
                <div className="text-white/50">
                  <span className="block text-[9px] text-white/30">PREV_RATING</span>
                  {levelUpData.old}
                </div>
                <div className="text-[#00f0ff] animate-pulse">➔</div>
                <div className="text-[#fce100] drop-shadow-[0_0_10px_rgba(252,225,0,0.6)]">
                  <span className="block text-[9px] text-white/30">NEW_RATING</span>
                  {levelUpData.new}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setShowLevelUp(false)} 
              className="w-full bg-[#ff003c] text-black font-extrabold uppercase py-2.5 tracking-widest text-xs hover:bg-white hover:text-[#ff003c] transition-colors cp-cut-both"
            >
              [ CONFIRM EVOLUTION SEQUENCE ]
            </button>
          </div>
        </div>
      )}

      {/* Cybernetic Frame container */}
      <div id="app-frame" className="relative flex flex-col h-full w-full bg-[rgba(20,2,5,0.85)] border-2 border-[#ff003c] text-white app-frame-layout flex-1 min-h-0">
        
        {/* Frame Highlight Highlights */}
        <div className="absolute top-[-2px] left-[-2px] w-[25px] h-[25px] z-[101] pointer-events-none" style={{ borderTop: '3px solid #fff', borderLeft: '3px solid #fff' }}></div>
        <div className="absolute bottom-[20px] right-[-15px] w-[20px] h-[20px] z-[101] pointer-events-none" style={{ borderBottom: '3px solid #fff', borderRight: '3px solid #fff' }}></div>

        {/* Windows Header Title Bar */}
        <div className="title-bar shrink-0 flex justify-between items-center h-[30px] bg-[rgba(255,0,60,0.15)] border-b border-[#ff003c] px-4 z-40">
          <div className="text-xs text-[#ff003c] font-bold tracking-widest font-mono uppercase">
            Ascension Forger Grid // OS <span className="text-white/50 text-[10px] ml-2">v1.0.0</span>
          </div>
          <div className="window-controls flex gap-3">
            <button className="win-btn text-[#ff003c] font-black hover:text-white transition-colors text-sm">_</button>
            <button className="win-btn text-[#ff003c] font-black hover:text-white transition-colors text-sm">[ ]</button>
            <button onClick={hardResetNode} className="win-btn close text-[#ff003c] font-black hover:text-[#fce100] transition-colors text-sm">X</button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-4 flex-1 overflow-hidden relative z-10 min-h-0">
          
          {/* Header Panel */}
          <header className="bg-[rgba(0,0,0,0.4)] backdrop-blur-md border border-[#ff003c]/40 text-white p-4 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0 shrink-0 hex-cut shadow-[0_0_20px_rgba(255,0,60,0.15)]">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#ff003c] drop-shadow-[0_0_10px_rgba(255,0,60,0.5)]">
                ASCENSION FORGER GRID
              </h1>
              <p className="text-[10px] sm:text-xs font-bold mt-1 opacity-70 font-mono uppercase text-white">
                OS: SECURE ACTION_COMMIT CONSOLE // OPERATOR NODE
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportTelemetry} className="btn-hybrid btn-cyan cp-cut-both px-4 py-1.5 text-[10px]">
                EXPORT_TELEMETRY
              </button>
              <button onClick={hardResetNode} className="btn-hybrid cp-cut-both px-4 py-1.5 text-[10px]">
                PURGE_BUFFER
              </button>
              <button onClick={triggerSync} className="btn-hybrid btn-yellow cp-cut-both px-4 py-1.5 text-[10px]">
                SYNC_GRID
              </button>
            </div>
          </header>

          {/* Quick Diag Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
            
            {/* Box 1 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-[#ff003c]/30 p-2.5 hex-cut-inv">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-[#ff003c] uppercase font-bold">LOCAL_BUFFER</span>
                <span className="text-[9px] text-white/70 font-mono">{cacheSizeText}</span>
              </div>
              <div className="w-full h-1 bg-black border border-[#ff003c]/20 mt-1.5">
                <div className="h-full bg-[#ff003c]" style={{ width: `${cachePercent}%` }}></div>
              </div>
            </div>

            {/* Box 2 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-[#00f0ff]/30 p-2.5 hex-cut-inv">
              <span className="text-[9px] text-[#00f0ff] uppercase font-bold block mb-0.5">OUTPUT_RATING</span>
              <span className="text-lg font-black font-mono text-white leading-tight">
                {currentLevel}
              </span>
            </div>

            {/* Box 3 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-[#fce100]/30 p-2.5 hex-cut-inv">
              <span className="text-[9px] text-[#fce100] uppercase font-bold block mb-0.5">YIELD_TOTAL</span>
              <span className="text-lg font-black font-mono text-white leading-tight">
                {currentXp}
              </span>
            </div>

            {/* Box 4 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-[#10b981]/30 p-2.5 hex-cut-inv">
              <span className="text-[9px] text-[#10b981] uppercase font-bold block mb-0.5">PENDING_UPLINK</span>
              <span className="text-lg font-black font-mono text-white leading-tight">
                {unsyncedCount}
              </span>
            </div>

            {/* Box 5 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-purple-400/30 p-2.5 hex-cut-inv">
              <span className="text-[9px] text-purple-400 uppercase font-bold block mb-0.5">ACTIVE_EXCURSION</span>
              <span className="text-lg font-black font-mono text-white leading-tight">
                {workoutLogs.length}
              </span>
            </div>

            {/* Box 6 */}
            <div className="bg-[rgba(0,0,0,0.5)] backdrop-blur-md border border-white/20 p-2.5 hex-cut-inv">
              <span className="text-[9px] text-white/50 uppercase font-bold block mb-0.5">UPLINK_STATUS</span>
              {isOnline ? (
                <span className="text-lg font-black font-mono text-[#00f0ff] uppercase leading-tight">ACTIVE</span>
              ) : (
                <span className="text-lg font-black font-mono text-[#ff003c] uppercase leading-tight animate-pulse">OFFLINE</span>
              )}
            </div>

          </div>

          {/* Grid Layout Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
            
            {/* Left Column: Attributes & Radar Diagram */}
            <section className="lg:col-span-5 flex flex-col gap-4 min-h-0">
              
              {/* Radar card box */}
              <div className="bg-[rgba(0,0,0,0.5)] border border-[#ff003c]/30 p-4 hex-cut-inv flex flex-col gap-4 shrink-0">
                <div className="flex justify-between items-center border-b border-[#ff003c]/20 pb-2">
                  <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase">CORE_TELEMETRY</span>
                  <span className="text-[8px] font-mono bg-[#ff003c]/20 text-[#ff003c] px-2 py-0.5 rounded border border-[#ff003c]/30">LOCAL_NODE</span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[9px] font-mono uppercase text-white/50">YIELD_PROGRESS</span>
                    <span className="text-xs font-mono text-[#00f0ff] font-bold">
                      {currentXp} <span className="text-white/30">/ {xpNeeded}</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-black border border-[#ff003c]/30 p-[1px] rounded-none">
                    <div 
                      className="h-full bg-gradient-to-r from-[#ff003c] to-[#fce100] transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,0,60,0.5)]" 
                      style={{ width: `${xpPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-[8px] font-mono text-white/40 mt-1 uppercase text-right tracking-widest">
                    {xpPercent}% COMPRESSION TO NEXT RATING BREACH
                  </p>
                </div>

                {/* Radar chart wrapper */}
                <div className="border border-[#ff003c]/20 bg-black/40 p-2 relative flex items-center justify-center h-[200px]">
                  <div className="absolute top-2 left-2 font-mono text-[8px] text-[#ff003c]/40 uppercase">VISUALIZATION_DECK</div>
                  <RadarChart stats={player || { str: 10, end: 10, agi: 10, vit: 10, core: 10 }} />
                </div>
              </div>

              {/* Attributes metrics lists */}
              <div className="bg-[rgba(0,0,0,0.4)] border border-white/10 p-3 flex flex-col gap-2 flex-1 overflow-y-auto min-h-[180px]">
                <span className="text-[9px] font-mono font-bold text-white/50 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">
                  METRIC_REGISTRY
                </span>
                
                {/* STR */}
                <div className="flex items-center justify-between p-2 bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70">STRENGTH (STR)</span>
                  <span className="font-mono text-xs text-[#00f0ff] font-bold">{player?.str?.toFixed(1) || '10.0'}</span>
                </div>
                {/* END */}
                <div className="flex items-center justify-between p-2 bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/77">ENDURANCE (END)</span>
                  <span className="font-mono text-xs text-[#00f0ff] font-bold">{player?.end?.toFixed(1) || '10.0'}</span>
                </div>
                {/* AGI */}
                <div className="flex items-center justify-between p-2 bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/77">AGILITY (AGI)</span>
                  <span className="font-mono text-xs text-[#00f0ff] font-bold">{player?.agi?.toFixed(1) || '10.0'}</span>
                </div>
                {/* VIT */}
                <div className="flex items-center justify-between p-2 bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/77">VITALITY (VIT)</span>
                  <span className="font-mono text-xs text-[#00f0ff] font-bold">{player?.vit?.toFixed(1) || '10.0'}</span>
                </div>
                {/* CORE */}
                <div className="flex items-center justify-between p-2 bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/77">CORE (CORE)</span>
                  <span className="font-mono text-xs text-[#00f0ff] font-bold">{player?.core?.toFixed(1) || '10.0'}</span>
                </div>
              </div>

            </section>

            {/* Right Column: Action Commit input & Database Log list */}
            <section className="lg:col-span-7 flex flex-col gap-4 min-h-0 lg:overflow-hidden">
              
              {/* Input Committer panel */}
              <div className="bg-[rgba(0,0,0,0.5)] border border-[#ff003c]/35 p-4 hex-cut shadow-[0_0_15px_rgba(255,0,60,0.15)] shrink-0">
                <span className="text-xs font-mono font-bold text-[#fce100] uppercase block border-b border-[#ff003c]/20 pb-2 mb-4">
                  ACTION_COMMIT_PROTOCOL
                </span>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-mono uppercase tracking-widest text-white/50 mb-1.5">
                        Protocol Vector
                      </label>
                      <select 
                        value={activity} 
                        onChange={(e) => setActivity(e.target.value)}
                        className="w-full bg-black/90 border border-[#ff003c]/50 text-[#fce100] text-xs font-mono p-2 outline-none focus:border-white transition-colors"
                      >
                        <option value="pushups">Pushups (STR)</option>
                        <option value="running">Running (END)</option>
                        <option value="pullups">Pullups (AGI)</option>
                        <option value="squats">Squats (VIT)</option>
                        <option value="plank">Plank (CORE)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono uppercase tracking-widest text-white/50 mb-1.5">
                        {activity === 'running' ? 'Duration (MINUTES)' : activity === 'plank' ? 'Duration (SECONDS)' : 'Quantity (REPS)'}
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        value={intensity} 
                        onChange={(e) => setIntensity(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-black/90 border border-[#ff003c]/50 text-white text-xs font-mono p-1.5 outline-none focus:border-white transition-colors"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full btn-hybrid cp-cut-both py-2.5 font-mono font-bold text-xs tracking-widest"
                  >
                    [ EXECUTE ACTION COMMIT ]
                  </button>
                </form>
              </div>

              {/* Table Ledger view */}
              <div className="table-container flex-1 min-h-[220px] overflow-hidden flex flex-col bg-[rgba(10,1,3,0.6)] backdrop-blur-xl">
                
                {/* Table Title Bar */}
                <div className="px-4 py-2 bg-[#0a0104] border-b border-[#ff003c]/30 flex justify-between items-center shrink-0">
                  <span className="text-[10px] text-[#fce100] font-bold tracking-widest uppercase">
                    LOCAL_LEDGER_BUFFER
                  </span>
                  <span className="text-[8px] font-mono text-white/40">BUFFERED_RECORDS: {workoutLogs.length}</span>
                </div>

                {/* Table body */}
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-[#0a0104] sticky top-0 z-[40] border-b border-[#ff003c]/20">
                      <tr className="text-[#ff003c] text-[9px] uppercase tracking-widest font-mono">
                        <th className="px-4 py-2 w-[40%]">TIMESTAMP</th>
                        <th className="px-4 py-2 w-[35%]">ACTION COMMIT</th>
                        <th className="px-4 py-2 text-right w-[25%]">UPLINK</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs text-white/90">
                      {workoutLogs.length > 0 ? (
                        workoutLogs.map((log) => {
                          let protocolLabel = log.activity_type.toUpperCase();
                          if (log.activity_type === 'pushups') protocolLabel = 'PUSHUPS';
                          else if (log.activity_type === 'running') protocolLabel = 'RUNNING';
                          else if (log.activity_type === 'pullups') protocolLabel = 'PULLUPS';
                          else if (log.activity_type === 'squats') protocolLabel = 'SQUATS';
                          else if (log.activity_type === 'plank') protocolLabel = 'PLANK';

                          return (
                            <tr key={log.id} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                              <td className="px-4 py-2 text-white/40 text-[10px]">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-[#00f0ff] font-bold">
                                {protocolLabel} <span className="text-[#fce100]">x{log.intensity_value}</span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {log.sync_status === 1 ? (
                                  <span className="text-[8px] font-mono text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded border border-[#10b981]/30">
                                    OK
                                  </span>
                                ) : (
                                  <span className="text-[8px] font-mono text-[#fce100] bg-[#fce100]/15 px-1.5 py-0.5 rounded border border-[#fce100]/30 animate-pulse">
                                    PEND
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-4 py-12 text-center text-white/30 text-xs font-mono uppercase">
                            No records compiled. Grid initialization required.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

            </section>

          </div>

        </div>

        {/* BOTTOM INTEGRATED CLI TERMINAL BAR */}
        <div className="cli-terminal shrink-0 h-[30px] bg-black/60 border-t border-[#ff003c] flex items-center px-4 z-40">
          <span className="text-[#00f0ff] font-bold text-xs font-mono mr-3 select-none">sys@forge:~$</span>
          <input 
            type="text" 
            value={cliInput}
            onChange={(e) => setCliInput(e.target.value)}
            onKeyDown={handleCLI}
            className="bg-transparent border-none outline-none text-white font-mono text-xs flex-1 placeholder:text-[#ff003c]/40 uppercase" 
            placeholder="type 'commit str 10' or 'sync' or 'export' or 'help'..."
          />
        </div>

      </div>

      {/* Cybernetic Toast Notification */}
      {toast.show && (
        <div 
          className="fixed bottom-12 right-10 px-6 py-3 transition-all duration-300 z-[9999] font-bold uppercase text-xs hex-cut shadow-[0_0_20px_rgba(252,225,0,0.5)] border border-black"
          style={{
            backgroundColor: toast.type === 'error' ? 'var(--cp-red)' : toast.type === 'deploy' ? 'var(--cp-cyan)' : 'var(--cp-yellow)',
            color: toast.type === 'error' ? '#fff' : '#000',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
