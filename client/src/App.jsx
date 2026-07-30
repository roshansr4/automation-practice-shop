import { useCallback, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import api from './api.js';
import { useStore } from './store.jsx';
import { SearchAutocomplete, ToastStack } from './components.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import { Orders, OrderConfirmation } from './pages/Orders.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Admin from './pages/Admin.jsx';
import Challenges from './pages/Challenges.jsx';

const MEGA_MENU = [
  {
    heading: 'Computing',
    links: [
      { label: 'Laptops', to: '/?category=laptops' },
      { label: 'Desk hubs', to: '/?search=hub' },
      { label: 'On sale', to: '/?onSale=true' }
    ]
  },
  {
    heading: 'Personal',
    links: [
      { label: 'Phones', to: '/?category=phones' },
      { label: 'Wearables', to: '/?category=wearables' },
      { label: 'Audio', to: '/?category=audio' }
    ]
  },
  {
    heading: 'Creative',
    links: [
      { label: 'Cameras', to: '/?category=cameras' },
      { label: 'Accessories', to: '/?category=accessories' },
      { label: 'Top rated', to: '/?sort=rating' }
    ]
  }
];

function Header() {
  const { cart, user, logout } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const fetchSuggestions = useCallback(async (term) => {
    const { suggestions } = await api.suggest(term);
    return suggestions;
  }, []);

  return (
    <header className="site-header">
      <div className="announcement" role="note">
        Free standard delivery on orders over &euro;100 &mdash; use code <strong>FREESHIP</strong>
      </div>

      <div className="site-header__main">
        <Link className="brand" to="/">
          <span className="brand__mark" aria-hidden="true">
            NW
          </span>
          <span className="brand__name">Northwind Supply Co.</span>
        </Link>

        <SearchAutocomplete
          fetchSuggestions={fetchSuggestions}
          onSearch={(term) => navigate(term ? `/?search=${encodeURIComponent(term)}` : '/')}
        />

        <div className="site-header__actions">
          <div
            className="account"
            onMouseEnter={() => setAccountOpen(true)}
            onMouseLeave={() => setAccountOpen(false)}
          >
            <button type="button" className="account__trigger" aria-haspopup="true" aria-expanded={accountOpen}>
              {user ? user.name.split(' ')[0] : 'Account'}
            </button>
            {accountOpen && (
              <div className="account__menu">
                {user ? (
                  <>
                    <Link to="/orders">My orders</Link>
                    {user.role === 'admin' && <Link to="/admin">Admin tools</Link>}
                    <button type="button" onClick={() => logout()}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login">Sign in</Link>
                    <Link to="/register">Create an account</Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link className="basket-link" to="/cart">
            Basket
            <span className="basket-link__count" aria-label={`${cart.itemCount || 0} items in basket`}>
              {cart.itemCount || 0}
            </span>
          </Link>
        </div>
      </div>

      <nav className="primary-nav" aria-label="Primary">
        <ul className="primary-nav__list">
          <li
            className="primary-nav__item has-mega"
            onMouseEnter={() => setMenuOpen(true)}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button type="button" className="primary-nav__link" aria-expanded={menuOpen}>
              Shop by department
            </button>
            {menuOpen && (
              <div className="mega-menu">
                {MEGA_MENU.map((column) => (
                  <div className="mega-menu__column" key={column.heading}>
                    <h3>{column.heading}</h3>
                    <ul>
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <Link to={link.to}>{link.label}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </li>
          <li className="primary-nav__item">
            <NavLink className="primary-nav__link" to="/?onSale=true">
              Offers
            </NavLink>
          </li>
          <li className="primary-nav__item">
            <NavLink className="primary-nav__link" to="/orders">
              Order tracking
            </NavLink>
          </li>
          <li className="primary-nav__item">
            <NavLink className="primary-nav__link" to="/challenges">
              Practice notes
            </NavLink>
          </li>
          <li className="primary-nav__item">
            <a
              className="primary-nav__link"
              href="https://developer.mozilla.org/en-US/docs/Web/API/Web_components"
              target="_blank"
              rel="noreferrer"
            >
              Docs (new tab)
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__columns">
        <div>
          <h4>Customer service</h4>
          <ul>
            <li>
              <Link to="/challenges">Delivery &amp; returns</Link>
            </li>
            <li>
              <Link to="/orders">Track an order</Link>
            </li>
            <li>
              <a href="mailto:support@northwind.example">support@northwind.example</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Test accounts</h4>
          <ul>
            <li>demo@practice.dev / Password123!</li>
            <li>admin@practice.dev / Admin123!</li>
            <li>locked@practice.dev / Password123!</li>
          </ul>
        </div>
        <div>
          <h4>Newsletter</h4>
          <form
            className="newsletter"
            onSubmit={(event) => {
              event.preventDefault();
              // A deliberate native dialog: Selenium and Playwright both need
              // an explicit handler for this.
              window.alert('Thanks. A confirmation email is on its way.');
              event.currentTarget.reset();
            }}
          >
            <label htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" name="newsletterEmail" type="email" required placeholder="you@example.com" />
            <button type="submit" className="button button--ghost">
              Subscribe
            </button>
          </form>
        </div>
      </div>
      <p className="site-footer__legal">
        Northwind Supply Co. is a fictional shop built for automation practice. Nothing here is for sale.
      </p>
    </footer>
  );
}

export default function App() {
  const { toasts, dismissToast } = useStore();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:reference" element={<OrderConfirmation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route
            path="*"
            element={
              <section className="panel">
                <h1>We could not find that page</h1>
                <p>
                  Try the <Link to="/">home page</Link> instead.
                </p>
              </section>
            }
          />
        </Routes>
      </main>
      <Footer />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
