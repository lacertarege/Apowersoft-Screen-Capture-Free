// Web Worker para manejar la actualización de precios en segundo plano
self.onmessage = function(e) {
  const { tickerId, apiUrl } = e.data;
  
  // Función para hacer la llamada API de actualización
  async function updatePrices() {
    try {
      const response = await fetch(`${apiUrl}/tickers/${tickerId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Enviar resultado exitoso al hilo principal
      self.postMessage({
        success: true,
        data: data,
        tickerId: tickerId
      });
      
    } catch (error) {
      // Enviar error al hilo principal
      self.postMessage({
        success: false,
        error: error.message,
        tickerId: tickerId
      });
    }
  }
  
  // Ejecutar la actualización
  updatePrices();
};



