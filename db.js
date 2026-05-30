import Dexie from 'dexie';

// Initialize the Ascension Forger Grid Local Database
export const db = new Dexie('AFG_Local_Grid');

db.version(1).stores({
    // Player state: Stores current level, total XP, and stat arrays
    player_status: 'id, current_level, total_xp',

    // Workout logs queue: Tracks workouts offline before syncing to cloud
    workout_logs: '++id, activity_type, intensity_value, timestamp, sync_status'
});

// The AFG Core Conversion Engine Logic
export const calculateXPYield = (activity, durationOrReps) => {
    const baseModifiers = {
        pushups: { STR: 1.2, CORE: 0.4, baseXP: 5 },
        running: { END: 1.5, VIT: 0.8, baseXP: 10 },
        pullups: { STR: 1.5, AGI: 0.3, baseXP: 8 }
    };

    const modifier = baseModifiers[activity] || { baseXP: 2 };
    return Math.floor(durationOrReps * modifier.baseXP);
};