# MicroBiz Shop (Static)

Simple, no-backend storefront for a micro-sized business: select products, choose payment method, and generate a printable invoice.

## Run

- Open `index.html` in any modern browser, or serve the folder:

```bash
cd /workspace/microbiz-site
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

## Customize

- Business info/currency: edit the `appConfig` object at the top of `app.js`.
- Products and categories: edit the `catalog` array in `app.js`.
- Tax: set `appConfig.tax.enabled` and `appConfig.tax.rate`.

## Flow

1. Products: filter by category, add items to cart, adjust quantities.
2. Payment: enter optional customer details, select payment method (cash/card/wallet). Cash shows change; card/wallet have reference fields.
3. Invoice: auto-generated, printable (use the Print button to save as PDF).

## Notes

- This is a static site; no payment is processed. Use it for in-person or manual orders.
- All calculations are done client-side. For compliance needs, integrate a backend.

