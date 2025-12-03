import { useSyncExternalStore } from "react";
import { WatchModeEvent } from "./types";

type Listener = () => void;

let recentEvents: WatchModeEvent[] = [];
const listeners = new Set<Listener>();

function emit() {
    listeners.forEach((listener) => listener());
}

export function addWatchModeEvent(event: WatchModeEvent) {
    recentEvents = [event, ...recentEvents].slice(0, 5);
    emit();
}

export function setWatchModeEvents(events: WatchModeEvent[]) {
    recentEvents = events.slice(0, 5);
    emit();
}

export function clearWatchModeEvents() {
    if (recentEvents.length === 0) {
        return;
    }
    recentEvents = [];
    emit();
}

function subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    return recentEvents;
}

export function useWatchModeEvents() {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
