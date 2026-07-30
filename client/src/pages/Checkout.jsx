import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useStore } from '../store.jsx';
import { DatePicker, Field, FileDropZone, Spinner, formatMoney } from '../components.jsx';

const COUNTRIES = {
  Ireland: ['Dublin', 'Cork', 'Galway', 'Limerick'],
  Netherlands: ['North Holland', 'South Holland', 'Utrecht', 'Gelderland'],
  Germany: ['Bavaria', 'Berlin', 'Hesse', 'Saxony'],
  Portugal: ['Lisbon', 'Porto', 'Faro', 'Braga'],
  Nepal: ['Bagmati', 'Gandaki', 'Lumbini', 'Koshi']
};

const STEPS = ['Delivery', 'Payment', 'Review'];

export default function Checkout() {
  const { cart, user, refreshCart, notify } = useStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    postcode: '',
    country: '',
    region: '',
    deliveryDate: '',
    shippingMethod: 'standard',
    paymentMethod: 'card',
    termsAccepted: false,
    marketingOptIn: false
  });
  const [card, setCard] = useState(null);
  const [upload, setUpload] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((current) => ({ ...current, fullName: current.fullName || user.name, email: current.email || user.email }));
    }
  }, [user]);

  // The payment widget is a separate document in an iframe and talks back over
  // postMessage. Both Selenium and Playwright have to switch context for it.
  useEffect(() => {
    function onMessage(event) {
      if (event.data?.source !== 'northwind-payment-widget') return;
      setCard(event.data.payload);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateStep(index) {
    const next = {};
    if (index === 0) {
      if (!form.fullName.trim()) next.fullName = 'Tell us who the parcel is for.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = 'Enter a valid email address.';
      if (!form.address.trim()) next.address = 'We need a street address.';
      if (!form.city.trim()) next.city = 'City is required.';
      if (!/^[a-z0-9 -]{3,10}$/i.test(form.postcode)) next.postcode = 'Postcodes are 3 to 10 letters or digits.';
      if (!form.country) next.country = 'Choose a country.';
      if (form.country && !form.region) next.region = 'Choose a region.';
      if (!form.deliveryDate) next.deliveryDate = 'Pick a delivery date.';
    }
    if (index === 1) {
      if (form.paymentMethod === 'card' && !card) next.paymentMethod = 'Complete the card details in the payment panel.';
    }
    if (index === 2 && !form.termsAccepted) {
      next.termsAccepted = 'You have to accept the terms.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleUpload(file) {
    setUploading(true);
    try {
      const { upload: saved } = await api.uploadDocument(file);
      setUpload(saved);
      notify(`${saved.name} uploaded.`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function placeOrder() {
    if (!validateStep(2)) return;
    if (!window.confirm(`Charge ${formatMoney(cart.total)} and place this order?`)) return;

    setPlacing(true);
    try {
      const { order } = await api.placeOrder({ ...form, coupon: cart.coupon });
      await refreshCart();
      navigate(`/orders/${order.reference}`, { state: { justPlaced: true } });
    } catch (error) {
      setErrors(error.payload?.errors || { form: error.message });
      notify(error.message, 'error');
      setStep(0);
    } finally {
      setPlacing(false);
    }
  }

  if (!cart.items || cart.items.length === 0) {
    return (
      <section className="panel empty-state">
        <h1>There is nothing to check out</h1>
        <p>Add something to your basket first.</p>
        <Link className="button" to="/">
          Back to the shop
        </Link>
      </section>
    );
  }

  return (
    <div className="checkout">
      <h1 className="page-title">Checkout</h1>

      <ol className="stepper" aria-label="Checkout progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`stepper__step ${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="stepper__index">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="checkout__layout">
        <section className="checkout__main">
          {step === 0 && (
            <form
              className="form-grid"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (validateStep(0)) setStep(1);
              }}
            >
              <h2>Delivery details</h2>

              <Field label="Full name" name="fullName" value={form.fullName} error={errors.fullName} onChange={(e) => set('fullName', e.target.value)} />
              <Field label="Email" name="email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
              <Field label="Street address" name="address" value={form.address} error={errors.address} onChange={(e) => set('address', e.target.value)} />
              <Field label="City" name="city" value={form.city} error={errors.city} onChange={(e) => set('city', e.target.value)} />
              <Field label="Postcode" name="postcode" value={form.postcode} error={errors.postcode} hint="Between 3 and 10 characters." onChange={(e) => set('postcode', e.target.value)} />

              <Field label="Country" name="country" error={errors.country}>
                <select
                  id="field-country"
                  name="country"
                  className="field__input"
                  value={form.country}
                  onChange={(event) => {
                    set('country', event.target.value);
                    set('region', '');
                  }}
                >
                  <option value="">Select a country</option>
                  {Object.keys(COUNTRIES).map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </Field>

              {/* The region list only populates after a country is chosen. */}
              <Field label="Region" name="region" error={errors.region}>
                <select
                  id="field-region"
                  name="region"
                  className="field__input"
                  value={form.region}
                  disabled={!form.country}
                  onChange={(event) => set('region', event.target.value)}
                >
                  <option value="">{form.country ? 'Select a region' : 'Choose a country first'}</option>
                  {(COUNTRIES[form.country] || []).map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </Field>

              <DatePicker
                label="Preferred delivery date"
                value={form.deliveryDate}
                error={errors.deliveryDate}
                onChange={(value) => set('deliveryDate', value)}
              />

              <fieldset className="radio-group">
                <legend>Delivery speed</legend>
                {[
                  { value: 'standard', label: 'Standard, 3-5 days' },
                  { value: 'express', label: 'Express, next working day' },
                  { value: 'pickup', label: 'Collect in store' }
                ].map((option) => (
                  <label key={option.value} className="radio">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={option.value}
                      checked={form.shippingMethod === option.value}
                      onChange={() => set('shippingMethod', option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <div className="form-grid__wide">
                <h3>Proof of address (optional)</h3>
                <FileDropZone onFile={handleUpload} uploaded={upload} uploading={uploading} />
              </div>

              <div className="form-grid__actions">
                <button type="submit" className="button">
                  Continue to payment
                </button>
              </div>
            </form>
          )}

          {step === 1 && (
            <div className="payment">
              <h2>Payment</h2>

              <fieldset className="radio-group">
                <legend>How would you like to pay?</legend>
                {[
                  { value: 'card', label: 'Card' },
                  { value: 'invoice', label: 'Invoice (business accounts)' },
                  { value: 'cash', label: 'Cash on collection' }
                ].map((option) => (
                  <label key={option.value} className="radio">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.value}
                      checked={form.paymentMethod === option.value}
                      onChange={() => set('paymentMethod', option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              {form.paymentMethod === 'card' && (
                <div className="payment__frame">
                  <p className="payment__note">Card details are handled by our payment partner in the panel below.</p>
                  <iframe
                    src="/payment-widget.html"
                    title="Secure card payment"
                    name="payment-widget"
                    width="100%"
                    height="360"
                  />
                  {card && (
                    <p className="field__success">
                      Card ending {card.last4} saved, expires {card.expiry}.
                    </p>
                  )}
                </div>
              )}

              {form.paymentMethod === 'invoice' && (
                <p className="notice">We will email an invoice with 30 day terms once the order ships.</p>
              )}

              {errors.paymentMethod && (
                <p className="field__error" role="alert">
                  {errors.paymentMethod}
                </p>
              )}

              <div className="form-grid__actions">
                <button type="button" className="button button--ghost" onClick={() => setStep(0)}>
                  Back
                </button>
                <button type="button" className="button" onClick={() => validateStep(1) && setStep(2)}>
                  Review order
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="review-step">
              <h2>Check everything over</h2>

              <dl className="review-step__facts">
                <div>
                  <dt>Deliver to</dt>
                  <dd>
                    {form.fullName}
                    <br />
                    {form.address}, {form.city} {form.postcode}
                    <br />
                    {form.region}, {form.country}
                  </dd>
                </div>
                <div>
                  <dt>Arriving</dt>
                  <dd>{form.deliveryDate}</dd>
                </div>
                <div>
                  <dt>Paying by</dt>
                  <dd>{form.paymentMethod === 'card' && card ? `Card ending ${card.last4}` : form.paymentMethod}</dd>
                </div>
                {upload && (
                  <div>
                    <dt>Attached document</dt>
                    <dd>{upload.name}</dd>
                  </div>
                )}
              </dl>

              <table className="review-step__items">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((line) => (
                    <tr key={line.lineId}>
                      <td>{line.product.name}</td>
                      <td>{line.quantity}</td>
                      <td>{formatMoney(line.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label className="checkbox">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={form.termsAccepted}
                  onChange={(event) => set('termsAccepted', event.target.checked)}
                />
                <span>
                  I accept the <Link to="/challenges">terms and conditions</Link>
                </span>
              </label>
              {errors.termsAccepted && (
                <p className="field__error" role="alert">
                  {errors.termsAccepted}
                </p>
              )}

              <label className="checkbox">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  checked={form.marketingOptIn}
                  onChange={(event) => set('marketingOptIn', event.target.checked)}
                />
                <span>Email me about offers</span>
              </label>

              <div className="form-grid__actions">
                <button type="button" className="button button--ghost" onClick={() => setStep(1)} disabled={placing}>
                  Back
                </button>
                <button type="button" className="button button--large" onClick={placeOrder} disabled={placing}>
                  {placing ? 'Placing your order…' : `Place order · ${formatMoney(cart.total)}`}
                </button>
              </div>

              {placing && <Spinner label="Talking to the payment provider" />}
            </div>
          )}
        </section>

        <aside className="summary">
          <h2>Summary</h2>
          <dl className="summary__lines">
            <div>
              <dt>Items</dt>
              <dd>{cart.itemCount}</dd>
            </div>
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
        </aside>
      </div>
    </div>
  );
}
