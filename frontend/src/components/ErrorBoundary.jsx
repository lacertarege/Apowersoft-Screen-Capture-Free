import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
    
    // Log adicional para debugging
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          color: '#dc2626'
        }}>
          <h2 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>
            ⚠️ Error en la aplicación
          </h2>
          <p style={{ margin: '0 0 10px 0' }}>
            Algo salió mal. Por favor, recarga la página.
          </p>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Detalles del error (para desarrolladores)
            </summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo.componentStack}
            </pre>
          </details>
          <div style={{ marginTop: '15px' }}>
            <button
              onClick={this.handleRetry}
              style={{
                marginRight: '10px',
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Reintentar ({this.state.retryCount}/3)
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Recargar página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
