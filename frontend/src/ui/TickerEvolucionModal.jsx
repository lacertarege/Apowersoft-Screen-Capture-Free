
import React from 'react'
import TickerEvolucionTable from './TickerEvolucionTable.jsx'

export default function TickerEvolucionModal({ open, onClose, tickerId }) {
    if (!open) return null

    return (
        <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
            <div className="modal-content" style={{ maxWidth: '90vw', width: '1100px', maxHeight: '90vh', padding: '0' }}>
                <div className="modal-header" style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Detalle de Evolución</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: '#6b7280'
                        }}
                    >
                        ×
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '0 20px 20px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(90vh - 65px)' }}>
                    <TickerEvolucionTable tickerId={tickerId} isModal={true} />
                </div>
            </div>
        </div>
    )
}

