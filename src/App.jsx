import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, processWorkoutAndLevelUp, getXPRequiredForLevel, ensurePlayerInitialized } from './db';
import { 
  Wifi, 
  WifiOff, 
  Dumbbell, 
  Activity, 
  TrendingUp, 
  Plus, 
  Layers, 
  Zap, 
  Heart, 
  Shield, 
  CheckCircle, 
  CloudLightning,
  AlertCircle
} from 'lucide-react';

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activity, setActivity] = useState('pushups');
  const [intensity, setIntensity] = useState(10);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // 1. Listen for network changes
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

    // Initial check
    ensurePlayerInitialized();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Fetch live data from Dexie.js
  const player = useLiveQuery(() => db.player_status.get('player_1'));
  const workoutLogs = useLiveQuery(() => 
    db.workout_logs.orderBy('timestamp').reverse().toArray()
  );

  const unsyncedCount = useLiveQuery(() => 
    db.workout_logs.where('sync_status').equals(0).count()
  );

  // 3. Automatical sync when network flips to online
  const triggerSync = async () => {
    const unsynced = await db.workout_logs.where('sync_status').equals(0).toArray();
    if (unsynced.length === 0) return;

    setSyncing(true);
    setSyncMessage(`Syncing ${unsynced.length} workout logs to grid...`);

    try {
      // Simulate API latency/sync to cloud
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Update all unsynced items to sync_status: 1
      await db.transaction('rw', db.workout_logs, async () => {
        for (const log of unsynced) {
          log.sync_status = 1;
          await db.workout_logs.put(log);
        }
      });
      setSyncMessage('Sync complete. Cloud nodes updated.');
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncMessage('Sync failed. Retrying later.');
    } finally {
      setTimeout(() => {
        setSyncing(false);
        setSyncMessage('');
      }, 3000);
    }
  };

  // 4. Handle manual workout submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (intensity <= 0) return;

    await processWorkoutAndLevelUp(activity, intensity, isOnline);
    setIntensity(10); // reset input
  };

  // 5. Calculate leveling variables
  const currentLevel = player?.current_level || 1;
  const currentXp = player?.total_xp || 0;
  const xpNeeded = getXPRequiredForLevel(currentLevel);
  const xpPercent = Math.min(100, Math.floor((currentXp / xpNeeded) * 100));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Banner & Network Monitor (Interface C) */}
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-emerald-500/50 flex items-center justify-center bg-emerald-950/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <span className="font-mono text-emerald-500 font-bold text-sm tracking-tighter">AFG</span>
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-wide uppercase text-neutral-200">
                Ascension Forger <span className="text-emerald-500">Grid</span>
              </h1>
              <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                Offline-First PWA Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Sync Notifications */}
            {syncMessage && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1 rounded animate-pulse">
                {syncMessage}
              </span>
            )}

            {/* Network Flag */}
            {isOnline ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-xs font-semibold tracking-wide shadow-grid-glow">
                <Wifi className="w-3.5 h-3.5 animate-pulse" />
                <span className="font-mono uppercase text-[10px]">Grid Sync Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-950/20 text-red-400 text-xs font-semibold tracking-wide shadow-grid-glow-red">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="font-mono uppercase text-[10px]">Local Standalone Node</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Player Hub (Interface B) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden shadow-2xl">
            {/* Geometric accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl"></div>
            
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Player Profile</h2>
              </div>
              <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded border border-neutral-700">
                NODE_1
              </span>
            </div>

            {/* Level & XP Gauge */}
            <div className="flex items-center gap-5 mb-6">
              <div className="w-20 h-20 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col items-center justify-center shadow-inner relative group">
                <div className="absolute inset-0 border border-emerald-500/10 rounded-xl group-hover:border-emerald-500/30 transition-all duration-300"></div>
                <span className="text-[10px] font-mono uppercase text-neutral-500 tracking-wider">LVL</span>
                <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">{currentLevel}</span>
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs font-mono uppercase text-neutral-400">Grid Experience (XP)</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">{currentXp} <span className="text-neutral-500">/ {xpNeeded}</span></span>
                </div>
                <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800 p-[2px]">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${xpPercent}%` }}
                  ></div>
                </div>
                <p className="text-[10px] font-mono text-neutral-500 mt-1 uppercase text-right tracking-wider">
                  {xpPercent}% TO NEXT FORGE
                </p>
              </div>
            </div>

            {/* Stats list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Attribute Grid</h3>
              
              {/* STR */}
              <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800/80 hover:border-emerald-500/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Dumbbell className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Strength (STR)</span>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold">{player?.str?.toFixed(1) || '10.0'}</span>
              </div>

              {/* END */}
              <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800/80 hover:border-emerald-500/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Endurance (END)</span>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold">{player?.end?.toFixed(1) || '10.0'}</span>
              </div>

              {/* AGI */}
              <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800/80 hover:border-emerald-500/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Agility (AGI)</span>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold">{player?.agi?.toFixed(1) || '10.0'}</span>
              </div>

              {/* VIT */}
              <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800/80 hover:border-emerald-500/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Heart className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Vitality (VIT)</span>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold">{player?.vit?.toFixed(1) || '10.0'}</span>
              </div>

              {/* CORE */}
              <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800/80 hover:border-emerald-500/20 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">Core (CORE)</span>
                </div>
                <span className="font-mono text-sm text-emerald-400 font-bold">{player?.core?.toFixed(1) || '10.0'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Workout Entry (Interface A) & Sync Log (Interface C) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Workout Entry Panel (Interface A) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Log Activity</h2>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1.5">
                    Activity Type
                  </label>
                  <select 
                    value={activity} 
                    onChange={(e) => setActivity(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3.5 py-2.5 text-neutral-200 text-sm font-semibold tracking-wide focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="pushups">Pushups (Strength)</option>
                    <option value="running">Running (Endurance)</option>
                    <option value="pullups">Pullups (Agility)</option>
                    <option value="squats">Squats (Vitality)</option>
                    <option value="plank">Plank (Core)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1.5">
                    {activity === 'running' ? 'Duration (mins)' : activity === 'plank' ? 'Duration (secs)' : 'Repetitions'}
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={intensity} 
                    onChange={(e) => setIntensity(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3.5 py-2 text-neutral-200 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold uppercase tracking-widest py-3 px-4 rounded text-xs transition-all duration-200 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-grid-glow-strong flex items-center justify-center gap-2"
              >
                <CloudLightning className="w-4 h-4" />
                Commit Workout to Local Grid
              </button>
            </form>
          </div>

          {/* Sync status & recent logs list (Interface C) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex-1 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Grid Activity Logs</h2>
              </div>
              
              <div className="flex items-center gap-2">
                {unsyncedCount > 0 && (
                  <button 
                    disabled={!isOnline || syncing}
                    onClick={triggerSync}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded border uppercase tracking-wider transition-all duration-200 ${
                      isOnline 
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500 hover:text-black cursor-pointer' 
                        : 'bg-neutral-800 text-neutral-600 border-neutral-700 cursor-not-allowed'
                    }`}
                  >
                    Force Sync ({unsyncedCount})
                  </button>
                )}
                <span className="text-[10px] font-mono text-neutral-500 uppercase">
                  Total: {workoutLogs?.length || 0}
                </span>
              </div>
            </div>

            {/* List block */}
            <div className="flex-1 overflow-y-auto max-h-[260px] space-y-2 pr-1">
              {workoutLogs && workoutLogs.length > 0 ? (
                workoutLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3 bg-neutral-950 rounded border border-neutral-850 flex items-center justify-between hover:border-neutral-750 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-200">
                          {log.activity_type}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400">
                          x{log.intensity_value}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-neutral-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      {log.sync_status === 1 ? (
                        <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-emerald-500 bg-emerald-950/10 border border-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Synced
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] font-mono uppercase text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Local-Only
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <Activity className="w-8 h-8 text-neutral-700 mb-2 animate-pulse" />
                  <p className="text-xs font-mono text-neutral-500 uppercase">
                    Grid is empty. Initiate active training.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer stats */}
      <footer className="border-t border-neutral-800 bg-neutral-950 px-4 py-3.5 sm:px-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          <span>Engine v1.0.0 (Local-First)</span>
          <span>IndexedDB Status: OK</span>
        </div>
      </footer>
    </div>
  );
}
