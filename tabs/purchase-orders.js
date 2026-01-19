// Purchase Order management

let purchaseOrdersListener = null;
let purchaseOrdersSearchTerm = '';
let purchaseOrderItems = []; // Array of { productId, productName, quantity, price }
let productSearchTimeout = null;
let isEditingPurchaseOrder = false;

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load purchase orders
function loadPurchaseOrders() {
  logger.debug('Loading purchase orders');
  const ordersList = document.getElementById('purchase-orders-list');
  if (!ordersList) {
    logger.warn('Purchase orders list element not found');
    return;
  }
  
  ordersList.innerHTML = '';

  // Remove previous listener
  if (purchaseOrdersListener) {
    logger.debug('Removing previous purchase orders listener');
    purchaseOrdersListener();
    purchaseOrdersListener = null;
  }

  // Ensure nrd is available - wait for it if needed
  if (!window.nrd || !window.nrd.purchaseOrders) {
    logger.warn('NRD Data Access library not ready, waiting...');
    // Wait for library with multiple retries
    let retries = 0;
    const maxRetries = 50; // 5 seconds max (50 * 100ms)
    const checkLibrary = () => {
      if (window.nrd && window.nrd.purchaseOrders) {
        loadPurchaseOrders();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(checkLibrary, 100);
      } else {
        logger.error('NRD Data Access library not available after timeout');
        ordersList.innerHTML = '<p class="text-center text-red-600 py-6 sm:py-8 text-sm sm:text-base">Error: Librería de acceso a datos no disponible. Por favor recarga la página.</p>';
      }
    };
    setTimeout(checkLibrary, 100);
    return;
  }

  // Listen for purchase orders using NRD Data Access
  logger.debug('Setting up purchase orders listener');
  purchaseOrdersListener = window.nrd.purchaseOrders.onValue((orders) => {
    logger.debug('Purchase orders data received', { count: Array.isArray(orders) ? orders.length : Object.keys(orders || {}).length });
    if (!ordersList) return;
    ordersList.innerHTML = '';
    
    // Convert to object format if needed
    const ordersDict = Array.isArray(orders) 
      ? orders.reduce((acc, order) => {
          if (order && order.id) {
            acc[order.id] = order;
          }
          return acc;
        }, {})
      : orders || {};

    if (Object.keys(ordersDict).length === 0) {
      ordersList.innerHTML = '<p class="text-center text-gray-600 py-6 sm:py-8 text-sm sm:text-base">No hay órdenes de compra registradas</p>';
      return;
    }

    // Filter by search term if active
    let ordersToShow = Object.entries(ordersDict);
    if (purchaseOrdersSearchTerm.trim()) {
      const searchLower = purchaseOrdersSearchTerm.toLowerCase().trim();
      ordersToShow = ordersToShow.filter(([id, order]) => {
        const supplierName = order.supplierName ? order.supplierName.toLowerCase() : '';
        const status = order.status ? order.status.toLowerCase() : '';
        const orderNumber = order.orderNumber ? order.orderNumber.toLowerCase() : '';
        
        return supplierName.includes(searchLower) || 
               status.includes(searchLower) ||
               orderNumber.includes(searchLower);
      });
    }
    
    // Sort by date (newest first)
    ordersToShow.sort(([idA, orderA], [idB, orderB]) => {
      const dateA = orderA.createdAt || 0;
      const dateB = orderB.createdAt || 0;
      return dateB - dateA;
    });
    
    if (ordersToShow.length === 0) {
      ordersList.innerHTML = '<p class="text-center text-gray-600 py-6 sm:py-8 text-sm sm:text-base">No hay órdenes de compra que coincidan con la búsqueda</p>';
      return;
    }
    
    ordersToShow.forEach(([id, order]) => {
      const item = document.createElement('div');
      item.className = 'border border-gray-200 p-3 sm:p-4 md:p-6 hover:border-red-600 transition-colors cursor-pointer';
      item.dataset.orderId = id;
      
      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES') : 'N/A';
      const status = order.status || 'Pendiente';
      const statusColor = status === 'Completada' ? 'text-green-600' : status === 'Cancelada' ? 'text-red-600' : 'text-orange-600';
      
      item.innerHTML = `
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-2 sm:mb-3">
          <div class="text-base sm:text-lg font-light">
            ${order.orderNumber ? `Orden #${escapeHtml(order.orderNumber)}` : `Orden ${id.substring(0, 8)}`}
          </div>
          <span class="px-2 sm:px-3 py-0.5 sm:py-1 text-xs uppercase tracking-wider border ${statusColor} border-current">
            ${escapeHtml(status)}
          </span>
        </div>
        <div class="text-xs sm:text-sm text-gray-600 space-y-0.5 sm:space-y-1">
          ${order.supplierName ? `<div>Proveedor: ${escapeHtml(order.supplierName)}</div>` : ''}
          <div>Fecha: ${date}</div>
          <div class="text-red-600 font-medium">Total: $${parseFloat(order.total || 0).toFixed(2)}</div>
        </div>
      `;
      item.addEventListener('click', () => viewPurchaseOrder(id));
      ordersList.appendChild(item);
    });
  });
}

// Show purchase order form
function showPurchaseOrderForm(orderId = null) {
  const form = document.getElementById('purchase-order-form');
  const list = document.getElementById('purchase-orders-list');
  const header = document.querySelector('#purchase-orders-view .flex.flex-col');
  const detail = document.getElementById('purchase-order-detail');
  const title = document.getElementById('purchase-order-form-title');
  const formElement = document.getElementById('purchase-order-form-element');
  
  if (form) form.classList.remove('hidden');
  if (list) list.style.display = 'none';
  if (header) header.style.display = 'none';
  if (detail) detail.classList.add('hidden');
  
  if (formElement) {
    formElement.reset();
    const orderIdInput = document.getElementById('purchase-order-id');
    if (orderIdInput) orderIdInput.value = orderId || '';
    
    // Reset items
    purchaseOrderItems = [];
    isEditingPurchaseOrder = !!orderId;
    renderPurchaseOrderItems();
    updatePurchaseOrderTotal();
  }

  const formHeader = document.getElementById('purchase-order-form-header');
  const subtitle = document.getElementById('purchase-order-form-subtitle');
  const saveBtn = document.getElementById('save-purchase-order-btn');
  
  if (orderId) {
    isEditingPurchaseOrder = true;
    if (title) title.textContent = 'Editar Orden de Compra';
    if (subtitle) subtitle.textContent = 'Modifique la información de la orden de compra';
    if (formHeader) {
      formHeader.classList.remove('bg-green-600', 'bg-gray-600');
      formHeader.classList.add('bg-blue-600');
    }
    if (saveBtn) {
      saveBtn.classList.remove('bg-green-600', 'border-green-600', 'hover:bg-green-700');
      saveBtn.classList.add('bg-blue-600', 'border-blue-600', 'hover:bg-blue-700');
    }
    // Load order data
    (async () => {
      const order = await window.nrd.purchaseOrders.getById(orderId);
      if (order) {
        const numberInput = document.getElementById('purchase-order-number');
        const supplierInput = document.getElementById('purchase-order-supplier');
        const supplierSearchInput = document.getElementById('purchase-order-supplier-search');
        const statusInput = document.getElementById('purchase-order-status');
        
        if (numberInput) numberInput.value = order.orderNumber || '';
        if (supplierInput) supplierInput.value = order.supplierId || '';
        if (supplierSearchInput) supplierSearchInput.value = order.supplierName || '';
        if (statusInput) statusInput.value = order.status || 'Pendiente';
        
        // Load items
        purchaseOrderItems = order.items || [];
        renderPurchaseOrderItems();
        updatePurchaseOrderTotal();
      }
    })();
  } else {
    if (title) title.textContent = 'Nueva Orden de Compra';
    if (subtitle) subtitle.textContent = 'Cree una nueva orden de compra';
    if (formHeader) {
      formHeader.classList.remove('bg-blue-600', 'bg-gray-600');
      formHeader.classList.add('bg-green-600');
    }
    if (saveBtn) {
      saveBtn.classList.remove('bg-blue-600', 'border-blue-600', 'hover:bg-blue-700');
      saveBtn.classList.add('bg-green-600', 'border-green-600', 'hover:bg-green-700');
    }
  }
}

// Hide purchase order form
function hidePurchaseOrderForm() {
  const form = document.getElementById('purchase-order-form');
  const list = document.getElementById('purchase-orders-list');
  const header = document.querySelector('#purchase-orders-view .flex.flex-col');
  
  if (form) form.classList.add('hidden');
  if (list) list.style.display = 'block';
  if (header) header.style.display = 'flex';
}

// View purchase order detail
async function viewPurchaseOrder(orderId) {
  logger.debug('Viewing purchase order', { orderId });
  showSpinner('Cargando orden de compra...');
  try {
    const order = await window.nrd.purchaseOrders.getById(orderId);
    hideSpinner();
    if (!order) {
      logger.warn('Purchase order not found', { orderId });
      await showError('Orden de compra no encontrada');
      return;
    }
    logger.debug('Purchase order loaded successfully', { orderId });

    const list = document.getElementById('purchase-orders-list');
    const header = document.querySelector('#purchase-orders-view .flex.flex-col');
    const form = document.getElementById('purchase-order-form');
    const detail = document.getElementById('purchase-order-detail');
    
    if (list) list.style.display = 'none';
    if (header) header.style.display = 'none';
    if (form) form.classList.add('hidden');
    if (detail) detail.classList.remove('hidden');

    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES') : 'N/A';
    const status = order.status || 'Pendiente';
    const statusColor = status === 'Completada' ? 'text-green-600' : status === 'Cancelada' ? 'text-red-600' : 'text-orange-600';
    
    let itemsHtml = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      itemsHtml = order.items.map(item => `
        <div class="flex justify-between py-2 border-b border-gray-200">
          <span class="text-sm">${escapeHtml(item.productName || 'Producto')} x ${item.quantity || 0}</span>
          <span class="text-sm font-medium">$${parseFloat(item.price || 0).toFixed(2)}</span>
        </div>
      `).join('');
    } else {
      itemsHtml = '<p class="text-sm text-gray-500 py-2">No hay items en esta orden</p>';
    }

    document.getElementById('purchase-order-detail-content').innerHTML = `
      <div class="space-y-3 sm:space-y-4">
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Número de Orden:</span>
          <span class="font-light text-sm sm:text-base">${order.orderNumber ? escapeHtml(order.orderNumber) : orderId.substring(0, 8)}</span>
        </div>
        ${order.supplierName ? `
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Proveedor:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(order.supplierName)}</span>
        </div>
        ` : ''}
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Fecha:</span>
          <span class="font-light text-sm sm:text-base">${date}</span>
        </div>
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Estado:</span>
          <span class="px-2 sm:px-3 py-0.5 sm:py-1 text-xs uppercase tracking-wider border ${statusColor} border-current">
            ${escapeHtml(status)}
          </span>
        </div>
        <div class="py-2 sm:py-3 border-b border-gray-200">
          <div class="text-gray-600 font-light text-sm sm:text-base mb-2">Items:</div>
          ${itemsHtml}
        </div>
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base font-medium">Total:</span>
          <span class="font-light text-sm sm:text-base text-red-600 font-medium">$${parseFloat(order.total || 0).toFixed(2)}</span>
        </div>
      </div>
    `;

    // Attach button handlers
    const editBtn = document.getElementById('edit-purchase-order-detail-btn');
    const deleteBtn = document.getElementById('delete-purchase-order-detail-btn');
    
    if (editBtn) {
      editBtn.onclick = () => {
        detail.classList.add('hidden');
        showPurchaseOrderForm(orderId);
      };
    }
    
    if (deleteBtn) {
      deleteBtn.onclick = () => deletePurchaseOrderHandler(orderId);
    }
  } catch (error) {
    hideSpinner();
    await showError('Error al cargar orden de compra: ' + error.message);
  }
}

// Save purchase order
async function savePurchaseOrder(orderId, orderData) {
  const user = getCurrentUser();
  
  if (orderId) {
    logger.info('Updating purchase order', { orderId });
    await window.nrd.purchaseOrders.update(orderId, orderData);
    logger.audit('ENTITY_UPDATE', { entity: 'purchaseOrder', id: orderId, data: orderData, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Purchase order updated successfully', { orderId });
    return { key: orderId };
  } else {
    logger.info('Creating new purchase order', { supplierId: orderData.supplierId });
    orderData.createdAt = Date.now();
    const id = await window.nrd.purchaseOrders.create(orderData);
    logger.audit('ENTITY_CREATE', { entity: 'purchaseOrder', id, data: orderData, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Purchase order created successfully', { id });
    return { key: id, getKey: () => id };
  }
}

// Purchase order form submit handler
const purchaseOrderFormElement = document.getElementById('purchase-order-form-element');
if (purchaseOrderFormElement) {
  purchaseOrderFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const orderId = document.getElementById('purchase-order-id').value;
    const orderNumber = document.getElementById('purchase-order-number').value.trim();
    const supplierId = document.getElementById('purchase-order-supplier').value;
    const status = document.getElementById('purchase-order-status').value;

    if (!supplierId) {
      await showError('El proveedor es requerido');
      return;
    }

    // Get supplier name
    let supplierName = '';
    if (supplierId) {
      try {
        const supplier = await window.nrd.suppliers.getById(supplierId);
        supplierName = supplier ? supplier.name : '';
      } catch (error) {
        logger.error('Error loading supplier', error);
      }
    }

    showSpinner('Guardando orden de compra...');
    try {
      // Calculate total (only if editing, otherwise 0)
      const total = isEditingPurchaseOrder 
        ? purchaseOrderItems.reduce((sum, item) => {
            return sum + (parseFloat(item.price || 0) * parseFloat(item.quantity || 0));
          }, 0)
        : 0;
      
      const orderData = {
        supplierId,
        supplierName,
        status: status || 'Pendiente',
        total: total,
        items: purchaseOrderItems
      };
      if (orderNumber) orderData.orderNumber = orderNumber;
      
      await savePurchaseOrder(orderId || null, orderData);
      hideSpinner();
      hidePurchaseOrderForm();
    } catch (error) {
      hideSpinner();
      await showError('Error al guardar orden de compra: ' + error.message);
    }
  });
}

// Back to purchase orders list
function backToPurchaseOrders() {
  const list = document.getElementById('purchase-orders-list');
  const header = document.querySelector('#purchase-orders-view .flex.flex-col');
  const detail = document.getElementById('purchase-order-detail');
  
  if (list) list.style.display = 'block';
  if (header) header.style.display = 'flex';
  if (detail) detail.classList.add('hidden');
}

// Delete purchase order handler
async function deletePurchaseOrderHandler(orderId) {
  logger.debug('Delete purchase order requested', { orderId });
  const confirmed = await showConfirm('Eliminar Orden de Compra', '¿Está seguro de eliminar esta orden de compra?');
  if (!confirmed) {
    logger.debug('Purchase order deletion cancelled', { orderId });
    return;
  }

  const user = getCurrentUser();
  logger.info('Deleting purchase order', { orderId });
  showSpinner('Eliminando orden de compra...');
  try {
    await window.nrd.purchaseOrders.delete(orderId);
    logger.audit('ENTITY_DELETE', { entity: 'purchaseOrder', id: orderId, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Purchase order deleted successfully', { orderId });
    hideSpinner();
    backToPurchaseOrders();
  } catch (error) {
    hideSpinner();
    logger.error('Failed to delete purchase order', error);
    await showError('Error al eliminar orden de compra: ' + error.message);
  }
}

// Setup supplier search in purchase order form
function setupSupplierSearch() {
  const supplierSearchInput = document.getElementById('purchase-order-supplier-search');
  const supplierHiddenInput = document.getElementById('purchase-order-supplier');
  const supplierResults = document.getElementById('purchase-order-supplier-search-results');
  
  if (!supplierSearchInput || !supplierHiddenInput || !supplierResults) return;
  
  let searchTimeout = null;
  
  supplierSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (searchTerm.length < 2) {
      supplierResults.classList.add('hidden');
      supplierHiddenInput.value = '';
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        const suppliersArray = await window.nrd.suppliers.getAll();
        const suppliers = Array.isArray(suppliersArray) 
          ? suppliersArray.reduce((acc, supplier) => {
              if (supplier && supplier.id) {
                acc[supplier.id] = supplier;
              }
              return acc;
            }, {})
          : suppliersArray || {};
        
        const matches = Object.entries(suppliers)
          .filter(([id, supplier]) => {
            const name = (supplier.name || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
          })
          .slice(0, 10);
        
        if (matches.length === 0) {
          supplierResults.innerHTML = '<div class="p-4 text-base text-gray-500 text-center">No se encontraron proveedores</div>';
          supplierResults.classList.remove('hidden');
          return;
        }
        
        supplierResults.innerHTML = matches.map(([id, supplier]) => `
          <div class="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-200 touch-target" 
            data-supplier-id="${id}" 
            data-supplier-name="${escapeHtml(supplier.name)}">
            <div class="font-medium text-base mb-1">${escapeHtml(supplier.name)}</div>
            ${supplier.phone ? `<div class="text-sm text-gray-500">${escapeHtml(supplier.phone)}</div>` : ''}
          </div>
        `).join('');
        
        supplierResults.classList.remove('hidden');
        
        // Add click handlers
        supplierResults.querySelectorAll('[data-supplier-id]').forEach(item => {
          item.addEventListener('click', () => {
            const supplierId = item.dataset.supplierId;
            const supplierName = item.dataset.supplierName;
            supplierHiddenInput.value = supplierId;
            supplierSearchInput.value = supplierName;
            supplierResults.classList.add('hidden');
          });
        });
      } catch (error) {
        logger.error('Error searching suppliers', error);
      }
    }, 300);
  });
  
  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!supplierSearchInput.contains(e.target) && !supplierResults.contains(e.target)) {
      supplierResults.classList.add('hidden');
    }
  });
}

// Render purchase order items
function renderPurchaseOrderItems() {
  const itemsList = document.getElementById('purchase-order-items-list');
  if (!itemsList) return;
  
  if (purchaseOrderItems.length === 0) {
    itemsList.innerHTML = '<p class="text-base text-gray-500 text-center py-8">No hay productos agregados</p>';
    return;
  }
  
  // When creating a new order, only show quantity. When editing, show price and subtotal too.
  const showPrices = isEditingPurchaseOrder;
  
  itemsList.innerHTML = purchaseOrderItems.map((item, index) => `
    <div class="border border-gray-200 p-4 rounded-lg bg-white" data-item-index="${index}">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-base">${escapeHtml(item.productName || 'Producto')}</div>
        </div>
        <button type="button" class="remove-item-btn flex-shrink-0 w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 active:bg-red-100 border border-red-300 rounded-full text-lg font-light transition-colors" data-item-index="${index}" aria-label="Eliminar">
          ×
        </button>
      </div>
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <label class="text-sm text-gray-600 whitespace-nowrap min-w-[80px]">Cantidad:</label>
          <input type="number" min="1" step="1" value="${item.quantity || 1}" 
            class="item-quantity flex-1 px-4 py-3 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white" 
            data-item-index="${index}"
            placeholder="Cantidad">
        </div>
        ${showPrices ? `
        <div class="flex items-center gap-3">
          <label class="text-sm text-gray-600 whitespace-nowrap min-w-[80px]">Precio:</label>
          <input type="number" min="0" step="0.01" value="${parseFloat(item.price || 0).toFixed(2)}" 
            class="item-price flex-1 px-4 py-3 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white" 
            data-item-index="${index}"
            placeholder="0.00">
        </div>
        <div class="flex justify-between items-center pt-2 border-t border-gray-100">
          <span class="text-sm text-gray-600">Subtotal:</span>
          <span class="text-base font-semibold text-gray-900">
            $${(parseFloat(item.price || 0) * parseFloat(item.quantity || 1)).toFixed(2)}
          </span>
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  // Attach event listeners to quantity and price inputs
  itemsList.querySelectorAll('.item-quantity').forEach(input => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.itemIndex);
      updateItemQuantity(index, e.target.value);
    });
  });
  
  if (showPrices) {
    itemsList.querySelectorAll('.item-price').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.itemIndex);
        updateItemPrice(index, e.target.value);
      });
    });
  }
  
  // Attach event listeners to remove buttons
  itemsList.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.itemIndex);
      removeItemFromOrder(index);
    });
  });
}

// Update purchase order total
function updatePurchaseOrderTotal() {
  const totalElement = document.getElementById('purchase-order-total');
  const totalContainer = document.getElementById('purchase-order-total-container');
  if (!totalElement || !totalContainer) return;
  
  // Only show total when editing (when prices are available)
  if (!isEditingPurchaseOrder) {
    totalContainer.classList.add('hidden');
    return;
  }
  
  totalContainer.classList.remove('hidden');
  const total = purchaseOrderItems.reduce((sum, item) => {
    return sum + (parseFloat(item.price || 0) * parseFloat(item.quantity || 1));
  }, 0);
  
  totalElement.textContent = `$${total.toFixed(2)}`;
}

// Add product to order
function addProductToOrder(product) {
  if (!product || !product.id) return;
  
  // Check if product already exists
  const existingIndex = purchaseOrderItems.findIndex(item => item.productId === product.id);
  if (existingIndex >= 0) {
    // Increment quantity if already exists
    purchaseOrderItems[existingIndex].quantity = (parseFloat(purchaseOrderItems[existingIndex].quantity || 1) + 1);
  } else {
    // Add new item - only include price when editing
    const newItem = {
      productId: product.id,
      productName: product.name || 'Producto',
      quantity: 1
    };
    
    // Only add price if editing an existing order
    if (isEditingPurchaseOrder) {
      newItem.price = parseFloat(product.price || 0);
    }
    
    purchaseOrderItems.push(newItem);
  }
  
  renderPurchaseOrderItems();
  updatePurchaseOrderTotal();
  
  // Hide search
  const searchContainer = document.getElementById('product-search-container');
  const searchInput = document.getElementById('purchase-order-product-search');
  if (searchContainer) searchContainer.classList.add('hidden');
  if (searchInput) searchInput.value = '';
}

// Remove item from order
function removeItemFromOrder(index) {
  if (index >= 0 && index < purchaseOrderItems.length) {
    purchaseOrderItems.splice(index, 1);
    renderPurchaseOrderItems();
    updatePurchaseOrderTotal();
  }
}

// Update item quantity
function updateItemQuantity(index, quantity) {
  if (index >= 0 && index < purchaseOrderItems.length) {
    const qty = parseFloat(quantity) || 1;
    if (qty > 0) {
      purchaseOrderItems[index].quantity = qty;
      renderPurchaseOrderItems();
      updatePurchaseOrderTotal();
    }
  }
}

// Update item price
function updateItemPrice(index, price) {
  if (index >= 0 && index < purchaseOrderItems.length) {
    const prc = parseFloat(price) || 0;
    if (prc >= 0) {
      purchaseOrderItems[index].price = prc;
      renderPurchaseOrderItems();
      updatePurchaseOrderTotal();
    }
  }
}

// Setup product search
function setupProductSearch() {
  const addProductBtn = document.getElementById('add-product-btn');
  const loadAllProductsBtn = document.getElementById('load-all-products-btn');
  const searchContainer = document.getElementById('product-search-container');
  const searchInput = document.getElementById('purchase-order-product-search');
  const searchResults = document.getElementById('purchase-order-product-search-results');
  
  if (!addProductBtn || !searchContainer || !searchInput || !searchResults) return;
  
  // Show search when add button is clicked
  addProductBtn.addEventListener('click', () => {
    searchContainer.classList.remove('hidden');
    searchInput.focus();
  });
  
  // Search products
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    
    clearTimeout(productSearchTimeout);
    
    if (searchTerm.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    
    productSearchTimeout = setTimeout(async () => {
      try {
        const products = await window.nrd.products.getAll();
        const productsArray = Array.isArray(products) 
          ? products 
          : Object.entries(products || {}).map(([id, product]) => ({ ...product, id }));
        
        // Filter active products
        const activeProducts = productsArray.filter(p => p.active !== false);
        
        const matches = activeProducts
          .filter(product => {
            const name = (product.name || '').toLowerCase();
            const sku = (product.sku || '').toLowerCase();
            const searchLower = searchTerm.toLowerCase();
            return name.includes(searchLower) || sku.includes(searchLower);
          })
          .slice(0, 10);
        
        if (matches.length === 0) {
          searchResults.innerHTML = '<div class="p-4 text-base text-gray-500 text-center">No se encontraron productos</div>';
          searchResults.classList.remove('hidden');
          return;
        }
        
        searchResults.innerHTML = matches.map(product => `
          <div class="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-200 product-result touch-target" 
            data-product-id="${escapeHtml(product.id)}"
            data-product-name="${escapeHtml(product.name || 'Producto')}"
            data-product-price="${product.price || 0}">
            <div class="font-medium text-base mb-1">${escapeHtml(product.name || 'Producto')}</div>
            ${product.sku ? `<div class="text-xs text-gray-500 mb-1">SKU: ${escapeHtml(product.sku)}</div>` : ''}
            <div class="text-sm text-gray-600">Precio: $${parseFloat(product.price || 0).toFixed(2)}</div>
          </div>
        `).join('');
        
        // Attach click handlers
        searchResults.querySelectorAll('.product-result').forEach(item => {
          item.addEventListener('click', () => {
            const product = {
              id: item.dataset.productId,
              name: item.dataset.productName,
              price: parseFloat(item.dataset.productPrice || 0)
            };
            addProductToOrder(product);
            searchResults.classList.add('hidden');
            searchInput.value = '';
          });
        });
        
        searchResults.classList.remove('hidden');
      } catch (error) {
        logger.error('Error searching products', error);
      }
    }, 300);
  });
  
  // Load all products
  if (loadAllProductsBtn) {
    loadAllProductsBtn.addEventListener('click', async () => {
      const supplierId = document.getElementById('purchase-order-supplier').value;
      
      if (!supplierId) {
        await showError('Primero debe seleccionar un proveedor');
        return;
      }
      
      showSpinner('Cargando productos...');
      try {
        const products = await window.nrd.products.getAll();
        const productsArray = Array.isArray(products) 
          ? products 
          : Object.entries(products || {}).map(([id, product]) => ({ ...product, id }));
        
        // Filter active products
        const activeProducts = productsArray.filter(p => p.active !== false);
        
        // Add all products - only include price when editing
        activeProducts.forEach(product => {
          const existingIndex = purchaseOrderItems.findIndex(item => item.productId === product.id);
          if (existingIndex < 0) {
            const newItem = {
              productId: product.id,
              productName: product.name || 'Producto',
              quantity: 1
            };
            
            // Only add price if editing an existing order
            if (isEditingPurchaseOrder) {
              newItem.price = parseFloat(product.price || 0);
            }
            
            purchaseOrderItems.push(newItem);
          }
        });
        
        renderPurchaseOrderItems();
        updatePurchaseOrderTotal();
        hideSpinner();
        
        if (activeProducts.length > 0) {
          await showSuccess(`${activeProducts.length} productos agregados`);
        } else {
          await showInfo('No hay productos activos disponibles');
        }
      } catch (error) {
        hideSpinner();
        logger.error('Error loading products', error);
        await showError('Error al cargar productos: ' + error.message);
      }
    });
  }
  
  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !addProductBtn.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });
}

// Setup event listeners
function setupPurchaseOrderEventListeners() {
  // Setup supplier search
  setupSupplierSearch();
  
  // Setup product search and items management
  setupProductSearch();
  
  // Search input
  const searchInput = document.getElementById('purchase-orders-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      purchaseOrdersSearchTerm = e.target.value;
      loadPurchaseOrders();
    });
  }

  // New order button
  const newBtn = document.getElementById('new-purchase-order-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      showPurchaseOrderForm();
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancel-purchase-order-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      hidePurchaseOrderForm();
    });
  }

  // Close form button
  const closeBtn = document.getElementById('close-purchase-order-form');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hidePurchaseOrderForm();
    });
  }

  // Back button
  const backBtn = document.getElementById('back-to-purchase-orders');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      backToPurchaseOrders();
    });
  }

  // Close detail button
  const closeDetailBtn = document.getElementById('close-purchase-order-detail-btn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      backToPurchaseOrders();
    });
  }
}

// Initialize purchase orders module
function initializePurchaseOrders() {
  logger.debug('Initializing purchase orders module');
  setupPurchaseOrderEventListeners();
  loadPurchaseOrders();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePurchaseOrders);
} else {
  initializePurchaseOrders();
}
