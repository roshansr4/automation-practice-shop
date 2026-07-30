import { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api.js';
import { Pagination, Spinner, formatMoney } from '../components.jsx';

const COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'created_at', label: 'Placed' },
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' }
];

export function Orders() {
  const [state, setState] = useState({ items: [], total: 0, page: 1, pageCount: 1 });
  const [sort, setSort] = useState('created_at');
  const [direction, setDirection] = useState('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .orders({ sort, direction, page, limit: 5, delay: 400 })
      .then((result) => !cancelled && setState(result))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort, direction, page]);

  function toggleSort(key) {
    if (sort === key) setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDirection('asc');
    }
    setPage(1);
  }

  return (
    <section className="orders">
      <h1 className="page-title">Your orders</h1>
      <p className="orders__intro">
        Orders placed as a guest are tied to this browser. Sign in before ordering to keep them on your account.
      </p>

      {loading && <Spinner label="Loading orders" />}

      {!loading && state.items.length === 0 && (
        <div className="empty-state">
          <h2>No orders yet</h2>
          <p>
            Place one from the <Link to="/">shop</Link> and it will show up here.
          </p>
        </div>
      )}

      {!loading && state.items.length > 0 && (
        <>
          <table className="data-table">
            <caption className="visually-hidden">Order history, sortable</caption>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" aria-sort={sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="data-table__sort" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      <span aria-hidden="true">{sort === column.key ? (direction === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}</span>
                    </button>
                  </th>
                ))}
                <th scope="col">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((order) => (
                <Fragment key={order.reference}>
                  <tr className="data-table__row">
                    <td>
                      <button type="button" className="link-button" onClick={() => setExpanded(expanded === order.reference ? null : order.reference)}>
                        {order.reference}
                      </button>
                    </td>
                    <td>{order.createdAt}</td>
                    <td>
                      <span className={`badge badge--${order.status.toLowerCase()}`}>{order.status}</span>
                    </td>
                    <td>{formatMoney(order.total)}</td>
                    <td>
                      <a href={api.invoiceUrl(order.reference)} download>
                        Download CSV
                      </a>
                    </td>
                  </tr>
                  {expanded === order.reference && (
                    <tr className="data-table__detail">
                      <td colSpan="5">
                        <ul>
                          {order.items.map((item) => (
                            <li key={item.id}>
                              {item.quantity} &times; {item.name} &mdash; {formatMoney(item.unitPrice * item.quantity)}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Delivering to {order.fullName}, {order.city}, {order.country}
                        </p>
                        <Link to={`/orders/${order.reference}`}>Open full order</Link>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <Pagination page={state.page} pageCount={state.pageCount} onChange={setPage} />
        </>
      )}
    </section>
  );
}

export function OrderConfirmation() {
  const { reference } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .order(reference)
      .then((result) => !cancelled && setOrder(result.order))
      .catch(() => !cancelled && setOrder(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (loading) {
    return (
      <div className="panel">
        <Spinner label="Loading your order" />
      </div>
    );
  }

  if (!order) {
    return (
      <section className="panel">
        <h1>We cannot find that order</h1>
        <p>
          Check the reference and try again, or look at <Link to="/orders">your order history</Link>.
        </p>
      </section>
    );
  }

  return (
    <section className="confirmation">
      <div className="confirmation__banner" role="status">
        <h1>Thanks, your order is in</h1>
        <p>
          Reference <strong className="confirmation__reference">{order.reference}</strong>. A confirmation email is on its
          way to {order.email}.
        </p>
      </div>

      <div className="confirmation__grid">
        <div>
          <h2>Delivery</h2>
          <address>
            {order.fullName}
            <br />
            {order.address}
            <br />
            {order.city} {order.postcode}
            <br />
            {order.region}, {order.country}
          </address>
          <p>Preferred date: {order.deliveryDate || 'not specified'}</p>
          <p>Method: {order.shippingMethod}</p>
        </div>

        <div>
          <h2>Payment</h2>
          <p>Method: {order.paymentMethod}</p>
          {order.coupon && <p>Code applied: {order.coupon}</p>}
          <p>
            <a href={api.invoiceUrl(order.reference)} download>
              Download the invoice
            </a>
          </p>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">SKU</th>
            <th scope="col">Qty</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.sku}</td>
              <td>{item.quantity}</td>
              <td>{formatMoney(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan="3" scope="row">
              Total paid
            </th>
            <td>{formatMoney(order.total)}</td>
          </tr>
        </tfoot>
      </table>

      <Link className="button" to="/">
        Keep shopping
      </Link>
    </section>
  );
}

export default Orders;
