document.addEventListener('DOMContentLoaded', () => {
    // Global variables
    let eventSource;
    let allProducts = [];
    let allOrders = [];
    const searchInput = document.getElementById('orderSearchInput');
    let openOrderCardIds = new Set();
    let openHistoryCardIds = new Set();
    let outOfDeliveryBatchKeys = new Set(); // <<< ADD THIS LINE

    // --- DOM Element Selections ---
    const loginBox = document.getElementById('loginBox');
    const staffPanel = document.getElementById('staffPanel');
    const staffLoginForm = document.getElementById('staffLoginForm');
    const loginMsg = document.getElementById('loginMsg');
    const logoutBtn = document.getElementById('logoutBtn');

    // Navigation Elements
    const navButtons = {
        products: document.getElementById('navProducts'),
        pendingOrders: document.getElementById('navPendingOrders'),
        rateRequested: document.getElementById('navRateRequested'),
        rateApproved: document.getElementById('navRateApproved'),
        confirmedOrders: document.getElementById('navConfirmedOrders'),
        dispatch: document.getElementById('navDispatch'),
        balance: document.getElementById('navBalance'),
        pausedOrders: document.getElementById('navPausedOrders'),
        holdOrders: document.getElementById('navHoldOrders'),
        delivered: document.getElementById('navDelivered'),
        cancelledOrders: document.getElementById('navCancelled'),
        createOrder: document.getElementById('navCreateOrder'), // <<< NEW
        visitedUsers: document.getElementById('navVisitedUsers')
    };
    const sections = {
        products: document.getElementById('productSection'),
        pendingOrders: document.getElementById('pendingOrdersSection'),
        rateRequested: document.getElementById('rateRequestedSection'),
        rateApproved: document.getElementById('rateApprovedSection'),
        confirmedOrders: document.getElementById('confirmedOrdersSection'),
        dispatch: document.getElementById('dispatchSection'),
        balance: document.getElementById('balanceSection'),
        pausedOrders: document.getElementById('pausedOrdersSection'),
        holdOrders: document.getElementById('holdOrdersSection'),
        delivered: document.getElementById('deliveredOrdersSection'),
        cancelledOrders: document.getElementById('cancelledOrdersSection'),
        createOrder: document.getElementById('createOrderSection'), // <<< NEW
        visitedUsers: document.getElementById('visitedUsersSection')
    };
    const visitedUsersSubNav = {
        noOrders: document.getElementById('navNoOrdersBtn'),
        allUsers: document.getElementById('navAllUsersBtn')
    };
    const visitedUsersLists = {
        noOrders: document.getElementById('noOrdersList'),
        allUsers: document.getElementById('allUsersList')
    };

    // --- Helper Functions ---
    // *** NEW HELPER FUNCTION ***
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        // This combines date + 12-hour time with AM/PM, no seconds
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    // *** END NEW HELPER FUNCTION ***

    // Add this helper function near the top with other helpers
    function formatDeliveryIdsForDescription(deliveryIds) {
        if (!deliveryIds) return '';
        const ids = Array.isArray(deliveryIds) ? deliveryIds : deliveryIds.split(',');
        if (ids.length > 1) {
            return `Batch of ${ids.length}`;
        } else if (ids.length === 1) {
            return `Delivery ${ids[0].substring(ids[0].length - 6)}`; // Last 6 chars
        }
        return '';
    }

    function showCustomItemModal(title, onSave, defaultName = '') {
        const modal = document.getElementById('customItemModal');
        const modalTitle = document.getElementById('customModalTitle');
        const nameInput = document.getElementById('customItemName');
        const priceInput = document.getElementById('customItemPrice');
        const saveBtn = document.getElementById('saveCustomItem');
        const cancelBtn = document.getElementById('cancelCustomItem');

        modalTitle.innerText = title;
        nameInput.value = defaultName;
        priceInput.value = '';
        modal.style.display = 'block';
        priceInput.focus();

        // Use named functions for handlers to allow removal
        const saveHandler = () => {
            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value);

            if (!name) {
                alert('Please enter a description.');
                return;
            }
            if (isNaN(price) || price < 0) {
                alert('Please enter a valid, non-negative amount.');
                return;
            }
            cleanup();
            onSave(name, price);
        };

        const cancelHandler = () => cleanup();

        const cleanup = () => {
            modal.style.display = 'none';
            // Remove the specific listeners
            saveBtn.removeEventListener('click', saveHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
            // Ensure focus is returned to the body or a relevant element
            document.body.focus();
        };

        // Add event listeners
        saveBtn.addEventListener('click', saveHandler);
        cancelBtn.addEventListener('click', cancelHandler);
    }

    function updateProductDropdown(card) {
        const select = card.querySelector('.product-select');
        if (!select) return;

        const existingProductIds = new Set(
            Array.from(card.querySelectorAll('.edit-item-list li, .new-item-list li')).map(li => li.dataset.productId)
        );

        // Filter available products - use allProducts which should be populated
        const availableProducts = allProducts.filter(p => p.isVisible && !existingProductIds.has(p._id)); // Also check isVisible

        select.innerHTML = '<option value="">-- Select Product --</option>' + // Add default empty option
            availableProducts.map(p => {
                const description = p.description ? ` - ${p.description}` : '';
                return `<option value="${p._id}">${p.name}${description}</option>`;
            }).join('');
    }


    function showSection(sectionKey) {
        Object.values(sections).forEach(section => section.style.display = 'none');
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        if (sections[sectionKey] && navButtons[sectionKey]) {
            sections[sectionKey].style.display = 'block';
            navButtons[sectionKey].classList.add('active');
        } else {
            console.warn(`Section or button not found for key: ${sectionKey}`);
            // Fallback to a default section if the key is invalid
            if (sections.pendingOrders && navButtons.pendingOrders) {
                sections.pendingOrders.style.display = 'block';
                navButtons.pendingOrders.classList.add('active');
            }
        }
    }


    function connectToOrderStream() {
        if (eventSource) eventSource.close();

        console.log('Connecting to order stream...');
        // Use /api/admin/order-stream as staff need the same updates
        eventSource = new EventSource('/api/admin/order-stream');

        eventSource.onopen = function () {
            console.log('✓ Order stream connected');
        };

        eventSource.onmessage = function (event) {
            console.log('SSE message received:', event.data);
            if (event.data === 'new_order' || event.data === 'order_updated' || event.data === 'connected') {
                loadOrders(); // Reload orders on update
                loadVisitedUsers(); // Reload users as well (order creation affects this)
            }
        };

        eventSource.onerror = function (err) {
            console.error('SSE connection error:', err);
            eventSource.close();
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                console.log('Attempting to reconnect...');
                connectToOrderStream();
            }, 5000);
        };
    }

    function showStaffPanel() {
        loginBox.style.display = 'none';
        staffPanel.style.display = 'block';
        loadProducts(); // Load available products for selection
        loadOrders(); // Load all orders
        loadVisitedUsers(); // Load users without orders
        loadAllUsers(); // Load all users
        connectToOrderStream(); // Start real-time updates
        showSection('pendingOrders'); // Show pending orders by default
    }

    function showLoginBox() {
        loginBox.style.display = 'block';
        staffPanel.style.display = 'none';
        if (eventSource) eventSource.close(); // Close SSE connection on logout
        // Clear potential form errors
        loginMsg.innerText = '';
        if (staffLoginForm) staffLoginForm.reset();
        // Clear order state
        allOrders = [];
        allProducts = [];
        openOrderCardIds.clear();
    }


    async function checkStaff() {
        try {
            const res = await fetch('/api/staff/check');
            if (res.ok) {
                showStaffPanel();
            } else {
                showLoginBox();
                // If the check fails (e.g., session expired), clear potentially stale session info
                sessionStorage.clear(); // Or specific items if needed
            }
        } catch (e) {
            console.error("Error checking staff session:", e);
            showLoginBox(); // Assume not logged in if check fails
        }
    }

    async function loadOrders() {
        try {
            // Staff fetch from the same admin endpoint
            const res = await fetch('/api/admin/orders');
            if (!res.ok) {
                // Handle different error statuses appropriately
                if (res.status === 401) {
                    console.warn("Unauthorized fetching orders. Logging out.");
                    showLoginBox(); // Redirect to login if unauthorized
                } else {
                    console.error(`Failed to load orders: ${res.status} ${res.statusText}`);
                    // Optionally display an error message to the user in the panel
                }
                return;
            }
            allOrders = await res.json();
            renderOrders(allOrders); // Render based on fetched data
            if (searchInput) searchInput.value = ''; // Clear search on reload
        } catch (error) {
            console.error("Network or parsing error loading orders:", error);
            // Optionally display a network error message
        }
    }

    function getCardStateId(card, order) {
        if (order) {
            const parentSection = card.closest('.admin-section'); // Target sections better
            if (!parentSection) return order._id;
            if (parentSection.id === 'balanceSection') return order._id + '-balance';
            if (parentSection.id === 'advanceSection') return order._id + '-advance';
            return order._id;
        } else if (card.dataset.userId) {
            return 'user-' + card.dataset.userId;
        } else if (card.id && card.id.startsWith('product-card-')) {
            return card.id;
        }
        return card.id || `card-${Math.random().toString(36).substring(2, 9)}`; // Fallback ID
    }

    function renderOrders(ordersToRender) {
        const lists = {
            pending: document.getElementById('pendingOrdersList'),
            rateRequested: document.getElementById('rateRequestedList'),
            rateApproved: document.getElementById('rateApprovedList'),
            confirmed: document.getElementById('confirmedOrdersList'),
            dispatch: document.getElementById('dispatchList'),
            partiallyDelivered: document.getElementById('dispatchList'), // Show in dispatch list
            paused: document.getElementById('pausedOrdersList'),
            hold: document.getElementById('holdOrdersList'),
            delivered: document.getElementById('deliveredOrdersList'),
            cancelled: document.getElementById('cancelledOrdersList'),
            balance: document.getElementById('balanceList')
        };
        // Ensure all list elements exist before proceeding
        for (const key in lists) {
            if (!lists[key]) {
                console.error(`List container element not found: ${key}`);
                return; // Stop rendering if a critical element is missing
            }
        }
        Object.values(lists).forEach(list => list.innerHTML = ''); // Clear lists

        const counts = { pending: 0, rateRequested: 0, rateApproved: 0, confirmed: 0, dispatch: 0, partiallyDelivered: 0, paused: 0, hold: 0, delivered: 0, cancelled: 0 };

        ordersToRender.forEach(order => {
            // Basic validation of order object
            if (!order || !order._id || !order.status || !order.user) {
                console.warn("Skipping invalid order object:", order);
                return;
            }

            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.order = JSON.stringify(order);
            const cardStateId = order._id;
            card.id = `order-${cardStateId}`;

            let targetList;
            switch (order.status) {
                case 'Pending': targetList = lists.pending; counts.pending++; break;
                case 'Rate Requested': targetList = lists.rateRequested; counts.rateRequested++; break;
                case 'Rate Approved': targetList = lists.rateApproved; counts.rateApproved++; break;
                case 'Confirmed': targetList = lists.confirmed; counts.confirmed++; break;
                case 'Dispatch': targetList = lists.dispatch; counts.dispatch++; break;
                case 'Partially Delivered': targetList = lists.dispatch; counts.partiallyDelivered++; break;
                case 'Paused': targetList = lists.paused; counts.paused++; break;
                case 'Hold': targetList = lists.hold; counts.hold++; break;
                case 'Delivered': targetList = lists.delivered; counts.delivered++; break;
                case 'Cancelled': targetList = lists.cancelled; counts.cancelled++; break;
                default:
                    console.warn(`Unknown order status "${order.status}" for order ${order._id}. Placing in Pending.`);
                    targetList = lists.pending; // Fallback to pending
            }

            // Generate HTML based on status
            if (order.status === 'Dispatch' || order.status === 'Partially Delivered') {
                card.innerHTML = generateStaffDispatchCardHtml(order);
            } else if (order.status === 'Delivered') {
                card.innerHTML = generateDeliveredCardHtml(order);
            } else {
                card.innerHTML = generateStaffOrderCardHtml(order);
            }
            targetList.appendChild(card);

            // Restore open state
            if (openOrderCardIds.has(cardStateId)) {
                const body = card.querySelector('.order-card-body');
                if (body && !body.querySelector('.profile-edit-form') && !body.querySelector('.edit-item-list')) {
                    body.style.display = 'block';
                }
            }
            // <<< NEW: Restore open state for HISTORY section >>>
            if (openHistoryCardIds.has(cardStateId)) {
                const historyContainer = card.querySelector('.delivery-history-container');
                const historyBtn = card.querySelector('.view-history-btn');
                // Check if both elements exist (relevant for dispatch/delivered cards)
                if (historyContainer && historyBtn) {
                    // We don't need to re-render here, just ensure it's visible if it should be
                    // Fetching happens when the user clicks view, or after adding amount.
                    // If the container is empty, it means it hasn't been rendered yet.
                    // If it's not empty, restore visibility.
                    if (historyContainer.innerHTML.trim() !== '' && historyContainer.innerHTML !== '<p>Loading history...</p>') {
                        historyContainer.style.display = 'block';
                        historyBtn.innerText = 'Hide History';
                    } else {
                        // If it was supposed to be open but isn't rendered,
                        // clear the state to avoid confusion. User needs to click again.
                        openHistoryCardIds.delete(cardStateId);
                        historyBtn.innerText = 'View History';
                        historyContainer.style.display = 'none';
                    }
                }
            }

            // Render balance card (only for non-cancelled orders)
            if (order.status !== 'Cancelled') {
                const balanceCard = document.createElement('div');
                balanceCard.className = 'card';
                balanceCard.dataset.order = JSON.stringify(order);
                const balanceCardStateId = order._id + '-balance';
                balanceCard.id = `order-${balanceCardStateId}`;
                balanceCard.innerHTML = generateConsolidatedBalanceCardHtml(order);
                lists.balance.appendChild(balanceCard);

                if (openOrderCardIds.has(balanceCardStateId)) {
                    const body = balanceCard.querySelector('.order-card-body');
                    if (body) body.style.display = 'block';
                }
            }
        });

        // Update Nav Button Counts (ensure buttons exist)
        if (navButtons.pendingOrders) navButtons.pendingOrders.innerText = `Active Orders (${counts.pending})`;
        if (navButtons.rateRequested) navButtons.rateRequested.innerText = `Rate Requested (${counts.rateRequested})`;
        if (navButtons.rateApproved) navButtons.rateApproved.innerText = `Rate Approved (${counts.rateApproved})`;
        if (navButtons.confirmedOrders) navButtons.confirmedOrders.innerText = `Confirmed (${counts.confirmed})`;
        if (navButtons.dispatch) navButtons.dispatch.innerText = `Dispatch (${counts.dispatch + counts.partiallyDelivered})`;
        if (navButtons.pausedOrders) navButtons.pausedOrders.innerText = `Paused (${counts.paused})`;
        if (navButtons.holdOrders) navButtons.holdOrders.innerText = `On Hold (${counts.hold})`;
        if (navButtons.delivered) navButtons.delivered.innerText = `Delivered (${counts.delivered})`;
        if (navButtons.cancelledOrders) navButtons.cancelledOrders.innerText = `Cancelled (${counts.cancelled})`;
    }

    // Replace the existing generateStaffOrderCardHtml function
    // Replace the existing generateStaffOrderCardHtml function
    function generateStaffOrderCardHtml(order, isNested = false) { // Added isNested flag
        const totalAmount = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);

        const itemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? `<br><medium style="color: #555;">${item.description}</medium>` : '';
            return `<li><strong>${item.name}</strong> <strong>${descriptionHtml}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li><br>`;
        }).join('');

        const totalAmountHtml = `<hr><h4 style="text-align: right;">Total Amount: ₹${totalAmount.toFixed(2)}</h4>`;

        let renderedCharges = '', renderedDiscounts = '', renderedAdvances = '', adjustmentsTotal = 0;
        if (order.adjustments && order.adjustments.length > 0) {
            order.adjustments.forEach(adj => {
                // Ensure adj._id exists before creating remove button
                const removeBtnHtml = adj._id ? `<button class="remove-adjustment-btn" data-id="${adj._id}" style="color:red; border:none; background:transparent; cursor:pointer; font-weight: bold;">&times;</button>` : '';
                if (adj.type === 'charge') {
                    renderedCharges += `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;"><span>${adj.description}:</span><span>₹${adj.amount.toFixed(2)}</span>${removeBtnHtml}</div>`;
                    adjustmentsTotal += adj.amount;
                } else if (adj.type === 'discount') { // Includes delivery deductions now
                    renderedDiscounts += `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;"><span>${adj.description}:</span><span>- ₹${adj.amount.toFixed(2)}</span>${removeBtnHtml}</div>`;
                    adjustmentsTotal -= adj.amount;
                } else if (adj.type === 'advance') {
                    renderedAdvances += `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;"><span>${adj.description}:</span><span>- ₹${adj.amount.toFixed(2)}</span>${removeBtnHtml}</div>`;
                    adjustmentsTotal -= adj.amount;
                }
            });
        }

        const finalTotal = totalAmount + adjustmentsTotal;
        const finalTotalHtml = (adjustmentsTotal !== 0) ? `<hr style="border-style: dashed;"><h4 style="text-align: right; color: #007bff;">Balance Amount: ₹${finalTotal.toFixed(2)}</h4>` : '';

        const adjustmentsContainerHtml = `
            <div style="text-align: right; font-size: 0.9em;">
                ${renderedCharges}
                <div style="color: #dc3545;">${renderedDiscounts}</div>
                <div style="color: #28a745;">${renderedAdvances}</div>
            </div>
            ${finalTotalHtml}
            <div style="text-align: right; margin-top: 5px; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="add-custom-item-btn" style="font-size: 0.8em; padding: 2px 8px;">+ Add Charge</button>
                <button class="add-custom-discount-btn" style="font-size: 0.8em; padding: 2px 8px; background-color: #dc3545; color: white;">- Add Discount</button>
                <button class="add-custom-advance-btn" style="font-size: 0.8em; padding: 2px 8px; background-color: #28a745; color: white;">- Add Advance</button>
            </div>`;

        let actionButtonHtml = '', agentHtml = '', reasonHtml = '';
        const { name: agentName = '', mobile: agentMobile = '', description: agentDescription = '', address: agentAddress = '' } = order.deliveryAgent || {};

        let agentDisplayHtml = '';
        if (agentName) {
            agentDisplayHtml = `<div style="padding: 8px; background: #e7f3ff; border-radius: 4px; margin-top: 10px;">
                <strong>Assigned Agent:</strong> ${agentName}
                ${agentMobile ? `(${agentMobile})` : ''}
                ${agentDescription ? `<br><small><strong>Note:</strong> ${agentDescription}</small>` : ''}
                ${agentAddress ? `<br><small><strong>Address:</strong> ${agentAddress}</small>` : ''}
            </div>`;
        }

        // --- CHANGE HERE: Show reason for 'Paused' OR 'Hold' ---
        if ((order.status === 'Paused' || order.status === 'Hold') && order.pauseReason) {
            reasonHtml = `<div style="background: #fff8e1; padding: 8px; margin-top: 10px; border-left: 3px solid #ffc107;"><strong>Reason:</strong><p style="margin: 5px 0;">${order.pauseReason}</p><button class="edit-pause-reason-btn small-btn">Edit Reason</button></div>`;
        }
        // --- END CHANGE ---

        const agentFormTemplate = `<div class="agent-form" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>Delivery Agent Details:</strong><br>
            <input type="text" class="agent-name-input" placeholder="Agent Name" value="${agentName}">
            <input type="text" class="agent-mobile-input" placeholder="Agent Mobile" value="${agentMobile}"><br>
            <input type="text" class="agent-desc-input" placeholder="Description (e.g., vehicle, ETA)" value="${agentDescription}" style="width: 95%; margin-top: 5px;"><br>
            <textarea class="agent-address-input" placeholder="Delivery Address" style="width: 95%; margin-top: 5px; height: 60px;">${agentAddress}</textarea><br>
            <button class="save-agent-btn">Save Agent</button>
        </div>`;

        // Action buttons based on status (similar logic as admin)
        switch (order.status) {
            case 'Pending':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="pause-btn">Pause</button><button class="admin-edit-order-btn">Edit</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Rate Requested':
                actionButtonHtml = `<p><strong>Waiting for admin approval.</strong></p><button class="cancel-rate-request-btn">Cancel Request</button>`;
                break;
            case 'Rate Approved':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="admin-edit-order-btn">Edit</button><button class="hold-btn">Hold</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Confirmed':
                if (!isNested) { // Only show agent assignment/dispatch button if not nested
                    if (agentName) {
                        agentHtml = agentDisplayHtml +
                            `<button class="show-agent-form-btn" style="font-size: 0.8em; margin-top: 5px;">Edit Agent</button>`;
                        actionButtonHtml = `<button class="dispatch-btn" style="background-color: #28a745; color: white;">Dispatch Order</button>`;
                    } else {
                        agentHtml = `<button class="show-agent-form-btn">Assign Agent</button>`;
                        actionButtonHtml = ``; // No dispatch button yet
                    }
                    agentHtml += `<div class="agent-form-container" style="display:none;">${agentFormTemplate}</div>`;
                } else if (agentName) {
                    agentHtml = agentDisplayHtml; // Show assigned agent if nested
                }
                actionButtonHtml += `<button class="admin-edit-order-btn">Edit Order</button><button class="hold-btn">Hold</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Paused':
            case 'Hold':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="admin-edit-order-btn">Edit</button><button class="cancel-btn">Cancel</button>`;
                break;
            default:
                if (agentName && !isNested) {
                    agentHtml = agentDisplayHtml;
                }
        }

        const statusColors = { Pending: 'orange', Confirmed: '#007bff', Paused: '#6c757d', Cancelled: '#dc3545', Delivered: 'green', 'Rate Requested': '#e83e8c', 'Rate Approved': '#20c997', 'Hold': '#343a40', 'Dispatch': '#fd7e14', 'Partially Delivered': '#fd7e14' };
        const statusColor = statusColors[order.status] || '#000';
        const statusHtml = `<strong style="color: ${statusColor};">Status: ${order.status}</strong><br>`;

        const cardHeader = !isNested ? `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: ${statusColor};">${order.status}</span>
            </div>` : '';

        const cardBodyContent = `
            ${!isNested ? `<strong>Customer:</strong> ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'}) <button class="view-profile-btn small-btn" data-user-id="${order.user._id}">View Profile</button><br>` : ''}
            ${!isNested ? `<strong>Ordered at:</strong> ${formatDate(order.createdAt)}<br>` : ''} 
            ${!isNested ? statusHtml : ''}${!isNested ? agentHtml : ''}
            <hr>
            <strong>Items:</strong>
            <ul class="item-list">${itemsHtml + totalAmountHtml + adjustmentsContainerHtml}</ul>
            <div class="order-actions">${actionButtonHtml}</div>
            ${reasonHtml}
            ${!isNested ? `<p class="edit-msg small" style="color:red;"></p>` : ''}
        `;

        if (isNested) {
            return cardBodyContent;
        } else {
            return cardHeader + `<div class="order-card-body" style="display: none;">${cardBodyContent}</div>`;
        }
    }


    // Replace the existing generateStaffDispatchCardHtml function
    function generateStaffDispatchCardHtml(order) {
        const { name: agentName = 'N/A', mobile: agentMobile = '', description: agentDesc = '' } = order.deliveryAgent || {};

        let allItemsDelivered = true; // Flag to check if everything is delivered
        let totalOrdered = 0;
        let totalDelivered = 0;

        const itemsTableRows = order.items.map(item => {
            const ordered = (item.quantityOrdered || 0);
            const delivered = (item.quantityDelivered || 0);
            const remaining = ordered - delivered;
            totalOrdered += ordered;
            totalDelivered += delivered;
            if (remaining > 0.001) { // Use tolerance for floating point
                allItemsDelivered = false;
            }
            return `
            <tr data-product-id="${item.product}" class="dispatch-item-row">
                <td style="padding: 8px 5px;">${item.name} <small>${item.description || ''}</small></td>
                <td style="padding: 8px 5px;">${ordered} ${item.unit || ''}</td>
                <td style="padding: 8px 5px;">${delivered} ${item.unit || ''}</td>
                <td style="padding: 8px 5px; font-weight: bold;">${remaining.toFixed(2)} ${item.unit || ''}</td>
                <td style="padding: 8px 5px;">
                    <input type="number" class="dispatch-qty-input" value="" placeholder="Qty" min="0" max="${remaining}" step="0.1" style="width: 70px;" ${remaining <= 0.001 ? 'disabled' : ''}>
                </td>
            </tr>`;
        }).join('');

        const itemsTable = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid #ccc;">
                        <th style="padding: 5px;">Product</th>
                        <th style="padding: 5px;">Ordered</th>
                        <th style="padding: 5px;">Delivered</th>
                        <th style="padding: 5px;">Remaining</th>
                        <th style="padding: 5px;">Delivering Now</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsTableRows}
                </tbody>
            </table>`;


        const { address: agentAddress = '' } = order.deliveryAgent || {};
        const agentEditHtml = `<div style="padding: 8px; background: #e7f3ff; border-radius: 4px; margin-top: 10px;">
            <strong>Assigned Agent:</strong> ${agentName} (${agentMobile})
            ${agentDesc ? `<br><small><strong>Note:</strong> ${agentDesc}</small>` : ''}
            ${agentAddress ? `<br><small><strong>Address:</strong> ${agentAddress}</small>` : ''}
            <button class="show-agent-form-btn" style="font-size: 0.8em; margin-top: 5px; float: right;">Edit Agent</button>
        </div>
        <div class="agent-form-container" style="display:none;">
             <div class="agent-form" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>Delivery Agent Details:</strong><br>
                <input type="text" class="agent-name-input" placeholder="Agent Name" value="${agentName}">
                <input type="text" class="agent-mobile-input" placeholder="Agent Mobile" value="${agentMobile}"><br>
                <input type="text" class="agent-desc-input" placeholder="Description (e.g., vehicle, ETA)" value="${agentDesc}" style="width: 95%; margin-top: 5px;"><br>
                <textarea class="agent-address-input" placeholder="Delivery Address" style="width: 95%; margin-top: 5px; height: 60px;">${agentAddress}</textarea><br>
                <button class="save-agent-btn">Save Agent</button>
            </div>
        </div>`;

        // --- Logic for Manual Delivery Button ---
        let actionButtonHtml = '';
        if (allItemsDelivered) {
            actionButtonHtml = `
                <button class="mark-delivered-btn" style="background-color: green; color: white;">Mark Delivered</button>
                <button class="view-history-btn">View History</button>
                <button class="return-to-confirmed-btn">Return to Confirmed</button>
            `;
        } else {
            actionButtonHtml = `
                <button class="record-delivery-btn" style="background-color:#28a745; color:white;">Record Delivery</button>
                <button class="view-history-btn">View History</button>
                <button class="return-to-confirmed-btn">Return to Confirmed</button>
             `;
        }
        const dispatchActionButtons = `<div class="order-actions">${actionButtonHtml}</div>`;
        // --- End Logic ---

        const statusColor = order.status === 'Partially Delivered' ? '#fd7e14' : '#007bff';

        const cardHeader = `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: ${statusColor};">${order.status}</span>
            </div>`;

        const confirmedViewOrderData = { ...order, status: 'Confirmed' };
        const nestedConfirmedHtml = generateStaffOrderCardHtml(confirmedViewOrderData, true);

        const cardBody = `
            <div class="order-card-body" style="display: none;">

                 <strong style="color: ${statusColor};">Current Status: ${order.status} ${allItemsDelivered ? '(All Items Dispatched)' : ''}</strong>
                 ${agentEditHtml}
                <hr>
                <h4>Delivery Entry</h4>
                 ${allItemsDelivered ? '<p style="color: green; font-weight: bold;">All items recorded as delivered.</p>' : itemsTable}
                <div class="delivery-history-container" style="display:none; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;"></div>
                ${dispatchActionButtons}
                <div class="order-details-container">
                    <hr style="margin: 20px 0; border-style: dotted;">
                    <h4>Orders</h4>
                    ${nestedConfirmedHtml}
                    <p class="edit-msg small" style="color:red; margin-top: 15px;"></p>
                </div>
            </div>`;

        return cardHeader + cardBody;
    }

    function generateDeliveredCardHtml(order) {
        // Recalculate totals including adjustments for delivered view
        const itemTotal = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);
        let adjustmentsTotal = 0;
        let renderedAdjustments = '';

        if (order.adjustments && order.adjustments.length > 0) {
            adjustmentsTotal = order.adjustments.reduce((sum, adj) => {
                const amount = (adj.type === 'charge') ? adj.amount : -adj.amount;
                return sum + amount;
            }, 0);

            renderedAdjustments = '<hr style="border-style: dashed;"><h5>Adjustments:</h5><ul style="font-size: 0.9em; text-align: right;">';
            order.adjustments.forEach(adj => {
                const amountSign = adj.type === 'charge' ? '+' : '-';
                const color = adj.type === 'charge' ? 'black' : (adj.type === 'advance' ? 'green' : 'red');
                renderedAdjustments += `<li style="color: ${color};">${adj.description}: ${amountSign} ₹${adj.amount.toFixed(2)}</li>`;
            });
            renderedAdjustments += '</ul>';
        }

        const finalTotal = itemTotal + adjustmentsTotal;


        const itemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? `<br><medium style="color: #555;">${item.description}</medium>` : '';
            return `<li><strong>${item.name}</strong> <strong>${descriptionHtml}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price.toFixed(2)}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li><br>`;
        }).join('');


        const cardHeader = `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: green;">${order.status}</span>
            </div>`;

        const cardBody = `
            <div class="order-card-body" style="display: none;">
                
                <strong style="color: green;">Status: ${order.status} on ${formatDate(order.deliveredAt)}</strong><br> 
                <hr>
                <h5>Items:</h5>
                <ul class="item-list">${itemsHtml}</ul>
                <h4 style="text-align: right;">Subtotal: ₹${itemTotal.toFixed(2)}</h4>
                ${renderedAdjustments}
                <h4 style="text-align: right; color: #28a745;">Final Amount: ₹${finalTotal.toFixed(2)}</h4>
                <div class="order-actions">
                     <button class="view-history-btn">View Full History</button>
                </div>
                <div class="delivery-history-container" style="display:none; margin-top: 15px; border-top: 1px dashed #ccc; padding-top: 10px;"></div>
            </div>`;

        return cardHeader + cardBody;
    }

    function generateConsolidatedBalanceCardHtml(order) {
        let totalBilled = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);
        let totalAdjustments = 0;
        let renderedAdjustments = '';

        if (order.adjustments && order.adjustments.length > 0) {
            totalAdjustments = order.adjustments.reduce((sum, adj) => sum + (adj.type === 'charge' ? adj.amount : -adj.amount), 0);

            renderedAdjustments = '<hr style="border-style: dashed;"><h5>Adjustments:</h5><ul style="font-size: 0.9em; text-align: right;">';
            order.adjustments.forEach(adj => {
                const amountSign = adj.type === 'charge' ? '+' : '-';
                const color = adj.type === 'charge' ? 'black' : (adj.type === 'advance' ? 'green' : 'red');
                renderedAdjustments += `<li style="color: ${color};">${adj.description}: ${amountSign} ₹${adj.amount.toFixed(2)}</li>`;
            });
            renderedAdjustments += '</ul>';
        }

        const cardHeader = `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: #17a2b8;">Balance View</span>
            </div>`;

        const itemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? `<br><medium style="color: #555;">${item.description}</medium>` : '';
            return `<li><strong>${item.name}</strong> <strong>${descriptionHtml}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price.toFixed(2)}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li><br>`;
        }).join('');


        const finalTotal = totalBilled + totalAdjustments;

        const cardBody = `
            <div class="order-card-body" style="display: none;">
                <hr>
                <div style="padding: 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 10px;">
                    <strong style="color: #007bff;">Status: ${order.status}</strong>
                    <ul class="item-list">${itemsHtml}</ul>
                    <h4 style="text-align: right;">Subtotal: ₹${totalBilled.toFixed(2)}</h4>
                </div>
                ${renderedAdjustments}
                <hr>
                 <div style="text-align: right;">
                    <h4>Item Total: ₹${totalBilled.toFixed(2)}</h4>
                    ${totalAdjustments !== 0 ? `<h4>Adjustments: ₹${totalAdjustments.toFixed(2)}</h4>` : ''}
                    <h3 style="color: #28a745;">Final Bill: ₹${finalTotal.toFixed(2)}</h3>
                 </div>
            </div>`;

        return cardHeader + cardBody;
    }

    async function generateStaffEditViewHtml(order) {
        // Ensure allProducts is loaded if it's empty
        if (allProducts.length === 0) {
            await loadProducts(); // Wait for products to be loaded
        }

        const existingProductIds = new Set(order.items.map(item => (item.product?._id || item.product).toString()));
        // Filter products that are visible AND not already in the order
        const availableProducts = allProducts.filter(p => p.isVisible && !existingProductIds.has(p._id));

        const productOptions = '<option value="">-- Select Product --</option>' + availableProducts.map(p => {
            const description = p.description ? ` - ${p.description}` : '';
            return `<option value="${p._id}">${p.name}${description}</option>`;
        }).join('');

        const currentItemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? ` - ${item.description}` : '';
            const productId = (item.product?._id || item.product).toString();
            // Find the original product price from allProducts
            const originalProduct = allProducts.find(p => p._id === productId);
            const originalPrice = originalProduct ? originalProduct.price.toFixed(2) : item.price.toFixed(2); // Fallback to item price

            return `<li data-product-id="${productId}" data-original-price="${originalPrice}">
                ${item.name}${descriptionHtml} (${item.unit || ''}) -
                <input type="number" class="qty-input" min="0.1" step="0.1" value="${item.quantityOrdered}" style="width: 80px;">
                Price: <input type="number" class="price-input" min="0" value="${item.price.toFixed(2)}" step="0.01" style="width: 80px;">
                <button class="remove-item-btn" style="color:red; margin-left: 5px;">X</button></li>`;
        }).join('');

        const cardHeader = `
            <div class="order-card-header">
                <strong>Order ID: ${order.customOrderId || 'NEW ORDER'}</strong>
                <span style="float: right; font-weight: bold; color: #ffc107;">${order._id ? 'Editing...' : 'Creating...'}</span>
            </div>`;

        const cardBody = `
            <div class="order-card-body" style="display: block;">
                <strong>Order for: ${order.user.name}</strong><hr>
                <strong>Items:</strong> <ul class="edit-item-list">${currentItemsHtml}</ul> <hr>
                <strong>Add Product:</strong><br>
                <select class="product-select">${productOptions}</select>
                <button class="add-product-btn">Add</button>
                <ul class="new-item-list" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;"></ul>
                <hr style="margin-top: 15px;">
                <div class="order-actions">
                    <button class="admin-save-changes-btn">Save Changes</button>
                    <button class="admin-cancel-edit-btn">Cancel</button>
                </div><p class="edit-msg small" style="color:red;"></p>
            </div>`;

        return cardHeader + cardBody;
    }

    // +++ NEW FUNCTION: Generates the read-only profile display +++
    function generateUserProfileDisplayHtml(user) {
        return `
            <div class="order-card-header">
                <strong>User Profile</strong>
                <span style="float: right; font-weight: bold; color: #17a2b8;">${user.mobile}</span>
            </div>
            <div class="order-card-body" style="display: block;">
                <h4>Profile Details for ${user.name || user.mobile}</h4>
                <div class="profile-display" style="line-height: 1.6;">
                    <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
                    <p><strong>Alternative Mobile:</strong> ${user.altMobile || 'N/A'}</p>
                    <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
                    <p><strong>District:</strong> ${user.district || 'N/A'}</p>
                    <p><strong>Taluk:</strong> ${user.taluk || 'N/A'}</p>
                    <p><strong>Address:</strong><br><span style="white-space: pre-wrap; padding-left: 10px;">${user.address || 'N/A'}</span></p>
                    <p><strong>Pincode:</strong> ${user.pincode || 'N/A'}</p>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px; text-align: right;">
                    <button class="show-edit-form-btn small-btn" data-user-id="${user._id}">Edit Profile</button>
                    <button class="cancel-profile-view-btn small-btn" style="background-color: #6c757d;">Close</button>
                </div>
                <p class="profile-display-msg small" style="color:green;"></p>
            </div>
        `;
    }

    function generateUserProfileEditHtml(user) {
        const cardHeader = `
            <div class="order-card-header">
                <strong>Editing Profile</strong>
                <span style="float: right; font-weight: bold; color: #ffc107;">${user.mobile}</span>
            </div>`;

        // Updated body with address textarea, removed place/landmark
        const cardBody = `
            <div class="order-card-body" style="display: block;">
                <h4>Editing Profile for ${user.name || user.mobile}</h4>
                <div class="profile-edit-form">
                    <label>Name</label>
                    <input id="prof_name" type="text" placeholder="Enter Customer Name" value="${user.name || ''}" maxlength="29">

                    <label>Alternative Mobile Number</label>
                    <input id="prof_altMobile" type="text" placeholder="Enter Alternate Mobile Number" value="${user.altMobile || ''}" maxlength="10" pattern="\\d{10}">

                    <label>Email</label>
                    <input id="prof_email" type="email" placeholder="Enter Customer Mail" value="${user.email || ''}" maxlength="40">

                    <label>District</label>
                    <select id="prof_district" data-current="${user.district || ''}"></select> 

                    <label>Taluk</label>
                    <select id="prof_taluk" data-current="${user.taluk || ''}"></select>

                    <label>Address</label>
                    <textarea id="prof_address" placeholder="Enter full address" rows="3" maxlength="150">${user.address || ''}</textarea>

                    <label>Pincode</label>
                    <input id="prof_pincode" type="text" placeholder="Enter Customer Pincode" value="${user.pincode || ''}" maxlength="6">

                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button class="save-profile-btn">Save Profile</button>
                        <button class="cancel-profile-edit-btn" type="button" style="background-color: #6c757d;">Cancel</button>
                    </div>
                    <p class="profile-edit-msg small" style="color:green;"></p>
                </div>
            </div>`;

        return cardHeader + cardBody;
    }


    async function loadVisitedUsers() {
        if (!visitedUsersLists.noOrders) return; // Guard if element doesn't exist
        try {
            const res = await fetch('/api/admin/visited-users');
            if (!res.ok) {
                visitedUsersLists.noOrders.innerHTML = '<p>Error loading users.</p>';
                return;
            }
            const users = await res.json();
            renderNoOrderUsers(users);
        } catch (error) {
            console.error("Error in loadVisitedUsers:", error);
            visitedUsersLists.noOrders.innerHTML = '<p>Network error loading users.</p>';
        }
    }

    function renderNoOrderUsers(users) {
        const listContainer = visitedUsersLists.noOrders;
        if (!listContainer || !visitedUsersSubNav.noOrders) return; // Guard
        visitedUsersSubNav.noOrders.innerText = `No Orders (${users.length})`;

        if (users.length === 0) {
            listContainer.innerHTML = '<p>No users are currently in this category.</p>';
            return;
        }

        listContainer.innerHTML = users.map(user => {
            if (!user || !user._id || !user.mobile) {
                console.warn("Skipping invalid user object in renderNoOrderUsers:", user);
                return ''; // Skip rendering this user
            }
            const cardStateId = 'user-' + user._id;

            const cardHeader = `<div class="order-card-header"><strong>Phone: ${user.mobile}</strong></div>`;
            const initialDisplay = openOrderCardIds.has(cardStateId) ? 'block' : 'none';

            const cardBody = `
                <div class="order-card-body profile-container" style="display: ${initialDisplay};">
                    ${generateUserProfileDisplayHtml(user)}
                </div>`;

            return `<div class="card" data-user-id="${user._id}">${cardHeader + cardBody}</div>`;
        }).join('');
    }

    async function loadAllUsers() {
        if (!visitedUsersLists.allUsers) return; // Guard
        try {
            const res = await fetch('/api/admin/all-users');
            if (!res.ok) {
                visitedUsersLists.allUsers.innerHTML = '<p>Error loading users.</p>';
                return;
            }
            const users = await res.json();
            renderAllUsers(users);
        } catch (error) {
            console.error("Error in loadAllUsers:", error);
            visitedUsersLists.allUsers.innerHTML = '<p>Network error loading users.</p>';
        }
    }

    function renderAllUsers(users) {
        const listContainer = visitedUsersLists.allUsers;
        if (!listContainer || !visitedUsersSubNav.allUsers) return; // Guard
        visitedUsersSubNav.allUsers.innerText = `All Logged-in Users (${users.length})`;

        if (users.length === 0) {
            listContainer.innerHTML = '<p>No users have registered yet.</p>';
            return;
        }

        listContainer.innerHTML = users.map(user => {
            if (!user || !user._id || !user.mobile) {
                console.warn("Skipping invalid user object in renderAllUsers:", user);
                return ''; // Skip rendering this user
            }
            const userName = user.name || 'N/A';
            const cardStateId = 'user-' + user._id;

            const cardHeader = `
                <div class="order-card-header">
                    <strong>Phone: ${user.mobile}</strong>
                    <span style="float: right;">Name: <strong>${userName}</strong></span>
                </div>`;
            const initialDisplay = openOrderCardIds.has(cardStateId) ? 'block' : 'none';
            const cardBody = `
                <div class="order-card-body" style="display: ${initialDisplay};">
                    ${generateUserProfileDisplayHtml(user)}
                </div>`;
            return `<div class="card" data-user-id="${user._id}">${cardHeader + cardBody}</div>`;
        }).join('');
    }

    async function loadProducts() {
        try {
            // Staff can only view products, use the public endpoint
            const res = await fetch('/api/products');
            if (!res.ok) {
                console.error(`Failed to load products: ${res.status}`);
                return;
            }
            const products = await res.json();
            allProducts = products; // Store for use in dropdowns

            // Staff panel might not have a product list to render to, check first
            const list = document.getElementById('productList');
            if (!list) return; // No product list element found, just load data

            list.innerHTML = '';
            // Only render visible products for staff
            const visibleProducts = products.filter(p => p.isVisible);

            visibleProducts.forEach((p, index) => {
                const el = document.createElement('div');
                el.className = 'card';
                const cardStateId = 'product-card-' + p._id;
                el.id = cardStateId;

                const cardHeader = `
                    <div class="order-card-header">
                        <strong>${String(index + 1).padStart(3, '0')} - ${p.name}</strong> ${p.sku ? `(${p.sku})` : ''}
                        <span style="float: right;">${p.price} / ${p.unit || 'unit'}</span>
                    </div>`;

                const initialDisplay = openOrderCardIds.has(cardStateId) ? 'block' : 'none';
                const cardBody = `
                    <div class="order-card-body" style="display: ${initialDisplay};">
                        <span class="small">${p.description || 'No description.'}</span><br>
                    </div>`;

                el.innerHTML = cardHeader + cardBody;
                list.appendChild(el);
            });

        } catch (error) {
            console.error("Network error loading products:", error);
        }
    }


    staffPanel.addEventListener('click', async (e) => {

        const header = e.target.closest('.order-card-header');
        if (header) {
            const card = header.closest('.card');
            if (!card) return;
            const body = card.querySelector('.order-card-body');
            const orderData = card.dataset.order;
            const order = orderData ? JSON.parse(orderData) : null;
            const cardStateId = getCardStateId(card, order);

            if (body) {
                const isOpen = body.style.display === 'block';
                if (body.querySelector('.profile-edit-form') || body.querySelector('.edit-item-list')) {
                    return;
                }
                body.style.display = isOpen ? 'none' : 'block';
                if (cardStateId) {
                    if (!isOpen) openOrderCardIds.add(cardStateId);
                    else openOrderCardIds.delete(cardStateId);
                }
            }
            return;
        }


        if (e.target.classList.contains('remove-dispatch-item-btn')) {
            e.target.closest('li')?.remove(); // Optional chaining for safety
            return;
        }

        if (e.target.classList.contains('show-agent-form-btn')) {
            const card = e.target.closest('.card');
            if (!card) return;
            // Need to get order data to check if agent already exists
            const orderData = card.dataset.order;
            const order = orderData ? JSON.parse(orderData) : null;
            const container = card.querySelector('.agent-form-container');
            if (container) {
                const isHidden = container.style.display === 'none';
                container.style.display = isHidden ? 'block' : 'none';
                e.target.innerText = isHidden ? 'Hide Form' : (order?.deliveryAgent?.name ? 'Edit Agent' : 'Assign Agent'); // Adjust text
            }
            return;
        }


        if (e.target === visitedUsersSubNav.allUsers) {
            visitedUsersLists.noOrders.style.display = 'none';
            visitedUsersLists.allUsers.style.display = 'block';
            visitedUsersSubNav.allUsers.classList.add('active');
            visitedUsersSubNav.noOrders.classList.remove('active');
            return;
        }

        if (e.target === visitedUsersSubNav.noOrders) {
            visitedUsersLists.allUsers.style.display = 'none';
            visitedUsersLists.noOrders.style.display = 'block';
            visitedUsersSubNav.noOrders.classList.add('active');
            visitedUsersSubNav.allUsers.classList.remove('active');
            return;
        }

        if (e.target.classList.contains('staff-create-new-order-btn')) {
            const card = e.target.closest('.card');
            if (!card) return;
            const userId = e.target.dataset.userId;
            let isPriceChanged = false;

            const getItemsFromList = (selector) => {
                return Array.from(card.querySelectorAll(selector)).map(li => {
                    const priceInput = li.querySelector('.price-input');
                    const qtyInput = li.querySelector('.qty-input');
                    const newPrice = parseFloat(priceInput?.value);
                    const originalPrice = parseFloat(li.dataset.originalPrice);
                    if (!isNaN(newPrice) && !isNaN(originalPrice) && newPrice !== originalPrice) {
                        isPriceChanged = true;
                    }
                    return {
                        productId: li.dataset.productId,
                        quantity: qtyInput?.value,
                        price: newPrice
                    };
                });
            };

            const newItems = [
                ...getItemsFromList('.edit-item-list li'),
                ...getItemsFromList('.new-item-list li')
            ].filter(item => item.quantity > 0 && item.price >= 0); // Basic validation


            if (newItems.length === 0) {
                alert("Cannot create an empty order or order with invalid items.");
                return;
            }

            const endpoint = isPriceChanged ? '/api/admin/orders/create-for-user-rate-request' : '/api/admin/orders/create-for-user';

            try {
                const res = await fetch(endpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userId, items: newItems })
                });

                if (res.ok) {
                    alert(isPriceChanged ? 'Order created and submitted for rate approval!' : 'Order created successfully!');
                    loadVisitedUsers();
                    loadOrders(); // Reload orders to show the new one
                } else {
                    const err = await res.json();
                    alert(`Failed to create order: ${err.error || res.statusText}`);
                }
            } catch (fetchError) {
                alert(`Network error creating order: ${fetchError.message}`);
            }
            return;
        }


        const card = e.target.closest('.card');
        if (!card) return;


        if (e.target.classList.contains('make-order-btn')) {
            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;
            const fakeOrder = {
                _id: null,
                customOrderId: null,
                user: { _id: userId, name: userName },
                items: []
            };

            const editViewHtml = await generateStaffEditViewHtml(fakeOrder);
            card.innerHTML = editViewHtml;

            const saveBtn = card.querySelector('.admin-save-changes-btn');
            if (saveBtn) {
                saveBtn.innerText = 'Create New Order';
                saveBtn.classList.remove('admin-save-changes-btn');
                saveBtn.classList.add('staff-create-new-order-btn');
                saveBtn.dataset.userId = userId;
            }

            const cancelBtn = card.querySelector('.admin-cancel-edit-btn');
            if (cancelBtn) {
                cancelBtn.classList.remove('admin-cancel-edit-btn');
                cancelBtn.classList.add('cancel-profile-edit-btn');
            }

            const cardStateId = getCardStateId(card, null);
            if (cardStateId) openOrderCardIds.add(cardStateId);

            return;
        }


        if (e.target.classList.contains('view-order-details-btn')) {
            const orderId = e.target.dataset.orderId;
            const order = allOrders.find(g => g.customOrderId === orderId);
            if (order) {
                const statusToNavKey = {
                    'Pending': 'pendingOrders', 'Rate Requested': 'rateRequested', 'Rate Approved': 'rateApproved',
                    'Confirmed': 'confirmedOrders', 'Dispatch': 'dispatch', 'Partially Delivered': 'dispatch',
                    'Paused': 'pausedOrders', 'Hold': 'holdOrders', 'Delivered': 'delivered', 'Cancelled': 'cancelledOrders'
                };
                const navKey = statusToNavKey[order.status];
                if (navKey && navButtons[navKey]) {
                    navButtons[navKey].click();
                    setTimeout(() => {
                        const targetCard = document.getElementById(`order-${order._id}`);
                        if (targetCard) {
                            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const body = targetCard.querySelector('.order-card-body');
                            if (body) {
                                body.style.display = 'block';
                                openOrderCardIds.add(order._id);
                            }
                            targetCard.style.backgroundColor = '#e7f3ff';
                            setTimeout(() => { targetCard.style.backgroundColor = ''; }, 2000);
                        } else {
                            console.warn(`Card with ID order-${order._id} not found after navigation.`);
                        }
                    }, 150); // Increased timeout slightly
                } else {
                    console.warn(`Navigation key or button not found for status: ${order.status}`);
                }
            } else {
                console.warn(`Order with custom ID ${orderId} not found in allOrders array.`);
            }
            return;
        }


        const orderData = card.dataset.order;
        const order = orderData ? JSON.parse(orderData) : null;

        async function addAdjustment(description, amount, type) {
            if (!order) return;
            try {
                const res = await fetch('/api/admin/orders/adjustments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order._id, description, amount, type })
                });
                if (!res.ok) {
                    const err = await res.json();
                    alert(`Failed to add adjustment: ${err.error || res.statusText}`);
                }
                // SSE will trigger reload
            } catch (fetchError) {
                alert(`Network error adding adjustment: ${fetchError.message}`);
            }
        }


        if (e.target.classList.contains('add-custom-item-btn')) {
            showCustomItemModal('Add New Charge', (name, price) => addAdjustment(name, price, 'charge'), 'Add Charge');
            return;
        }
        if (e.target.classList.contains('add-custom-discount-btn')) {
            showCustomItemModal('Add New Discount', (name, price) => addAdjustment(name, price, 'discount'), 'Discount');
            return;
        }
        if (e.target.classList.contains('add-custom-advance-btn')) {
            showCustomItemModal('Add Advance Payment', (name, price) => addAdjustment(name, price, 'advance'), 'Advance');
            return;
        }
        if (e.target.classList.contains('remove-adjustment-btn')) {
            if (!order || !confirm('Are you sure? This action cannot be undone.')) return;
            const adjustmentId = e.target.dataset.id;

            // --- MODIFIED: Add feedback for locked items ---
            const btn = e.target;
            btn.disabled = true;
            btn.innerText = '...';

            try {
                const res = await fetch('/api/admin/orders/remove-adjustment', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order._id, adjustmentId })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to remove');
                }
                // SSE will trigger reload
            } catch (fetchError) {
                alert(`Could not remove amount: ${fetchError.message}`);
                // Re-enable button on failure
                btn.disabled = false;
                btn.innerText = '✕';
            }
            return;
        }

        // --- MODIFIED: '.lock-adjustment-btn' HANDLER ---
        if (e.target.classList.contains('lock-adjustment-btn')) {
            if (!order || !confirm('Are you sure you want to lock this amount?\n\nIt CANNOT be removed or edited after locking.')) return;

            const adjustmentId = e.target.dataset.id;
            const btn = e.target;
            const btnContainer = btn.parentElement; // Get the container holding the buttons

            btn.disabled = true;
            btn.innerText = '...';

            // Find the 'x' button in the same container
            const removeBtn = btnContainer.querySelector('.remove-adjustment-btn');
            if (removeBtn) {
                removeBtn.style.display = 'none'; // Hide the 'x' button
            }

            try {
                const res = await fetch('/api/admin/orders/lock-adjustment', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order._id, adjustmentId })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to lock');
                }

                // On success, replace the buttons with the "Locked" text immediately.
                btnContainer.innerHTML = `<span style="color: green; font-weight: bold; margin-left: 10px;">✓ Locked</span>`;

            } catch (error) {
                console.error("Error locking adjustment:", error);
                alert(`Could not lock amount: ${error.message}`);

                // On failure, re-enable the button and show the 'x' button again
                btn.disabled = false;
                btn.innerText = '✓';
                if (removeBtn) {
                    removeBtn.style.display = 'inline-block';
                }
            }
            return;
        }
        // --- END MODIFIED HANDLER ---


        if (e.target.classList.contains('remove-item-btn')) {
            e.target.closest('li')?.remove();
            updateProductDropdown(card);
            return;
        }

        if (e.target.classList.contains('add-product-btn')) {
            const select = card.querySelector('.product-select');
            const list = card.querySelector('.new-item-list');
            if (!select || !list || !select.value) return;

            const selectedProduct = allProducts.find(p => p._id === select.value);
            if (!selectedProduct) {
                console.warn("Selected product not found in allProducts array");
                return;
            }

            const newItemLi = document.createElement('li');
            newItemLi.dataset.productId = select.value;
            newItemLi.dataset.originalPrice = selectedProduct.price.toFixed(2);
            newItemLi.innerHTML = `${select.options[select.selectedIndex].text} -
                <input type="number" class="qty-input" min="0.1" step="0.1" value="" style="width: 80px;">
                Price: <input type="number" class="price-input" min="0" value="${selectedProduct.price.toFixed(2)}" step="0.01" style="width: 80px;">
                <button class="remove-item-btn" style="color:red; margin-left: 5px;">X</button>`;
            list.appendChild(newItemLi);

            updateProductDropdown(card); // Update dropdown after adding
            select.value = ""; // Reset select dropdown
            return;
        }

        if (e.target.classList.contains('price-input')) {
            const saveBtn = card.querySelector('.admin-save-changes-btn, .staff-create-new-order-btn');
            if (saveBtn) {
                // Check if price actually changed compared to original
                const priceInput = e.target;
                const li = priceInput.closest('li');
                if (!li) return; // Should not happen
                const originalPrice = parseFloat(li.dataset.originalPrice);
                const newPrice = parseFloat(priceInput.value);
                let isChanged = false;

                if (!isNaN(originalPrice) && !isNaN(newPrice) && newPrice !== originalPrice) {
                    isChanged = true;
                }

                // Check other items as well
                const allItems = card.querySelectorAll('.edit-item-list li, .new-item-list li');
                for (const itemLi of allItems) {
                    if (itemLi === li) continue; // Skip current item
                    const itemPriceInput = itemLi.querySelector('.price-input');
                    const itemOriginalPrice = parseFloat(itemLi.dataset.originalPrice);
                    const itemNewPrice = parseFloat(itemPriceInput?.value);
                    if (!isNaN(itemOriginalPrice) && !isNaN(itemNewPrice) && itemNewPrice !== itemOriginalPrice) {
                        isChanged = true;
                        break;
                    }
                }

                const buttonText = saveBtn.classList.contains('staff-create-new-order-btn') ? 'Create New Order' : 'Save Changes';
                const rateReqText = saveBtn.classList.contains('staff-create-new-order-btn') ? 'Create & Request Rate' : 'Request Rate Change';

                if (isChanged) {
                    saveBtn.innerText = rateReqText;
                    saveBtn.style.backgroundColor = '#e83e8c'; // Highlight button
                } else {
                    // If price is same as original, revert button text/style
                    saveBtn.innerText = buttonText;
                    saveBtn.style.backgroundColor = ''; // Revert to default style
                }
            }
            return; // Don't process further actions on price input focus/change
        }

        if (e.target.classList.contains('record-delivery-btn')) {
            if (!order) return;
            const deliveries = [];
            let hasInvalidQuantity = false;
            card.querySelectorAll('.dispatch-item-row').forEach(row => {
                const qtyInput = row.querySelector('.dispatch-qty-input');
                const quantity = parseFloat(qtyInput?.value);
                const max = parseFloat(qtyInput?.max);

                if (!isNaN(quantity) && quantity > 0) {
                    if (!isNaN(max) && quantity > max) {
                        alert(`Cannot deliver ${quantity} for ${row.cells[0].textContent.trim()} - maximum remaining is ${max}.`);
                        hasInvalidQuantity = true;
                        return; // Stop processing this row
                    }
                    deliveries.push({
                        productId: row.dataset.productId,
                        quantity: quantity
                    });
                } else if (!isNaN(quantity) && quantity < 0) {
                    alert(`Invalid negative quantity entered for ${row.cells[0].textContent.trim()}.`);
                    hasInvalidQuantity = true;
                }
            });

            if (hasInvalidQuantity) return; // Stop if validation failed

            if (deliveries.length === 0) {
                alert('Please enter a quantity greater than 0 for at least one item to record a delivery.');
                return;
            }

            if (!confirm(`You are about to record a delivery for ${deliveries.length} item(s).\n\n${deliveries.map(d => `- ${d.quantity} x Item ID ${d.productId.slice(-4)}`).join('\n')}\n\nContinue?`)) {
                return;
            }


            e.target.disabled = true;
            e.target.innerText = 'Saving...';
            const msgEl = card.querySelector('.edit-msg');
            if (msgEl) msgEl.innerText = ''; // Clear previous messages

            try {
                const res = await fetch('/api/admin/orders/record-delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order._id, deliveries })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || res.statusText);
                }
                // Success - SSE will handle UI update
                if (msgEl) {
                    msgEl.innerText = 'Delivery recorded!';
                    msgEl.style.color = 'green';
                    setTimeout(() => { if (msgEl) msgEl.innerText = ''; }, 3000);
                }
            } catch (error) {
                console.error("Error recording delivery:", error);
                alert(`Failed to record delivery: ${error.message}`);
                if (msgEl) {
                    msgEl.innerText = `Error: ${error.message}`;
                    msgEl.style.color = 'red';
                }
            } finally {
                // Re-enable button regardless of success/failure ONLY IF the card still exists
                // (SSE might have removed it if order became Delivered)
                const currentCard = document.getElementById(card.id);
                const button = currentCard?.querySelector('.record-delivery-btn');
                if (button) {
                    button.disabled = false;
                    button.innerText = 'Record Delivery';
                }
            }
            return;
        }

        if (e.target.classList.contains('view-history-btn')) {
            const historyButton = e.target;
            const orderId = JSON.parse(card.dataset.order)?._id;
            const cardStateId = getCardStateId(card, JSON.parse(card.dataset.order || '{}')); // Get the main card ID

            if (!orderId || !cardStateId) {
                console.error("Could not get order ID or card state ID.");
                alert("Error: Could not process history action.");
                return;
            }

            const currentOrder = allOrders.find(o => o._id === orderId);
            if (!currentOrder) {
                console.error(`Order with ID ${orderId} not found in allOrders array.`);
                alert("Error: Could not load history. Order not found in memory.");
                return;
            }

            const historyContainer = card.querySelector('.delivery-history-container');
            if (!historyContainer) {
                console.error("History container not found in the card.");
                return;
            }

            const isCurrentlyVisible = historyContainer.style.display === 'block';

            if (isCurrentlyVisible) {
                // Hide it
                historyContainer.style.display = 'none';
                historyButton.innerText = 'View History';
                openHistoryCardIds.delete(cardStateId); // <<< REMOVE from set when hiding
            } else {
                // Show it using the render function
                openHistoryCardIds.add(cardStateId); // <<< ADD to set when showing
                await renderDeliveryHistory(currentOrder, historyContainer, historyButton); // Render function sets text to "Hide History"
            }
            return;
        }

        // --- MODIFIED: '.revert-delivery-btn' HANDLER ---
        if (e.target.classList.contains('revert-delivery-btn')) {
            // Find the parent batch div and get its unique key
            const batchDiv = e.target.closest('div[data-group-key]');
            const uniqueGroupKey = batchDiv ? batchDiv.dataset.groupKey : null;

            // Get the latest order data
            const currentOrderData = card.dataset.order;
            const currentOrder = currentOrderData ? JSON.parse(currentOrderData) : null;

            if (!currentOrder || !uniqueGroupKey) {
                alert("Error: Cannot identify batch or order data for revert.");
                return;
            }

            // --- MODIFICATION: Find associated AND locked adjustments ---
            let adjustmentIdsToRemove = [];
            let lockedAdjustmentsFound = []; // <<< NEW
            if (currentOrder.adjustments) {
                const associatedAdjs = currentOrder.adjustments
                    .filter(adj => adj.type === 'discount' && adj.description && adj.description.startsWith(`[${uniqueGroupKey}]`));

                adjustmentIdsToRemove = associatedAdjs.map(adj => adj._id);
                lockedAdjustmentsFound = associatedAdjs.filter(adj => adj.isLocked); // <<< NEW
            }
            // --- END MODIFICATION ---

            // --- NEW: Check for locked adjustments and block if found ---
            if (lockedAdjustmentsFound.length > 0) {
                const totalLocked = lockedAdjustmentsFound.reduce((sum, adj) => sum + adj.amount, 0).toFixed(2);
                alert(
                    `Cannot revert this batch.\n\nReason: This batch has ${lockedAdjustmentsFound.length} locked payment(s) totalling ₹${totalLocked} associated with it.\n\nThis action is blocked to protect financial records.`
                );
                return; // Stop the revert process
            }
            // --- END NEW ---


            let confirmMessage = 'Are you sure you want to revert this delivery batch?\n\nThis will PERMANENTLY delete these delivery records and adjust the order\'s delivered quantities.';
            if (adjustmentIdsToRemove.length > 0) {
                confirmMessage += `\n\nIt will ALSO remove ${adjustmentIdsToRemove.length} associated payment(s) totalling ₹${currentOrder.adjustments.filter(adj => adjustmentIdsToRemove.includes(adj._id)).reduce((sum, adj) => sum + adj.amount, 0).toFixed(2)}.`;
            }

            if (!confirm(confirmMessage)) {
                return;
            }

            const btn = e.target;
            const deliveryIds = btn.dataset.deliveryIds?.split(',');
            if (!deliveryIds || deliveryIds.length === 0) {
                alert("Could not identify delivery records to revert.");
                return;
            }

            btn.disabled = true;
            btn.innerText = 'Reverting...';
            const msgEl = card.querySelector('.edit-msg');
            if (msgEl) msgEl.innerText = '';

            try {
                const res = await fetch('/api/admin/deliveries/revert-batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // --- NEW: Send adjustmentIds along with deliveryIds ---
                    body: JSON.stringify({ deliveryIds, adjustmentIdsToRemove })
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || res.statusText);
                }
                // Success - SSE will handle UI update by reloading orders
                if (msgEl) {
                    msgEl.innerText = 'Reverted! Refreshing...';
                    msgEl.style.color = 'orange';
                    setTimeout(() => { if (msgEl) msgEl.innerText = ''; }, 3000);
                }

                // <<< REVISED: Restore open state for HISTORY section >>>
                const cardStateId = getCardStateId(card, order); // Get card ID
                const historyContainer = card.querySelector('.delivery-history-container');
                const historyBtn = card.querySelector('.view-history-btn');

                if (historyContainer && historyBtn && cardStateId) { // Check if elements exist
                    if (openHistoryCardIds.has(cardStateId)) {
                        // If it's supposed to be open, ensure it is and render if empty
                        historyContainer.style.display = 'block'; // Make sure it's visible
                        historyBtn.innerText = 'Hide History';
                        // If the content is empty or just the loading message, re-render it
                        if (historyContainer.innerHTML.trim() === '' || historyContainer.innerHTML === '<p>Loading history...</p>') {
                            // Find the latest order data to pass
                            const latestOrderData = allOrders.find(o => o._id === order._id);
                            if (latestOrderData) {
                                // Use setTimeout to allow the card to be fully added to DOM first
                                setTimeout(() => renderDeliveryHistory(latestOrderData, historyContainer, historyBtn), 0);
                            } else {
                                console.warn("Could not find latest order data to re-render history for", order._id);
                                historyContainer.innerHTML = '<p style="color: red;">Error re-rendering history.</p>';
                            }
                        }
                    } else {
                        // If it's not supposed to be open, ensure it's hidden
                        historyContainer.style.display = 'none';
                        historyBtn.innerText = 'View History';
                    }
                }
                // <<< END REVISED >>>

            } catch (error) {
                console.error("Error reverting delivery:", error);
                alert(`Failed to revert delivery: ${error.message}`);
                if (msgEl) {
                    msgEl.innerText = `Error: ${error.message}`;
                    msgEl.style.color = 'red';
                }
                btn.disabled = false; // Re-enable on failure
                btn.innerText = 'Revert';
            }

            return;
        }
        // --- END MODIFIED HANDLER ---

        // --- ADD THIS NEW HANDLER BLOCK ---
        if (e.target.classList.contains('out-of-delivery-btn')) {
            const btn = e.target;
            const batchDiv = btn.closest('div[data-group-key]');
            if (!batchDiv) return;

            const groupKey = batchDiv.dataset.groupKey; // <<< Get the key
            if (groupKey) {
                outOfDeliveryBatchKeys.add(groupKey); // <<< Add key to the set
            }

            const revertBtn = batchDiv.querySelector('.revert-delivery-btn');
            if (revertBtn) {
                revertBtn.disabled = true;
                revertBtn.style.opacity = '0.5';
                revertBtn.title = 'Disabled as order is out for delivery.';
            }

            btn.disabled = true;
            btn.innerText = 'Marked as Out';
            return; // Stop further processing
        }
        // --- END OF NEW HANDLER BLOCK ---

        if (e.target.classList.contains('mark-delivered-btn')) {
            if (!order || !confirm('Are you sure you want to mark this order as fully delivered?\nThis will move it to the Delivered tab.')) return;

            const btn = e.target;
            btn.disabled = true;
            btn.innerText = 'Marking...';

            apiUpdateStatus(order._id, 'Delivered'); // Call the existing API
            // SSE will handle the UI update (moving the card)
            return;
        }

        if (e.target.classList.contains('add-delivery-deduction-btn')) {
            // Ensure 'order' uses the latest data from the card's dataset before modal
            let orderDataForModal = card.dataset.order;
            let orderForModal = orderDataForModal ? JSON.parse(orderDataForModal) : null;
            if (!orderForModal) {
                alert("Error: Cannot add deduction, order data missing.");
                return;
            }

            const deliveryIds = e.target.dataset.deliveryIds; // Still needed for API call
            const batchDiv = e.target.closest('div[data-group-key]');
            const uniqueGroupKey = batchDiv ? batchDiv.dataset.groupKey : null;

            if (!uniqueGroupKey) {
                alert("Error: Could not identify the delivery batch. Please reload.");
                return;
            }

            const defaultDescription = `Received Amount`; // Simple default for modal input

            showCustomItemModal('Amount Received for Delivery', async (description, amount) => {
                if (amount <= 0) {
                    alert("Deduction amount must be positive.");
                    return;
                }

                // Add the unique key as a prefix to the description
                const finalDescription = `[${uniqueGroupKey}] ${description || 'Received Amount'}`.substring(0, 100);

                try {
                    const res = await fetch('/api/admin/orders/add-delivery-deduction', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: orderForModal._id, // Use ID from initially read order
                            deliveryIds: deliveryIds.split(','),
                            description: finalDescription,
                            amount: amount
                        })
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || "Failed to add deduction");
                    } else {
                        // --- NEW UPDATE LOGIC ---
                        const updatedOrderFromServer = await res.json();

                        // 1. Update card dataset
                        card.dataset.order = JSON.stringify(updatedOrderFromServer);

                        // 2. Update global allOrders array
                        const orderIndex = allOrders.findIndex(o => o._id === updatedOrderFromServer._id);
                        if (orderIndex > -1) {
                            allOrders[orderIndex] = updatedOrderFromServer;
                        } else {
                            allOrders.push(updatedOrderFromServer);
                        }

                        alert('Deduction added!');
                        const cardStateId = getCardStateId(card, updatedOrderFromServer);
                        if (cardStateId) openHistoryCardIds.add(cardStateId);

                        const historyContainer = card.querySelector('.delivery-history-container');
                        const historyBtn = card.querySelector('.view-history-btn');
                        if (historyContainer && historyBtn) {
                            await renderDeliveryHistory(updatedOrderFromServer, historyContainer, historyBtn);
                        }
                        // --- END NEW UPDATE LOGIC ---
                    }
                } catch (error) {
                    console.error("Error in add-delivery-deduction:", error);
                    alert(`Failed to add deduction: ${error.message}`);
                }
            }, defaultDescription);

            return;
        }

        if (e.target.classList.contains('admin-cancel-edit-btn')) {
            if (!order) return;
            const cardStateId = getCardStateId(card, order);
            const wasOpen = openOrderCardIds.has(cardStateId);
            // Regenerate appropriate card type based on actual status
            if (order.status === 'Dispatch' || order.status === 'Partially Delivered') {
                card.innerHTML = generateStaffDispatchCardHtml(order);
            } else {
                card.innerHTML = generateStaffOrderCardHtml(order);
            }

            if (wasOpen) {
                const newBody = card.querySelector('.order-card-body');
                if (newBody) newBody.style.display = 'block';
            }
            return;
        }

        if (e.target.classList.contains('cancel-profile-edit-btn')) {
            if (card.closest('#allUsersList')) {
                loadAllUsers();
            } else if (card.closest('#noOrdersList')) {
                loadVisitedUsers();
            } else {
                loadOrders(); // Reload orders if editing profile from an order card
            }
            return;
        }


        const actions = {
            'confirm-btn': () => order && apiUpdateStatus(order._id, 'Confirmed'),
            'dispatch-btn': () => order && apiUpdateStatus(order._id, 'Dispatch'),
            'return-to-confirmed-btn': () => order && apiUpdateStatus(order._id, 'Confirmed'),
            'pause-btn': () => {
                if (!order) return;
                const description = prompt("Reason for pausing this order:");
                // Only proceed if user provides a reason (doesn't click cancel or leave empty)
                if (description && description.trim() !== '') {
                    const timestamp = formatDate(new Date()); // MODIFIED
                    const reason = `[${timestamp}] - ${description.trim()}`;
                    apiUpdateStatus(order._id, 'Paused', { reason });
                } else if (description !== null) { // User clicked OK but left it empty
                    alert("Please provide a reason to pause the order.");
                }
            },
            'hold-btn': () => {
                if (!order) return;
                const description = prompt("Reason for putting this order on hold:");
                if (description && description.trim() !== '') {
                    const timestamp = formatDate(new Date()); // MODIFIED
                    const reason = `[${timestamp}] - ${description.trim()}`;
                    apiUpdateStatus(order._id, 'Hold', { reason });
                } else if (description !== null) {
                    alert("Please provide a reason to put the order on hold.");
                }
            },
            'cancel-btn': () => order && confirm('Are you sure you want to cancel this order?') && apiUpdateStatus(order._id, 'Cancelled'),
            'cancel-rate-request-btn': () => order && confirm('Cancel the rate request and return to Pending status?') && apiUpdateStatus(order._id, 'Pending'), // Add confirm
            'save-agent-btn': () => {
                if (!order) return;
                const agentName = card.querySelector('.agent-name-input')?.value;
                const agentMobile = card.querySelector('.agent-mobile-input')?.value;
                const agentDescription = card.querySelector('.agent-desc-input')?.value;
                // Pass card to get address inside apiAssignAgent
                apiAssignAgent(order._id, agentName, agentMobile, agentDescription, card);
            },
            'edit-pause-reason-btn': () => {
                if (!order) return;
                const newDescription = prompt("Enter new reason (the old reason will be replaced):");
                if (newDescription && newDescription.trim() !== '') {
                    const timestamp = formatDate(new Date()); // MODIFIED
                    const reason = `[${timestamp}] - ${newDescription.trim()}`;
                    apiUpdateStatus(order._id, order.status, { reason }); // Use current status
                } else if (newDescription !== null) {
                    alert("Please provide a new reason.");
                }
            },
            // ... (rest of the actions object)
            'hold-btn': () => {
                if (!order) return;
                const description = prompt("Reason for putting this order on hold:");
                if (description && description.trim() !== '') {
                    const timestamp = new Date().toLocaleString();
                    const reason = `[${timestamp}] - ${description.trim()}`;
                    apiUpdateStatus(order._id, 'Hold', { reason });
                } else if (description !== null) {
                    alert("Please provide a reason to put the order on hold.");
                }
            },
            'cancel-btn': () => order && confirm('Are you sure you want to cancel this order?') && apiUpdateStatus(order._id, 'Cancelled'),
            'cancel-rate-request-btn': () => order && confirm('Cancel the rate request and return to Pending status?') && apiUpdateStatus(order._id, 'Pending'), // Add confirm
            'save-agent-btn': () => {
                if (!order) return;
                const agentName = card.querySelector('.agent-name-input')?.value;
                const agentMobile = card.querySelector('.agent-mobile-input')?.value;
                const agentDescription = card.querySelector('.agent-desc-input')?.value;
                // Pass card to get address inside apiAssignAgent
                apiAssignAgent(order._id, agentName, agentMobile, agentDescription, card);
            },
            'edit-pause-reason-btn': () => {
                if (!order) return;
                const newDescription = prompt("Enter new reason (the old reason will be replaced):");
                if (newDescription && newDescription.trim() !== '') {
                    const timestamp = new Date().toLocaleString();
                    const reason = `[${timestamp}] - ${newDescription.trim()}`;
                    apiUpdateStatus(order._id, order.status, { reason }); // Use current status
                } else if (newDescription !== null) {
                    alert("Please provide a new reason.");
                }
            },
            'admin-edit-order-btn': async () => {
                if (!order) return;

                // Keep the status check for staff
                const editableStates = ['Pending', 'Paused', 'Hold', 'Rate Approved', 'Confirmed', 'Dispatch', 'Partially Delivered'];
                if (!editableStates.includes(order.status)) {
                    alert(`Cannot edit items when order status is ${order.status}.`);
                    return;
                }

                const cardStateId = getCardStateId(card, order);
                if (cardStateId) openOrderCardIds.add(cardStateId);

                const isDispatchCard = card.querySelector('.dispatch-item-row');

                if (isDispatchCard) {
                    const container = card.querySelector('.order-details-container');
                    if (container) {
                        // Generate the *full* edit view HTML (header + body) for STAFF
                        const fullEditHtml = await generateStaffEditViewHtml(order);

                        // Create a temporary element to parse the HTML
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = fullEditHtml;

                        // Find the body content *within* the parsed HTML
                        const editBodyElement = tempDiv.querySelector('.order-card-body');

                        if (editBodyElement) {
                            // Replace the container's content with the edit body's content
                            container.innerHTML = editBodyElement.innerHTML;

                            // Ensure the dropdown is updated correctly *within the container*
                            updateProductDropdown(container);

                            // Add the input listener to the container
                            container.addEventListener('input', (e) => {
                                if (!e.target.classList.contains('qty-input')) return;

                                const li = e.target.closest('li');
                                if (!li) return;
                                const productId = li.dataset.productId;
                                const newOrderedQty = parseFloat(e.target.value) || 0;

                                // Find the corresponding row in the dispatch table (using 'card' is correct here)
                                const row = card.querySelector(`.dispatch-item-row[data-product-id="${productId}"]`);
                                if (!row) return; // Item might be newly added

                                // Get delivered qty from the table cell
                                const deliveredQtyText = row.cells[2].textContent || '';
                                const deliveredQty = parseFloat(deliveredQtyText) || 0;
                                const unit = deliveredQtyText.replace(/[\d.-]/g, '').trim();

                                // Calculate and update remaining in the table cell
                                const newRemaining = newOrderedQty - deliveredQty;
                                row.cells[3].textContent = `${newRemaining.toFixed(2)} ${unit}`;

                                // Update max on the "Delivering Now" input
                                const dispatchInput = row.cells[4].querySelector('.dispatch-qty-input');
                                if (dispatchInput) {
                                    dispatchInput.max = newRemaining;
                                    dispatchInput.disabled = newRemaining <= 0;
                                }
                            });
                        } else {
                            console.error("[Staff] Could not find .order-card-body in generated edit HTML.");
                            // Fallback: Replace the whole card (less ideal)
                            card.innerHTML = fullEditHtml;
                            updateProductDropdown(card);
                        }
                    } else {
                        console.error("[Staff] Could not find .order-details-container.");
                        // Fallback: Replace the whole card
                        card.innerHTML = await generateStaffEditViewHtml(order);
                        updateProductDropdown(card);
                    }
                } else {
                    // Original behavior for non-dispatch cards
                    card.innerHTML = await generateStaffEditViewHtml(order);
                    updateProductDropdown(card);
                }
            },
            'admin-save-changes-btn': async () => {
                if (!order) return;
                let isPriceChanged = false;
                const saveButton = e.target; // Get ref to button
                saveButton.disabled = true; // Disable button immediately
                saveButton.innerText = 'Saving...';

                const getItemsFromList = (selector) => {
                    return Array.from(card.querySelectorAll(selector)).map(li => {
                        const priceInput = li.querySelector('.price-input');
                        const qtyInput = li.querySelector('.qty-input');
                        const newPrice = parseFloat(priceInput?.value);
                        const originalPrice = parseFloat(li.dataset.originalPrice);
                        // Check if price actually changed
                        if (!isNaN(newPrice) && !isNaN(originalPrice) && newPrice !== originalPrice) {
                            isPriceChanged = true;
                        }
                        return {
                            productId: li.dataset.productId,
                            quantity: qtyInput?.value,
                            price: newPrice
                        };
                    });
                };

                const updatedItems = [
                    ...getItemsFromList('.edit-item-list li'),
                    ...getItemsFromList('.new-item-list li')
                ].filter(item => item.quantity > 0 && item.price >= 0); // Validate items

                if (updatedItems.length === 0) {
                    alert("Cannot save with empty items or invalid quantities/prices.");
                    saveButton.disabled = false; // Re-enable
                    saveButton.innerText = isPriceChanged ? 'Request Rate Change' : 'Save Changes';
                    return;
                }


                const endpoint = isPriceChanged ? '/api/admin/orders/request-rate-change' : '/api/admin/orders/edit';
                const method = isPriceChanged ? 'PATCH' : 'PUT';
                const successMsg = isPriceChanged ? 'Rate change requested!' : 'Order updated!';
                const errorMsgPrefix = isPriceChanged ? 'Failed to request rate change' : 'Failed to save changes';

                try {
                    const res = await fetch(endpoint, {
                        method, headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: order._id, updatedItems })
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || res.statusText);
                    }
                    alert(successMsg); // Give feedback
                } catch (error) {
                    console.error(`${errorMsgPrefix}:`, error);
                    alert(`${errorMsgPrefix}: ${error.message}`);
                    saveButton.disabled = false; // Re-enable on error
                    saveButton.innerText = isPriceChanged ? 'Request Rate Change' : 'Save Changes';
                    saveButton.style.backgroundColor = isPriceChanged ? '#e83e8c' : ''; // Keep color if rate change failed
                }
            },
            'view-profile-btn': async () => {
                const userId = e.target.dataset.userId || card.dataset.userId;
                if (!userId) {
                    alert("Could not find user ID.");
                    return;
                }
                const cardStateId = getCardStateId(card, order);
                if (cardStateId) openOrderCardIds.add(cardStateId);

                try {
                    const res = await fetch(`/api/admin/users/${userId}`);
                    if (!res.ok) throw new Error('Failed to fetch user profile.');
                    const userProfileData = await res.json();
                    card.innerHTML = generateUserProfileDisplayHtml(userProfileData);
                } catch (error) {
                    alert(error.message);
                    if (cardStateId) openOrderCardIds.delete(cardStateId);
                }
            },
            'show-edit-form-btn': async () => {
                const userId = e.target.dataset.userId;
                if (!userId) {
                    alert("Could not find user ID to edit.");
                    return;
                }
                const cardStateId = getCardStateId(card, order);
                if (cardStateId) openOrderCardIds.add(cardStateId);

                try {
                    const res = await fetch(`/api/admin/users/${userId}`);
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || `Failed to fetch profile (${res.status})`);
                    }
                    const userProfileData = await res.json();
                    card.innerHTML = generateUserProfileEditHtml(userProfileData);

                    const districtSelect = card.querySelector('#prof_district');
                    const talukSelect = card.querySelector('#prof_taluk');
                    if (districtSelect && talukSelect) {
                        try {
                            const locRes = await fetch('/api/locations');
                            const locations = await locRes.json();
                            districtSelect.innerHTML = '<option value="">Select district</option>';
                            const sortedDistricts = Object.keys(locations).sort();
                            for (const d of sortedDistricts) {
                                const opt = document.createElement('option');
                                opt.value = d;
                                opt.textContent = d;
                                districtSelect.appendChild(opt);
                            }
                            districtSelect.value = districtSelect.dataset.current || "";
                            const populateTaluks = () => {
                                talukSelect.innerHTML = '<option value="">Select taluk</option>';
                                const selectedDistrict = districtSelect.value;
                                const talukList = locations[selectedDistrict] || [];
                                const sortedTaluks = talukList.sort();
                                for (const t of sortedTaluks) {
                                    const opt = document.createElement('option');
                                    opt.value = t;
                                    opt.textContent = t;
                                    talukSelect.appendChild(opt);
                                }
                                talukSelect.value = talukSelect.dataset.current || "";
                            };
                            districtSelect.addEventListener('change', populateTaluks);
                            populateTaluks();

                        } catch (locError) {
                            console.error("Error fetching locations for profile edit:", locError);
                            districtSelect.innerHTML = '<option value="">Error loading</Goption>';
                            talukSelect.innerHTML = '<option value="">Error loading</Goption>';
                        }
                    }
                } catch (error) {
                    console.error("Error loading profile for edit:", error);
                    alert(`Could not load profile: ${error.message}`);
                    if (cardStateId) openOrderCardIds.delete(cardStateId);
                }
            },
            'cancel-profile-view-btn': () => {
                if (card.closest('#allUsersList')) {
                    loadAllUsers();
                } else if (card.closest('#noOrdersList')) {
                    loadVisitedUsers();
                } else {
                    loadOrders();
                }
            },
            'save-profile-btn': async () => {
                let userId;
                if (order && order.user) { // Check existence
                    userId = order.user._id;
                } else {
                    userId = card.dataset.userId || e.target.dataset.userId;
                }

                if (!userId) {
                    alert("Error: Cannot determine user to save.");
                    return;
                }

                const msgEl = card.querySelector('.profile-edit-msg');
                if (msgEl) msgEl.innerText = ''; // Clear message

                // --- Read data from edit form inputs ---
                const name = card.querySelector('#prof_name')?.value.trim() || '';
                const altMobile = card.querySelector('#prof_altMobile')?.value.trim() || '';
                const email = card.querySelector('#prof_email')?.value.trim() || '';
                const district = card.querySelector('#prof_district')?.value || '';
                const taluk = card.querySelector('#prof_taluk')?.value || '';
                const address = card.querySelector('#prof_address')?.value.trim() || '';
                const pincode = card.querySelector('#prof_pincode')?.value.trim() || '';
                // --- End read data ---


                // --- Validation ---
                if (altMobile && (altMobile.length !== 10 || !/^\d{10}$/.test(altMobile))) {
                    if (msgEl) msgEl.innerText = 'Alternative mobile must be 10 digits.'; return;
                }
                if (name.length > 29) {
                    if (msgEl) msgEl.innerText = 'Name must be 29 characters or less.'; return;
                }
                if (email && !/\S+@\S+\.\S+/.test(email)) {
                    if (msgEl) msgEl.innerText = 'Invalid email format.'; return;
                }
                if (address.length > 150) {
                    if (msgEl) msgEl.innerText = 'Address must be 150 characters or less.'; return;
                }
                if (pincode && (pincode.length !== 6 || !/^\d{6}$/.test(pincode))) {
                    if (msgEl) msgEl.innerText = 'Pincode must be 6 digits.'; return;
                }
                // --- End Validation ---

                const profileData = { name, altMobile, email, district, taluk, address, pincode };

                const saveBtn = e.target;
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving...';


                try {
                    // Use admin endpoint for saving
                    const res = await fetch(`/api/admin/users/${userId}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(profileData)
                    });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || res.statusText);
                    }

                    if (msgEl) {
                        msgEl.innerText = 'Profile saved successfully! Reloading list...';
                        msgEl.style.color = 'green';
                    }
                    // Trigger a reload of the relevant list after a short delay
                    setTimeout(() => {
                        if (card.closest('#allUsersList')) loadAllUsers();
                        else if (card.closest('#noOrdersList')) loadVisitedUsers();
                        else loadOrders(); // Reload orders if edited from an order card
                    }, 1500); // Reload happens instead of manually switching view

                } catch (error) {
                    console.error("Error saving profile:", error);
                    if (msgEl) {
                        msgEl.innerText = `Error: ${error.message}`;
                        msgEl.style.color = 'red';
                    }
                    saveBtn.disabled = false; // Re-enable button on error
                    saveBtn.innerText = 'Save Profile';
                }
            },
        };

        for (const cls in actions) {
            if (e.target.classList.contains(cls)) {
                actions[cls]();
                break;
            }
        }
    });

    async function renderDeliveryHistory(orderToRender, containerElement, buttonElement) {
        if (!orderToRender || !containerElement || !buttonElement) {
            console.error("renderDeliveryHistory called with invalid arguments.");
            return;
        }

        buttonElement.disabled = true;
        buttonElement.innerText = 'Loading History...';
        containerElement.innerHTML = '<p>Loading history...</p>';
        containerElement.style.display = 'block';

        try {
            const res = await fetch(`/api/admin/orders/${orderToRender._id}/history`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const history = await res.json();

            let historyHtml = '<h4>Delivery History</h4>';

            const groupedHistory = new Map();
            for (const h of history) {
                if (!h.deliveryAgent || !h.deliveryAgent.name || !h.deliveryDate || !h.product || !h.product.name) {
                    console.warn("Skipping history item due to missing data:", h); continue;
                }
                const deliveryTime = new Date(h.deliveryDate).getTime();
                const roundedTime = new Date(Math.round(deliveryTime / 10000) * 10000).toISOString();
                const key = `${h.deliveryAgent.name}-${roundedTime}`;

                if (!groupedHistory.has(key)) {
                    groupedHistory.set(key, { groupKey: key, date: new Date(h.deliveryDate), agent: h.deliveryAgent, items: [], deliveryIds: [] });
                }
                groupedHistory.get(key).items.push({ name: h.product.name, description: h.product.description || '', quantity: h.quantityDelivered, unit: h.product.unit || '' });
                groupedHistory.get(key).deliveryIds.push(h._id);
            }

            const sortedGroupEntries = Array.from(groupedHistory.entries()).sort(([, a], [, b]) => b.date.getTime() - a.date.getTime());

            let agentCounter = 1;

            if (sortedGroupEntries.length === 0) {
                historyHtml += '<p>No deliveries have been recorded for this order yet.</p>';
            } else {
                sortedGroupEntries.forEach(([, entry]) => {
                    const uniqueGroupKey = entry.groupKey;
                    let batchAdjustments = [];
                    if (orderToRender.adjustments && uniqueGroupKey) {
                        batchAdjustments = orderToRender.adjustments
                            .filter(adj => adj.type === 'discount' && adj.description && adj.description.startsWith(`[${uniqueGroupKey}]`));
                    }

                    const totalReceivedAmount = batchAdjustments.reduce((sum, adj) => sum + adj.amount, 0);

                    let receivedBtnText = "Received Amount";
                    let receivedBtnStyle = "background-color: #ffeaea; color: #dc3545;";
                    if (totalReceivedAmount > 0) {
                        receivedBtnText = `Received: ₹${totalReceivedAmount.toFixed(2)}`;
                        receivedBtnStyle = "background-color: #e9f5e9; color: #28a745; border: 1px solid #a3d3a3;";
                    }

                    const displayAgentName = `Agent ${agentCounter++}`;
                    const agentOriginalInfo = `${entry.agent.name}${entry.agent.mobile ? ` (${entry.agent.mobile})` : ''}`;
                    const deliveryIds = entry.deliveryIds.join(',');

                    const agentInfo = `${displayAgentName} <small>(${agentOriginalInfo})</small>
                        ${entry.agent.description ? `<br><small><strong>Note:</strong> ${entry.agent.description}</small>` : ''}
                        ${entry.agent.address ? `<br><small><strong>Address:</strong> ${entry.agent.address}</small>` : ''}`;

                    const formattedDate = formatDate(entry.date); // MODIFIED

                    // Check if this batch key is in our client-side set
                    const isOutOfDelivery = outOfDeliveryBatchKeys.has(uniqueGroupKey);

                    // Set button states based on isOutOfDelivery
                    const revertBtnDisabledAttr = isOutOfDelivery ? 'disabled' : '';
                    const revertBtnStyle = isOutOfDelivery ? 'opacity: 0.5;' : 'color:red;';
                    const revertBtnTitle = isOutOfDelivery ? 'Disabled as order is out for delivery.' : '';

                    const outBtnDisabledAttr = isOutOfDelivery ? 'disabled' : '';
                    const outBtnText = isOutOfDelivery ? 'Marked as Out' : 'Out of Delivery';
                    const outBtnStyle = "background-color:#fd7e14; color:white;";


                    historyHtml += `
                        <div style="border: 1px solid #ccc; border-radius: 5px; padding: 10px; margin-bottom: 10px; background-color: #f9f9f9; position: relative;" data-group-key="${uniqueGroupKey}">
                            <h5 style="margin: 0 0 8px 0; padding-bottom: 5px; border-bottom: 1px solid #ddd; color: #333;">
                                <button class="revert-delivery-btn small-btn" style="${revertBtnStyle}" data-delivery-ids="${deliveryIds}" ${revertBtnDisabledAttr} title="${revertBtnTitle}">Revert</button>
                                <button class="out-of-delivery-btn small-btn" style="${outBtnStyle}" ${outBtnDisabledAttr}>${outBtnText}</button>
                                <div style="float: right;">
                                     <button class="add-delivery-deduction-btn small-btn" style="${receivedBtnStyle}" data-delivery-ids="${deliveryIds}">${receivedBtnText}</button>
                                </div>
                                <span style="font-weight: bold; font-size: 1.1em;">${agentInfo}</span><br>
                                <small>${formattedDate}</small>
                            </h5>
                            <ul style="margin: 0; padding-left: 20px; font-size: 0.9em; list-style-type: disc;">`;

                    entry.items.forEach(item => {
                        const descriptionHtml = item.description ? ` (${item.description})` : '';
                        historyHtml += `<li style="margin-bottom: 5px;"><strong>${item.name}${descriptionHtml}</strong> - ${item.quantity} ${item.unit}</li>`;
                    });

                    // --- MODIFICATION START ---
                    // Remove lock button/status from history view for adjustments
                    if (batchAdjustments.length > 0) {
                        const adjustmentListHtml = batchAdjustments.map((adj, index) => {
                            const style = (index === 0) ? 'margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc;' : '';
                            // Only show remove button if NOT locked (still needed for revert check)
                            const removeBtnHtml = adj.isLocked ? '' : `<button class="remove-adjustment-btn" data-id="${adj._id}" style="color:red; border:none; background:transparent; cursor:pointer; font-weight: bold; margin-left: 10px;">&times;</button>`;
                            const displayDesc = adj.description.startsWith(`[${uniqueGroupKey}]`)
                                ? adj.description.substring(uniqueGroupKey.length + 2).trim()
                                : adj.description;

                            // ** Removed lockStatusHtml variable and usage **
                            return `
                                <li style="${style} list-style-type: none; text-align: right; color: #dc3545; display: flex; justify-content: flex-end; align-items: center; gap: 5px;">
                                    <span>${displayDesc || 'Received Amount'}:</span>
                                    <span style="font-weight: bold;">- ₹${adj.amount.toFixed(2)}</span>
                                    ${removeBtnHtml} 
                                </li>
                            `;
                        }).join('');
                        historyHtml += adjustmentListHtml;


                        if (batchAdjustments.length > 1) {
                            historyHtml += `
                                <li style="list-style-type: none; text-align: right; font-weight: bold; color: #28a745; border-top: 1px solid #eee; padding-top: 5px; margin-top: 5px;">
                                    Batch Total: ₹${totalReceivedAmount.toFixed(2)}
                                </li>
                             `;
                        }
                    }
                    // --- MODIFICATION END ---
                    historyHtml += `</ul></div>`;
                });
            }
            containerElement.innerHTML = historyHtml;
            containerElement.style.display = 'block';
            buttonElement.innerText = 'Hide History';

        } catch (error) {
            console.error("Error fetching or rendering history:", error);
            containerElement.innerHTML = `<p style="color: red;">Error loading history: ${error.message}</p>`;
            containerElement.style.display = 'block';
            buttonElement.innerText = 'View History';
        } finally {
            buttonElement.disabled = false;
        }
    }

    async function apiUpdateStatus(orderId, status, bodyData = {}) {
        const msgEl = document.querySelector(`#order-${orderId} .edit-msg`); // Find message area in card
        if (msgEl) msgEl.innerText = 'Updating status...';
        try {
            const res = await fetch(`/api/admin/orders/update-status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status, ...bodyData })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || res.statusText);
            }
        } catch (error) {
            console.error(`Error updating status to ${status}:`, error);
            alert(`Failed to update status: ${error.message}`);
            if (msgEl) {
                msgEl.innerText = `Error: ${error.message}`;
                msgEl.style.color = 'red';
            }
        }
    }


    async function apiAssignAgent(orderId, agentName, agentMobile, agentDescription, card) {
        const agentAddress = card.querySelector('.agent-address-input')?.value;
        const msgEl = card.querySelector('.edit-msg');
        const saveBtn = card.querySelector('.save-agent-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';
        }
        if (msgEl) msgEl.innerText = '';


        if (!agentName) {
            alert("Agent name is required.");
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = 'Save Agent'; }
            return;
        }

        try {
            const res = await fetch('/api/admin/orders/assign-agent', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, agentName, agentMobile, agentDescription, agentAddress })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || res.statusText);
            }
            if (msgEl) {
                msgEl.innerText = 'Agent saved!'; msgEl.style.color = 'green';
            }
            const container = card.querySelector('.agent-form-container');
            if (container) container.style.display = 'none';
            const showBtn = card.querySelector('.show-agent-form-btn');
            if (showBtn) showBtn.innerText = 'Edit Agent';

        } catch (error) {
            console.error("Error saving agent:", error);
            if (msgEl) {
                msgEl.innerText = `Error: ${error.message}`; msgEl.style.color = 'red';
            }
        } finally {
            const container = card.querySelector('.agent-form-container');
            if (container && container.style.display !== 'none' && saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save Agent';
            }
            if (msgEl) {
                setTimeout(() => { if (msgEl) msgEl.innerText = ''; }, 3000);
            }
        }
    }

    // Attach navigation listeners
    Object.keys(navButtons).forEach(key => {
        if (navButtons[key]) {
            navButtons[key].addEventListener('click', () => showSection(key));
        } else {
            console.warn(`Navigation button not found for key: ${key}`);
        }
    });


    if (staffLoginForm) {
        staffLoginForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (!usernameInput || !passwordInput) return; // Guard

            const submitButton = staffLoginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerText = 'Logging in...';
            loginMsg.innerText = '';


            try {
                const res = await fetch('/api/staff/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
                });
                if (res.ok) {
                    showStaffPanel();
                } else {
                    const err = await res.json();
                    loginMsg.innerText = err.error || 'Invalid login';
                    submitButton.disabled = false;
                    submitButton.innerText = 'Login';
                }
            } catch (error) {
                console.error("Login fetch error:", error);
                loginMsg.innerText = 'Network error during login.';
                submitButton.disabled = false;
                submitButton.innerText = 'Login';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logoutBtn.disabled = true; // Prevent multiple clicks
            try {
                await fetch('/api/staff/logout', { method: 'POST' });
                showLoginBox(); // Transition UI after successful logout
            } catch (error) {
                console.error("Logout error:", error);
                alert("Logout failed. Please try again.");
            } finally {
                // Ensure button is re-enabled even if error occurs,
                // but only if the logout button still exists (might not if UI changed)
                const currentLogoutBtn = document.getElementById('logoutBtn');
                if (currentLogoutBtn) currentLogoutBtn.disabled = false;
            }
        });
    }

    // ========== CREATE ORDER SECTION (Same as Admin) ==========
    let selectedUser = null;
    let orderCart = [];
    let allUsersForSearch = [];

    // Load all users for search
    async function loadAllUsersForSearch() {
        try {
            const res = await fetch('/api/admin/all-users');
            if (res.ok) {
                allUsersForSearch = await res.json();
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    // User search with debouncing
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchResults = document.getElementById('userSearchResults');
    let searchTimeout;

    if (userSearchInput) {
        userSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim().toLowerCase();

            if (query.length < 2) {
                userSearchResults.innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(() => {
                const results = allUsersForSearch.filter(user =>
                    user.mobile.includes(query) ||
                    (user.name && user.name.toLowerCase().includes(query))
                ).slice(0, 10);

                if (results.length === 0) {
                    userSearchResults.innerHTML = '<p style="color: #888;">No users found</p>';
                } else {
                    userSearchResults.innerHTML = results.map(user => `
                        <div class="user-search-result" data-user-id="${user._id}" style="padding: 8px; border: 1px solid #ddd; margin: 5px 0; cursor: pointer; border-radius: 3px;">
                            <strong>${user.name || 'Unnamed'}</strong><br>
                            <small>${user.mobile}</small>
                        </div>
                    `).join('');
                }
            }, 300);
        });
    }

    // Select user from search results
    if (userSearchResults) {
        userSearchResults.addEventListener('click', (e) => {
            const resultDiv = e.target.closest('.user-search-result');
            if (resultDiv) {
                const userId = resultDiv.dataset.userId;
                const user = allUsersForSearch.find(u => u._id === userId);
                if (user) {
                    selectUser(user);
                }
            }
        });
    }

    // Show/hide new user form
    const showNewUserFormBtn = document.getElementById('showNewUserFormBtn');
    const newUserForm = document.getElementById('newUserForm');

    // Location data for dropdowns
    let LOCS = {};

    // Load locations for district/taluk dropdowns
    async function loadLocationsForNewUser() {
        try {
            const res = await fetch('/api/locations');
            if (res.ok) {
                LOCS = await res.json();
                const districtSelect = document.getElementById('newUserDistrict');
                districtSelect.innerHTML = '<option value="">Select District</option>';
                const sortedDistricts = Object.keys(LOCS).sort();
                for (const d of sortedDistricts) {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = d;
                    districtSelect.appendChild(opt);
                }
            }
        } catch (error) {
            console.error('Error loading locations:', error);
        }
    }

    // Handle district change to populate taluks
    const newUserDistrictSelect = document.getElementById('newUserDistrict');
    const newUserTalukSelect = document.getElementById('newUserTaluk');

    if (newUserDistrictSelect) {
        newUserDistrictSelect.addEventListener('change', () => {
            newUserTalukSelect.innerHTML = '<option value="">Select Taluk</option>';
            const selectedDistrict = newUserDistrictSelect.value;
            const talukList = LOCS[selectedDistrict] || [];
            const sortedTaluks = talukList.sort();
            for (const t of sortedTaluks) {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                newUserTalukSelect.appendChild(opt);
            }
        });
    }

    if (showNewUserFormBtn) {
        showNewUserFormBtn.addEventListener('click', () => {
            newUserForm.style.display = 'block';
            userSearchInput.value = '';
            userSearchResults.innerHTML = '';
            loadLocationsForNewUser(); // Load locations when form is shown
        });
    }
    const cancelNewUserBtn = document.getElementById('cancelNewUserBtn');

    if (cancelNewUserBtn) {
        cancelNewUserBtn.addEventListener('click', () => {
            newUserForm.style.display = 'none';
            document.getElementById('newUserMobile').value = '';
            document.getElementById('newUserAltMobile').value = '';
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserEmail').value = '';
            document.getElementById('newUserDistrict').value = '';
            document.getElementById('newUserTaluk').value = '';
            document.getElementById('newUserPincode').value = '';
            document.getElementById('newUserAddress').value = '';
            document.getElementById('newUserMsg').textContent = '';
        });
    }

    // Create new user
    const createNewUserBtn = document.getElementById('createNewUserBtn');
    const newUserMsg = document.getElementById('newUserMsg');

    if (createNewUserBtn) {
        createNewUserBtn.addEventListener('click', async () => {
            const mobile = document.getElementById('newUserMobile').value.trim();
            const altMobile = document.getElementById('newUserAltMobile').value.trim();
            const name = document.getElementById('newUserName').value.trim();
            const email = document.getElementById('newUserEmail').value.trim();
            const district = document.getElementById('newUserDistrict').value.trim();
            const taluk = document.getElementById('newUserTaluk').value.trim();
            const pincode = document.getElementById('newUserPincode').value.trim();
            const address = document.getElementById('newUserAddress').value.trim();

            if (!mobile || !/^\d{10}$/.test(mobile)) {
                newUserMsg.textContent = 'Please enter a valid 10-digit mobile number';
                newUserMsg.style.color = 'red';
                return;
            }

            try {
                const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mobile, altMobile, name, email, district, taluk, pincode, address })
                });

                const data = await res.json();

                if (res.ok) {
                    newUserMsg.textContent = 'User created successfully!';
                    newUserMsg.style.color = 'green';
                    newUserForm.style.display = 'none';
                    loadAllUsersForSearch();
                    selectUser(data.user);
                    document.getElementById('newUserMobile').value = '';
                    document.getElementById('newUserAltMobile').value = '';
                    document.getElementById('newUserName').value = '';
                    document.getElementById('newUserEmail').value = '';
                    document.getElementById('newUserDistrict').value = '';
                    document.getElementById('newUserTaluk').value = '';
                    document.getElementById('newUserPincode').value = '';
                    document.getElementById('newUserAddress').value = '';
                } else {
                    newUserMsg.textContent = data.error || 'Error creating user';
                    newUserMsg.style.color = 'red';
                }
            } catch (error) {
                console.error('Error creating user:', error);
                newUserMsg.textContent = 'Server error creating user';
                newUserMsg.style.color = 'red';
            }
        });
    }

    // Select user and show order building section
    function selectUser(user) {
        selectedUser = user;
        document.getElementById('selectedUserInfo').textContent = `${user.name || 'Unnamed'} (${user.mobile})`;
        document.getElementById('selectedUserDisplay').style.display = 'block';
        document.getElementById('orderBuildingCard').style.display = 'block';
        userSearchInput.value = '';
        userSearchResults.innerHTML = '';

        populateProductDropdown();
    }

    // Change user button
    const changeUserBtn = document.getElementById('changeUserBtn');
    if (changeUserBtn) {
        changeUserBtn.addEventListener('click', () => {
            selectedUser = null;
            document.getElementById('selectedUserDisplay').style.display = 'none';
            document.getElementById('orderBuildingCard').style.display = 'none';
            orderCart = [];
            updateCartDisplay();
        });
    }

    // Populate product dropdown with prices
    async function populateProductDropdown() {
        const productSelect = document.getElementById('productSelectCreate');
        if (!productSelect) return;

        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                const products = await res.json();
                const visibleProducts = products.filter(p => p.isVisible);

                productSelect.innerHTML = '<option value="">-- Select Product --</option>' +
                    visibleProducts.map(p => {
                        const desc = p.description ? ` - ${p.description}` : '';
                        return `<option value="${p._id}">${p.name}${desc} (₹${p.price}/${p.unit || 'unit'})</option>`;
                    }).join('');
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    // Product selection change
    const productSelectCreate = document.getElementById('productSelectCreate');
    const selectedProductInfo = document.getElementById('selectedProductInfo');

    if (productSelectCreate) {
        productSelectCreate.addEventListener('change', async (e) => {
            const productId = e.target.value;

            if (!productId) {
                selectedProductInfo.style.display = 'none';
                return;
            }

            try {
                const res = await fetch('/api/products');
                if (res.ok) {
                    const products = await res.json();
                    const product = products.find(p => p._id === productId);

                    if (product) {
                        document.getElementById('productInfoName').textContent = product.name;
                        document.getElementById('productInfoDesc').textContent = product.description || 'N/A';
                        document.getElementById('productInfoUnit').textContent = product.unit || 'unit';
                        document.getElementById('productPrice').value = product.price;
                        document.getElementById('productQuantity').value = 1;
                        selectedProductInfo.style.display = 'block';
                        selectedProductInfo.dataset.productId = productId;
                        selectedProductInfo.dataset.productName = product.name;
                        selectedProductInfo.dataset.productDesc = product.description || '';
                        selectedProductInfo.dataset.productUnit = product.unit || '';
                    }
                }
            } catch (error) {
                console.error('Error fetching product details:', error);
            }
        });
    }

    // Add product to cart
    const addProductToCartBtn = document.getElementById('addProductToCartBtn');
    if (addProductToCartBtn) {
        addProductToCartBtn.addEventListener('click', () => {
            const productId = selectedProductInfo.dataset.productId;
            const productName = selectedProductInfo.dataset.productName;
            const productDesc = selectedProductInfo.dataset.productDesc;
            const productUnit = selectedProductInfo.dataset.productUnit;
            const quantity = parseFloat(document.getElementById('productQuantity').value);
            const price = parseFloat(document.getElementById('productPrice').value);

            if (!productId || quantity <= 0 || price < 0) {
                alert('Please select a product and enter valid quantity and price');
                return;
            }

            const existingIndex = orderCart.findIndex(item => item.productId === productId);

            if (existingIndex > -1) {
                orderCart[existingIndex].quantity += quantity;
            } else {
                orderCart.push({
                    productId,
                    productName,
                    description: productDesc,
                    unit: productUnit,
                    quantity,
                    price
                });
            }

            updateCartDisplay();
            productSelectCreate.value = '';
            selectedProductInfo.style.display = 'none';
        });
    }

    // Update cart display
    function updateCartDisplay() {
        const cartItemsList = document.getElementById('cartItemsList');
        const cartTotal = document.getElementById('cartTotal');

        if (orderCart.length === 0) {
            cartItemsList.innerHTML = '<li style="color: #888;">Cart is empty</li>';
            cartTotal.textContent = '';
            return;
        }

        let total = 0;
        cartItemsList.innerHTML = orderCart.map((item, index) => {
            const itemTotal = item.quantity * item.price;
            total += itemTotal;
            return `
                <li style="padding: 8px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${item.productName}</strong><br>
                        <small>${item.quantity} ${item.unit} × ₹${item.price.toFixed(2)} = ₹${itemTotal.toFixed(2)}</small>
                    </div>
                    <button class="remove-cart-item" data-index="${index}" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Remove</button>
                </li>
            `;
        }).join('');

        cartTotal.innerHTML = `<strong>Total: ₹${total.toFixed(2)}</strong>`;
    }

    // Remove item from cart
    const cartItemsList = document.getElementById('cartItemsList');
    if (cartItemsList) {
        cartItemsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-cart-item')) {
                const index = parseInt(e.target.dataset.index);
                orderCart.splice(index, 1);
                updateCartDisplay();
            }
        });
    }

    // Clear cart
    const clearCartBtn = document.getElementById('clearCartBtn');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the cart?')) {
                orderCart = [];
                updateCartDisplay();
            }
        });
    }

    // Submit order
    const submitOrderBtn = document.getElementById('submitOrderBtn');
    const orderSubmitMsg = document.getElementById('orderSubmitMsg');

    if (submitOrderBtn) {
        submitOrderBtn.addEventListener('click', async () => {
            if (!selectedUser) {
                alert('Please select a user first');
                return;
            }

            if (orderCart.length === 0) {
                alert('Please add at least one product to the cart');
                return;
            }

            const orderType = document.querySelector('input[name="orderType"]:checked').value;
            const endpoint = orderType === 'rate-request'
                ? '/api/admin/orders/create-for-user-rate-request'
                : '/api/admin/orders/create-for-user';

            const items = orderCart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price
            }));

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: selectedUser._id,
                        items
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    orderSubmitMsg.textContent = 'Order created successfully!';
                    orderSubmitMsg.style.color = 'green';

                    orderCart = [];
                    updateCartDisplay();
                    selectedUser = null;
                    document.getElementById('selectedUserDisplay').style.display = 'none';
                    document.getElementById('orderBuildingCard').style.display = 'none';

                    loadOrders();

                    setTimeout(() => {
                        orderSubmitMsg.textContent = '';
                    }, 3000);
                } else {
                    orderSubmitMsg.textContent = data.error || 'Error creating order';
                    orderSubmitMsg.style.color = 'red';
                }
            } catch (error) {
                console.error('Error creating order:', error);
                orderSubmitMsg.textContent = 'Server error creating order';
                orderSubmitMsg.style.color = 'red';
            }
        });
    }

    // Load users when Create Order section is shown
    Object.keys(navButtons).forEach(key => {
        navButtons[key].addEventListener('click', () => {
            showSection(key);
            if (key === 'createOrder') {
                loadAllUsersForSearch();
            }
        });
    });

    // Initial check
    checkStaff();
});