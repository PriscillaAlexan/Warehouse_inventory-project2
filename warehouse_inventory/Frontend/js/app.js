const API_BASE = "http://localhost/warehouse_inventory/backend/api";

async function api(endpoint, method = "GET", data = null) {
  const opts = { method, credentials: "include" };
  if (data) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(`${API_BASE}/${endpoint}`, opts);
  return await res.json().catch(() => ({}));
}

const main = document.getElementById("main");

// Global auth state
let isLoggedIn = false;
let isAdmin = false;

// Helper to set active tab
function setActive(view) {
  document.querySelectorAll("nav button[data-view]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

/* ========== DASHBOARD ========== */
async function renderDashboard() {
  setActive("dashboard");

  const [products, orders, shipments] = await Promise.all([
    api("products.php"),
    api("orders.php"),
    api("shipments.php")
  ]);

  // Product Table
  const productRows = Array.isArray(products)
    ? products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.sku}</td>
        <td>${p.name}</td>
        <td>${p.total_stock ?? 0}</td>
        <td>${p.locations ?? '-'}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5">No products found</td></tr>`;

  // Order Summary
  const orderSummary = Array.isArray(orders)
    ? orders.slice(0, 5).map(o => `
        <tr>
          <td>${o.id}</td>
          <td>${o.order_number}</td>
          <td>${o.total_items ?? 0}</td>
          <td>${o.status ?? '-'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4">No orders</td></tr>`;

  // Shipment Summary
  const shipmentSummary = Array.isArray(shipments)
    ? shipments.slice(0, 5).map(s => `
        <tr>
          <td>${s.id}</td>
          <td>${s.shipment_type}</td>
          <td>${s.warehouse}</td>
          <td>${s.total_items ?? 0}</td>
          <td>${s.created_at}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5">No shipments</td></tr>`;

  main.innerHTML = `
    <div class="page-card">
      <h2>📦 Dashboard Overview</h2>

      <h3>Products Summary</h3>
      <table class="table">
        <thead><tr><th>ID</th><th>SKU</th><th>Name</th><th>Qty</th><th>Location</th></tr></thead>
        <tbody>${productRows}</tbody>
      </table>

      <h3>🧾 Recent Orders</h3>
      <table class="table">
        <thead><tr><th>ID</th><th>Order #</th><th>Qty</th><th>Status</th></tr></thead>
        <tbody>${orderSummary}</tbody>
      </table>

      <h3>🚚 Recent Shipments</h3>
      <table class="table">
        <thead><tr><th>ID</th><th>Type</th><th>Warehouse</th><th>Items</th><th>Date</th></tr></thead>
        <tbody>${shipmentSummary}</tbody>
      </table>
    </div>
  `;
}

/* ========== LOAD SUPPLIERS FROM API ========== */
async function loadSuppliers() {
    try {
        const res = await fetch(`${API_BASE}/supplier.php`);
        const data = await res.json();
        // Ensure suppliers is always an array
        return Array.isArray(data.suppliers) ? data.suppliers : [];
    } catch (e) {
        console.error("Failed to load suppliers:", e);
        return [];
    }
}

/* ========== SHOW NEW PRODUCT FORM ========== */
async function showNewProductForm() {
    // Fetch suppliers first
    const suppliers = await loadSuppliers();

    // Generate supplier options
    const supplierOptions = suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

   main.innerHTML = `
  <div class="page-card">
    <h2>New Product</h2>

    <div class="form-group">
      <label>SKU:</label>
      <input id="productSKU" class="input-field" placeholder="Product SKU" disabled>
    </div>

    <div class="form-group">
      <label>Name:</label>
      <input id="productName" class="input-field" placeholder="Product Name">
    </div>

    <div class="form-group">
      <label>Description:</label>
      <textarea id="productDescription" class="input-field" placeholder="Product Description"></textarea>
    </div>

    <div class="form-group">
      <label>Acquire Cost:</label>
      <input id="productCost" class="input-field" type="number" placeholder="0">
    </div>

    <div class="form-group">
      <label>Quantity:</label>
      <input id="productQuantity" class="input-field" type="number" placeholder="0" value="0">
    </div>

    <div class="form-group">
      <label>Price:</label>
      <input id="productPrice" class="input-field" type="number" placeholder="0">
    </div>

    <div class="form-group">
      <label>Supplier:</label>
      <select id="productSupplier" class="input-field">
        <option value="">Select Supplier</option>
        ${supplierOptions}
      </select>
    </div>

    <div class="form-group">
      <label>Warehouse Name:</label>
      <input id="warehouseName" class="input-field" placeholder="Warehouse Name">
    </div>

    <div class="form-group">
      <label>Location:</label>
      <input id="warehouseLocation" class="input-field" placeholder="Warehouse Location">
    </div>

    <div class="form-actions" style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
      <button class="btn-primary" id="saveProductBtn">Save</button>
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
    </div>
  </div>
`;


    // Auto-generate random SKU
    document.getElementById("productSKU").value = 'SKU-' + Math.floor(100000 + Math.random() * 900000);

    // Button events
    document.getElementById("saveProductBtn").onclick = saveNewProduct;
    document.getElementById("cancelBtn").onclick = () => renderProducts(isLoggedIn, isAdmin);
}

/* ========== SAVE NEW PRODUCT ========== */
async function saveNewProduct() {
  const description = document.getElementById("productDescription").value.trim();
  const sku = document.getElementById("productSKU")?.value.trim();
  const name = document.getElementById("productName")?.value.trim();
  const acquire_cost = parseFloat(document.getElementById("productCost")?.value) || 0;
  const price = parseFloat(document.getElementById("productPrice")?.value) || 0;
  const supplier_id = document.getElementById("productSupplier")?.value || null;
  const warehouseName = document.getElementById("warehouseName")?.value.trim() || null;
  const warehouseLocation = document.getElementById("warehouseLocation")?.value.trim() || null;
  const quantity = parseInt(document.getElementById("productQuantity")?.value) || 0;

  if (!sku) return alert("Product SKU is required");
  if (!name) return alert("Product name is required");

  const res = await api("products.php", "POST", { 
    sku, name, description, acquire_cost, price, supplier_id, warehouseName, warehouseLocation, quantity
  });

  if (res.success) {
    alert("Product added successfully!");
    renderProducts(isLoggedIn, isAdmin);
  } else {
    alert(res.error || "Failed to add product");
  }
}

/* ========== RENDER PRODUCTS PAGE ========== */
async function renderProducts(isLoggedIn, isAdmin) {
  setActive("products");
  const data = await api("products.php");

  const rows = Array.isArray(data) ? data.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.sku}</td>
      <td>${p.name}</td>
      <td>${p.acquire_cost ?? 0}</td>
      <td>${p.price ?? 0}</td>
      <td>${p.total_stock ?? 0}</td>
      <td>${p.locations ?? "-"}</td>
      <td>
        ${isAdmin ? `
          <button class="btn-primary" onclick="editProduct(${p.id})">Edit</button>
          <button class="btn-primary btn-del" onclick="deleteProduct(${p.id})">Delete</button>
        ` : ''}
      </td>
    </tr>
  `).join(''):'';

  main.innerHTML = `
    <div class="page-card">
      <div class="page-header">
        <h2>Products</h2>
        <div class="toolbar">
          ${isLoggedIn ? '<button class="btn-primary" id="newProductBtn">New</button>' : ''}
          <input id="searchBox" class="search-input" placeholder="Search products...">
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>SKU</th>
            <th>Name</th>
            <th>Acquire Cost</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Location</th>
        ${isAdmin ?`<th>Actions</th>`:``} 
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  if (isLoggedIn && isAdmin) {
    document.getElementById("newProductBtn").onclick = showNewProductForm;
  }

  document.getElementById("searchBox").addEventListener("keyup", e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll("tbody tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(term) ? "" : "none";
    });
  });
}

/* ========== DELETE PRODUCT ========== */
async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;
  const res = await api(`products.php?id=${id}`, "DELETE");
  if (res.ok) {
    alert("Deleted successfully!");
    renderProducts(isLoggedIn, isAdmin);
  } else {
    alert(res.error || "Failed to delete product");
  }
}

/* ========== EDIT PRODUCT ========== */
async function editProduct(id) {
  const p = await api(`products.php?id=${id}`);

  // ✅ Filter only warehouses where quantity > 0
  const activeWarehouses = (p.warehouses || []).filter(w => parseFloat(w.quantity) > 0);

main.innerHTML = `
  <div class="page-card">
    <h2 style="display:flex;align-items:center;gap:8px;margin-bottom:20px;">
      <span style="color:#1f7aef;">✏️</span> Edit Product
    </h2>

    <div class="form-group">
      <label>SKU</label>
      <input id="productSKU" value="${p.sku}" class="input-field readonly" disabled>
    </div>

    <div class="form-group">
      <label>Name</label>
      <input id="productName" value="${p.name}" class="input-field">
    </div>

    <div class="form-group">
      <label>Acquire Cost</label>
      <input id="productCost" type="number" value="${p.acquire_cost ?? 0}" class="input-field">
    </div>

    <div class="form-group">
      <label>Price</label>
      <input id="productPrice" type="number" value="${p.price ?? 0}" class="input-field">
    </div>

    ${
      activeWarehouses.length > 0
        ? `
        <div class="form-group">
          <label>Warehouse</label>
          <select id="warehouseSelect" class="input-field">
            <option value="">-- Select Warehouse --</option>
            ${activeWarehouses
              .map(
                w => `
                <option value="${w.warehouse_id}" data-qty="${w.quantity}">
                  ${w.warehouse_name} (${w.location}) — Qty: ${w.quantity}
                </option>
              `
              )
              .join('')}
          </select>
        </div>

        <div id="warehouseQtyDiv" class="form-group" style="display:none;">
          <label>Edit Warehouse Quantity</label>
          <input id="warehouseQtyInput" type="number" class="input-field" placeholder="0">
        </div>
      `
        : `<p style="color:#666;">This product is not assigned to any warehouse.</p>`
    }

    <div style="display:flex;gap:10px;justify-content:center;margin-top:25px;">
      <button class="btn-primary" id="saveEditBtn">💾 Save</button>
      <button class="btn-secondary" id="cancelBtn">Cancel</button>
    </div>
  </div>
`;
const warehouseSelect = document.getElementById("warehouseSelect");
const warehouseQtyDiv = document.getElementById("warehouseQtyDiv");
const warehouseQtyInput = document.getElementById("warehouseQtyInput");

// Show/hide quantity input based on warehouse selection
if (warehouseSelect) {
  warehouseSelect.addEventListener("change", () => {
    const selected = warehouseSelect.options[warehouseSelect.selectedIndex];
    const qty = selected.getAttribute("data-qty");

    if (selected.value) {
      warehouseQtyDiv.style.display = "block"; // show
      warehouseQtyInput.value = qty || 0;
    } else {
      warehouseQtyDiv.style.display = "none"; // hide
    }
  });
}
warehouseSelect.addEventListener('change', () => {
  const selected = warehouseSelect.options[warehouseSelect.selectedIndex];
  const qty = selected.getAttribute('data-qty');
  if (selected.value) {
    warehouseQtyDiv.style.display = 'block';
    requestAnimationFrame(() => warehouseQtyDiv.classList.add('show'));
    warehouseQtyInput.value = qty || 0;
  } else {
    warehouseQtyDiv.classList.remove('show');
    setTimeout(() => (warehouseQtyDiv.style.display = 'none'), 250);
  }
});

  // Save button logic
  document.getElementById("saveEditBtn").onclick = async () => {
    const sku = document.getElementById("productSKU").value;
    const name = document.getElementById("productName").value;
    const acquire_cost = parseFloat(document.getElementById("productCost").value) || 0;
    const price = parseFloat(document.getElementById("productPrice").value) || 0;
    const selectedWarehouse = warehouseSelect ? warehouseSelect.value : null;
    const warehouseQty = warehouseQtyInput ? parseFloat(warehouseQtyInput.value) || 0 : null;

    const payload = { sku, name, acquire_cost, price };

    if (selectedWarehouse && warehouseQty !== null) {
      payload.warehouse_id = selectedWarehouse;
      payload.quantity = warehouseQty;
    }

    const res = await api(`products.php?id=${id}`, "PUT", payload);
    if (res.ok) {
      alert("Product updated!");
      renderProducts(isLoggedIn, isAdmin);
    } else {
      alert(res.error || "Failed to update product");
    }
  };

  document.getElementById("cancelBtn").onclick = renderProducts.bind(null, true);
}

/* ========== ORDERS ========== */
async function renderOrders() {
  setActive("orders");
  const data = await api("orders.php");

  // Ensure data is an array before using map()
  const orders = Array.isArray(data) ? data : [];
  const rows = orders.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.order_number}</td>
      <td>${o.products ?? "-"}</td>
      <td>${o.total_items ?? 0}</td>
      <td>${o.status ?? "-"}</td>
      ${isAdmin ? `<td>
          <button class="btn-primary btn-del" onclick="deleteOrder(${o.id})">Delete</button>
        </td>` : ""}
    </tr>
  `).join("");

  main.innerHTML = `
    <div class="page-card">
      <div class="page-header">
        <h2>Orders</h2>
        ${isAdmin ? `<button class="btn-primary" id="newOrderBtn">➕ New Order</button>` : ""}
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th><th>Order #</th><th>Products</th><th>Qty</th><th>Status</th>
            ${isAdmin ? `<th>Actions</th>` : ""}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  if (isAdmin) {
    document.getElementById("newOrderBtn").onclick = showNewOrderForm;
  }
}

async function showNewOrderForm() {
  // Fetch product list for dropdown
  const products = await api("products.php");
  const res = await api("orders.php/new-number");
  const orderNumber = res.order_number ?? "ORD-UNKNOWN";

  const productOptions = Array.isArray(products)
    ? products.map(
        p => `<option value="${p.id}" data-stock="${p.total_stock ?? 0}">
                ${p.name} (Stock: ${p.total_stock ?? 0})
              </option>`
      ).join("")
    : "";

  main.innerHTML = `
    <div class="page-card">
      <h2>➕ Create New Order</h2>

      <div class="form-group">
        <label>Order Number</label>
        <input id="orderNumber" class="input-field readonly" value="${orderNumber}" readonly>
      </div>

      <div class="form-group">
        <label>Customer Name</label>
        <input id="customerName" class="input-field" placeholder="John Doe">
      </div>

      <div class="form-group">
        <label>Select Product</label>
        <select id="productSelect" class="input-field">${productOptions}</select>
      </div>

      <div class="form-group">
        <label>Quantity</label>
        <input id="orderQty" type="number" min="1" class="input-field" placeholder="Enter quantity">
      </div>

      <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
        <button class="btn-primary" id="submitOrderBtn">💾 Create</button>
        <button class="btn-secondary" id="cancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById("cancelBtn").onclick = renderOrders;

  document.getElementById("submitOrderBtn").onclick = async () => {
    const order_number = document.getElementById("orderNumber").value.trim();
    const customer_name = document.getElementById("customerName").value.trim();
    const productSelect = document.getElementById("productSelect");
    const product_id = productSelect.value;
    const stock = parseInt(productSelect.selectedOptions[0].dataset.stock);
    const qty = parseInt(document.getElementById("orderQty").value);

    if (!order_number || !product_id || !qty || !customer_name) {
      alert("⚠️ Please fill all fields.");
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      alert("❌ Please enter a valid quantity greater than zero.");
      return;
    }

    if (qty > stock) {
      alert(`❌ Quantity (${qty}) cannot exceed available stock (${stock}).`);
      return;
    }

    // ✅ Send order creation request to backend
    const body = {
      order_number,
      customer_name,
      items: [{ product_id, qty }]
    };

    const res = await api("orders.php", "POST", body);

    if (res.error) {
      alert("❌ " + res.error);
    } else {
      alert("✅ Order created successfully!");
      renderOrders();
    }
  };
}


async function deleteOrder(id) {
  if (!confirm("Are you sure you want to delete this order?")) return;
  const res = await api(`orders.php?id=${id}`, "DELETE");

  if (res.ok) {
    alert("Order deleted!");
    renderOrders();
  } else {
    alert(res.error || "Failed to delete order");
  }
}

/* ========== SHIPMENTS ========== */
async function renderShipments() {
  setActive("shipments");

  let data;
  try {
    data = await api("shipments.php");
  } catch (err) {
    console.error(err);
    main.innerHTML = "<p>⚠️ Failed to load shipments.</p>";
    return;
  }

  const rows = Array.isArray(data) ? data.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.shipment_type}</td>
      <td>${s.reference ?? "-"}</td>
      <td>${s.total_items ?? 0}</td>
      <td>${s.products ?? "-"}</td>
      <td>${s.warehouse}</td>
      <td>${s.created_at}</td>
    </tr>
  `).join('') : '';

  main.innerHTML = `
    <div class="page-card">
      <div class="page-header">
        <h2>Shipments</h2>
        ${isAdmin ? `<button class="btn-primary" id="newShipmentBtn">➕ New Shipment</button>` : ""}
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Total Items</th>
            <th>Products</th>
            <th>Warehouse</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  if (isAdmin) {
    document.getElementById("newShipmentBtn").onclick = showNewShipmentForm;
  }
}


async function showNewShipmentForm() {
  try {
    // Fetch existing warehouses, products, and suppliers
    const warehouses = await api("warehouse.php");
    const products = await api("products.php");
    const suppliers = await loadSuppliers();

    const warehouseOptions = Array.isArray(warehouses)
      ? warehouses.map(w => `<option value="${w.warehouse_id}">${w.warehouse_name} (${w.location || 'No location'})</option>`).join('')
      : '';

    const productOptions = Array.isArray(products)
      ? products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.total_stock ?? 0})</option>`).join('')
      : '';

    const supplierOptions = Array.isArray(suppliers)
      ? suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : '';

    main.innerHTML = `
      <div class="page-card">
        <h2>➕ Create New Shipment</h2>

        <div class="form-group">
          <label>Shipment Type</label>
          <select id="shipmentType" class="input-field">
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>

        <div class="form-group">
          <label>Warehouse</label>
          <select id="shipmentWarehouse" class="input-field">
            <option value="">-- Select Warehouse or Add New --</option>
            ${warehouseOptions}
            <option value="__new">+ Add New Warehouse</option>
          </select>
          <input id="newWarehouseName" placeholder="Enter new warehouse name" class="input-field mt-1" style="display:none;">
          <input id="newWarehouseLocation" placeholder="Location (optional)" class="input-field mt-1" style="display:none;">
        </div>

        <div class="form-group">
          <label>Product</label>
          <select id="shipmentProduct" class="input-field">
            <option value="">-- Select Product or Add New --</option>
            ${productOptions}
            <option value="__new">+ Add New Product</option>
          </select>

          <div id="newProductFields" style="display:none; margin-top:10px;">
            <input id="newProductName" placeholder="Enter new product name" class="input-field mt-1">
            <input id="newProductSku" placeholder="SKU" class="input-field mt-1" disabled>
            <input id="newProductCost" type="number" placeholder="Cost" class="input-field mt-1">
            <input id="newProductPrice" type="number" placeholder="Price" class="input-field mt-1">
            <label>Supplier:</label>
            <select id="newProductSupplier" class="input-field mt-1">
              <option value="">Select Supplier</option>
              ${supplierOptions}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Quantity</label>
          <input id="shipmentQty" type="number" min="1" class="input-field" placeholder="Enter quantity">
        </div>

        <div class="form-group">
          <label>Reference</label>
          <input id="shipmentRef" placeholder="Optional reference" class="input-field mt-1">
        </div>

        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
          <button class="btn-primary" id="submitShipmentBtn">💾 Create</button>
          <button class="btn-secondary" id="cancelBtn">Cancel</button>
        </div>
      </div>
    `;

    // Grab DOM elements
    const warehouseSelect = document.getElementById("shipmentWarehouse");
    const newWarehouseName = document.getElementById("newWarehouseName");
    const newWarehouseLocation = document.getElementById("newWarehouseLocation");

    const productSelect = document.getElementById("shipmentProduct");
    const newProductFields = document.getElementById("newProductFields");
    const newProductName = document.getElementById("newProductName");
    const newProductSku = document.getElementById("newProductSku");
    const newProductCost = document.getElementById("newProductCost");
    const newProductPrice = document.getElementById("newProductPrice");
    const newProductSupplier = document.getElementById("newProductSupplier");

    // Auto-generate SKU for new product
    newProductSku.value = 'SKU-' + Math.floor(100000 + Math.random() * 900000);

    // Warehouse: show/hide new warehouse fields
    warehouseSelect.addEventListener("change", () => {
      const isNew = warehouseSelect.value === "__new";
      newWarehouseName.style.display = isNew ? "block" : "none";
      newWarehouseLocation.style.display = isNew ? "block" : "none";
    });

    // Product: show/hide new product fields
    productSelect.addEventListener("change", () => {
      const isNew = productSelect.value === "__new";
      newProductFields.style.display = isNew ? "block" : "none";
      if (isNew) newProductSku.value = 'SKU-' + Math.floor(100000 + Math.random() * 900000);
    });

    // Cancel button
    document.getElementById("cancelBtn").onclick = renderShipments;

    // Submit shipment
    document.getElementById("submitShipmentBtn").onclick = async () => {
      const shipment_type = document.getElementById("shipmentType").value;
      const warehouse_id = warehouseSelect.value;
      const warehouseNameVal = newWarehouseName.value.trim();
      const warehouseLocationVal = newWarehouseLocation.value.trim();

      const product_id = productSelect.value;
      const productNameVal = newProductName.value.trim();
      const productSkuVal = newProductSku.value.trim();
      const productCostVal = parseFloat(newProductCost.value) || 0;
      const productPriceVal = parseFloat(newProductPrice.value) || 0;
      const productSupplierVal = newProductSupplier.value || null;

      const qty = parseInt(document.getElementById("shipmentQty").value);
      const reference = document.getElementById("shipmentRef").value.trim();

      if (!shipment_type || (!warehouse_id && !warehouseNameVal) || (!product_id && !productNameVal) || !qty || qty <= 0) {
        return alert("⚠️ Please fill all required fields correctly.");
      }

      const body = {
        shipment_type,
        warehouse_id: warehouse_id === "__new" ? null : warehouse_id,
        warehouseName: warehouse_id === "__new" ? warehouseNameVal : null,
        warehouseLocation: warehouse_id === "__new" ? warehouseLocationVal : null,
        items: [{
          product_id: product_id === "__new" ? null : product_id,
          name: product_id === "__new" ? productNameVal : null,
          sku: product_id === "__new" ? productSkuVal : null,
          acquire_cost: product_id === "__new" ? productCostVal : null,
          price: product_id === "__new" ? productPriceVal : null,
          supplier_id: product_id === "__new" ? productSupplierVal : null,
          qty
        }],
        reference: reference || null
      };

      try {
        const res = await api("shipments.php", "POST", body);
        if (res.error) alert("❌ " + res.error);
        else {
          alert("✅ Shipment created successfully!");
          renderShipments();
        }
      } catch (err) {
        console.error(err);
        alert("❌ Failed to create shipment.");
      }
    };

  } catch (err) {
    console.error("Failed to load warehouses/products:", err);
    main.innerHTML = "<p>⚠️ Failed to load form data. Please try again.</p>";
  }
}

/* ========== AUTH ========== */
async function login() {
  const username = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await api("auth.php?task=login", "POST", { username, password });
  if (res.ok) init();
  else alert(res.error || "Invalid login");
}

async function logout() {
  await api("auth.php?task=logout", "POST");
  init();
}

function showLogin() {
  main.innerHTML = `


    <div class="login-container">
    <div class="form-group">
      <h2>Login</h2>
       <label for="username">Username</label>
      <input id="email" class="input-field" type="text" placeholder="Enter username">
      <div class="form-group">
    <label for="password">Password</label>
    <input id="password" class="input-field" type="password" placeholder="Enter password">
   </div>
  <button class="btn-login" id="doLogin">Login</button>
  <div class="login-error" id="loginError"></div>
</div>
  `;
  document.getElementById("doLogin").onclick = login;
}

/* ========== INIT ========== */
async function init() {
  const res = await api("auth.php?task=me");
  isLoggedIn = res.user ? true : false;
  isAdmin = res.user?.role === 'admin';

  const nav = document.querySelector("nav");

  if (!isLoggedIn) {
    // Hide top nav completely
    if (nav) nav.style.display = "none";

    document.getElementById("loginBtn").style.display = "inline-block";
    document.getElementById("logoutBtn").style.display = "none";

    main.innerHTML = ""; // clear previous content
    return showLogin();
  }

  // Show nav for logged in users
  if (nav) nav.style.display = "flex";

  document.querySelectorAll("nav button[data-view]").forEach(btn => btn.style.display = "inline-block");
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("logoutBtn").style.display = "inline-block";

  // Render dashboard and attach nav events
  renderDashboard();
  document.querySelector("button[data-view='products']").onclick = () => renderProducts(isLoggedIn, isAdmin);
  document.querySelector("button[data-view='orders']").onclick = renderOrders;
  document.querySelector("button[data-view='shipments']").onclick = renderShipments;
}



/* NAV EVENTS */
document.querySelector("button[data-view='dashboard']").onclick = renderDashboard;
document.querySelector("button[data-view='products']").onclick = renderProducts;
document.querySelector("button[data-view='orders']").onclick = renderOrders;
document.querySelector("button[data-view='shipments']").onclick = renderShipments;

document.getElementById("loginBtn").onclick = showLogin;
document.getElementById("logoutBtn").onclick = logout;

init();

