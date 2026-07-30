import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { useStore } from '../store.jsx';
import { Field, ShadowRating, Spinner, StarPicker, formatMoney } from '../components.jsx';

const TABS = [
  { id: 'description', label: 'Description' },
  { id: 'specification', label: 'Specification' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'delivery', label: 'Delivery & returns' }
];

function ReviewForm({ slug, onAdded }) {
  const { notify } = useStore();
  const [form, setForm] = useState({ author: '', rating: 0, title: '', body: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { review } = await api.addReview(slug, form);
      onAdded(review);
      setForm({ author: '', rating: 0, title: '', body: '' });
      notify('Thanks, your review is live.');
    } catch (error) {
      setErrors(error.payload?.errors || { body: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="review-form" onSubmit={submit} noValidate>
      <h3>Write a review</h3>
      <Field
        label="Your name"
        name="author"
        value={form.author}
        error={errors.author}
        onChange={(event) => setForm({ ...form, author: event.target.value })}
      />
      <StarPicker value={form.rating} error={errors.rating} onChange={(rating) => setForm({ ...form, rating })} />
      <Field
        label="Headline"
        name="title"
        value={form.title}
        error={errors.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
      />
      <Field label="Your review" name="body" error={errors.body}>
        <textarea
          id="field-body"
          name="body"
          rows="4"
          className="field__input"
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
        />
      </Field>
      <button type="submit" className="button" disabled={saving}>
        {saving ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}

export default function Product() {
  const { slug } = useParams();
  const { addToCart, cartBusy, notify } = useStore();

  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState('description');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTab('description');
    setQuantity(1);
    api
      .product(slug)
      .then((result) => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    api
      .reviews(slug)
      .then((result) => !cancelled && setReviews(result.reviews))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="panel">
        <Spinner label="Loading product" />
      </div>
    );
  }

  if (!data) {
    return (
      <section className="panel">
        <h1>That product has gone</h1>
        <p>
          It may have been discontinued. <Link to="/">Back to the shop</Link>.
        </p>
      </section>
    );
  }

  const { product, related } = data;
  const images = ['front', 'angle', 'detail', 'packaging'];

  return (
    <article className="product-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to={`/?category=${product.category}`}>{product.categoryName}</Link>
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="product-page__top">
        <section className="gallery">
          <img
            className="gallery__main"
            src={api.imageUrl(product, images[activeImage])}
            alt={`${product.name}, ${images[activeImage]} view`}
            width="480"
            height="360"
          />
          <div className="gallery__thumbs">
            {images.map((view, index) => (
              <button
                key={view}
                type="button"
                className={`gallery__thumb ${index === activeImage ? 'is-active' : ''}`}
                aria-label={`Show ${view} view`}
                onClick={() => setActiveImage(index)}
              >
                <img src={api.imageUrl(product, view)} alt="" width="120" height="90" />
              </button>
            ))}
          </div>
        </section>

        <section className="buy-box">
          <p className="buy-box__brand">{product.brand}</p>
          <h1 className="buy-box__title">{product.name}</h1>

          {/* The rating lives in a shadow root on purpose. */}
          <ShadowRating rating={product.rating} count={product.reviewCount} />

          <p className="buy-box__price">
            <strong>{formatMoney(product.price)}</strong>
            {product.listPrice && <s>{formatMoney(product.listPrice)}</s>}
            <span className="buy-box__vat">incl. VAT</span>
          </p>

          <p className={`buy-box__stock ${product.stock === 0 ? 'is-out' : ''}`}>
            {product.stock === 0
              ? 'Out of stock'
              : product.stock < 5
                ? `Only ${product.stock} left`
                : `${product.stock} in stock`}
          </p>

          <div className="quantity">
            <button
              type="button"
              className="quantity__step"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              &minus;
            </button>
            <input
              className="quantity__input"
              name="quantity"
              type="number"
              min="1"
              max={Math.max(product.stock, 1)}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            />
            <button
              type="button"
              className="quantity__step"
              aria-label="Increase quantity"
              onClick={() => setQuantity((value) => Math.min(Math.max(product.stock, 1), value + 1))}
            >
              +
            </button>
          </div>

          <div className="buy-box__actions">
            <button
              type="button"
              className="button button--large"
              disabled={product.stock === 0 || cartBusy}
              onClick={() => addToCart(product, quantity).catch(() => {})}
            >
              {product.stock === 0 ? 'Out of stock' : 'Add to basket'}
            </button>

            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                // Native confirm: needs an explicit dialog handler in both tools.
                const yes = window.confirm(`Add ${product.name} to your comparison list?`);
                if (yes) notify(`${product.name} added to comparison.`, 'info');
              }}
            >
              Compare
            </button>

            <div
              className="share"
              onMouseEnter={() => setShareOpen(true)}
              onMouseLeave={() => setShareOpen(false)}
            >
              <button type="button" className="share__trigger" aria-expanded={shareOpen}>
                Share
              </button>
              {shareOpen && (
                <ul className="share__menu">
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        const name = window.prompt('Who should we send this to?', 'a friend');
                        if (name) notify(`Link sent to ${name}.`, 'info');
                      }}
                    >
                      Email a friend
                    </button>
                  </li>
                  <li>
                    <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer">
                      Open in a new tab
                    </a>
                  </li>
                  <li>
                    <button type="button" onClick={() => window.open(`/product/${product.slug}`, '_blank', 'width=640,height=720')}>
                      Open in a popup window
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>

          <ul className="buy-box__points">
            <li>Free returns within 30 days</li>
            <li>SKU {product.sku}</li>
            <li>Dispatched from Rotterdam</li>
          </ul>
        </section>
      </div>

      <section className="tabs">
        <div className="tabs__list" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              role="tab"
              type="button"
              aria-selected={tab === entry.id}
              className={`tabs__tab ${tab === entry.id ? 'is-active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
              {entry.id === 'reviews' && <span className="tabs__badge">{reviews.length}</span>}
            </button>
          ))}
        </div>

        <div className="tabs__panel" role="tabpanel">
          {tab === 'description' && (
            <div className="prose">
              <p>{product.description}</p>
              <p>
                Need the full technical sheet?{' '}
                <a href={`/api/products/${product.slug}`} target="_blank" rel="noreferrer">
                  Open the raw product record
                </a>{' '}
                in a new tab.
              </p>
            </div>
          )}

          {tab === 'specification' && (
            <table className="spec-table">
              <caption>Manufacturer specification</caption>
              <tbody>
                {Object.entries(product.specs).map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'reviews' && (
            <div className="reviews">
              <ul className="reviews__list">
                {reviews.map((review) => (
                  <li className="review" key={review.id}>
                    <p className="review__stars" aria-label={`${review.rating} out of 5`}>
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)}
                    </p>
                    <h4>{review.title}</h4>
                    <p className="review__body">{review.body}</p>
                    <p className="review__meta">
                      {review.author} &middot; {review.createdAt}
                    </p>
                  </li>
                ))}
              </ul>
              <ReviewForm slug={product.slug} onAdded={(review) => setReviews((current) => [review, ...current])} />
            </div>
          )}

          {tab === 'delivery' && (
            <div className="prose">
              <h3>Delivery</h3>
              <p>Standard delivery is 3-5 working days and free over &euro;100. Express is next working day.</p>
              <h3>Returns</h3>
              <p>Thirty days, original packaging preferred but not required. Refunds land within five working days.</p>
            </div>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="related">
          <h2>People also looked at</h2>
          <div className="related__row">
            {related.map((item) => (
              <Link className="related__card" to={`/product/${item.slug}`} key={item.id}>
                <img src={api.imageUrl(item)} alt={item.name} width="240" height="180" loading="lazy" />
                <span className="related__name">{item.name}</span>
                <span className="related__price">{formatMoney(item.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
