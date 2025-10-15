import { useState, useCallback } from 'react';
import { API } from '../ui/config';

export function usePriceUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null);

  const updatePrices = useCallback(async (tickerId, onSuccess, onError) => {
    setIsUpdating(true);
    setUpdateProgress({ status: 'starting', message: 'Iniciando actualización...' });

    try {
      // Usar AbortController para cancelar la operación si es necesario
      const controller = new AbortController();
      
      // Función para simular progreso
      const progressInterval = setInterval(() => {
        setUpdateProgress(prev => ({
          ...prev,
          status: 'processing',
          message: 'Consultando servicios de precios...'
        }));
      }, 1000);

      const response = await fetch(`${API}/tickers/${tickerId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      setUpdateProgress({
        status: 'completed',
        message: 'Actualización completada',
        data: data
      });

      if (onSuccess) {
        onSuccess(data);
      }

      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        setUpdateProgress({
          status: 'cancelled',
          message: 'Actualización cancelada'
        });
      } else {
        setUpdateProgress({
          status: 'error',
          message: error.message || 'Error al actualizar precios'
        });
      }

      if (onError) {
        onError(error);
      }

      throw error;
    } finally {
      setIsUpdating(false);
      // Limpiar el progreso después de un tiempo
      setTimeout(() => {
        setUpdateProgress(null);
      }, 5000);
    }
  }, []);

  return {
    isUpdating,
    updateProgress,
    updatePrices
  };
}



