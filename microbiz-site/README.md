# MicroBiz Shop (Static)

Simple, no-backend storefront for a micro-sized business: select products, choose payment method, and generate a printable invoice.

## Run (with backend)

Start the Node server (serves the site and APIs):

```bash
cd /workspace/microbiz-server
npm install
npm start
```

Open `http://localhost:8080`.

## Customize

- Business info/currency: edit the `appConfig` object at the top of `app.js`.
- Products and categories: edit the `catalog` array in `app.js`.
- Tax: set `appConfig.tax.enabled` and `appConfig.tax.rate`.

## Flow

1. Products: filter by category, add items to cart, adjust quantities.
2. Payment: enter optional customer details, select payment method (cash/card/wallet). Cash shows change; card/wallet have reference fields.
3. Invoice: auto-generated, printable (use the Print button to save as PDF).

## Notes

- No real payment processing; the backend records orders to `microbiz-server/data/orders.json`.
- Totals are verified on the server using current catalog and tax.

