import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL = {
  pending: 'Awaiting review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

function emptyLine(defaultTypeId) {
  return { stock_type_id: defaultTypeId, quantity: '' };
}

export default function CustomerDashboard() {
  const { user, token, logout } = useAuth();
  const [stockTypes, setStockTypes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [typesData, orderData] = await Promise.all([
        api.getStockTypes(token),
        api.getMyOrders(token),
      ]);
      setStockTypes(typesData);
      setOrders(orderData);
      setLines((current) =>
        current.length > 0 ? current : [emptyLine(typesData[0]?.id ?? '')]
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(index, field, value) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine(stockTypes[0]?.id ?? '')]);
  }

  function removeLine(index) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const items = lines
      .filter((line) => line.quantity && Number(line.quantity) > 0)
      .map((line) => ({ stock_type_id: Number(line.stock_type_id), quantity: Number(line.quantity) }));

    if (items.length === 0) {
      setError('Add at least one chicken type and quantity.');
      return;
    }

    try {
      await api.createOrder(
        {
          items,
          note,
          delivery_date: deliveryDate || null,
          delivery_location: deliveryLocation,
        },
        token
      );
      setSuccess('Your order request has been sent for review.');
      setLines([emptyLine(stockTypes[0]?.id ?? '')]);
      setNote('');
      setDeliveryDate('');
      setDeliveryLocation('');
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  function typeName(id) {
    return stockTypes.find((t) => t.id === id)?.name || 'Unknown';
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">JK</span>
          <span>Chicken Care</span>
        </div>
        <div className="topbar-right">
          <span className="who">Habari, {user.name}</span>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2 className="panel-title">Coop stock</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="gauge-row">
              {stockTypes.map((t) => {
                const pct = Math.min(100, Math.round((t.quantity / 100) * 100));
                return (
                  <div className="gauge-mini-wrap" key={t.id}>
                    <div className="gauge-mini">
                      <div className="gauge-fill" style={{ height: `${pct}%` }} />
                      <div className="gauge-value">
                        <strong>{t.quantity}</strong>
                      </div>
                    </div>
                    <span className="gauge-mini-label">{t.name}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="gauge-note">Stock updates the moment an order is accepted.</p>
        </section>

        <section className="panel">
          <h2 className="panel-title">Weka Oda yako</h2>
          <form onSubmit={handleSubmit} className="order-form">
            {lines.map((line, index) => (
              <div className="order-line" key={index}>
                <select
                  value={line.stock_type_id}
                  onChange={(e) => updateLine(index, 'stock_type_id', e.target.value)}
                >
                  {stockTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost-inline"
                    onClick={() => removeLine(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn-secondary btn-add-line" onClick={addLine}>
              + Ongeza aiina nyingine
            </button>

            <label className="field">
              <span>Uletewe Sehemu gani</span>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                required
                placeholder="e.g. Ntinda, Kampala"
              />
            </label>
            <label className="field">
              <span>Preferred delivery date (optional)</span>
              <input
                type="date"
                value={deliveryDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Note (optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Breed preference, special instructions, etc."
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}
            <button type="submit" className="btn-primary">Tuma oda yako</button>
          </form>
        </section>

        <section className="panel wide">
          <h2 className="panel-title">Your order history</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="muted">No orders yet. Your first request will appear here.</p>
          ) : (
            <table className="order-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Delivery</th>
                  <th>Note</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      {o.items.map((item) => (
                        <div key={item.stock_type_id}>
                          {item.quantity} {item.stock_type_name}
                        </div>
                      ))}
                    </td>
                    <td>
                      {o.delivery_location}
                      {o.delivery_date && (
                        <div className="muted small">
                          {new Date(o.delivery_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td>{o.note || '—'}</td>
                    <td>
                      <span className={`status status-${o.status}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                      {o.status === 'rejected' && o.admin_note && (
                        <div className="reject-reason">"{o.admin_note}"</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
