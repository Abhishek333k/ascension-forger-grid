import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, processWorkoutAndLevelUp, getXPRequiredForLevel, ensurePlayerInitialized } from './db';

// Custom SVG-based Cybernetic Radar Chart (Lightweight, Offline-Ready, No Dependencies)
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

  // 4 concentric grid rings (25%, 50%, 75%, 100%)
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
    <svg viewBox="0 0 200 200" className="w-full h-full max-h-[220px] mx-auto select-none">
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

      {/* Text labels (STR, END, AGI, VIT, CORE) */}
      {labels.map((lbl, i) => {
        const pos = labelPositions[i];
        let textAnchor = "middle";
        if (i === 1 || i === 2) textAnchor = "start";
        if (i === 3 || i === 4) textAnchor = "end";
        
        // Fine-tune Y offset for text alignment
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

  // Level Up Breached State (Phase 2 Visual Alerts)
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ old: 1, new: 1 });
  const prevLevelRef = useRef(null);

  // Network State and player bootstrap setup
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    ensurePlayerInitialized();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Live query indices
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

  // Sync Telemetry Mock
  const triggerSync = async () => {
    const unsynced = await db.workout_logs.where('sync_status').equals(0).toArray();
    if (unsynced.length === 0) return;

    setSyncing(true);
    setSyncMessage(`Pushing ${unsynced.length} records to cloud...`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await db.transaction('rw', db.workout_logs, async () => {
        for (const log of unsynced) {
          log.sync_status = 1;
          await db.workout_logs.put(log);
        }
      });
      setSyncMessage('Uplink synchronized successfully.');
    } catch (err) {
      console.error('Uplink synchronization failed:', err);
      setSyncMessage('Uplink failed. Local buffer preserved.');
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
  };

  // Data Sovereignty (Phase 3)
  const exportTelemetry = async () => {
    const statusData = await db.player_status.toArray();
    const logsData = await db.workout_logs.toArray();
    const dataStr = JSON.stringify({ player_status: statusData, workout_logs: logsData }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vf_node_telemetry_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hardResetNode = async () => {
    if (window.confirm("WARNING: INITIALIZING COMPLETE SYSTEM PURGE. ALL LOCAL DATA WILL BE DELETED. PROCEED?")) {
      await db.transaction('rw', db.player_status, db.workout_logs, async () => {
        await db.player_status.clear();
        await db.workout_logs.clear();
      });
      await ensurePlayerInitialized();
      window.location.reload();
    }
  };

  // Calculations
  const currentLevel = player?.current_level || 1;
  const currentXp = player?.total_xp || 0;
  const xpNeeded = getXPRequiredForLevel(currentLevel);
  const xpPercent = Math.min(100, Math.floor((currentXp / xpNeeded) * 100));

  return (
    <div className="p-3 sm:p-5 min-h-screen bg-[#050102] flex flex-col justify-center items-center relative overflow-hidden font-rajdhani selection:bg-cpRed selection:text-black">
      {/* Visual backgrounds */}
      <div className="bg-matrix"></div>
      <div className="scanlines"></div>

      {/* Level Up Flashing Alert Modal (Phase 2 Visual Alerts) */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center backdrop-blur-md p-4">
          <div className="bg-[#20050a] border-2 border-[#ff003c] p-6 sm:p-8 max-w-md w-full hex-cut shadow-[0_0_50px_rgba(255,0,60,0.6)] animate-warning-flash text-center relative">
            <div className="absolute top-2 right-3 font-mono text-[9px] text-[#ff003c]/60">SYS_INTERCEPT_ALARM</div>
            
            <h2 className="text-[#ff003c] text-xl sm:text-2xl font-black uppercase tracking-widest mb-4 border-b border-[#ff003c]/30 pb-2 animate-text-glitch">
              RATING_UPGRADE_DETECTED
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

      {/* Main Terminal Frame */}
      <div className="relative z-10 flex-1 w-full max-w-6xl bg-[rgba(20,2,5,0.85)] backdrop-blur-xl border-2 border-[#ff003c] hex-cut p-4 md:p-6 flex flex-col gap-4 shadow-[inset_0_0_50px_rgba(255,0,60,0.2)]">
        
        {/* Terminal Header */}
        <header className="flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center border-b border-[#ff003c]/30 pb-4 shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-widest text-[#ff003c] uppercase drop-shadow-[0_0_8px_rgba(255,0,60,0.4)]">
              VAULT_FORGE // OS
            </h1>
            <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
              SECURE TELEMETRY INTERFACE // ACTIVE
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 justify-center">
            {syncMessage && (
              <span className="text-[10px] font-mono text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/30 px-2 py-0.5 rounded animate-pulse">
                {syncMessage}
              </span>
            )}
            
            {/* Action Buttons (Phase 3 Data Sovereignty) */}
            <button 
              onClick={exportTelemetry} 
              className="text-[#00f0ff] text-[10px] font-bold uppercase font-mono border border-[#00f0ff]/40 px-2 py-1 hover:bg-[#00f0ff] hover:text-black transition-colors"
            >
              [ EXPORT TELEMETRY ]
            </button>
            <button 
              onClick={hardResetNode} 
              className="text-[#ff003c] text-[10px] font-bold uppercase font-mono border border-[#ff003c]/40 px-2 py-1 hover:bg-[#ff003c] hover:text-black transition-colors"
            >
              [ RESET NODE ]
            </button>

            {/* Network indicator */}
            <div className="font-mono text-right text-[10px] uppercase font-bold pl-2 border-l border-white/15">
              {isOnline ? (
                <span className="text-[#00f0ff] animate-pulse">UPLINK: ONLINE</span>
              ) : (
                <span className="text-[#fce100] animate-pulse">UPLINK: OFFLINE</span>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
          
          {/* LEFT PANEL: Operator Profile & Attributes Map (Radar Component) */}
          <section className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Rating card */}
            <div className="bg-black/55 border border-[#ff003c]/35 p-4 hex-cut-inv flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-[#ff003c]/20 pb-2">
                <span className="text-xs font-mono font-bold text-[#00f0ff] uppercase">OPERATOR_PROFILE</span>
                <span className="text-[9px] font-mono bg-[#ff003c]/20 text-[#ff003c] px-2 py-0.5 rounded border border-[#ff003c]/30">NODE_01</span>
              </div>
              
              <div className="flex items-center gap-5">
                {/* Level Display */}
                <div className="w-20 h-20 bg-black/90 border-2 border-[#ff003c] rounded flex flex-col items-center justify-center shadow-[0_0_15px_rgba(255,0,60,0.2)] relative">
                  <span className="text-[9px] font-mono text-white/40 uppercase">OUTPUT_RATING</span>
                  <span className="text-3xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
                    {currentLevel}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[10px] font-mono uppercase text-white/50">OUTPUT_YIELD (XP)</span>
                    <span className="text-xs font-mono text-[#00f0ff] font-bold">
                      {currentXp} <span className="text-white/30">/ {xpNeeded}</span>
                    </span>
                  </div>
                  <div className="w-full h-3 bg-black border border-[#ff003c]/30 p-[1.5px] rounded-none">
                    <div 
                      className="h-full bg-gradient-to-r from-[#ff003c] to-[#fce100] transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,0,60,0.5)]" 
                      style={{ width: `${xpPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-[8px] font-mono text-white/40 mt-1 uppercase text-right tracking-widest">
                    {xpPercent}% COMPRESSION TO NEXT RATING BREACH
                  </p>
                </div>
              </div>

              {/* Dynamic SVG Radar Chart Component (Phase 2 Objective) */}
              <div className="border border-[#ff003c]/20 bg-black/40 p-2 relative flex items-center justify-center h-[230px]">
                <div className="absolute top-2 left-2 font-mono text-[8px] text-[#ff003c]/40 uppercase">VISUALIZATION_DECK</div>
                <RadarChart stats={player || { str: 10, end: 10, agi: 10, vit: 10, core: 10 }} />
              </div>
            </div>

            {/* List of Attribute Levels */}
            <div className="bg-black/40 border border-white/10 p-3 flex flex-col gap-2 flex-1 overflow-y-auto">
              <span className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">
                ATTRIBUTE_GRID
              </span>
              
              {/* STR */}
              <div className="flex items-center justify-between p-2 rounded bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Strength (STR)</span>
                <span className="font-mono text-sm text-[#00f0ff] font-bold">{player?.str?.toFixed(1) || '10.0'}</span>
              </div>
              {/* END */}
              <div className="flex items-center justify-between p-2 rounded bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Endurance (END)</span>
                <span className="font-mono text-sm text-[#00f0ff] font-bold">{player?.end?.toFixed(1) || '10.0'}</span>
              </div>
              {/* AGI */}
              <div className="flex items-center justify-between p-2 rounded bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Agility (AGI)</span>
                <span className="font-mono text-sm text-[#00f0ff] font-bold">{player?.agi?.toFixed(1) || '10.0'}</span>
              </div>
              {/* VIT */}
              <div className="flex items-center justify-between p-2 rounded bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Vitality (VIT)</span>
                <span className="font-mono text-sm text-[#00f0ff] font-bold">{player?.vit?.toFixed(1) || '10.0'}</span>
              </div>
              {/* CORE */}
              <div className="flex items-center justify-between p-2 rounded bg-black/50 border border-[#ff003c]/20 hover:border-[#ff003c]/60 transition-colors">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Core (CORE)</span>
                <span className="font-mono text-sm text-[#00f0ff] font-bold">{player?.core?.toFixed(1) || '10.0'}</span>
              </div>
            </div>

          </section>

          {/* RIGHT PANEL: Input Deck & Activity Log Ledger */}
          <section className="lg:col-span-7 flex flex-col gap-4 min-h-0">
            
            {/* Input Deck (Action Committer form) */}
            <div className="bg-black/50 border border-[#ff003c]/35 p-4 hex-cut shadow-[0_0_15px_rgba(255,0,60,0.15)] shrink-0">
              <span className="text-xs font-mono font-bold text-[#fce100] uppercase block border-b border-[#ff003c]/20 pb-2 mb-4">
                TRAINING_TELEMETRY_LOG
              </span>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50 mb-1.5">
                      Activity Protocol
                    </label>
                    <select 
                      value={activity} 
                      onChange={(e) => setActivity(e.target.value)}
                      className="w-full bg-black/90 border border-[#ff003c]/50 text-[#fce100] text-xs font-mono p-2.5 outline-none focus:border-white transition-colors"
                    >
                      <option value="pushups">SYS.ACTION.PUSHUPS (STR)</option>
                      <option value="running">SYS.ACTION.RUNNING (END)</option>
                      <option value="pullups">SYS.ACTION.PULLUPS (AGI)</option>
                      <option value="squats">SYS.ACTION.SQUATS (VIT)</option>
                      <option value="plank">SYS.ACTION.PLANK (CORE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-white/50 mb-1.5">
                      {activity === 'running' ? 'Duration (MINUTES)' : activity === 'plank' ? 'Duration (SECONDS)' : 'Quantity (REPETITIONS)'}
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={intensity} 
                      onChange={(e) => setIntensity(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-black/90 border border-[#ff003c]/50 text-white text-xs font-mono p-2 outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full btn-hybrid cp-cut-both py-3 font-mono font-bold text-xs tracking-widest"
                >
                  [ COMMIT TELEMETRY SEQUENCE ]
                </button>
              </form>
            </div>

            {/* Local Logs Ledger */}
            <div className="bg-black/55 border border-white/10 p-4 flex flex-col flex-1 min-h-[220px] overflow-hidden">
              <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#fce100] uppercase">LOCAL_LEDGER_BUFFER</span>
                  {unsyncedCount > 0 && (
                    <button 
                      disabled={!isOnline || syncing}
                      onClick={triggerSync}
                      className={`text-[9px] font-mono px-2 py-0.5 border uppercase tracking-wider transition-colors ${
                        isOnline 
                          ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]/40 hover:bg-[#00f0ff] hover:text-black cursor-pointer' 
                          : 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                      }`}
                    >
                      Sync Buffer ({unsyncedCount})
                    </button>
                  )}
                </div>
                <span className="text-[10px] font-mono text-white/40">TOTAL_LOGS: {workoutLogs.length}</span>
              </div>

              {/* Logs loop */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {workoutLogs.length > 0 ? (
                  workoutLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="p-2.5 bg-black/60 border border-white/5 flex items-center justify-between hover:border-[#ff003c]/40 transition-colors"
                    >
                      <div className="font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#00f0ff] font-bold">sys@afg:~$</span>
                          <span className="text-white uppercase font-bold tracking-wide">{log.activity_type}</span>
                          <span className="text-white/40">//</span>
                          <span className="text-[#fce100]">V:{log.intensity_value}</span>
                        </div>
                        <span className="text-[9px] text-white/30 block mt-0.5">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div>
                        {log.sync_status === 1 ? (
                          <span className="text-[9px] font-mono uppercase text-[#10b981] bg-[#10b981]/15 border border-[#10b981]/30 px-2 py-0.5">
                            UPLINKED
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono uppercase text-[#fce100] bg-[#fce100]/15 border border-[#fce100]/30 px-2 py-0.5">
                            BUFFERED
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 opacity-40">
                    <span className="text-xs font-mono text-white uppercase tracking-widest">
                      Ledger buffer empty. Awaiting physical training.
                    </span>
                  </div>
                )}
              </div>

            </div>

          </section>

        </div>

        {/* Footer */}
        <footer className="border-t border-[#ff003c]/20 pt-3 flex justify-between items-center text-[9px] font-mono text-white/30 uppercase tracking-widest shrink-0">
          <span>VF_OS // NODE_NODE_LOCAL</span>
          <span>SYSTEM_READY</span>
        </footer>

      </div>
    </div>
  );
}
