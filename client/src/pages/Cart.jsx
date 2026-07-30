import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useStore } from '../store.jsx';
import { Modal, Spinner, formatMoney } from '../components.jsx';

const SHIPPING_OPTIONS = [
  { value: 'standard', label: 'Standard, 3-5 days (free over €100)' },
  { value: 'express', label: 'Express, next working day' },
  { value: 'pickup', label: 'Collect in store' }
];

export default function Cart() {
  const { cart, setCart, updateLine, removeLine, emptyCart, cartBusy, notify } = useStore();
  const navigate = useNavigate();

  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponState, setCouponState] = useState({ status: 'idle', message: '' });
  const [shipping, setShipping] = useState('standard');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  async function applyCoupon(event) {
    event.preventDefault();
    setCouponState({ status: 'checking', message: '' });
    try {
      const { summary } = await api.applyCoupon(couponInput.trim().toUpperCase(), shipping);
      setCart(summary);
      setCouponState({ status: 'ok', message: `Code ${summary.coupon} applied.` });
    } catch (error) {
      setCouponState({ status: 'error', message: error.message });
    }
  }

  async function changeShipping(value) {
    setShipping(value);
    const summary = await api.cart({ shipping: value, coupon: cart.coupon || '' });
    setCart(summary);
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <section className="panel empty-state">
        <h1>Your basket is empty</h1>
        <p>Nothing here yet. The shop is through that link.</p>
        <Link className="button" to="/">
          Start shopping
        </Link>
      </section>
    );
  }

  return (
    <div className="cart-page">
      <h1 className="page-title">Your basket</h1>

      <div className="cart-page__layout">
        <section className="cart-table-wrap">
          <table className="cart-table">
            <caption className="visually-hidden">Items in your basket</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Unit price</th>
                <th scope="col">Quantity</th>
                <th scope="col">Line total</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((line) => (
                <tr key={line.lineId} className="cart-row">
                  <td className="cart-row__item">
                    <img src={api.imageUrl(line.product)} alt="" width="96" height="72" />
                    <div>
                      <Link to={`/product/${line.product.slug}`}>{line.product.name}</Link>
                      <p className="cart-row__meta">
                        {line.product.brand} &middot; SKU {line.product.sku}
                      </p>
                    </div>
                  </td>
                  <td>{formatMoney(line.product.price)}</td>
                  <td>
                    <div className="cart-row__quantity">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${line.product.name}`}
                        disabled={cartBusy}
                        onClick={() => updateLine(line.lineId, line.quantity - 1)}
                      >
                        &minus;
                      </button>
                      <input
                        type="number"
                        min="0"
                        aria-label={`Quantity of ${line.product.name}`}
                        value={line.quantity}
                        disabled={cartBusy}
                        onChange={(event) => updateLine(line.lineId, Number(event.target.value) || 0)}
                      />
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.product.name}`}
                        disabled={cartBusy}
                        onClick={() => updateLine(line.lineId, line.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="cart-row__total">{formatMoney(line.lineTotal)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setPendingRemoval(line)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cartBusy && <Spinner label="Updating your basket" />}

          <div className="cart-page__table-actions">
            <Link className="link-button" to="/">
              Continue shopping
            </Link>
            <button type="button" className="link-button" onClick={() => setConfirmEmpty(true)}>
              Empty basket
            </button>
          </div>
        </section>

        <aside className="summary">
          <h2>Order summary</h2>

          <form className="coupon" onSubmit={applyCoupon}>
            <label htmlFor="coupon-code">Promotion code</label>
            <div className="coupon__row">
              <input
                id="coupon-code"
                name="coupon"
                autoComplete="off"
                placeholder="e.g. SAVE10"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
              />
              <button type="submit" className="button button--ghost" disabled={couponState.status === 'checking'}>
                {couponState.status === 'checking' ? 'Checking…' : 'Apply'}
              </button>
            </div>
            {couponState.status === 'checking' && <Spinner label="Validating code" />}
            {couponState.status === 'error' && (
              <p className="field__error" role="alert">
                {couponState.message}
              </p>
            )}
            {couponState.status === 'ok' && <p className="field__success">{couponState.message}</p>}
          </form>

          <div className="summary__shipping">
            <label htmlFor="shipping-method">Delivery</label>
            <select
              id="shipping-method"
              name="shippingMethod"
              value={shipping}
              onChange={(event) => changeShipping(event.target.value)}
            >
              {SHIPPING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <dl className="summary__lines">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(cart.subtotal)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>-{formatMoney(cart.discount)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{cart.shipping === 0 ? 'Free' : formatMoney(cart.shipping)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{formatMoney(cart.tax)}</dd>
            </div>
            <div className="summary__total">
              <dt>Total</dt>
              <dd>{formatMoney(cart.total)}</dd>
            </div>
          </dl>

          <button type="button" className="button button--large" onClick={() => navigate('/checkout')}>
            Checkout
          </button>
        </aside>
      </div>

      <Modal
        open={Boolean(pendingRemoval)}
        title="Remove this item?"
        tone="danger"
        confirmLabel="Yes, remove it"
        onClose={() => setPendingRemoval(null)}
        onConfirm={async () => {
          const line = pendingRemoval;
          setPendingRemoval(null);
          await removeLine(line.lineId, line.product.name);
        }}
      >
        <p>
          <strong>{pendingRemoval?.product.name}</strong> will be taken out of your basket.
        </p>
      </Modal>

      <Modal
        open={confirmEmpty}
        title="Empty your basket?"
        tone="danger"
        confirmLabel="Empty it"
        onClose={() => setConfirmEmpty(false)}
        onConfirm={async () => {
          setConfirmEmpty(false);
          await emptyCart();
          notify('Basket emptied.', 'info');
        }}
      >
        <p>Every line will be removed. This cannot be undone.</p>
      </Modal>
    </div>
  );
}
