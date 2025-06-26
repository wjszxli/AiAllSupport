export interface WindowState {
    position: { x: number; y: number };
    size: { width: number; height: number };
    isVisible: boolean;
    isPinned: boolean;
    provider: string | null;
}

export type ActionType =
    | { type: 'SET_POSITION'; payload: { x: number; y: number } }
    | { type: 'SET_SIZE'; payload: { width: number; height: number } }
    | { type: 'SET_VISIBILITY'; payload: boolean }
    | { type: 'TOGGLE_PIN' }
    | { type: 'INITIALIZE'; payload: { provider: string | null } };
