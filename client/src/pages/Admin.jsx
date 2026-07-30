import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api.js';
import { useStore } from '../store.jsx';
import { Spinner, formatMoney } from '../components.jsx';

function SignaturePad() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#1f2a37';

    function position(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function down(event) {
      drawing.current = true;
      const { x, y } = position(event);
      context.beginPath();
      context.moveTo(x, y);
    }
    function move(event) {
      if (!drawing.current) return;
      const { x, y } = position(event);
      context.lineTo(x, y);
      context.stroke();
      setSigned(true);
    }
    function up() {
      drawing.current = false;
    }

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <div className="signature">
      <canvas ref={canvasRef} width="420" height="150" className="signature__canvas" aria-label="Signature area" />
      <div className="signature__actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            const canvas = canvasRef.current;
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
            setSigned(false);
          }}
        >
          Clear
        </button>
        <span className="signature__status">{signed ? 'Signature captured' : 'Not signed'}</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, authReady, notify } = useStore();
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [selected, setSelected] = useState([]);
  const [threshold, setThreshold] = useState(500);

  useEffect(() => {
    api
      .featured()
      .then((result) => setFeatured(result.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!authReady) {
    return (
      <div className="panel">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <section className="panel">
        <h1>Admin tools</h1>
        <p>
          You need the admin account for this page. Sign in as <code>admin@practice.dev</code> from the{' '}
          <Link to="/login">sign in page</Link>.
        </p>
      </section>
    );
  }

  function reorder(from, to) {
    setFeatured((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveFeatured(featured.map((item) => item.id));
      notify('Featured order saved.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const allSelected = selected.length === featured.length && featured.length > 0;

  return (
    <section className="admin">
      <h1 className="page-title">Admin tools</h1>
      <p className="admin__intro">Signed in as {user.email}. Everything on this page is a drill, not a real control panel.</p>

      <section className="panel">
        <h2>Featured products</h2>
        <p>Drag the rows to change the order they appear in on the home page, then save.</p>

        {loading ? (
          <Spinner label="Loading featured products" />
        ) : (
          <ul className="sortable">
            {featured.map((item, index) => (
              <li
                key={item.id}
                className={`sortable__item ${dragIndex === index ? 'is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                <span className="sortable__handle" aria-hidden="true">
                  ⠿
                </span>
                <span className="sortable__position">{index + 1}</span>
                <span className="sortable__name">{item.name}</span>
                <span className="sortable__price">{formatMoney(item.price)}</span>
                <span className="sortable__buttons">
                  <button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => reorder(index, index - 1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.name} down`}
                    disabled={index === featured.length - 1}
                    onClick={() => reorder(index, index + 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="button" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save order'}
        </button>
      </section>

      <section className="panel">
        <h2>Bulk actions</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => setSelected(event.target.checked ? featured.map((item) => item.id) : [])}
                  />
                  <span className="visually-hidden">Select all rows</span>
                </label>
              </th>
              <th scope="col">Product</th>
              <th scope="col">Stock</th>
              <th scope="col">Price</th>
            </tr>
          </thead>
          <tbody>
            {featured.map((item) => (
              <tr key={item.id}>
                <td>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                        )
                      }
                    />
                    <span className="visually-hidden">Select {item.name}</span>
                  </label>
                </td>
                <td>{item.name}</td>
                <td>{item.stock}</td>
                <td>{formatMoney(item.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p aria-live="polite">{selected.length} row(s) selected</p>
        <button
          type="button"
          className="button button--ghost"
          disabled={selected.length === 0}
          onClick={() => {
            if (window.confirm(`Archive ${selected.length} product(s)?`)) {
              notify(`${selected.length} product(s) archived (not really).`, 'info');
              setSelected([]);
            }
          }}
        >
          Archive selected
        </button>
      </section>

      <section className="panel">
        <h2>Low stock alert threshold</h2>
        <label htmlFor="threshold">Warn me below {threshold} units of demand</label>
        <input
          id="threshold"
          type="range"
          min="0"
          max="1000"
          step="50"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
        <output htmlFor="threshold">{threshold}</output>
      </section>

      <section className="panel">
        <h2>Manager signature</h2>
        <p>Draw in the box below. Canvas elements have no DOM to query, so you have to work with actions and pixels.</p>
        <SignaturePad />
      </section>

      <section className="panel">
        <h2>Open the storefront in a second window</h2>
        <button type="button" className="button button--ghost" onClick={() => window.open('/', '_blank')}>
          Open storefront in a new tab
        </button>
      </section>
    </section>
  );
}
