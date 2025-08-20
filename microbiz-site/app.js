"use strict";

// Mauiz Cafe storefront: menu -> cart -> payment -> invoice (with backend integration)

// Config and catalog will be hydrated from the backend, but we keep a fallback
let appConfig = {
	business: {
		name: "Mauiz Cafe",
		email: "hello@mauizcafe.example",
		phone: "+1 (555) 010-CAFE",
		address: "12 Brew Street, Bean City",
	},
	currency: { code: "USD", locale: "en-US" },
	tax: { enabled: false, rate: 0 },
};

let catalog = [
	{ id: "coffee-espresso", name: "Espresso", price: 2.5, category: "Coffee", image: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800&q=60" },
	{ id: "coffee-americano", name: "Americano", price: 3.0, category: "Coffee", image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=60" },
	{ id: "coffee-latte", name: "Caffe Latte", price: 3.75, category: "Coffee", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=60" },
	{ id: "coffee-cappuccino", name: "Cappuccino", price: 3.75, category: "Coffee", image: "https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?w=800&q=60" },
	{ id: "coffee-mocha", name: "Mocha", price: 4.0, category: "Coffee", image: "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&q=60" },
	{ id: "noncoffee-chocolate", name: "Hot Chocolate", price: 3.25, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800&q=60" },
	{ id: "noncoffee-matcha", name: "Matcha Latte", price: 4.0, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1515824955341-513a8d249d6a?w=800&q=60" },
	{ id: "noncoffee-icedtea", name: "Iced Tea", price: 2.5, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=60" },
	{ id: "pastry-croissant", name: "Butter Croissant", price: 2.75, category: "Pastries", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=60" },
	{ id: "pastry-muffin", name: "Blueberry Muffin", price: 2.25, category: "Pastries", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476d?w=800&q=60" },
	{ id: "pastry-cookie", name: "Chocolate Chip Cookie", price: 1.75, category: "Pastries", image: "https://images.unsplash.com/photo-1606813907291-76b599ecb39e?w=800&q=60" },
];

// State
const state = {
	selectedCategory: "All",
	search: "",
	cartProductIdToQuantity: new Map(),
	paymentMethod: null,
	customer: { name: "", email: "", phone: "" },
	paymentDetails: {},
	orderType: null, // Dine-in | Take-out | Delivery
	orderNote: "",
	lastOrder: null,
};

// DOM
const stepProducts = document.getElementById("step-products");
const stepPayment = document.getElementById("step-payment");
const stepInvoice = document.getElementById("step-invoice");

const businessNameEl = document.getElementById("businessName");
const businessFooterNameEl = document.getElementById("businessFooterName");
const businessFooterContactEl = document.getElementById("businessFooterContact");

const categoryTabs = document.getElementById("categoryTabs");
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
const orderNoteInput = document.getElementById("orderNote");

const invoiceContainer = document.getElementById("invoiceContainer");
const printInvoiceBtn = document.getElementById("printInvoiceBtn");
const newOrderBtn = document.getElementById("newOrderBtn");

const backdropEl = document.getElementById("backdrop");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartPanel = document.getElementById("cartPanel");
const cartCountEl = document.getElementById("cartCount");
const searchInput = document.getElementById("searchInput");

// Init
initializeApp().catch(console.error);

async function initializeApp() {
	await hydrateFromApi();
	// Business identity
	businessNameEl.textContent = appConfig.business.name;
	businessFooterNameEl.textContent = appConfig.business.name;
	businessFooterContactEl.textContent = appConfig.business.email || appConfig.business.phone || "";

	populateCategories();
	renderProducts();
	renderCart();
	attachEventListeners();
}

async function hydrateFromApi() {
	try {
		const [cfgRes, catRes] = await Promise.all([
			fetch(`/api/config`).then(r => r.ok ? r.json() : Promise.reject()),
			fetch(`/api/catalog`).then(r => r.ok ? r.json() : Promise.reject()),
		]);
		if (cfgRes) appConfig = cfgRes;
		if (catRes && Array.isArray(catRes.catalog)) catalog = catRes.catalog;
	} catch {
		// use fallback
	}
}

function populateCategories() {
	const uniqueCategories = Array.from(new Set(catalog.map(p => p.category)));
	const tabs = ["All", ...uniqueCategories];
	categoryTabs.innerHTML = tabs.map(cat => `<button type="button" class="tab" data-cat="${cat}">${cat}</button>`).join("");
	setActiveTab();
	categoryTabs.querySelectorAll(".tab").forEach(btn => {
		btn.addEventListener("click", () => {
			state.selectedCategory = btn.getAttribute("data-cat");
			setActiveTab();
			renderProducts();
		});
	});
}

function setActiveTab() {
	categoryTabs.querySelectorAll(".tab").forEach(btn => {
		const cat = btn.getAttribute("data-cat");
		if (cat === state.selectedCategory) btn.classList.add("active"); else btn.classList.remove("active");
	});
}

function renderProducts() {
	const productsToShow = catalog.filter(p =>
		(state.selectedCategory === "All" || p.category === state.selectedCategory) &&
		(!state.search || p.name.toLowerCase().includes(state.search))
	);
	productsGrid.innerHTML = productsToShow.map(product => renderProductCard(product)).join("");

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
			yQtyInput.value = String(current);
		});
		addButton.addEventListener("click", () => {
			const qtyToAdd = Math.max(1, parseInt(qtyInput.value || "1", 10));
			addToCart(product.id, qtyToAdd);
		});
	});
}

function renderProductCard(product) {
	const price = formatMoney(product.price);
	const imgStyle = product.image ? ` style="background-image:url('${product.image}')"` : "";
	return `
		<div class="product-card">
			<div class="thumb"${imgStyle}></div>
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
	if (newQuantity <= 0) state.cartProductIdToQuantity.delete(productId);
	else state.cartProductIdToQuantity.set(productId, Math.min(999, newQuantity));
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

	const { subtotal, tax, total } = calculateTotals();
	subtotalAmountEl.textContent = formatMoney(subtotal);
	totalAmountEl.textContent = formatMoney(total);

	toPaymentBtn.disabled = items.length === 0;
	if (cartCountEl) {
		const count = items.reduce((sum, it) => sum + it.quantity, 0);
		cartCountEl.textContent = String(count);
	}

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

	// Customer and order details
	customerNameInput.addEventListener("input", () => state.customer.name = customerNameInput.value.trim());
	customerEmailInput.addEventListener("input", () => state.customer.email = customerEmailInput.value.trim());
	customerPhoneInput.addEventListener("input", () => state.customer.phone = customerPhoneInput.value.trim());
	if (orderNoteInput) orderNoteInput.addEventListener("input", () => state.orderNote = orderNoteInput.value);
	paymentForm.addEventListener("change", (e) => {
		if (e.target && e.target.name === "orderType") state.orderType = e.target.value;
	});

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
	paymentForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!canConfirm()) return;
		try {
			const order = await submitOrderToApi();
			state.lastOrder = order || null;
			generateInvoice(order || undefined);
			goToStep("invoice");
		} catch (e) {
			state.lastOrder = null;
			generateInvoice();
			goToStep("invoice");
		}
	});

	// Cart drawer
	function openCart() {
		if (cartPanel) {
			cartPanel.classList.add("open");
			cartPanel.setAttribute("aria-hidden", "false");
		}
		if (backdropEl) backdropEl.hidden = false;
	}
	function closeCart() {
		if (cartPanel) {
			cartPanel.classList.remove("open");
			cartPanel.setAttribute("aria-hidden", "true");
		}
		if (backdropEl) backdropEl.hidden = true;
	}
	if (openCartBtn) openCartBtn.addEventListener("click", openCart);
	if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
	if (backdropEl) backdropEl.addEventListener("click", closeCart);

	// Search
	if (searchInput) {
		searchInput.addEventListener("input", () => {
			state.search = (searchInput.value || "").toLowerCase();
			renderProducts();
		});
	}
}

function goToStep(step) {
	stepProducts.classList.remove("active");
	stepPayment.classList.remove("active");
	stepInvoice.classList.remove("active");
	if (step === "products") stepProducts.classList.add("active");
	else if (step === "payment") stepPayment.classList.add("active");
	else if (step === "invoice") stepInvoice.classList.add("active");
}

function renderPaymentDetailsFields() {
	const method = state.paymentMethod;
	if (!method) { paymentDetailsContainer.innerHTML = ""; return; }
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
		state.paymentDetails = { cashGiven: cashGivenInput ? parseFloat(cashGivenInput.value || "0") : 0 };
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

function formatMoney(amount) {
	return new Intl.NumberFormat(appConfig.currency.locale, { style: "currency", currency: appConfig.currency.code }).format(amount);
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

function canConfirm() {
	const hasItems = getCartItems().length > 0;
	const hasMethod = Boolean(state.paymentMethod);
	return hasItems && hasMethod;
}

function syncConfirmEnabled() {
	confirmPaymentBtn.disabled = !canConfirm();
}

function generateInvoice(orderFromServer) {
	const items = getCartItems();
	const localTotals = calculateTotals();
	const { subtotal, tax, total } = orderFromServer?.totals || localTotals;
	const invoiceId = orderFromServer?.invoiceId || `INV-${Date.now().toString().slice(-6)}`;
	const createdAt = orderFromServer ? new Date(orderFromServer.createdAt) : new Date();

	const paymentSummary = buildPaymentSummary();

	const rowsSource = orderFromServer?.itemsDetailed?.length
		? orderFromServer.itemsDetailed.map(d => ({ product: { name: d.name, price: d.price }, quantity: d.quantity, lineTotal: d.lineTotal }))
		: items;
	const rowsHtml = rowsSource.map(item => `
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
	const hasAny = state.customer.name || state.customer.email || state.customer.phone || state.orderType || state.orderNote;
	if (!hasAny) return "";
	const rows = [
		state.customer.name ? `<div>${state.customer.name}</div>` : "",
		state.customer.email ? `<div>${state.customer.email}</div>` : "",
		state.customer.phone ? `<div>${state.customer.phone}</div>` : "",
		state.orderType ? `<div><strong>Order:</strong> ${state.orderType}</div>` : "",
		state.orderNote ? `<div><strong>Note:</strong> ${state.orderNote}</div>` : "",
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

async function submitOrderToApi() {
	const items = [];
	for (const [productId, quantity] of state.cartProductIdToQuantity.entries()) {
		items.push({ productId, quantity });
	}
	const payload = {
		items,
		customer: state.customer,
		paymentMethod: state.paymentMethod,
		paymentDetails: state.paymentDetails,
		orderType: state.orderType || null,
		note: state.orderNote || "",
	};
	const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
	if (!res.ok) throw new Error('Order submission failed');
	return res.json();
}
"use strict";

// Mauiz Cafe storefront: menu -> cart -> payment -> invoice (with backend integration)

// Config and catalog will be hydrated from the backend, but we keep a fallback
let appConfig = {
	business: {
		name: "Mauiz Cafe",
		email: "hello@mauizcafe.example",
		phone: "+1 (555) 010-CAFE",
		address: "12 Brew Street, Bean City",
	},
	currency: { code: "USD", locale: "en-US" },
	tax: { enabled: false, rate: 0 },
};

let catalog = [
	{ id: "coffee-espresso", name: "Espresso", price: 2.5, category: "Coffee", image: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800&q=60" },
	{ id: "coffee-americano", name: "Americano", price: 3.0, category: "Coffee", image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=800&q=60" },
	{ id: "coffee-latte", name: "Caffe Latte", price: 3.75, category: "Coffee", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=800&q=60" },
	{ id: "coffee-cappuccino", name: "Cappuccino", price: 3.75, category: "Coffee", image: "https://images.unsplash.com/photo-1510972527921-ce03766a1cf1?w=800&q=60" },
	{ id: "coffee-mocha", name: "Mocha", price: 4.0, category: "Coffee", image: "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&q=60" },
	{ id: "noncoffee-chocolate", name: "Hot Chocolate", price: 3.25, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=800&q=60" },
	{ id: "noncoffee-matcha", name: "Matcha Latte", price: 4.0, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1515824955341-513a8d249d6a?w=800&q=60" },
	{ id: "noncoffee-icedtea", name: "Iced Tea", price: 2.5, category: "Non-Coffee", image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=60" },
	{ id: "pastry-croissant", name: "Butter Croissant", price: 2.75, category: "Pastries", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=60" },
	{ id: "pastry-muffin", name: "Blueberry Muffin", price: 2.25, category: "Pastries", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476d?w=800&q=60" },
	{ id: "pastry-cookie", name: "Chocolate Chip Cookie", price: 1.75, category: "Pastries", image: "https://images.unsplash.com/photo-1606813907291-76b599ecb39e?w=800&q=60" },
];

// State
const state = {
	selectedCategory: "All",
	search: "",
	cartProductIdToQuantity: new Map(),
	paymentMethod: null,
	customer: { name: "", email: "", phone: "" },
	paymentDetails: {},
	orderType: null, // Dine-in | Take-out | Delivery
	orderNote: "",
	lastOrder: null,
};

// DOM
const stepProducts = document.getElementById("step-products");
const stepPayment = document.getElementById("step-payment");
const stepInvoice = document.getElementById("step-invoice");

const businessNameEl = document.getElementById("businessName");
const businessFooterNameEl = document.getElementById("businessFooterName");
const businessFooterContactEl = document.getElementById("businessFooterContact");

const categoryTabs = document.getElementById("categoryTabs");
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
const orderNoteInput = document.getElementById("orderNote");

const invoiceContainer = document.getElementById("invoiceContainer");
const printInvoiceBtn = document.getElementById("printInvoiceBtn");
const newOrderBtn = document.getElementById("newOrderBtn");

const backdropEl = document.getElementById("backdrop");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartPanel = document.getElementById("cartPanel");
const cartCountEl = document.getElementById("cartCount");
const searchInput = document.getElementById("searchInput");

// Init
initializeApp().catch(console.error);

async function initializeApp() {
	await hydrateFromApi();
	// Business identity
	businessNameEl.textContent = appConfig.business.name;
	businessFooterNameEl.textContent = appConfig.business.name;
	businessFooterContactEl.textContent = appConfig.business.email || appConfig.business.phone || "";

	populateCategories();
	renderProducts();
	renderCart();
	attachEventListeners();
}

async function hydrateFromApi() {
	try {
		const [cfgRes, catRes] = await Promise.all([
			fetch(`/api/config`).then(r => r.ok ? r.json() : Promise.reject()),
			fetch(`/api/catalog`).then(r => r.ok ? r.json() : Promise.reject()),
		]);
		if (cfgRes) appConfig = cfgRes;
		if (catRes && Array.isArray(catRes.catalog)) catalog = catRes.catalog;
	} catch {
		// use fallback
	}
}

function populateCategories() {
	const uniqueCategories = Array.from(new Set(catalog.map(p => p.category)));
	const tabs = ["All", ...uniqueCategories];
	categoryTabs.innerHTML = tabs.map(cat => `<button type="button" class="tab" data-cat="${cat}">${cat}</button>`).join("");
	setActiveTab();
	categoryTabs.querySelectorAll(".tab").forEach(btn => {
		btn.addEventListener("click", () => {
			state.selectedCategory = btn.getAttribute("data-cat");
			setActiveTab();
			renderProducts();
		});
	});
}

function setActiveTab() {
	categoryTabs.querySelectorAll(".tab").forEach(btn => {
		const cat = btn.getAttribute("data-cat");
		if (cat === state.selectedCategory) btn.classList.add("active"); else btn.classList.remove("active");
	});
}

function renderProducts() {
	const productsToShow = catalog.filter(p =>
		(state.selectedCategory === "All" || p.category === state.selectedCategory) &&
		(!state.search || p.name.toLowerCase().includes(state.search))
	);
	productsGrid.innerHTML = productsToShow.map(product => renderProductCard(product)).join("");

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
	const imgStyle = product.image ? ` style="background-image:url('${product.image}')"` : "";
	return `
		<div class="product-card">
			<div class="thumb"${imgStyle}></div>
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
	if (newQuantity <= 0) state.cartProductIdToQuantity.delete(productId);
	else state.cartProductIdToQuantity.set(productId, Math.min(999, newQuantity));
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

	const { subtotal, tax, total } = calculateTotals();
	subtotalAmountEl.textContent = formatMoney(subtotal);
	totalAmountEl.textContent = formatMoney(total);

	toPaymentBtn.disabled = items.length === 0;
	if (cartCountEl) {
		const count = items.reduce((sum, it) => sum + it.quantity, 0);
		cartCountEl.textContent = String(count);
	}

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

	// Customer and order details
	customerNameInput.addEventListener("input", () => state.customer.name = customerNameInput.value.trim());
	customerEmailInput.addEventListener("input", () => state.customer.email = customerEmailInput.value.trim());
	customerPhoneInput.addEventListener("input", () => state.customer.phone = customerPhoneInput.value.trim());
	if (orderNoteInput) orderNoteInput.addEventListener("input", () => state.orderNote = orderNoteInput.value);
	paymentForm.addEventListener("change", (e) => {
		if (e.target && e.target.name === "orderType") state.orderType = e.target.value;
	});

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
	paymentForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (!canConfirm()) return;
		try {
			const order = await submitOrderToApi();
			state.lastOrder = order || null;
			generateInvoice(order || undefined);
			goToStep("invoice");
		} catch (e) {
			state.lastOrder = null;
			generateInvoice();
			goToStep("invoice");
		}
	});

	// Cart drawer
	function openCart() {
		if (cartPanel) {
			cartPanel.classList.add("open");
			cartPanel.setAttribute("aria-hidden", "false");
		}
		if (backdropEl) backdropEl.hidden = false;
	}
	function closeCart() {
		if (cartPanel) {
			cartPanel.classList.remove("open");
			cartPanel.setAttribute("aria-hidden", "true");
		}
		if (backdropEl) backdropEl.hidden = true;
	}
	if (openCartBtn) openCartBtn.addEventListener("click", openCart);
	if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
	if (backdropEl) backdropEl.addEventListener("click", closeCart);

	// Search
	if (searchInput) {
		searchInput.addEventListener("input", () => {
			state.search = (searchInput.value || "").toLowerCase();
			renderProducts();
		});
	}
}

function goToStep(step) {
	stepProducts.classList.remove("active");
	stepPayment.classList.remove("active");
	stepInvoice.classList.remove("active");
	if (step === "products") stepProducts.classList.add("active");
	else if (step === "payment") stepPayment.classList.add("active");
	else if (step === "invoice") stepInvoice.classList.add("active");
}

function renderPaymentDetailsFields() {
	const method = state.paymentMethod;
	if (!method) { paymentDetailsContainer.innerHTML = ""; return; }
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
		state.paymentDetails = { cashGiven: cashGivenInput ? parseFloat(cashGivenInput.value || "0") : 0 };
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

function formatMoney(amount) {
	return new Intl.NumberFormat(appConfig.currency.locale, { style: "currency", currency: appConfig.currency.code }).format(amount);
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

function canConfirm() {
	const hasItems = getCartItems().length > 0;
	const hasMethod = Boolean(state.paymentMethod);
	return hasItems && hasMethod;
}

function syncConfirmEnabled() {
	confirmPaymentBtn.disabled = !canConfirm();
}

function generateInvoice(orderFromServer) {
	const items = getCartItems();
	const localTotals = calculateTotals();
	const { subtotal, tax, total } = orderFromServer?.totals || localTotals;
	const invoiceId = orderFromServer?.invoiceId || `INV-${Date.now().toString().slice(-6)}`;
	const createdAt = orderFromServer ? new Date(orderFromServer.createdAt) : new Date();

	const paymentSummary = buildPaymentSummary();

	const rowsSource = orderFromServer?.itemsDetailed?.length
		? orderFromServer.itemsDetailed.map(d => ({ product: { name: d.name, price: d.price }, quantity: d.quantity, lineTotal: d.lineTotal }))
		: items;
	const rowsHtml = rowsSource.map(item => `
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
	const hasAny = state.customer.name || state.customer.email || state.customer.phone || state.orderType || state.orderNote;
	if (!hasAny) return "";
	const rows = [
		state.customer.name ? `<div>${state.customer.name}</div>` : "",
		state.customer.email ? `<div>${state.customer.email}</div>` : "",
		state.customer.phone ? `<div>${state.customer.phone}</div>` : "",
		state.orderType ? `<div><strong>Order:</strong> ${state.orderType}</div>` : "",
		state.orderNote ? `<div><strong>Note:</strong> ${state.orderNote}</div>` : "",
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

async function submitOrderToApi() {
	const items = [];
	for (const [productId, quantity] of state.cartProductIdToQuantity.entries()) {
		items.push({ productId, quantity });
	}
	const payload = {
		items,
		customer: state.customer,
		paymentMethod: state.paymentMethod,
		paymentDetails: state.paymentDetails,
		orderType: state.orderType || null,
		note: state.orderNote || "",
	};
	const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
	if (!res.ok) throw new Error('Order submission failed');
	return res.json();
}