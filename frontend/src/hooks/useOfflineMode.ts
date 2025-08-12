import { useState, useEffect, useCallback, useRef } from 'react';

interface QueuedOperation {
  id: string;
  type: 'assignment' | 'update' | 'completion';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineModeConfig {
  maxRetries?: number;
  retryDelay?: number;
  queueKey?: string;
}

export const useOfflineMode = (config: OfflineModeConfig = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 5000,
    queueKey = 'offline_queue'
  } = config;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Load queue from localStorage
  const loadQueue = useCallback((): QueuedOperation[] => {
    try {
      const savedQueue = localStorage.getItem(queueKey);
      return savedQueue ? JSON.parse(savedQueue) : [];
    } catch (error) {
      console.error('[OfflineMode] Failed to load queue:', error);
      return [];
    }
  }, [queueKey]);

  // Save queue to localStorage
  const saveQueue = useCallback((queue: QueuedOperation[]) => {
    try {
      localStorage.setItem(queueKey, JSON.stringify(queue));
      setQueueSize(queue.length);
    } catch (error) {
      console.error('[OfflineMode] Failed to save queue:', error);
    }
  }, [queueKey]);

  // Add operation to queue
  const queueOperation = useCallback((
    type: QueuedOperation['type'],
    data: any,
    customMaxRetries?: number
  ): string => {
    const operation: QueuedOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: customMaxRetries || maxRetries
    };

    const queue = loadQueue();
    queue.push(operation);
    saveQueue(queue);

    console.log(`[OfflineMode] Queued operation: ${operation.id}`);
    return operation.id;
  }, [loadQueue, saveQueue, maxRetries]);

  // Remove operation from queue
  const removeFromQueue = useCallback((operationId: string) => {
    const queue = loadQueue();
    const updatedQueue = queue.filter(op => op.id !== operationId);
    saveQueue(updatedQueue);
    console.log(`[OfflineMode] Removed operation: ${operationId}`);
  }, [loadQueue, saveQueue]);

  // Process a single queued operation
  const processOperation = useCallback(async (operation: QueuedOperation): Promise<boolean> => {
    try {
      let result;
      
      switch (operation.type) {
        case 'assignment':
          // Mock API call for assignment
          result = await fetch('/api/assignments/blind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(operation.data)
          });
          break;
          
        case 'update':
          // Mock API call for update
          result = await fetch(`/api/assignments/${operation.data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(operation.data)
          });
          break;
          
        case 'completion':
          // Mock API call for completion
          result = await fetch(`/api/assignments/${operation.data.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      if (result && result.ok) {
        console.log(`[OfflineMode] Successfully processed: ${operation.id}`);
        return true;
      } else {
        throw new Error(`API call failed: ${result?.status} ${result?.statusText}`);
      }
    } catch (error) {
      console.error(`[OfflineMode] Failed to process operation ${operation.id}:`, error);
      return false;
    }
  }, []);

  // Process entire queue
  const processQueue = useCallback(async () => {
    if (!isOnline || isProcessingQueue) return;

    setIsProcessingQueue(true);
    const queue = loadQueue();
    
    if (queue.length === 0) {
      setIsProcessingQueue(false);
      return;
    }

    console.log(`[OfflineMode] Processing ${queue.length} queued operations`);
    const updatedQueue: QueuedOperation[] = [];

    for (const operation of queue) {
      const success = await processOperation(operation);
      
      if (success) {
        // Operation successful, don't re-queue
        continue;
      } else {
        // Operation failed, check if we should retry
        operation.retryCount++;
        
        if (operation.retryCount < operation.maxRetries) {
          updatedQueue.push(operation);
          console.log(`[OfflineMode] Retry ${operation.retryCount}/${operation.maxRetries} for: ${operation.id}`);
        } else {
          console.error(`[OfflineMode] Max retries exceeded for: ${operation.id}`);
          // Could emit an event here for failed operations
        }
      }
    }

    saveQueue(updatedQueue);
    setIsProcessingQueue(false);

    // If there are still items in queue and we're online, schedule retry
    if (updatedQueue.length > 0 && isOnline) {
      retryTimeoutRef.current = setTimeout(() => {
        processQueue();
      }, retryDelay);
    }
  }, [isOnline, isProcessingQueue, loadQueue, processOperation, saveQueue, retryDelay]);

  // Execute operation with automatic queuing if offline
  const executeOperation = useCallback(async (
    type: QueuedOperation['type'],
    data: any,
    options: { immediate?: boolean; maxRetries?: number } = {}
  ): Promise<{ success: boolean; queued: boolean; operationId?: string }> => {
    if (!isOnline || !options.immediate) {
      // Queue the operation
      const operationId = queueOperation(type, data, options.maxRetries);
      return { success: false, queued: true, operationId };
    }

    try {
      // Try immediate execution
      const operation: QueuedOperation = {
        id: `immediate_${Date.now()}`,
        type,
        data,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: options.maxRetries || maxRetries
      };

      const success = await processOperation(operation);
      
      if (success) {
        return { success: true, queued: false };
      } else {
        // Failed, queue for retry
        const operationId = queueOperation(type, data, options.maxRetries);
        return { success: false, queued: true, operationId };
      }
    } catch (error) {
      console.error('[OfflineMode] Immediate execution failed:', error);
      const operationId = queueOperation(type, data, options.maxRetries);
      return { success: false, queued: true, operationId };
    }
  }, [isOnline, queueOperation, processOperation, maxRetries]);

  // Clear failed operations
  const clearFailedOperations = useCallback(() => {
    const queue = loadQueue();
    const activeQueue = queue.filter(op => op.retryCount < op.maxRetries);
    saveQueue(activeQueue);
    console.log('[OfflineMode] Cleared failed operations');
  }, [loadQueue, saveQueue]);

  // Get queue status
  const getQueueStatus = useCallback(() => {
    const queue = loadQueue();
    const failed = queue.filter(op => op.retryCount >= op.maxRetries);
    const pending = queue.filter(op => op.retryCount < op.maxRetries);
    
    return {
      total: queue.length,
      pending: pending.length,
      failed: failed.length,
      operations: queue
    };
  }, [loadQueue]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[OfflineMode] Back online - processing queue');
      // Small delay to ensure connection is stable
      setTimeout(() => processQueue(), 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[OfflineMode] Gone offline - operations will be queued');
      
      // Clear any pending retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue processing if online
    if (isOnline) {
      processQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [processQueue, isOnline]);

  // Update queue size on mount
  useEffect(() => {
    const queue = loadQueue();
    setQueueSize(queue.length);
  }, [loadQueue]);

  return {
    isOnline,
    isProcessingQueue,
    queueSize,
    executeOperation,
    queueOperation,
    removeFromQueue,
    processQueue,
    clearFailedOperations,
    getQueueStatus
  };
};