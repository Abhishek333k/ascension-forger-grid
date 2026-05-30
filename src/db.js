import Dexie from 'dexie';

// Initialize the Ascension Forger Grid Local Database
export const db = new Dexie('AFG_Local_Grid');

db.version(1).stores({
    // Player status: Stores current level, total XP, and attributes (str, end, agi, vit, core)
    player_status: 'id, current_level, total_xp, str, end, agi, vit, core',

    // Workout logs: Stores workout logs before syncing. Primary key ++id.
    // Index sync_status so we can query unsynced logs easily.
    workout_logs: '++id, activity_type, intensity_value, timestamp, sync_status'
});

// Seed initial player status if database is empty
db.on('populate', () => {
    db.player_status.add({
        id: 'player_1',
        current_level: 1,
        total_xp: 0,
        str: 10.0,
        end: 10.0,
        agi: 10.0,
        vit: 10.0,
        core: 10.0
    });
});

// Ensure player is initialized if populating did not run for some reason
export const ensurePlayerInitialized = async () => {
    const player = await db.player_status.get('player_1');
    if (!player) {
        await db.player_status.add({
            id: 'player_1',
            current_level: 1,
            total_xp: 0,
            str: 10.0,
            end: 10.0,
            agi: 10.0,
            vit: 10.0,
            core: 10.0
        });
    }
};

// Compounding leveling curve: XP_Required = Math.floor(100 * Math.pow(Current_Level, 1.5))
export const getXPRequiredForLevel = (level) => {
    return Math.floor(100 * Math.pow(level, 1.5));
};

// Workout modifier algorithm mapping workout types to attributes and XP
export const calculateWorkoutYield = (activityType, intensityValue) => {
    const mappings = {
        pushups: { attribute: 'str', xpMultiplier: 5, attrGain: 0.1 },
        running: { attribute: 'end', xpMultiplier: 8, attrGain: 0.15 },
        pullups: { attribute: 'agi', xpMultiplier: 6, attrGain: 0.12 },
        squats: { attribute: 'vit', xpMultiplier: 5, attrGain: 0.1 },
        plank: { attribute: 'core', xpMultiplier: 7, attrGain: 0.08 }
    };

    const config = mappings[activityType.toLowerCase()] || { attribute: 'str', xpMultiplier: 2, attrGain: 0.05 };
    const xpYield = Math.floor(intensityValue * config.xpMultiplier);
    
    return {
        xpYield,
        attribute: config.attribute,
        attributeGain: Number((intensityValue * config.attrGain).toFixed(2))
    };
};

// Pure algorithm to add workout log and recalculate player levels & stats
export const processWorkoutAndLevelUp = async (activityType, intensityValue, isOnline) => {
    // 1. Add workout to log
    const timestamp = Date.now();
    await db.workout_logs.add({
        activity_type: activityType,
        intensity_value: Number(intensityValue),
        timestamp,
        sync_status: isOnline ? 1 : 0 // 1 for synced, 0 for unsynced/local-only
    });

    // 2. Retrieve current player status
    await ensurePlayerInitialized();
    const player = await db.player_status.get('player_1');
    
    // 3. Calculate yields
    const { xpYield, attribute, attributeGain } = calculateWorkoutYield(activityType, intensityValue);
    
    let newXp = player.total_xp + xpYield;
    let currentLevel = player.current_level;
    
    // 4. Process compounding level ups
    while (true) {
        const xpRequired = getXPRequiredForLevel(currentLevel);
        if (newXp >= xpRequired) {
            newXp -= xpRequired;
            currentLevel += 1;
        } else {
            break;
        }
    }

    // Update the player stats
    const updatedStats = {
        ...player,
        current_level: currentLevel,
        total_xp: newXp,
        [attribute]: Number((player[attribute] + attributeGain).toFixed(2))
    };

    await db.player_status.put(updatedStats);
    return updatedStats;
};
