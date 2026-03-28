// utils/state.js - Global State Management
class AppState {
    constructor() {
        this.state = new Map();
        this.listeners = new Map();
    }

    set(key, value) {
        const oldValue = this.state.get(key);
        this.state.set(key, value);
        
        // Notify listeners
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                callback(value, oldValue);
            });
        }
    }

    get(key) {
        return this.state.get(key);
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.get(key)?.delete(callback);
        };
    }

    // Batch update multiple values
    batch(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    }

    // Reset state
    reset() {
        this.state.clear();
        this.listeners.clear();
    }
}

// Create global state instance
export const state = new AppState();
