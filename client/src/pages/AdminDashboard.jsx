import { Fragment, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const [stockTypes, setStockTypes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [stockEdits, setStockEdits] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeQty, setNewTypeQty] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [typesData, orderData] = await Promise.all([
        api.getStockTypes(token),
        api.getAllOrders(token),
      ]);
      setStockTypes(typesData);
      setOrders(orderData);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAccept(id) {
    setActionError('');
    try {
      await api.acceptOrder(id, token);
      loadData();
    } catch (err) {
      setActionError(err.message);
    }
  }

  function startReject(id) {
    setActionError('');
    setRejectingId(id);
    setRejectReason('');
  }

  function cancelReject() {
    setRejectingId(null);
    setRejectReason('');
  }

  async function confirmReject(id) {
    setActionError('');
    try {
      await api.rejectOrder(id, rejectReason, token);
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleStockUpdate(e, typeId) {
    e.preventDefault();
    setActionError('');
    const value = stockEdits[typeId];
    if (value === undefined || value === '') return;
    try {
      await api.updateStockType(typeId, Number(value), token);
      setStockEdits((current) => ({ ...current, [typeId]: '' }));
      loadData();
    } catch (err) {
      setActionError(err.message);
    }
  }

  async function handleAddType(e) {
    e.preventDefault();
    setActionError('');
    try {
      await api.createStockType(newTypeName, Number(newTypeQty) || 0, token);
      setNewTypeName('');
      setNewTypeQty('');
      loadData();
    } catch (err) {
      setActionError(err.message);
    }
  }

  const pending = orders.filter((o) => o.status === 'pending');
  const decided = orders.filter((o) => o.status !== 'pending');

  function itemsSummary(order) {
    return order.items.map((item) => `${item.quantity} ${item.stock_type_name}`).join(', ');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">JK</span>
          <span>Chicken Care · Admin</span>
        </div>
        <div className="topbar-right">
          <span className="who">Hi, {user.name}</span>
          <button className="btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="layout">
        <section className="panel wide">
          <h2 className="panel-title">Chagua aina ya Kuku</h2>
          {actionError && <p className="form-error">{actionError}</p>}
          {loading ? (
            <p className="muted">Loading…</p>
          ) : (
            <div className="stock-type-grid">
              {stockTypes.map((t) => {
                const pct = Math.min(100, Math.round((t.quantity / 100) * 100));
                return (
                  <div className="stock-type-card" key={t.id}>
                    <div className="gauge-mini">
                      <div className="gauge-fill" style={{ height: `${pct}%` }} />
                      <div className="gauge-value">
                        <strong>{t.quantity}</strong>
                      </div>
                    </div>
                    <span className="gauge-mini-label">{t.name}</span>
                    <form
                      className="stock-update-form"
                      onSubmit={(e) => handleStockUpdate(e, t.id)}
                    >
                      <input
                        type="number"
                        min="0"
                        placeholder="Set new total"
                        value={stockEdits[t.id] ?? ''}
                        onChange={(e) =>
                          setStockEdits((current) => ({ ...current, [t.id]: e.target.value }))
                        }
                      />
                      <button type="submit" className="btn-secondary">Update</button>
                    </form>
                  </div>
                );
              })}

              <form className="stock-type-card add-type-card" onSubmit={handleAddType}>
                <span className="gauge-mini-label">Ongeza Aina Mpya</span>
                <input
                  type="text"
                  placeholder="e.g. Turkeys"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Starting quantity"
                  value={newTypeQty}
                  onChange={(e) => setNewTypeQty(e.target.value)}
                />
                <button type="submit" className="btn-secondary">Ongeza Aina </button>
              </form>
            </div>
          )}
        </section>

        <section className="panel wide">
          <h2 className="panel-title">Maomba yanayosubiri{pending.length > 0 && `(${pending.length})`}</h2>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="muted">No pending order requests right now.</p>
          ) : (
            <table className="order-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Delivery</th>
                  <th>Note</th>
                  <th>Requested</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td>{o.customer_name}<br /><span className="muted small">{o.customer_email}</span></td>
                      <td>{itemsSummary(o)}</td>
                      <td>
                        {o.delivery_location || '—'}
                        {o.delivery_date && (
                          <div className="muted small">
                            {new Date(o.delivery_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td>{o.note || '—'}</td>
                      <td>{new Date(o.created_at).toLocaleString()}</td>
                      <td className="actions">
                        {rejectingId === o.id ? (
                          <button className="btn-ghost-inline" onClick={cancelReject}>Cancel</button>
                        ) : (
                          <>
                            <button className="btn-accept" onClick={() => handleAccept(o.id)}>Accept</button>
                            <button className="btn-reject" onClick={() => startReject(o.id)}>Reject</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {rejectingId === o.id && (
                      <tr key={`${o.id}-reason`} className="reason-row">
                        <td colSpan={6}>
                          <div className="reason-inline">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Reason for rejecting (e.g. out of stock this week)"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <button
                              className="btn-reject"
                              onClick={() => confirmReject(o.id)}
                            >
                              Confirm reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel wide">
          <h2 className="panel-title">Order history</h2>
          {decided.length === 0 ? (
            <p className="muted">Decided orders will show up here.</p>
          ) : (
            <table className="order-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((o) => (
                  <tr key={o.id}>
                    <td>{o.customer_name}</td>
                    <td>{itemsSummary(o)}</td>
                    <td>
                      {o.delivery_location || '—'}
                      {o.delivery_date && (
                        <div className="muted small">
                          {new Date(o.delivery_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td><span className={`status status-${o.status}`}>{o.status}</span></td>
                    <td>{o.status === 'rejected' ? (o.admin_note || '—') : '—'}</td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
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
