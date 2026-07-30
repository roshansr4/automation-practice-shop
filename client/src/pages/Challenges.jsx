import { Link } from 'react-router-dom';

const GROUPS = [
  {
    title: 'Locating elements',
    rows: [
      ['Hashed class names that change every page load', 'Home', 'Product cards carry a class like card_a91f3c. Anchor on text, roles or structure instead.'],
      ['Dynamic element ids built from the slug', 'Home', 'Each card has id="product-<slug>", so a fixed id will not survive a catalogue change.'],
      ['Shadow DOM', 'Product', 'The star rating lives inside an open shadow root. Playwright pierces it; Selenium needs getShadowRoot() or JS.'],
      ['Cross-frame content', 'Checkout, step 2', 'Card fields live in an iframe served from /payment-widget.html.'],
      ['Nested tables and header cells', 'Product, Specification tab', 'Row lookups by <th> text into the adjacent <td>.'],
      ['Text that repeats across the page', 'Home', 'Several cards share a brand name, so a naive text locator resolves to many nodes.']
    ]
  },
  {
    title: 'Waits and async behaviour',
    rows: [
      ['Skeleton loaders', 'Home', 'The grid renders placeholders before real cards arrive.'],
      ['Debounced autocomplete', 'Header search', 'Suggestions fire 450ms after typing stops, and the request itself is slow.'],
      ['Stale element references', 'Cart', 'Quantity changes re-render the whole row after a 600ms round trip.'],
      ['Self-dismissing toasts', 'Everywhere', 'Notifications vanish after four seconds.'],
      ['Infinite scroll', 'Home', 'More cards load only once the sentinel scrolls into view.'],
      ['Slow order submission', 'Checkout', 'Placing an order deliberately takes about 1.5 seconds.'],
      ['Tunable latency', 'Any API call', 'Append ?delay=3000 to any /api request to make it slower.']
    ]
  },
  {
    title: 'Forms and validation',
    rows: [
      ['Field-level validation messages', 'Checkout, step 1', 'Client-side rules plus a second pass on the server.'],
      ['Dependent selects', 'Checkout, step 1', 'The region list is empty and disabled until a country is chosen.'],
      ['Multi-select with Ctrl held', 'Home filters', 'A native <select multiple> for brands.'],
      ['Custom date picker', 'Checkout, step 1', 'No native date input: a calendar grid with month paging and disabled past dates.'],
      ['Radio groups and checkboxes', 'Checkout', 'Delivery speed, payment method, terms, marketing opt-in.'],
      ['Password visibility toggle', 'Sign in', 'The input type flips between password and text.'],
      ['Multi-step wizard with back navigation', 'Checkout', 'State has to survive stepping backwards.']
    ]
  },
  {
    title: 'Browser-level challenges',
    rows: [
      ['window.alert', 'Footer newsletter, out-of-stock button', 'Register a dialog handler before clicking.'],
      ['window.confirm', 'Product compare, place order, admin archive', 'Accepting and dismissing lead to different outcomes.'],
      ['window.prompt', 'Product, Share menu', 'Type a value into the native prompt.'],
      ['New tab via target=_blank', 'Header, Product share menu', 'Handle the extra window or page object.'],
      ['Popup window via window.open', 'Product share menu', 'Sized popup rather than a tab.'],
      ['File upload', 'Checkout, step 1', 'Real multipart upload, plus an HTML5 drop zone.'],
      ['File download', 'Orders', 'Invoice CSV served with Content-Disposition: attachment.'],
      ['Drag and drop', 'Admin', 'Reorder featured products using HTML5 drag events.'],
      ['Canvas drawing', 'Admin', 'Pointer actions on a canvas with no queryable DOM inside.'],
      ['Hover-only menus', 'Header, Product', 'Menus appear on mouseenter and disappear on mouseleave.']
    ]
  },
  {
    title: 'Data and state',
    rows: [
      ['Sortable, paginated table', 'Orders', 'Column sort toggles direction and resets to page one.'],
      ['Expandable rows', 'Orders', 'Row detail is injected as a sibling <tr>.'],
      ['Filter state in the URL', 'Home', 'Every filter is a query parameter, so deep links are testable.'],
      ['Guest vs signed-in carts', 'Everywhere', 'The basket follows a cart id in localStorage until you sign in.'],
      ['Server-side price maths', 'Cart, Checkout', 'Totals, tax and discounts are calculated by the API, not the browser.'],
      ['Coupon codes', 'Cart', 'SAVE10, SAVE25 (min €400), FLAT50 (min €200), FREESHIP, and EXPIRED which always fails.'],
      ['Locked account error', 'Sign in', 'locked@practice.dev returns HTTP 423.']
    ]
  }
];

export default function Challenges() {
  return (
    <article className="challenges">
      <h1 className="page-title">What is in here to practise on</h1>
      <p className="challenges__lead">
        There are no data-testid attributes anywhere in this codebase, on purpose. Everything below is reachable with the
        kind of locator you would have to write against a real production site: roles, labels, text, structure and CSS
        that was never designed for you.
      </p>

      {GROUPS.map((group) => (
        <section className="challenges__group" key={group.title}>
          <h2>{group.title}</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col">Where</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map(([scenario, where, notes]) => (
                <tr key={scenario}>
                  <td>{scenario}</td>
                  <td>{where}</td>
                  <td>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <section className="challenges__group">
        <h2>Useful entry points</h2>
        <ul>
          <li>
            <Link to="/">Storefront with filters</Link>
          </li>
          <li>
            <Link to="/cart">Basket</Link> and <Link to="/checkout">checkout</Link>
          </li>
          <li>
            <Link to="/orders">Order history</Link>
          </li>
          <li>
            <Link to="/admin">Admin tools</Link> (sign in as admin@practice.dev)
          </li>
          <li>
            <a href="/api/health" target="_blank" rel="noreferrer">
              API health endpoint
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
