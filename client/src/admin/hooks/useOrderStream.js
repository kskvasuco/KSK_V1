import { useEffect, useRef } from 'react';

export function useOrderStream(onUpdate, enabled = true) {
    const eventSourceRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        // Temporarily disabled SSE - admin panel doesn't have this endpoint yet
        // TODO: Add SSE endpoint to backend
        console.log('SSE not yet implemented for React admin panel');

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
        };
    }, [onUpdate, enabled]);

    return null;
}
