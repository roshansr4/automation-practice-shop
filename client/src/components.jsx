import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* ---------------------------------------------------------------- utilities */

export function formatMoney(value, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(Number(value || 0));
}

// Mimics a CSS-modules build: the class name is stable for the life of the page
// but changes between loads, so a locator pinned to it will rot.
export function useHashedClass(base) {
  return useMemo(() => `${base}_${Math.random().toString(36).slice(2, 8)}`, [base]);
}

export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------ loading state */

export function Spinner({ label = 'Loading' }) {
  return (
    <span className="spinner" role="status" aria-live="polite">
      <span className="spinner__disc" aria-hidden="true" />
      <span className="spinner__label">{label}</span>
    </span>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="product-grid" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="skeleton-card" key={index}>
          <div className="skeleton-card__image" />
          <div className="skeleton-card__line" />
          <div className="skeleton-card__line skeleton-card__line--short" />
        </article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- toasts */

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="alert">
          <p>{toast.message}</p>
          <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            &times;
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------- modal */

export function Modal({ open, title, children, onClose, onConfirm, confirmLabel = 'Confirm', tone = 'default' }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="modal__title">{title}</h2>
        <div className="modal__body">{children}</div>
        <footer className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          {onConfirm && (
            <button type="button" className={`button ${tone === 'danger' ? 'button--danger' : ''}`} onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------- rating widget inside shadow DOM */

export function ShadowRating({ rating, count }) {
  const hostRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!rootRef.current) {
      rootRef.current = hostRef.current.attachShadow({ mode: 'open' });
    }
    const filled = Math.round(rating);
    rootRef.current.innerHTML = `
      <style>
        .wrap { display: inline-flex; align-items: center; gap: 8px; font-family: inherit; }
        .stars { letter-spacing: 2px; color: #c98a1b; font-size: 1rem; }
        .score { font-weight: 600; }
        .count { color: #667; font-size: 0.85rem; }
      </style>
      <span class="wrap" part="wrap">
        <span class="stars">${'★'.repeat(filled)}${'☆'.repeat(Math.max(5 - filled, 0))}</span>
        <span class="score">${Number(rating).toFixed(1)}</span>
        <span class="count">(${count} reviews)</span>
      </span>
    `;
  }, [rating, count]);

  return <div className="shadow-rating" ref={hostRef} />;
}

/* ------------------------------------------------------ autocomplete search */

export function SearchAutocomplete({ onSearch, fetchSuggestions, placeholder = 'Search the shop' }) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounced = useDebounced(value, 450);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    setLoading(true);
    fetchSuggestions(debounced)
      .then((result) => {
        if (cancelled) return;
        setSuggestions(result);
        setOpen(true);
        setHighlight(-1);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, fetchSuggestions]);

  useEffect(() => {
    function onClickAway(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  function submit(event) {
    event.preventDefault();
    setOpen(false);
    onSearch(value.trim());
  }

  function onKeyDown(event) {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, suggestions.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    }
    if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault();
      const picked = suggestions[highlight];
      setValue(picked.name);
      setOpen(false);
      onSearch(picked.name);
    }
  }

  return (
    <div className="search" ref={containerRef}>
      <form className="search__form" onSubmit={submit} role="search">
        <input
          type="search"
          className="search__input"
          name="q"
          autoComplete="off"
          aria-label="Search products"
          aria-expanded={open}
          aria-controls="search-suggestions"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="search__submit">
          Search
        </button>
        {loading && <span className="search__loading" aria-hidden="true" />}
      </form>

      {open && (
        <ul className="search__suggestions" id="search-suggestions" role="listbox">
          {suggestions.length === 0 && <li className="search__empty">No matches for &ldquo;{debounced}&rdquo;</li>}
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.slug}
              role="option"
              aria-selected={index === highlight}
              className={`search__suggestion ${index === highlight ? 'is-active' : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={() => {
                setValue(suggestion.name);
                setOpen(false);
                onSearch(suggestion.name);
              }}
            >
              <span className="search__suggestion-name">{suggestion.name}</span>
              <span className="search__suggestion-meta">{suggestion.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------- custom date picker */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function DatePicker({ label, value, onChange, error, minDate = new Date() }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => (value ? new Date(value) : new Date()));
  const wrapRef = useRef(null);

  useEffect(() => {
    function onClickAway(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const floor = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));

  return (
    <div className="datepicker" ref={wrapRef}>
      <label className="field__label" htmlFor="delivery-date">
        {label}
      </label>
      <div className="datepicker__control">
        <input
          id="delivery-date"
          name="deliveryDate"
          className="field__input"
          readOnly
          autoComplete="off"
          placeholder="Choose a date"
          value={value || ''}
          onClick={() => setOpen((current) => !current)}
        />
        <button type="button" className="datepicker__toggle" aria-label="Open calendar" onClick={() => setOpen((current) => !current)}>
          &#128197;
        </button>
      </div>
      {error && <p className="field__error">{error}</p>}

      {open && (
        <div className="datepicker__panel" role="dialog" aria-label="Choose a delivery date">
          <header className="datepicker__header">
            <button type="button" aria-label="Previous month" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              &#8249;
            </button>
            <strong>
              {MONTHS[month]} {year}
            </strong>
            <button type="button" aria-label="Next month" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              &#8250;
            </button>
          </header>
          <div className="datepicker__weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="datepicker__grid">
            {cells.map((date, index) => {
              if (!date) return <span key={`blank-${index}`} className="datepicker__blank" />;
              const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const disabled = date < floor;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  className={`datepicker__day ${value === iso ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- file drop zone */

export function FileDropZone({ onFile, uploaded, uploading }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  return (
    <div
      className={`dropzone ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <p className="dropzone__hint">Drag a proof-of-address file here, or</p>
      <button type="button" className="button button--ghost" onClick={() => inputRef.current?.click()}>
        Browse files
      </button>
      <input
        ref={inputRef}
        type="file"
        name="document"
        className="dropzone__input"
        accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {uploading && <Spinner label="Uploading" />}
      {uploaded && !uploading && (
        <p className="dropzone__result">
          Attached <strong>{uploaded.name}</strong> ({Math.round(uploaded.size / 1024)} KB)
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- pagination */

export function Pagination({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (candidate) => candidate === 1 || candidate === pageCount || Math.abs(candidate - page) <= 1
  );

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="pagination__step" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      {pages.map((candidate, index) => (
        <span key={candidate} className="pagination__slot">
          {index > 0 && candidate - pages[index - 1] > 1 && <span className="pagination__gap">&hellip;</span>}
          <button
            type="button"
            aria-current={candidate === page ? 'page' : undefined}
            className={`pagination__page ${candidate === page ? 'is-current' : ''}`}
            onClick={() => onChange(candidate)}
          >
            {candidate}
          </button>
        </span>
      ))}
      <button type="button" className="pagination__step" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}

/* ----------------------------------------------------------- star selection */

export function StarPicker({ value, onChange, error }) {
  return (
    <fieldset className="stars-field">
      <legend>Your rating</legend>
      <div className="stars-field__options">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className={`stars-field__option ${Number(value) >= star ? 'is-on' : ''}`}>
            <input
              type="radio"
              name="rating"
              value={star}
              checked={Number(value) === star}
              onChange={() => onChange(star)}
            />
            <span aria-hidden="true">{Number(value) >= star ? '★' : '☆'}</span>
            <span className="visually-hidden">{star} stars</span>
          </label>
        ))}
      </div>
      {error && <p className="field__error">{error}</p>}
    </fieldset>
  );
}

/* ------------------------------------------------------------ generic field */

export function Field({ label, name, error, hint, children, ...rest }) {
  const id = `field-${name}`;
  return (
    <div className={`field ${error ? 'field--invalid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children || <input id={id} name={name} className="field__input" aria-invalid={Boolean(error)} {...rest} />}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
