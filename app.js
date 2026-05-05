// Main app controller

// Navigation
let currentView = null;

function switchView(viewName) {
  if (currentView === viewName) {
    logger.debug('View already active, skipping', { viewName });
    return;
  }
  
  logger.info('Switching view', { from: currentView, to: viewName });
  currentView = viewName;

  // Hide all views
  const views = ['purchase-orders', 'suppliers'];
  views.forEach(view => {
    const viewElement = document.getElementById(`${view}-view`);
    if (viewElement) {
      viewElement.classList.add('hidden');
    }
  });

  // Show selected view
  const selectedView = document.getElementById(`${viewName}-view`);
  if (selectedView) {
    selectedView.classList.remove('hidden');
    logger.debug('View shown', { viewName });
  } else {
    logger.warn('View element not found', { viewName });
  }

  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('border-red-600', 'text-red-600', 'bg-red-50', 'font-medium');
    btn.classList.add('border-transparent', 'text-gray-600');
  });
  const activeBtn = document.querySelector(`[data-view="${viewName}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('border-transparent', 'text-gray-600');
    activeBtn.classList.add('border-red-600', 'text-red-600', 'bg-red-50', 'font-medium');
  } else {
    logger.warn('Active nav button not found', { viewName });
  }

  // Load data for the view
  if (viewName === 'purchase-orders') {
    logger.debug('Loading purchase orders view');
    if (typeof loadPurchaseOrders === 'function') {
      loadPurchaseOrders();
    }
  } else if (viewName === 'suppliers') {
    logger.debug('Loading suppliers view');
    if (typeof loadSuppliers === 'function') {
      loadSuppliers();
    }
  }
  
  logger.debug('View switched successfully', { viewName });
}

// Nav button handlers
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    logger.debug('Nav button clicked', { view });
    switchView(view);
  });
});
logger.debug('Nav button handlers attached');
