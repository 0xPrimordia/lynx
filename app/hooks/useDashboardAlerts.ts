'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function useDashboardAlerts() {
  const lastCheckRef = useRef<string | null>(null);

  useEffect(() => {
    const alertTopicId = process.env.NEXT_PUBLIC_DASHBOARD_ALERT_TOPIC;
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

    if (!alertTopicId) {
      console.log('[DashboardAlerts] No DASHBOARD_ALERT_TOPIC configured');
      return;
    }

    const mirrorUrl = network === 'mainnet' 
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';

    const checkForNewMessages = async () => {
      try {
        const url = `${mirrorUrl}/api/v1/topics/${alertTopicId}/messages?limit=5&order=desc`;
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error(`[DashboardAlerts] API error: ${response.status}`);
          return;
        }

        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          // If this is the first run, just set the timestamp and skip ALL messages
          if (!lastCheckRef.current) {
            const newestMessage = data.messages[0]; // messages are in desc order
            lastCheckRef.current = newestMessage.consensus_timestamp;
            console.log(`[DashboardAlerts] Started listening for new alerts`);
            return; // Skip processing any existing messages
          }
          
          // Process messages in chronological order (oldest first) for subsequent runs
          const messages = data.messages.reverse();
          
          for (const message of messages) {
            // Only process messages newer than our last check
            if (message.consensus_timestamp <= lastCheckRef.current) {
              continue; // Skip old messages
            }
            
            try {
              const content = atob(message.message);
              toast(content, {
                duration: 8000,
              });
            } catch (error) {
              console.error('[DashboardAlerts] Failed to decode message:', error);
            }
          }
          
          if (messages.length > 0 && messages[messages.length - 1].consensus_timestamp > lastCheckRef.current) {
            // Update last check timestamp to the newest message
            lastCheckRef.current = messages[messages.length - 1].consensus_timestamp;
          }
        }
      } catch (error) {
        console.error(`[DashboardAlerts] Error:`, error);
      }
    };

    // Initial check and set up polling
    checkForNewMessages();
    const intervalId = setInterval(checkForNewMessages, 2000); // Check every 2 seconds

    console.log(`[DashboardAlerts] Monitoring ${alertTopicId} for dashboard alerts`);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
}