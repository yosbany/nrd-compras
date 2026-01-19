// Supplier management

let suppliersListener = null;
let suppliersSearchTerm = '';

// Helper function to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load suppliers
function loadSuppliers() {
  logger.debug('Loading suppliers');
  const suppliersList = document.getElementById('suppliers-list');
  if (!suppliersList) {
    logger.warn('Suppliers list element not found');
    return;
  }
  
  // Ensure nrd is available - wait for it if needed
  if (!window.nrd || !window.nrd.suppliers) {
    logger.warn('NRD Data Access library not ready, waiting...');
    // Wait for library with multiple retries
    let retries = 0;
    const maxRetries = 50; // 5 seconds max (50 * 100ms)
    const checkLibrary = () => {
      if (window.nrd && window.nrd.suppliers) {
        loadSuppliers();
      } else if (retries < maxRetries) {
        retries++;
        setTimeout(checkLibrary, 100);
      } else {
        logger.error('NRD Data Access library not available after timeout');
        suppliersList.innerHTML = '<p class="text-center text-red-600 py-6 sm:py-8 text-sm sm:text-base">Error: Librería de acceso a datos no disponible. Por favor recarga la página.</p>';
      }
    };
    setTimeout(checkLibrary, 100);
    return;
  }
  
  suppliersList.innerHTML = '';

  // Remove previous listener
  if (suppliersListener) {
    logger.debug('Removing previous suppliers listener');
    suppliersListener();
    suppliersListener = null;
  }

  // Listen for suppliers using NRD Data Access
  logger.debug('Setting up suppliers listener');
  suppliersListener = window.window.nrd.suppliers.onValue((suppliers) => {
    logger.debug('Suppliers data received', { count: Array.isArray(suppliers) ? suppliers.length : Object.keys(suppliers || {}).length });
    if (!suppliersList) return;
    suppliersList.innerHTML = '';
    
    // Convert to object format if needed
    const suppliersDict = Array.isArray(suppliers) 
      ? suppliers.reduce((acc, supplier) => {
          if (supplier && supplier.id) {
            acc[supplier.id] = supplier;
          }
          return acc;
        }, {})
      : suppliers || {};

    if (Object.keys(suppliersDict).length === 0) {
      suppliersList.innerHTML = '<p class="text-center text-gray-600 py-6 sm:py-8 text-sm sm:text-base">No hay proveedores registrados</p>';
      return;
    }

    // Filter by search term if active
    let suppliersToShow = Object.entries(suppliersDict);
    if (suppliersSearchTerm.trim()) {
      const searchLower = suppliersSearchTerm.toLowerCase().trim();
      suppliersToShow = suppliersToShow.filter(([id, supplier]) => {
        const name = supplier.name ? supplier.name.toLowerCase() : '';
        const phone = supplier.phone ? supplier.phone.toLowerCase() : '';
        const email = supplier.email ? supplier.email.toLowerCase() : '';
        const address = supplier.address ? supplier.address.toLowerCase() : '';
        
        return name.includes(searchLower) || 
               phone.includes(searchLower) || 
               email.includes(searchLower) ||
               address.includes(searchLower);
      });
    }
    
    if (suppliersToShow.length === 0) {
      suppliersList.innerHTML = '<p class="text-center text-gray-600 py-6 sm:py-8 text-sm sm:text-base">No hay proveedores que coincidan con la búsqueda</p>';
      return;
    }
    
    suppliersToShow.forEach(([id, supplier]) => {
      const item = document.createElement('div');
      item.className = 'border border-gray-200 p-3 sm:p-4 md:p-6 hover:border-red-600 transition-colors cursor-pointer';
      item.dataset.supplierId = id;
      item.innerHTML = `
        <div class="flex justify-between items-center mb-2 sm:mb-3">
          <div class="text-base sm:text-lg font-light">${escapeHtml(supplier.name)}</div>
        </div>
        <div class="text-xs sm:text-sm text-gray-600 space-y-0.5 sm:space-y-1">
          ${supplier.phone ? `<div>Teléfono: ${escapeHtml(supplier.phone)}</div>` : ''}
          ${supplier.email ? `<div>Email: ${escapeHtml(supplier.email)}</div>` : ''}
          ${supplier.address ? `<div>Dirección: ${escapeHtml(supplier.address)}</div>` : ''}
        </div>
      `;
      item.addEventListener('click', () => viewSupplier(id));
      suppliersList.appendChild(item);
    });
  });
}

// Show supplier form
function showSupplierForm(supplierId = null) {
  const form = document.getElementById('supplier-form');
  const list = document.getElementById('suppliers-list');
  const header = document.querySelector('#suppliers-view .flex.flex-col');
  const detail = document.getElementById('supplier-detail');
  const title = document.getElementById('supplier-form-title');
  const formElement = document.getElementById('supplier-form-element');
  
  if (form) form.classList.remove('hidden');
  if (list) list.style.display = 'none';
  if (header) header.style.display = 'none';
  if (detail) detail.classList.add('hidden');
  
  if (formElement) {
    formElement.reset();
    const supplierIdInput = document.getElementById('supplier-id');
    if (supplierIdInput) supplierIdInput.value = supplierId || '';
  }

  const formHeader = document.getElementById('supplier-form-header');
  const subtitle = document.getElementById('supplier-form-subtitle');
  const saveBtn = document.getElementById('save-supplier-btn');
  
  if (supplierId) {
    if (title) title.textContent = 'Editar Proveedor';
    if (subtitle) subtitle.textContent = 'Modifique la información del proveedor';
    if (formHeader) {
      formHeader.classList.remove('bg-green-600', 'bg-gray-600');
      formHeader.classList.add('bg-blue-600');
    }
    if (saveBtn) {
      saveBtn.classList.remove('bg-green-600', 'border-green-600', 'hover:bg-green-700');
      saveBtn.classList.add('bg-blue-600', 'border-blue-600', 'hover:bg-blue-700');
    }
    (async () => {
      const supplier = await window.nrd.suppliers.getById(supplierId);
      if (supplier) {
        const nameInput = document.getElementById('supplier-name');
        const phoneInput = document.getElementById('supplier-phone');
        const emailInput = document.getElementById('supplier-email');
        const addressInput = document.getElementById('supplier-address');
        const descriptionInput = document.getElementById('supplier-description');
        if (nameInput) nameInput.value = supplier.name || '';
        if (phoneInput) phoneInput.value = supplier.phone || '';
        if (emailInput) emailInput.value = supplier.email || '';
        if (addressInput) addressInput.value = supplier.address || '';
        if (descriptionInput) descriptionInput.value = supplier.description || '';
      }
    })();
  } else {
    if (title) title.textContent = 'Nuevo Proveedor';
    if (subtitle) subtitle.textContent = 'Registre la información del nuevo proveedor';
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

// Hide supplier form
function hideSupplierForm() {
  const form = document.getElementById('supplier-form');
  const list = document.getElementById('suppliers-list');
  const header = document.querySelector('#suppliers-view .flex.flex-col');
  
  if (form) form.classList.add('hidden');
  if (list) list.style.display = 'block';
  if (header) header.style.display = 'flex';
}

// Save supplier
async function saveSupplier(supplierId, supplierData) {
  const user = getCurrentUser();
  if (supplierId) {
    logger.info('Updating supplier', { supplierId, name: supplierData.name });
    await window.nrd.suppliers.update(supplierId, supplierData);
    logger.audit('ENTITY_UPDATE', { entity: 'supplier', id: supplierId, data: supplierData, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Supplier updated successfully', { supplierId });
    return { key: supplierId };
  } else {
    logger.info('Creating new supplier', { name: supplierData.name });
    const id = await window.nrd.suppliers.create(supplierData);
    logger.audit('ENTITY_CREATE', { entity: 'supplier', id, data: supplierData, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Supplier created successfully', { id, name: supplierData.name });
    return { key: id, getKey: () => id };
  }
}

// View supplier detail
async function viewSupplier(supplierId) {
  logger.debug('Viewing supplier', { supplierId });
  showSpinner('Cargando proveedor...');
  try {
    const supplier = await window.nrd.suppliers.getById(supplierId);
    hideSpinner();
    if (!supplier) {
      logger.warn('Supplier not found', { supplierId });
      await showError('Proveedor no encontrado');
      return;
    }
    logger.debug('Supplier loaded successfully', { supplierId, name: supplier.name });

    const list = document.getElementById('suppliers-list');
    const header = document.querySelector('#suppliers-view .flex.flex-col');
    const form = document.getElementById('supplier-form');
    const detail = document.getElementById('supplier-detail');
    
    if (list) list.style.display = 'none';
    if (header) header.style.display = 'none';
    if (form) form.classList.add('hidden');
    if (detail) detail.classList.remove('hidden');

    document.getElementById('supplier-detail-content').innerHTML = `
      <div class="space-y-3 sm:space-y-4">
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Nombre:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(supplier.name)}</span>
        </div>
        ${supplier.phone ? `
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Teléfono:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(supplier.phone)}</span>
        </div>
        ` : ''}
        ${supplier.email ? `
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Email:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(supplier.email)}</span>
        </div>
        ` : ''}
        ${supplier.address ? `
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Dirección:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(supplier.address)}</span>
        </div>
        ` : ''}
        ${supplier.description ? `
        <div class="flex justify-between py-2 sm:py-3 border-b border-gray-200">
          <span class="text-gray-600 font-light text-sm sm:text-base">Descripción:</span>
          <span class="font-light text-sm sm:text-base">${escapeHtml(supplier.description)}</span>
        </div>
        ` : ''}
      </div>
    `;

    // Attach button handlers
    const editBtn = document.getElementById('edit-supplier-detail-btn');
    const deleteBtn = document.getElementById('delete-supplier-detail-btn');
    
    if (editBtn) {
      editBtn.onclick = () => {
        detail.classList.add('hidden');
        showSupplierForm(supplierId);
      };
    }
    
    if (deleteBtn) {
      deleteBtn.onclick = () => deleteSupplierHandler(supplierId);
    }
  } catch (error) {
    hideSpinner();
    await showError('Error al cargar proveedor: ' + error.message);
  }
}

// Back to suppliers list
function backToSuppliers() {
  const list = document.getElementById('suppliers-list');
  const header = document.querySelector('#suppliers-view .flex.flex-col');
  const detail = document.getElementById('supplier-detail');
  
  if (list) list.style.display = 'block';
  if (header) header.style.display = 'flex';
  if (detail) detail.classList.add('hidden');
}

// Delete supplier handler
async function deleteSupplierHandler(supplierId) {
  logger.debug('Delete supplier requested', { supplierId });
  const confirmed = await showConfirm('Eliminar Proveedor', '¿Está seguro de eliminar este proveedor?');
  if (!confirmed) {
    logger.debug('Supplier deletion cancelled', { supplierId });
    return;
  }

  const user = getCurrentUser();
  logger.info('Deleting supplier', { supplierId });
  showSpinner('Eliminando proveedor...');
  try {
    await window.nrd.suppliers.delete(supplierId);
    logger.audit('ENTITY_DELETE', { entity: 'supplier', id: supplierId, uid: user?.uid, email: user?.email, timestamp: Date.now() });
    logger.info('Supplier deleted successfully', { supplierId });
    hideSpinner();
    backToSuppliers();
  } catch (error) {
    hideSpinner();
    logger.error('Failed to delete supplier', error);
    await showError('Error al eliminar proveedor: ' + error.message);
  }
}

// Supplier form submit handler
const supplierFormElement = document.getElementById('supplier-form-element');
if (supplierFormElement) {
  supplierFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const supplierId = document.getElementById('supplier-id').value;
    const name = document.getElementById('supplier-name').value.trim();
    const phone = document.getElementById('supplier-phone').value.trim();
    const email = document.getElementById('supplier-email').value.trim();
    const address = document.getElementById('supplier-address').value.trim();
    const description = document.getElementById('supplier-description').value.trim();

    if (!name) {
      await showError('El nombre es requerido');
      return;
    }

    showSpinner('Guardando proveedor...');
    try {
      const supplierData = { name };
      if (phone) supplierData.phone = phone;
      if (email) supplierData.email = email;
      if (address) supplierData.address = address;
      if (description) supplierData.description = description;
      
      await saveSupplier(supplierId || null, supplierData);
      hideSpinner();
      hideSupplierForm();
    } catch (error) {
      hideSpinner();
      await showError('Error al guardar proveedor: ' + error.message);
    }
  });
}

// Setup event listeners
function setupSupplierEventListeners() {
  // Search input
  const searchInput = document.getElementById('suppliers-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      suppliersSearchTerm = e.target.value;
      loadSuppliers();
    });
  }

  // New supplier button
  const newBtn = document.getElementById('new-supplier-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      showSupplierForm();
    });
  }

  // Cancel button
  const cancelBtn = document.getElementById('cancel-supplier-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      hideSupplierForm();
    });
  }

  // Close form button
  const closeBtn = document.getElementById('close-supplier-form');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideSupplierForm();
    });
  }

  // Back button
  const backBtn = document.getElementById('back-to-suppliers');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      backToSuppliers();
    });
  }

  // Close detail button
  const closeDetailBtn = document.getElementById('close-supplier-detail-btn');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => {
      backToSuppliers();
    });
  }
}

// Initialize suppliers module
function initializeSuppliers() {
  logger.debug('Initializing suppliers module');
  setupSupplierEventListeners();
  // Don't load suppliers here - they will be loaded when the view is switched to suppliers
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSuppliers);
} else {
  initializeSuppliers();
}
