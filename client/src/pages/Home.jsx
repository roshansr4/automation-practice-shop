import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useStore } from '../store.jsx';
import { SkeletonGrid, Spinner, formatMoney, useHashedClass } from '../components.jsx';

const SORTS = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Customer rating' },
  { value: 'name-asc', label: 'Name A-Z' },
  { value: 'newest', label: 'Newest first' }
];

function ProductCard({ product, cardClass, onAdd, busy }) {
  const discount = product.listPrice ? Math.round((1 - product.price / product.listPrice) * 100) : 0;

  return (
    <article className={`${cardClass} product-card`} data-sku={product.sku} id={`product-${product.slug}`}>
      <Link className="product-card__media" to={`/product/${product.slug}`}>
        <img src={api.imageUrl(product)} alt={product.name} loading="lazy" width="480" height="360" />
        {discount > 0 && <span className="product-card__flag">-{discount}%</span>}
        {product.stock === 0 && <span className="product-card__flag product-card__flag--muted">Out of stock</span>}
      </Link>

      <div className="product-card__body">
        <p className="product-card__brand">{product.brand}</p>
        <h3 className="product-card__title">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="product-card__blurb">{product.shortDescription}</p>

        <p className="product-card__rating" aria-label={`Rated ${product.rating} out of 5`}>
          <span aria-hidden="true">{'★'.repeat(Math.round(product.rating))}</span>
          <span className="product-card__rating-count">({product.reviewCount})</span>
        </p>

        <p className="product-card__price">
          <strong>{formatMoney(product.price)}</strong>
          {product.listPrice && <s>{formatMoney(product.listPrice)}</s>}
        </p>

        <button
          type="button"
          className="button product-card__add"
          disabled={product.stock === 0 || busy}
          onClick={() => onAdd(product)}
        >
          {product.stock === 0 ? 'Notify me' : 'Add to basket'}
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const { addToCart, cartBusy } = useStore();
  const cardClass = useHashedClass('card');

  const [meta, setMeta] = useState({ categories: [], brands: [], priceRange: { min: 0, max: 2000 } });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef(null);

  const filters = useMemo(
    () => ({
      search: params.get('search') || '',
      category: params.get('category') || '',
      brand: params.get('brand') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      inStock: params.get('inStock') || '',
      onSale: params.get('onSale') || '',
      sort: params.get('sort') || 'relevance'
    }),
    [params]
  );

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;
    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);

    api
      .products({ ...filters, page, limit: 9, delay: isFirstPage ? 500 : 900 })
      .then((result) => {
        if (cancelled) return;
        setItems((current) => (isFirstPage ? result.items : [...current, ...result.items]));
        setTotal(result.total);
        setPageCount(result.pageCount);
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterKey, page]);

  // Infinite scroll: new cards arrive only once the sentinel is in view, so a
  // test that scrapes the grid too early will see a short list.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < pageCount) {
          setPage((current) => current + 1);
        }
      },
      { rootMargin: '160px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, loadingMore, page, pageCount]);

  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(params);
      Object.entries(patch).forEach(([key, value]) => {
        if (!value) next.delete(key);
        else next.set(key, value);
      });
      setParams(next, { replace: false });
    },
    [params, setParams]
  );

  const selectedCategories = filters.category ? filters.category.split(',') : [];
  const selectedBrands = filters.brand ? filters.brand.split(',') : [];

  function toggleCategory(slug) {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((value) => value !== slug)
      : [...selectedCategories, slug];
    update({ category: next.join(',') });
  }

  async function handleAdd(product) {
    if (product.stock === 0) {
      window.alert(`We will email you when ${product.name} is back in stock.`);
      return;
    }
    await addToCart(product, 1).catch(() => {});
  }

  return (
    <div className="listing">
      <section className="hero">
        <div className="hero__text">
          <h1>Kit that survives the commute</h1>
          <p>
            Six categories, {meta.categories.reduce((sum, category) => sum + category.count, 0) || '60'} products, and a
            checkout that is deliberately awkward. Everything on this site exists to be automated.
          </p>
          <Link className="button" to="/challenges">
            What is in here to practise on
          </Link>
        </div>
      </section>

      <div className="listing__layout">
        <aside className="filters" aria-label="Product filters">
          <h2 className="filters__title">Refine</h2>

          <fieldset className="filters__group">
            <legend>Category</legend>
            {meta.categories.map((category) => (
              <label className="checkbox" key={category.slug}>
                <input
                  type="checkbox"
                  name="category"
                  value={category.slug}
                  checked={selectedCategories.includes(category.slug)}
                  onChange={() => toggleCategory(category.slug)}
                />
                <span>
                  {category.name} <em>({category.count})</em>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="filters__group">
            <label className="filters__label" htmlFor="brand-select">
              Brand (hold Ctrl to pick several)
            </label>
            <select
              id="brand-select"
              multiple
              size="6"
              value={selectedBrands}
              onChange={(event) => {
                const chosen = Array.from(event.target.selectedOptions).map((option) => option.value);
                update({ brand: chosen.join(',') });
              }}
            >
              {meta.brands.map((brand) => (
                <option key={brand.name} value={brand.name}>
                  {brand.name} ({brand.count})
                </option>
              ))}
            </select>
          </div>

          <div className="filters__group filters__group--inline">
            <label className="filters__label" htmlFor="min-price">
              Min &euro;
            </label>
            <input
              id="min-price"
              name="minPrice"
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(event) => update({ minPrice: event.target.value })}
            />
            <label className="filters__label" htmlFor="max-price">
              Max &euro;
            </label>
            <input
              id="max-price"
              name="maxPrice"
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(event) => update({ maxPrice: event.target.value })}
            />
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              name="inStock"
              checked={filters.inStock === 'true'}
              onChange={(event) => update({ inStock: event.target.checked ? 'true' : '' })}
            />
            <span>In stock only</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              name="onSale"
              checked={filters.onSale === 'true'}
              onChange={(event) => update({ onSale: event.target.checked ? 'true' : '' })}
            />
            <span>Reduced items</span>
          </label>

          <button type="button" className="button button--ghost" onClick={() => setParams(new URLSearchParams())}>
            Clear all filters
          </button>
        </aside>

        <section className="results">
          <header className="results__header">
            <p className="results__count" aria-live="polite">
              {loading ? 'Loading products' : `${total} products`}
              {filters.search && !loading && (
                <>
                  {' '}
                  for <strong>&ldquo;{filters.search}&rdquo;</strong>
                </>
              )}
            </p>
            <label className="results__sort">
              Sort by
              <select name="sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </header>

          {selectedCategories.length + selectedBrands.length > 0 && (
            <ul className="chips" aria-label="Active filters">
              {[...selectedCategories, ...selectedBrands].map((value) => (
                <li className="chip" key={value}>
                  {value}
                  <button
                    type="button"
                    aria-label={`Remove filter ${value}`}
                    onClick={() =>
                      update({
                        category: selectedCategories.filter((entry) => entry !== value).join(','),
                        brand: selectedBrands.filter((entry) => entry !== value).join(',')
                      })
                    }
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <SkeletonGrid count={9} />
          ) : items.length === 0 ? (
            <div className="empty-state">
              <h2>Nothing matched those filters</h2>
              <p>Try widening the price range or clearing a category.</p>
            </div>
          ) : (
            <div className="product-grid">
              {items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cardClass={cardClass}
                  onAdd={handleAdd}
                  busy={cartBusy}
                />
              ))}
            </div>
          )}

          <div ref={sentinel} className="results__sentinel" aria-hidden="true" />

          {loadingMore && <Spinner label="Loading more products" />}

          {!loading && page < pageCount && !loadingMore && (
            <button type="button" className="button button--ghost results__more" onClick={() => setPage((p) => p + 1)}>
              Load more products
            </button>
          )}

          {!loading && items.length > 0 && page >= pageCount && <p className="results__end">That is everything.</p>}
        </section>
      </div>
    </div>
  );
}
