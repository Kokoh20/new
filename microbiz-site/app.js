"use strict";

// Simple micro-business storefront: product selection -> payment -> invoice

// Configuration
const appConfig = {
  business: {
    name: "Acme Micro Shop",
    email: "hello@acmemicro.example",
    phone: "+1 (555) 010-0100",
    address: "123 Sample Street, Townsville",
  },
  currency: {
    code: "USD",
    locale: "en-US",
  },
  tax: {
    enabled: false,
    rate: 0,
  },
};

// Seed catalog (edit freely to match your products)
const catalog = [
  { id: "bowl-chicken", name: "Chicken Bowl", price: 6.99, category: "Bowls" },
  { id: "bowl-beef", name: "Beef Bowl", price: 7.99, category: "Bowls" },
  { id: "bowl-veggie", name: "Veggie Bowl", price: 5.99, category: "Bowls" },
  { id: "addon-egg", name: "Extra Egg", price: 0.99, category: "Add-ons" },
  { id: "addon-cheese", name: "Cheese", price: 0.79, category: "Add-ons" },
  { id: "addon-sauce", name: "Spicy Sauce", price: 0.49, category: "Add-ons" },
  { id: "drink-cola", name: "Cola", price: 1.49, category: "Drinks" },
  { id: "drink-icedtea", name: "Iced Tea", price: 1.69, category: "Drinks" },
  { id: "drink-water", name: "Bottled Water", price: 0.99, category: "Drinks" },
];

// State
const state = {
  selectedCategory: "All",
  cartProductIdToQuantity: new Map(),
  paymentMethod: null, // "cash" | "card" | "wallet"
  customer: {
    name: "",
    email: "",
    phone: "",
  },
  paymentDetails: {},
};

// Utilities
function formatMoney(amount) {
  return new Intl.NumberFormat(appConfig.currency.locale, {
    style: "currency",
    currency: appConfig.currency.code,
  }).format(amount);
}

function getCartItems() {
  const items = [];
  for (const [productId, quantity] of state.cartProductIdToQuantity.entries()) {
    const product = catalog.find(p => p.id === productId);
    if (!product) continue;
    items.push({ product, quantity, lineTotal: roundMoney(product.price * quantity) });
  }
  return items;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculateTotals() {
  const items = getCartItems();
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const tax = appConfig.tax.enabled ? roundMoney(subtotal * appConfig.tax.rate) : 0;
  const total = roundMoney(subtotal + tax);
  return { subtotal, tax, total };
}

// DOM references
const stepProducts = document.getElementById("step-products");
const stepPayment = document.getElementById("step-payment");
const stepInvoice = document.getElementById("step-invoice");

const businessNameEl = document.getElementById("businessName");
const businessFooterNameEl = document.getElementById("businessFooterName");
const businessFooterContactEl = document.getElementById("businessFooterContact");

const categorySelect = document.getElementById("categorySelect");
const productsGrid = document.getElementById("productsGrid");

const cartItemsList = document.getElementById("cartItems");
const subtotalAmountEl = document.getElementById("subtotalAmount");
const totalAmountEl = document.getElementById("totalAmount");
const toPaymentBtn = document.getElementById("toPaymentBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const paymentForm = document.getElementById("paymentForm");
const backToProductsBtn = document.getElementById("backToProductsBtn");
const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
const paymentDetailsContainer = document.getElementById("paymentDetails");
const customerNameInput = document.getElementById("customerName");
const customerEmailInput = document.getElementById("customerEmail");
const customerPhoneInput = document.getElementById("customerPhone");

const invoiceContainer = document.getElementById("invoiceContainer");
const printInvoiceBtn = document.getElementById("printInvoiceBtn");
const newOrderBtn = document.getElementById("newOrderBtn");

// Init
initializeApp();

function initializeApp() {
  // Set business identity
  businessNameEl.textContent = appConfig.business.name;
  businessFooterNameEl.textContent = appConfig.business.name;
  businessFooterContactEl.textContent = appConfig.business.email || appConfig.business.phone || "";

  populateCategories();
  renderProducts();
  renderCart();
  attachEventListeners();
}

function populateCategories() {
  const uniqueCategories = Array.from(new Set(catalog.map(p => p.category)));
  const options = ["All", ...uniqueCategories];
  categorySelect.innerHTML = options.map(cat => `<option value="${cat}">${cat}</option>`).join("");
  categorySelect.value = state.selectedCategory;
}

function renderProducts() {
  const productsToShow = catalog.filter(p => state.selectedCategory === "All" || p.category === state.selectedCategory);
  productsGrid.innerHTML = productsToShow.map(product => renderProductCard(product)).join("");

  // Wire up buttons and qty controls after render
  productsToShow.forEach(product => {
    const minusButton = document.querySelector(`button[data-minus="${product.id}"]`);
    const plusButton = document.querySelector(`button[data-plus="${product.id}"]`);
    const qtyInput = document.querySelector(`input[data-qty="${product.id}"]`);
    const addButton = document.querySelector(`button[data-add="${product.id}"]`);

    minusButton.addEventListener("click", () => {
      const current = Math.max(1, parseInt(qtyInput.value || "1", 10) - 1);
      qtyInput.value = String(current);
    });
    plusButton.addEventListener("click", () => {
      const current = Math.min(999, parseInt(qtyInput.value || "1", 10) + 1);
      qtyInput.value = String(current);
    });
    addButton.addEventListener("click", () => {
      const qtyToAdd = Math.max(1, parseInt(qtyInput.value || "1", 10));
      addToCart(product.id, qtyToAdd);
    });
  });
}

function renderProductCard(product) {
  const price = formatMoney(product.price);
  return `
    <div class="product-card">
      <div>
        <h4>${product.name}</h4>
        <div class="product-price">${price}</div>
      </div>
      <div class="product-actions">
        <div class="qty">
          <button type="button" data-minus="${product.id}">−</button>
          <input type="number" inputmode="numeric" min="1" max="999" value="1" data-qty="${product.id}" />
          <button type="button" data-plus="${product.id}">+</button>
        </div>
        <button type="button" class="btn" data-add="${product.id}">Add</button>
      </div>
    </div>
  `;
}

function addToCart(productId, quantityToAdd) {
  const current = state.cartProductIdToQuantity.get(productId) || 0;
  const next = Math.min(999, current + quantityToAdd);
  state.cartProductIdToQuantity.set(productId, next);
  renderCart();
}

function updateCartQuantity(productId, newQuantity) {
  if (newQuantity <= 0) {
    state.cartProductIdToQuantity.delete(productId);
  } else {
    state.cartProductIdToQuantity.set(productId, Math.min(999, newQuantity));
  }
  renderCart();
}

function renderCart() {
  const items = getCartItems();
  cartItemsList.innerHTML = items.map(({ product, quantity }) => {
    const lineTotal = formatMoney(product.price * quantity);
    return `
      <li class="cart-item" data-id="${product.id}">
        <div class="name">${product.name}<div class="product-price">${formatMoney(product.price)}</div></div>
        <div class="controls">
          <div class="qty">
            <button type="button" data-cart-minus>−</button>
            <input type="number" inputmode="numeric" min="1" max="999" value="${quantity}" data-cart-qty />
            <button type="button" data-cart-plus>+</button>
          </div>
          <div class="line-total">${lineTotal}</div>
          <button type="button" class="remove" title="Remove" data-cart-remove>✕</button>
        </div>
      </li>
    `;
  }).join("");

  // Totals
  const { subtotal, tax, total } = calculateTotals();
  subtotalAmountEl.textContent = formatMoney(subtotal);
  totalAmountEl.textContent = formatMoney(total);

  // Buttons
  toPaymentBtn.disabled = items.length === 0;

  // Wire up cart item controls
  document.querySelectorAll(".cart-item").forEach(itemEl => {
    const productId = itemEl.getAttribute("data-id");
    const minus = itemEl.querySelector("[data-cart-minus]");
    const plus = itemEl.querySelector("[data-cart-plus]");
    const qtyInput = itemEl.querySelector("[data-cart-qty]");
    const removeBtn = itemEl.querySelector("[data-cart-remove]");

    minus.addEventListener("click", () => updateCartQuantity(productId, parseInt(qtyInput.value, 10) - 1));
    plus.addEventListener("click", () => updateCartQuantity(productId, parseInt(qtyInput.value, 10) + 1));
    qtyInput.addEventListener("change", () => updateCartQuantity(productId, parseInt(qtyInput.value || "1", 10)));
    removeBtn.addEventListener("click", () => updateCartQuantity(productId, 0));
  });
}

function attachEventListeners() {
  categorySelect.addEventListener("change", () => {
    state.selectedCategory = categorySelect.value;
    renderProducts();
  });

  clearCartBtn.addEventListener("click", () => {
    state.cartProductIdToQuantity.clear();
    renderCart();
  });

  toPaymentBtn.addEventListener("click", () => {
    goToStep("payment");
  });

  backToProductsBtn.addEventListener("click", () => {
    goToStep("products");
  });

  // Track customer inputs
  customerNameInput.addEventListener("input", () => state.customer.name = customerNameInput.value.trim());
  customerEmailInput.addEventListener("input", () => state.customer.email = customerEmailInput.value.trim());
  customerPhoneInput.addEventListener("input", () => state.customer.phone = customerPhoneInput.value.trim());

  // Payment method selection
  paymentForm.addEventListener("change", (event) => {
    if (event.target && event.target.name === "paymentMethod") {
      state.paymentMethod = event.target.value;
      renderPaymentDetailsFields();
      syncConfirmEnabled();
    }
  });

  paymentForm.addEventListener("input", () => {
    capturePaymentDetails();
    syncConfirmEnabled();
  });

  paymentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canConfirm()) return;
    generateInvoice();
    goToStep("invoice");
  });

  printInvoiceBtn.addEventListener("click", () => window.print());
  newOrderBtn.addEventListener("click", () => {
    // Reset all state
    state.cartProductIdToQuantity.clear();
    state.paymentMethod = null;
    state.paymentDetails = {};
    state.customer = { name: "", email: "", phone: "" };
    // Reset form fields
    paymentForm.reset();
    customerNameInput.value = "";
    customerEmailInput.value = "";
    customerPhoneInput.value = "";
    renderPaymentDetailsFields();
    renderCart();
    goToStep("products");
  });
}

function goToStep(step) {
  stepProducts.classList.remove("active");
  stepPayment.classList.remove("active");
  stepInvoice.classList.remove("active");

  if (step === "products") {
    stepProducts.classList.add("active");
  } else if (step === "payment") {
    stepPayment.classList.add("active");
  } else if (step === "invoice") {
    stepInvoice.classList.add("active");
  }
}

function renderPaymentDetailsFields() {
  const method = state.paymentMethod;
  if (!method) {
    paymentDetailsContainer.innerHTML = "";
    return;
  }
  if (method === "cash") {
    paymentDetailsContainer.innerHTML = `
      <div class="field-row two">
        <div>
          <label for="cashGiven">Cash received (optional)</label>
          <input type="number" id="cashGiven" placeholder="${appConfig.currency.code} amount" min="0" step="0.01" />
        </div>
        <div>
          <label for="cashChange">Change (auto)</label>
          <input type="text" id="cashChange" disabled />
        </div>
      </div>
    `;
  } else if (method === "card") {
    paymentDetailsContainer.innerHTML = `
      <div class="field-row two">
        <div>
          <label for="cardLast4">Card last 4</label>
          <input type="text" id="cardLast4" maxlength="4" placeholder="1234" />
        </div>
        <div>
          <label for="cardRef">Auth/reference</label>
          <input type="text" id="cardRef" placeholder="AUTH123" />
        </div>
      </div>
    `;
  } else if (method === "wallet") {
    paymentDetailsContainer.innerHTML = `
      <div class="field-row two">
        <div>
          <label for="walletProvider">Wallet provider</label>
          <input type="text" id="walletProvider" placeholder="e.g., GCash, PayPal" />
        </div>
        <div>
          <label for="walletRef">Transaction ref</label>
          <input type="text" id="walletRef" placeholder="TXN-001" />
        </div>
      </div>
    `;
  }

  // If cash, auto compute change on input
  if (method === "cash") {
    const cashGivenInput = document.getElementById("cashGiven");
    const cashChangeInput = document.getElementById("cashChange");
    cashGivenInput.addEventListener("input", () => {
      const { total } = calculateTotals();
      const given = parseFloat(cashGivenInput.value || "0");
      const change = Math.max(0, roundMoney(given - total));
      cashChangeInput.value = formatMoney(change);
    });
  }
}

function capturePaymentDetails() {
  const method = state.paymentMethod;
  if (!method) { state.paymentDetails = {}; return; }
  if (method === "cash") {
    const cashGivenInput = document.getElementById("cashGiven");
    state.paymentDetails = {
      cashGiven: cashGivenInput ? parseFloat(cashGivenInput.value || "0") : 0,
    };
  } else if (method === "card") {
    state.paymentDetails = {
      last4: (document.getElementById("cardLast4")?.value || "").trim(),
      reference: (document.getElementById("cardRef")?.value || "").trim(),
    };
  } else if (method === "wallet") {
    state.paymentDetails = {
      provider: (document.getElementById("walletProvider")?.value || "").trim(),
      reference: (document.getElementById("walletRef")?.value || "").trim(),
    };
  }
}

function canConfirm() {
  const hasItems = getCartItems().length > 0;
  const hasMethod = Boolean(state.paymentMethod);
  return hasItems && hasMethod;
}

function syncConfirmEnabled() {
  confirmPaymentBtn.disabled = !canConfirm();
}

function generateInvoice() {
  const items = getCartItems();
  const { subtotal, tax, total } = calculateTotals();
  const invoiceId = `INV-${Date.now().toString().slice(-6)}`;
  const createdAt = new Date();

  const paymentSummary = buildPaymentSummary();

  const rowsHtml = items.map(item => `
    <tr>
      <td>${item.product.name}</td>
      <td>${item.quantity}</td>
      <td>${formatMoney(item.product.price)}</td>
      <td>${formatMoney(item.lineTotal)}</td>
    </tr>
  `).join("");

  const taxRow = appConfig.tax.enabled ? `<tr><td colspan="3" style="text-align:right">Tax</td><td>${formatMoney(tax)}</td></tr>` : "";

  const customerBlock = buildCustomerBlock();

  invoiceContainer.innerHTML = `
    <header>
      <div>
        <div style="font-weight:700; font-size:18px;">${appConfig.business.name}</div>
        <div style="color:#555;">${appConfig.business.address || ""}</div>
        <div style="color:#555;">${appConfig.business.email || ""} ${appConfig.business.phone ? "· " + appConfig.business.phone : ""}</div>
      </div>
      <div>
        <div style="font-weight:700;">Invoice</div>
        <div style="color:#555;">${invoiceId}</div>
        <div style="color:#555;">${createdAt.toLocaleString()}</div>
      </div>
    </header>

    ${customerBlock}

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr><td colspan="3" style="text-align:right">Subtotal</td><td>${formatMoney(subtotal)}</td></tr>
        ${taxRow}
        <tr><td colspan="3" style="text-align:right">Total</td><td>${formatMoney(total)}</td></tr>
      </tfoot>
    </table>

    <div style="margin-top:10px;">
      <div><strong>Payment</strong>: ${paymentSummary}</div>
      <div style="color:#555;margin-top:6px;">Thank you for your purchase!</div>
    </div>
  `;
}

function buildCustomerBlock() {
  const hasAny = state.customer.name || state.customer.email || state.customer.phone;
  if (!hasAny) return "";
  const rows = [
    state.customer.name ? `<div>${state.customer.name}</div>` : "",
    state.customer.email ? `<div>${state.customer.email}</div>` : "",
    state.customer.phone ? `<div>${state.customer.phone}</div>` : "",
  ].join("");
  return `<div style="margin-bottom:10px;">${rows}</div>`;
}

function buildPaymentSummary() {
  const method = state.paymentMethod;
  if (!method) return "";
  if (method === "cash") {
    const given = state.paymentDetails.cashGiven || 0;
    const { total } = calculateTotals();
    const change = Math.max(0, roundMoney(given - total));
    return `Cash${given ? ` · Given ${formatMoney(given)} · Change ${formatMoney(change)}` : ""}`;
  }
  if (method === "card") {
    const last4 = state.paymentDetails.last4 ? `•••• ${state.paymentDetails.last4}` : "Card";
    const ref = state.paymentDetails.reference ? ` · Ref ${state.paymentDetails.reference}` : "";
    return `${last4}${ref}`;
  }
  if (method === "wallet") {
    const provider = state.paymentDetails.provider || "Wallet";
    const ref = state.paymentDetails.reference ? ` · Ref ${state.paymentDetails.reference}` : "";
    return `${provider}${ref}`;
  }
  return "";
}

