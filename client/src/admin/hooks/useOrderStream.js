import { useEffect, useRef } from 'react';

export function useOrderStream(onUpdate, enabled = true) {
    const eventSourceRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        if (!enabled) {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            return;
        }

        const connect = () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            console.log('Connecting to Order Stream SSE...');
            // Standard EventSource doesn't support headers, but we use cookie-based auth
            const es = new EventSource('/api/admin/order-stream');
            eventSourceRef.current = es;

            es.onmessage = (event) => {
                if (event.data === 'connected') {
                    console.log('SSE Connected to server');
                    return;
                }
                console.log('SSE Message received:', event.data);
                if (onUpdate) onUpdate(event.data);
            };

            es.onerror = (err) => {
                console.error('SSE Connection error:', err);
                es.close();
                eventSourceRef.current = null;
                
                // Attempt to reconnect in 5 seconds
                if (enabled) {
                    console.log('Attempting SSE reconnection in 5s...');
                    reconnectTimeoutRef.current = setTimeout(connect, 5000);
                }
            };
        };

        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [onUpdate, enabled]);

    return null;
}
