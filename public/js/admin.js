document.addEventListener('DOMContentLoaded', () => {
    // Global variables
    let eventSource;
    let allProducts = [];
    let allOrders = [];
    const searchInput = document.getElementById('orderSearchInput');
    let openOrderCardIds = new Set();
    let openHistoryCardIds = new Set();
    let outOfDeliveryBatchKeys = new Set(); // <<< ADD THIS LINE

    // Loading spinner helper functions
    function showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p id="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
            document.getElementById('loading-message').textContent = message;
        }
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.animation = '';
            }, 300);
        }
    }

    // DOM Element Selections
    const loginBox = document.getElementById('loginBox');
    const adminPanel = document.getElementById('adminPanel');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const loginMsg = document.getElementById('loginMsg');
    const logoutBtn = document.getElementById('logoutBtn');
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
        amounts: document.getElementById('navAmounts'), // <<< RENAMED
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
        amounts: document.getElementById('amountsSection'), // <<< RENAMED
        visitedUsers: document.getElementById('visitedUsersSection')
    };
    const productForm = document.getElementById('productForm');
    const productFormTitle = document.getElementById('productFormTitle');
    const productIdInput = document.getElementById('productId');
    const productNameInput = document.getElementById('productName');
    const productDescInput = document.getElementById('productDesc');
    const productPriceInput = document.getElementById('productPrice');
    const productUnitInput = document.getElementById('productUnit');
    const productSkuInput = document.getElementById('productSku');
    const productSubmitBtn = document.getElementById('productSubmitBtn');
    const productCancelBtn = document.getElementById('productCancelBtn');
    const productFormMsg = document.getElementById('productFormMsg');
    const visitedUsersSubNav = {
        noOrders: document.getElementById('navNoOrdersBtn'),
        allUsers: document.getElementById('navAllUsersBtn')
    };
    const visitedUsersLists = {
        noOrders: document.getElementById('noOrdersList'),
        allUsers: document.getElementById('allUsersList')
    };

    // Helper Functions (keep formatDeliveryIdsForDescription, showCustomItemModal, updateProductDropdown, showSection, connectToOrderStream, showAdminPanel, showLoginBox, checkAdmin, loadOrders, getCardStateId, renderAdvanceList, renderOrders)
    // *** NEW HELPER FUNCTION ***
    // Helper to format dates without seconds
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
        // Keep it short, maybe just the count or first/last few chars of IDs
        if (ids.length > 1) {
            return `Batch of ${ids.length}`;
        } else if (ids.length === 1) {
            return `Delivery ${ids[0].substring(ids[0].length - 6)}`; // Last 6 chars
        }
        return '';
    }


    // HELPER to show the custom modal
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
            saveBtn.removeEventListener('click', saveHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };

        saveBtn.addEventListener('click', saveHandler);
        cancelBtn.addEventListener('click', cancelHandler);
    }

    function updateProductDropdown(card) {
        const select = card.querySelector('.product-select');
        if (!select) return;
        const existingProductIds = new Set(
            Array.from(card.querySelectorAll('.edit-item-list li, .new-item-list li')).map(li => li.dataset.productId)
        );
        const availableProducts = allProducts.filter(p => !existingProductIds.has(p._id));
        select.innerHTML = availableProducts.map(p => {
            const description = p.description ? ` - ${p.description}` : '';
            return `<option value="${p._id}">${p.name}${description}</option>`;
        }).join('');
    }

    function showSection(sectionKey) {
        Object.values(sections).forEach(section => section.style.display = 'none');
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        sections[sectionKey].style.display = 'block';
        navButtons[sectionKey].classList.add('active');
    }

    function connectToOrderStream() {
        if (eventSource) eventSource.close();
        eventSource = new EventSource('/api/admin/order-stream');
        eventSource.onmessage = function (event) {
            if (event.data === 'new_order' || event.data === 'order_updated') {
                loadOrders(); // Will re-render using the openOrderCardIds set
                loadVisitedUsers(); // Will re-render using the openOrderCardIds set
            }
        };
        eventSource.onerror = () => { console.error('Real-time connection failed.'); eventSource.close(); };
    }

    function showAdminPanel() {
        loginBox.style.display = 'none';
        adminPanel.style.display = 'block';
        loadProducts();
        loadOrders();
        loadVisitedUsers();
        loadAllUsers();
        connectToOrderStream();
        showSection('pendingOrders');
    }

    function showLoginBox() {
        loginBox.style.display = 'block';
        adminPanel.style.display = 'none';
        if (eventSource) eventSource.close();
    }

    async function checkAdmin() {
        try {
            const res = await fetch('/api/admin/check');
            if (res.ok) showAdminPanel(); else showLoginBox();
        } catch (e) {
            showLoginBox();
        }
    }

    async function loadOrders() {
        try {
            showLoading('Loading orders...');
            const res = await fetch('/api/admin/orders');
            if (!res.ok) {
                hideLoading();
                return;
            }
            allOrders = await res.json();
            renderOrders(allOrders); // This will now use openOrderCardIds
            searchInput.value = '';
            hideLoading();
        } catch (error) {
            console.error("Failed to load orders:", error);
            hideLoading();
        }
    }

    // Function to get a unique ID for state tracking
    function getCardStateId(card, order) {
        if (order) {
            const parentSection = card.closest('section'); // Find the parent section
            if (!parentSection) return order._id; // Default

            // Check based on the section's ID
            if (parentSection.id === 'balanceSection') {
                return order._id + '-balance';
            } else if (parentSection.id === 'advanceSection') {
                return order._id + '-advance';
            } else {
                return order._id; // Default to order ID for main lists
            }
        } else if (card.dataset.userId) { // Handle user cards
            return 'user-' + card.dataset.userId;
        } else if (card.id && card.id.startsWith('product-card-')) { // Handle product cards
            return card.id;
        }
        // Fallback if no specific ID is found (might not persist state correctly)
        return card.id || null;
    }


    function renderAmountsList(orders) {
        const amountsListContainer = document.getElementById('amountsList'); // <<< RENAMED
        amountsListContainer.innerHTML = '';
        let amountsFound = false;

        orders.forEach(order => {
            if (!order.adjustments || order.adjustments.length === 0) return;

            // Filter for advances AND received amounts (discounts starting with '[')
            const amountItems = order.adjustments.filter(adj =>
                adj.type === 'advance' ||
                (adj.type === 'discount' && adj.description.startsWith('['))
            );

            if (amountItems.length > 0) {
                amountsFound = true;
                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.order = JSON.stringify(order);
                const cardStateId = order._id + '-amounts'; // <<< RENAMED
                card.id = `order-${cardStateId}`;

                let amountsHtml = amountItems.map(adj => {
                    let buttonsHtml = '';
                    let itemStyle = '';
                    let typeLabel = '';

                    if (adj.type === 'advance') {
                        typeLabel = `<span style="color: #28a745; font-weight: bold;">(Advance)</span>`;
                    } else {
                        typeLabel = `<span style="color: #dc3545; font-weight: bold;">(Received)</span>`;
                    }

                    if (adj.isLocked) {
                        buttonsHtml = `<span style="color: green; font-weight: bold; margin-left: 10px;">✓ Locked</span>`;
                        itemStyle = `background-color: #f0f0f0;`;
                    } else {
                        buttonsHtml = `
                            <button class="lock-adjustment-btn small-btn" data-id="${adj._id}" style="color:green;" title="Lock this amount">✓</button>
                            <button class="remove-adjustment-btn small-btn" data-id="${adj._id}" style="color:red;" title="Remove this amount">✕</button>
                        `;
                    }

                    return `<li style="display: flex; justify-content: space-between; align-items: center; padding: 5px; ${itemStyle}">
                                <div>
                                    ${adj.description} ${typeLabel}<br>
                                    <strong>₹${adj.amount.toFixed(2)}</strong>
                                </div>
                                <div>${buttonsHtml}</div>
                            </li>`;
                }).join('');

                const cardHeader = `
                    <div class="order-card-header">
                        <strong>Order ID: ${order.customOrderId}</strong>
                        <span style="float: right;">${order.user?.name || 'N/A'}</span>
                    </div>`;

                const initialDisplay = openOrderCardIds.has(cardStateId) ? 'block' : 'none';
                const cardBody = `
                    <div class="order-card-body" style="display: ${initialDisplay};">
                        <ul style="list-style-type: none; padding-left: 0;">${amountsHtml}</ul>
                        <button class="view-order-details-btn" data-order-id="${order.customOrderId}" style="margin-top: 10px;">View Full Order</button>
                    </div>`;

                card.innerHTML = cardHeader + cardBody;
                amountsListContainer.appendChild(card);
            }
        });

        if (!amountsFound) {
            amountsListContainer.innerHTML = '<p>No advance payments or received amounts found.</p>';
        }
    }


    // ### REFACTORED: renderOrders ###
    function renderOrders(ordersToRender) {
        const lists = {
            pending: document.getElementById('pendingOrdersList'),
            rateRequested: document.getElementById('rateRequestedList'),
            rateApproved: document.getElementById('rateApprovedList'),
            confirmed: document.getElementById('confirmedOrdersList'),
            dispatch: document.getElementById('dispatchList'),
            partiallyDelivered: document.getElementById('dispatchList'),
            paused: document.getElementById('pausedOrdersList'),
            hold: document.getElementById('holdOrdersList'),
            delivered: document.getElementById('deliveredOrdersList'),
            cancelled: document.getElementById('cancelledOrdersList'),
            balance: document.getElementById('balanceList')
        };
        Object.values(lists).forEach(list => list.innerHTML = '');

        const counts = { pending: 0, rateRequested: 0, rateApproved: 0, confirmed: 0, dispatch: 0, partiallyDelivered: 0, paused: 0, hold: 0, delivered: 0, cancelled: 0 };

        ordersToRender.forEach(order => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.order = JSON.stringify(order);
            const cardStateId = order._id; // Use order ID for main list state
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
                default: targetList = lists.pending;
            }


            if (targetList) {
                // Generate HTML first
                if (order.status === 'Dispatch' || order.status === 'Partially Delivered') {
                    card.innerHTML = generateDispatchCardHtml(order);
                } else if (order.status === 'Delivered') {
                    card.innerHTML = generateDeliveredCardHtml(order);
                } else {
                    card.innerHTML = generateAdminOrderCardHtml(order);
                }
                targetList.appendChild(card);

                // <<< MODIFICATION: Restore open state AFTER adding to DOM >>>
                if (openOrderCardIds.has(cardStateId)) {
                    const body = card.querySelector('.order-card-body');
                    if (body && !body.closest('.profile-edit-form') && !body.querySelector('.edit-item-list')) { // Check for edit views
                        body.style.display = 'block';
                    }
                }
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
            }

            // Render balance card
            if (order.status !== 'Cancelled') {
                const balanceCard = document.createElement('div');
                balanceCard.className = 'card';
                balanceCard.dataset.order = JSON.stringify(order);
                const balanceCardStateId = order._id + '-balance'; // Unique ID for balance card state
                balanceCard.id = `order-${balanceCardStateId}`;
                balanceCard.innerHTML = generateConsolidatedBalanceCardHtml(order);
                lists.balance.appendChild(balanceCard);

                // <<< MODIFICATION: Restore open state for balance card >>>
                if (openOrderCardIds.has(balanceCardStateId)) {
                    const body = balanceCard.querySelector('.order-card-body');
                    if (body) {
                        body.style.display = 'block';
                    }
                }
            }
        });

        // --- Update Nav Counts ---
        navButtons.pendingOrders.innerText = `Active Orders (${counts.pending})`;
        navButtons.rateRequested.innerText = `Rate Requested (${counts.rateRequested})`;
        navButtons.rateApproved.innerText = `Rate Approved (${counts.rateApproved})`;
        navButtons.confirmedOrders.innerText = `Confirmed (${counts.confirmed})`;
        navButtons.dispatch.innerText = `Dispatch (${counts.dispatch + counts.partiallyDelivered})`;
        navButtons.pausedOrders.innerText = `Paused (${counts.paused})`;
        navButtons.holdOrders.innerText = `On Hold (${counts.hold})`;
        navButtons.delivered.innerText = `Delivered (${counts.delivered})`;
        navButtons.cancelledOrders.innerText = `Cancelled (${counts.cancelled})`;

        renderAmountsList(ordersToRender); // <<< RENAMED
    }

    // Keep generateDispatchCardHtml, generateDeliveredCardHtml, generateAdminOrderCardHtml, generateConsolidatedBalanceCardHtml, generateAdminEditViewHtml, generateUserProfileEditHtml as defined in the previous response (with the nested view logic)

    function generateAdminOrderCardHtml(order, isNested = false) { // Added isNested flag
        const totalAmount = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);

        const itemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? `<br><medium style="color: #555;">${item.description}</medium>` : '';
            return `<li><strong>${item.name}</strong> <strong>${descriptionHtml}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li><br>`;
        }).join('');

        const totalAmountHtml = `<hr><h4 style="text-align: right;">Total Amount: ₹${totalAmount.toFixed(2)}</h4>`;

        let renderedCharges = '', renderedDiscounts = '', renderedAdvances = '', adjustmentsTotal = 0;
        if (order.adjustments && order.adjustments.length > 0) {
            order.adjustments.forEach(adj => {
                const removeBtnHtml = `<button class="remove-adjustment-btn" data-id="${adj._id}" style="color:red; border:none; background:transparent; cursor:pointer; font-weight: bold;">&times;</button>`;
                if (adj.type === 'charge') {
                    renderedCharges += `<div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px;"><span>${adj.description}:</span><span>₹${adj.amount.toFixed(2)}</span>${removeBtnHtml}</div>`;
                    adjustmentsTotal += adj.amount;
                } else if (adj.type === 'discount') {
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

        let actionButtonHtml = '', agentHtml = '', reasonHtml = ''; // Renamed from pauseReasonHtml
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

        if ((order.status === 'Paused' || order.status === 'Hold') && order.pauseReason) {
            reasonHtml = `<div style="background: #fff8e1; padding: 8px; margin-top: 10px; border-left: 3px solid #ffc107;"><strong>Reason:</strong><p style="margin: 5px 0;">${order.pauseReason}</p><button class="edit-pause-reason-btn small-btn">Edit Reason</button></div>`;
        }

        const agentFormTemplate = `<div class="agent-form" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>Delivery Agent Details:</strong><br>
            <input type="text" class="agent-name-input" placeholder="Agent Name" value="${agentName}">
            <input type="text" class="agent-mobile-input" placeholder="Agent Mobile" value="${agentMobile}"><br>
            <input type="text" class="agent-desc-input" placeholder="Description (e.g., vehicle, ETA)" value="${agentDescription}" style="width: 95%; margin-top: 5px;"><br>
            <textarea class="agent-address-input" placeholder="Delivery Address" style="width: 95%; margin-top: 5px; height: 60px;">${agentAddress}</textarea><br>
            <button class="save-agent-btn">Save Agent</button>
        </div>`;

        switch (order.status) {
            case 'Pending':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="pause-btn">Pause</button><button class="admin-edit-order-btn">Edit</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Rate Requested':
                actionButtonHtml = `<button class="approve-rate-btn">Approve Rate</button><button class="admin-edit-order-btn">Edit</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Rate Approved':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="admin-edit-order-btn">Edit</button><button class="hold-btn">Hold</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Confirmed':
                // Only show agent assignment/editing in the main Confirmed list, not when nested in Dispatch
                if (!isNested) {
                    if (agentName) {
                        agentHtml = agentDisplayHtml +
                            `<button class="show-agent-form-btn" style="font-size: 0.8em; margin-top: 5px;">Edit Agent</button>`;
                        actionButtonHtml = `<button class="dispatch-btn" style="background-color: #28a745; color: white;">Dispatch Order</button>`;
                    } else {
                        agentHtml = `<button class="show-agent-form-btn">Assign Agent</button>`;
                        actionButtonHtml = ``; // No dispatch button yet
                    }
                    agentHtml += `<div class="agent-form-container" style="display:none;">${agentFormTemplate}</div>`;
                } else {
                    // If nested, just display agent if assigned
                    if (agentName) agentHtml = agentDisplayHtml;
                }
                actionButtonHtml += `<button class="admin-edit-order-btn">Edit Order</button><button class="hold-btn">Hold</button><button class="cancel-btn">Cancel</button>`;
                break;
            case 'Paused':
            case 'Hold':
                actionButtonHtml = `<button class="confirm-btn">Confirm</button><button class="admin-edit-order-btn">Edit</button><button class="cancel-btn">Cancel</button>`;
                break;
            default: // Covers Dispatch, Delivered etc. when called for the nested view
                if (agentName && !isNested) { // Avoid showing agent twice when nested
                    agentHtml = `<p style="margin-top:10px;"><strong>Assigned Agent:</strong> ${agentName} (${agentMobile})</p>`;
                }
        }

        const statusColors = { Pending: 'orange', Confirmed: '#007bff', Paused: '#6c757d', Cancelled: '#dc3545', Delivered: 'green', 'Rate Requested': '#e83e8c', 'Rate Approved': '#20c997', 'Hold': '#343a40', 'Dispatch': '#fd7e14', 'Partially Delivered': '#fd7e14' };
        const statusColor = statusColors[order.status] || '#000';
        // Use "Confirmed" label if nested within Dispatch view
        const displayStatus = isNested && (order.status === 'Dispatch' || order.status === 'Partially Delivered') ? 'Confirmed' : order.status;
        const statusHtml = `<strong style="color: ${statusColor};">Status: ${displayStatus}</strong><br>`;


        // --- Card Header only needed for top-level cards ---
        const cardHeader = !isNested ? `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: ${statusColor};">${order.status}</span>
            </div>` : '';

        // --- Main Body generation (used standalone or nested) ---
        const cardBodyContent = `
                ${!isNested ? `<strong>Customer:</strong> ${order.user.name} (${order.user.mobile}) <button class="view-profile-btn small-btn" data-user-id="${order.user._id}">View Profile</button><br>` : ''}
                ${!isNested ? `<strong>Ordered at:</strong> ${formatDate(order.createdAt)}<br>` : ''}
                ${!isNested ? statusHtml : ''}${!isNested ? agentHtml : ''}
                <hr>
                <strong>Items:</strong>
                <ul class="item-list">${itemsHtml + totalAmountHtml + adjustmentsContainerHtml}</ul>
                <div class="order-actions">${actionButtonHtml}</div>
                ${reasonHtml}
                ${!isNested ? `<p class="edit-msg small" style="color:red;"></p>` : ''}
            `;

        // --- Return structure depends on whether it's nested ---
        if (isNested) {
            return cardBodyContent; // Return only the inner content
        } else {
            return cardHeader + `<div class="order-card-body" style="display: none;">${cardBodyContent}</div>`; // Return full card structure
        }
    }

    function generateDeliveredCardHtml(order) {
        // Recalculate totals including adjustments for delivered view
        const itemTotal = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);
        let adjustmentsTotal = 0;
        if (order.adjustments && order.adjustments.length > 0) {
            adjustmentsTotal = order.adjustments.reduce((sum, adj) => sum + (adj.type === 'charge' ? adj.amount : -adj.amount), 0);
        }
        const finalTotal = itemTotal + adjustmentsTotal;


        const itemsHtml = order.items.map(item => {
            return `<li><strong>${item.name}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price.toFixed(2)}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li>`;
        }).join('');

        // Display adjustments in the delivered view
        let renderedAdjustments = '';
        if (order.adjustments && order.adjustments.length > 0) {
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


    function generateDeliveredCardHtml(order) {
        // Recalculate totals including adjustments for delivered view
        const itemTotal = order.items.reduce((sum, item) => sum + (item.quantityOrdered * item.price), 0);
        let adjustmentsTotal = 0;
        if (order.adjustments && order.adjustments.length > 0) {
            adjustmentsTotal = order.adjustments.reduce((sum, adj) => sum + (adj.type === 'charge' ? adj.amount : -adj.amount), 0);
        }
        const finalTotal = itemTotal + adjustmentsTotal;


        const itemsHtml = order.items.map(item => {
            return `<li><strong>${item.name}</strong> - (${item.quantityOrdered} ${item.unit || ''} &times; ₹${item.price.toFixed(2)}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li>`;
        }).join('');

        // Display adjustments in the delivered view
        let renderedAdjustments = '';
        if (order.adjustments && order.adjustments.length > 0) {
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
                <span style="float: right; font-weight: bold; color: green;">${order.status}</span>
            </div>`;

        const cardBody = `
            <div class="order-card-body" style="display: none;">
               
                <strong style="color: green;">Status: ${order.status} on ${new Date(order.deliveredAt).toLocaleDateString()}</strong><br>
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

        if (order.adjustments && order.adjustments.length > 0) {
            totalAdjustments = order.adjustments.reduce((sum, adj) => sum + (adj.type === 'charge' ? adj.amount : -adj.amount), 0);
        }

        const cardHeader = `
            <div class="order-card-header">
                <strong>ID: ${order.customOrderId || 'N/A'}</strong> - ${order.user?.name || 'N/A'} (${order.user?.mobile || 'N/A'})
                <span style="float: right; font-weight: bold; color: #17a2b8;">Balance View</span>
            </div>`;

        const itemsHtml = order.items.map(item => `<li>${item.name} - (${item.quantityOrdered} &times; ₹${item.price.toFixed(2)}) = <strong>₹${(item.quantityOrdered * item.price).toFixed(2)}</strong></li>`).join('');

        const finalTotal = totalBilled + totalAdjustments;

        const cardBody = `
            <div class="order-card-body" style="display: none;">
                <hr>
                <div style="padding: 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 10px;">
                    <strong style="color: #007bff;">Status: ${order.status}</strong>
                    <ul>${itemsHtml}</ul>
                    <h4 style="text-align: right;">Subtotal: ₹${totalBilled.toFixed(2)}</h4>
                </div>
                <hr>
                 <div style="text-align: right;">
                    <h4>Item Total: ₹${totalBilled.toFixed(2)}</h4>
                    ${totalAdjustments !== 0 ? `<h4>Adjustments: ₹${totalAdjustments.toFixed(2)}</h4>` : ''}
                    <h3 style="color: #28a745;">Final Bill: ₹${finalTotal.toFixed(2)}</h3>
                 </div>
            </div>`;

        return cardHeader + cardBody;
    }

    async function generateAdminEditViewHtml(order) {
        if (allProducts.length === 0) {
            const res = await fetch('/api/products');
            allProducts = await res.json();
        }

        const existingProductIds = new Set(order.items.map(item => (item.product._id || item.product).toString()));
        const availableProducts = allProducts.filter(p => !existingProductIds.has(p._id));

        const productOptions = availableProducts.map(p => {
            const description = p.description ? ` - ${p.description}` : '';
            return `<option value="${p._id}">${p.name}${description}</option>`;
        }).join('');

        const currentItemsHtml = order.items.map(item => {
            const descriptionHtml = item.description ? ` - ${item.description}` : '';
            const productId = (item.product._id || item.product).toString();
            // Find the original product price from allProducts
            const originalProduct = allProducts.find(p => p._id === productId);
            const originalPrice = originalProduct ? originalProduct.price.toFixed(2) : item.price.toFixed(2); // Fallback

            return `<li data-product-id="${productId}" data-original-price="${originalPrice}">
                ${item.name}${descriptionHtml} (${item.unit || ''}) -
                <input type="number" class="qty-input" min="0.1" step="0.1" value="${item.quantityOrdered}" style="width: 60px;">
                Price: <input type="number" class="price-input" min="0" value="${item.price.toFixed(2)}" step="0.01" style="width: 80px;">
                <button class="remove-item-btn" style="color:red; margin-left: 5px;">X</button></li>`;
        }).join('');

        const cardHeader = `
            <div class="order-card-header">
                <strong>Order ID: ${order.customOrderId || 'NEW ORDER'}</strong>
                <span style="float: right; font-weight: bold; color: #ffc107;">${order._id ? 'Editing...' : 'Creating...'}</span>
            </div>`;

        const cardBody = `
            <div class="order-card-body" style="display: block;"><br>
                <strong>Order for: ${order.user.name}</strong><hr>
                <strong>Items:</strong> <ul class="edit-item-list">${currentItemsHtml}</ul> <hr>
                <strong>Add Product:</strong><br>
                <select class="product-select"><option value="">-- Select Product --</option>${productOptions}</select>
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

    // Replace this entire function
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
                        <button class="save-profile-btn" data-user-id="${user._id}">Save Profile</button> 
                        <button class="cancel-profile-edit-btn" type="button" style="background-color: #6c757d;" data-user-id="${user._id}">Cancel</button> 
                    </div>
                    <p class="profile-edit-msg small" style="color:green;"></p>
                </div>
            </div>`;

        return cardHeader + cardBody; // Return header + body
    }

    // --- Rendering functions for Users/Products ---
    async function loadVisitedUsers() {
        showLoading('Loading users...');
        const res = await fetch('/api/admin/visited-users');
        if (!res.ok) {
            visitedUsersLists.noOrders.innerHTML = '<p>Error loading users.</p>';
            hideLoading();
            return;
        }
        const users = await res.json();
        renderNoOrderUsers(users);
        hideLoading();
    }

    function renderNoOrderUsers(users) {
        const listContainer = visitedUsersLists.noOrders;
        visitedUsersSubNav.noOrders.innerText = `No Orders (${users.length})`;
        if (users.length === 0) { listContainer.innerHTML = '<p>No users are currently in this category.</p>'; return; }

        listContainer.innerHTML = users.map(user => {
            const cardStateId = 'user-' + user._id; // Unique ID
            const safeUserName = (user.name || user.mobile).replace(/"/g, '&quot;');

            const cardHeader = `<div class="order-card-header"><strong>Phone: ${user.mobile}</strong></div>`;
            const initialDisplay = openOrderCardIds.has(cardStateId) ? 'block' : 'none';

            // When the card is expanded, it shows the profile display directly.
            const cardBody = `
                <div class="order-card-body profile-container" style="display: ${initialDisplay};">
                    ${generateUserProfileDisplayHtml(user)}
                </div>`;

            return `<div class="card" data-user-id="${user._id}">${cardHeader + cardBody}</div>`;
        }).join('');
    }

    async function loadAllUsers() {
        showLoading('Loading all users...');
        const res = await fetch('/api/admin/all-users');
        if (!res.ok) {
            visitedUsersLists.allUsers.innerHTML = '<p>Error loading users.</p>';
            hideLoading();
            return;
        }
        const users = await res.json();
        renderAllUsers(users);
        hideLoading();
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
                <div class="order-card-body profile-container" style="display: ${initialDisplay};">
                     ${generateUserProfileDisplayHtml(user)}
                </div>`;
            return `<div class="card" data-user-id="${user._id}">${cardHeader + cardBody}</div>`;
        }).join('');
    }

    async function loadProducts() {
        showLoading('Loading products...');
        const res = await fetch('/api/products');
        if (!res.ok) {
            hideLoading();
            return;
        }
        const products = await res.json();
        allProducts = products;

        const list = document.getElementById('productList');
        list.innerHTML = '';
        products.forEach((p, index) => {
            const el = document.createElement('div');
            el.className = 'card';
            const cardStateId = 'product-card-' + p._id; // Unique ID for product card
            el.id = cardStateId; // Set element ID

            const visibilityText = p.isVisible ? 'Hide' : 'Show';
            const visibilityClass = p.isVisible ? 'hide-btn' : 'show-btn';

            const cardHeader = `<div class="order-card-header"><strong>${p.name}</strong></div>`;
            const cardBody = `
            <div class="order-card-body" style="display: none;">
                <span class="small">${p.description || ''}</span><br>
                Price: ${p.price} / ${p.unit || 'unit'}<br>
                <button class="edit-btn" data-id="${p._id}">Edit</button>
                <button class="delete-btn" data-id="${p._id}">Delete</button>
                <button class="visibility-btn ${visibilityClass}" data-id="${p._id}">${visibilityText}</button>
            </div>`;

            el.innerHTML = cardHeader + cardBody;
            list.appendChild(el);
        });
        attachProductEventListeners(); // Keep this if it adds listeners inside the body
        hideLoading();
    }

    // ### UPDATED: Main Event Listener ###
    adminPanel.addEventListener('click', async (e) => {

        // ### Card Toggling Logic (Keep as is) ###
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
                    if (!isOpen) {
                        openOrderCardIds.add(cardStateId);
                    } else {
                        openOrderCardIds.delete(cardStateId);
                    }
                }
            }
            return;
        }

        // --- Other non-card specific button logic ---
        if (e.target.classList.contains('remove-dispatch-item-btn')) {
            e.target.closest('li').remove();
            return;
        }

        if (e.target.classList.contains('show-agent-form-btn')) {
            const card = e.target.closest('.card');
            if (!card) return;
            const container = card.querySelector('.agent-form-container');
            if (container) {
                container.style.display = container.style.display === 'none' ? 'block' : 'none';
                e.target.innerText = container.style.display === 'none' ? 'Edit Agent' : 'Hide Form';
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

        if (e.target.classList.contains('admin-create-new-order-btn')) {
            const card = e.target.closest('.card');
            if (!card) return;
            const userId = e.target.dataset.userId;
            const updatedItems = Array.from(card.querySelectorAll('.edit-item-list li, .new-item-list li')).map(li => ({
                productId: li.dataset.productId,
                quantity: li.querySelector('.qty-input').value,
                price: li.querySelector('.price-input').value
            }));

            if (updatedItems.length === 0) {
                alert("Cannot create an empty order.");
                return;
            }

            const res = await fetch('/api/admin/orders/create-for-user', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, items: updatedItems })
            });

            if (res.ok) {
                alert('Order created successfully!');
                loadVisitedUsers();
                loadOrders();
            } else {
                const err = await res.json();
                alert(`Failed to create order: ${err.error}`);
            }
            return;
        }

        // --- Card Specific Logic ---
        const card = e.target.closest('.card');
        if (!card) return;

        // --- (Keep make-order-btn, view-order-details-btn logic) ---
        if (e.target.classList.contains('make-order-btn')) {
            const userId = e.target.dataset.userId;
            const userName = e.target.dataset.userName;
            const fakeOrder = {
                _id: null,
                customOrderId: null,
                user: { _id: userId, name: userName },
                items: []
            };

            const editViewHtml = await generateAdminEditViewHtml(fakeOrder);

            card.innerHTML = editViewHtml;

            const saveBtn = card.querySelector('.admin-save-changes-btn');
            if (saveBtn) {
                saveBtn.innerText = 'Create New Order';
                saveBtn.classList.remove('admin-save-changes-btn');
                saveBtn.classList.add('admin-create-new-order-btn');
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
                        }
                    }, 100);
                }
            }
            return;
        }


        const orderData = card.dataset.order;
        const order = orderData ? JSON.parse(orderData) : null;

        // --- (Keep addAdjustment function, adjustment button handlers) ---
        async function addAdjustment(description, amount, type) {
            if (!order) return;
            const res = await fetch('/api/admin/orders/adjustments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order._id, description, amount, type })
            });
            if (!res.ok) alert('Failed to add adjustment.');
            // SSE will handle reload
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
                // SSE will handle reload

            } catch (error) {
                console.error("Error removing adjustment:", error);
                alert(`Could not remove amount: ${error.message}`);
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

        // --- (Keep remove-item-btn, add-product-btn logic) ---
        if (e.target.classList.contains('remove-item-btn')) {
            e.target.closest('li').remove();
            updateProductDropdown(card);
            return;
        }

        if (e.target.classList.contains('add-product-btn')) {
            const select = card.querySelector('.product-select');
            const list = card.querySelector('.new-item-list');
            if (!select.value) return;
            const selectedProduct = allProducts.find(p => p._id === select.value);
            if (!selectedProduct) return;
            const newItemLi = document.createElement('li');
            newItemLi.dataset.productId = select.value;
            newItemLi.dataset.originalPrice = selectedProduct.price.toFixed(2); // Store original price
            newItemLi.innerHTML = `${select.options[select.selectedIndex].text} (${selectedProduct.unit || ''}) -
                <input type="number" class="qty-input" min="0.1" step="0.1" value="" style="width: 80px;">
                Price: <input type="number" class="price-input" min="0" value="${selectedProduct.price.toFixed(2)}" step="0.01" style="width: 80px;">
                <button class="remove-item-btn" style="color:red; margin-left: 5px;">X</button>`;
            list.appendChild(newItemLi);
            updateProductDropdown(card);
            select.value = ""; // Reset select
            return;
        }

        // --- (Keep record-delivery-btn logic) ---
        if (e.target.classList.contains('record-delivery-btn')) {
            if (!order) return;
            const deliveries = [];
            let hasInvalidQuantity = false;
            card.querySelectorAll('.dispatch-item-row').forEach(row => {
                const qtyInput = row.querySelector('.dispatch-qty-input');
                const quantity = parseFloat(qtyInput.value);
                const max = parseFloat(qtyInput.max);

                if (!isNaN(quantity) && quantity > 0) {
                    if (!isNaN(max) && quantity > max) {
                        alert(`Cannot deliver ${quantity} for ${row.cells[0].textContent.trim()} - maximum remaining is ${max}.`);
                        hasInvalidQuantity = true;
                        return;
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

            if (hasInvalidQuantity) return;

            if (deliveries.length === 0) {
                alert('Please enter a quantity for at least one item to record a delivery.');
                return;
            }

            if (!confirm(`You are about to record a delivery for ${deliveries.length} item(s). Continue?`)) {
                return;
            }

            e.target.disabled = true;
            e.target.innerText = 'Saving...';

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
                // SSE will handle reload
            } catch (error) {
                console.error("Error recording delivery:", error);
                alert(`Failed to record delivery: ${error.message}`);
                e.target.disabled = false;
                e.target.innerText = 'Record Delivery';
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

                        // <<< NEW: Ensure history state reflects it should be open >>>
                        const cardStateId = getCardStateId(card, updatedOrderFromServer);
                        if (cardStateId) openHistoryCardIds.add(cardStateId);
                        const historyContainer = card.querySelector('.delivery-history-container');
                        const historyBtn = card.querySelector('.view-history-btn');
                        if (historyContainer && historyBtn) {
                            // Call renderDeliveryHistory directly, passing the updated order
                            await renderDeliveryHistory(updatedOrderFromServer, historyContainer, historyBtn);
                        }
                        // --- END REVISED UPDATE LOGIC ---
                    }
                } catch (error) {
                    console.error("Error in add-delivery-deduction:", error);
                    alert(`Failed to add deduction: ${error.message}`);
                }
            }, defaultDescription);

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

        // --- (Keep admin-cancel-edit-btn, cancel-profile-edit-btn handlers) ---
        if (e.target.classList.contains('admin-cancel-edit-btn')) {
            if (!order) return;
            const cardStateId = getCardStateId(card, order);
            const wasOpen = openOrderCardIds.has(cardStateId);

            // Regenerate appropriate card HTML based on original status
            if (order.status === 'Dispatch' || order.status === 'Partially Delivered') {
                card.innerHTML = generateDispatchCardHtml(order);
            } else {
                card.innerHTML = generateAdminOrderCardHtml(order);
            }


            if (wasOpen) {
                const newBody = card.querySelector('.order-card-body');
                if (newBody) newBody.style.display = 'block';
            }
            return;
        }
        if (e.target.classList.contains('cancel-profile-edit-btn')) {
            // Reloading list is simplest to restore state correctly
            if (card.closest('#allUsersList')) {
                loadAllUsers();
            } else if (card.closest('#noOrdersList')) {
                loadVisitedUsers();
            } else {
                // Was likely editing from an order card
                loadOrders();
            }
            // Clear open state for this card if it was added during edit
            const cardStateId = getCardStateId(card, order); // Get ID again
            if (cardStateId) openOrderCardIds.delete(cardStateId);
            return; // Stop further processing
        }


        // --- Action Handlers Dictionary (keep existing, ensure pause/hold/edit-pause logic is correct) ---
        const actions = {
            'confirm-btn': () => order && apiUpdateStatus(order._id, 'Confirmed'),
            'dispatch-btn': () => order && apiUpdateStatus(order._id, 'Dispatch'),
            'return-to-confirmed-btn': () => order && apiUpdateStatus(order._id, 'Confirmed'),
            'pause-btn': () => {
                if (!order) return;
                const description = prompt("Reason for pausing this order:");
                if (description && description.trim() !== '') {
                    const timestamp = formatDate(new Date()); // MODIFIED
                    const reason = `[${timestamp}] - ${description.trim()}`;
                    apiUpdateStatus(order._id, 'Paused', { reason });
                } else if (description !== null) {
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
            'approve-rate-btn': () => order && apiApproveRate(order._id),
            'cancel-btn': () => order && confirm('Are you sure?') && apiUpdateStatus(order._id, 'Cancelled'),
            'save-agent-btn': () => {
                if (!order) return;
                const agentName = card.querySelector('.agent-name-input')?.value;
                const agentMobile = card.querySelector('.agent-mobile-input')?.value;
                const agentDescription = card.querySelector('.agent-desc-input')?.value;
                apiAssignAgent(order._id, agentName, agentMobile, agentDescription, card);
            },
            'edit-pause-reason-btn': () => {
                if (!order) return;
                const newDescription = prompt("Enter new reason (the old reason will be replaced):");
                if (newDescription && newDescription.trim() !== '') {
                    const timestamp = formatDate(new Date()); // MODIFIED
                    const reason = `[${timestamp}] - ${newDescription.trim()}`;
                    apiUpdateStatus(order._id, order.status, { reason });
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
            'approve-rate-btn': () => order && apiApproveRate(order._id),
            'cancel-btn': () => order && confirm('Are you sure?') && apiUpdateStatus(order._id, 'Cancelled'),
            'save-agent-btn': () => {
                if (!order) return;
                const agentName = card.querySelector('.agent-name-input')?.value;
                const agentMobile = card.querySelector('.agent-mobile-input')?.value;
                const agentDescription = card.querySelector('.agent-desc-input')?.value;
                apiAssignAgent(order._id, agentName, agentMobile, agentDescription, card);
            },
            'edit-pause-reason-btn': () => {
                if (!order) return;
                const newDescription = prompt("Enter new reason (the old reason will be replaced):");
                if (newDescription && newDescription.trim() !== '') {
                    const timestamp = new Date().toLocaleString();
                    const reason = `[${timestamp}] - ${newDescription.trim()}`;
                    apiUpdateStatus(order._id, order.status, { reason });
                } else if (newDescription !== null) {
                    alert("Please provide a new reason.");
                }
            },
            'admin-edit-order-btn': async () => {
                if (!order) return;
                const cardStateId = getCardStateId(card, order);
                if (cardStateId) openOrderCardIds.add(cardStateId); // Ensure state reflects edit mode

                const isDispatchCard = card.querySelector('.dispatch-item-row');

                if (isDispatchCard) {
                    const container = card.querySelector('.order-details-container');
                    if (container) {
                        // Generate the *full* edit view HTML (header + body) for ADMIN
                        const fullEditHtml = await generateAdminEditViewHtml(order);

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
                            console.error("[Admin] Could not find .order-card-body in generated edit HTML.");
                            // Fallback: Replace the whole card (less ideal)
                            card.innerHTML = fullEditHtml;
                            updateProductDropdown(card);
                        }
                    } else {
                        console.error("[Admin] Could not find .order-details-container.");
                        // Fallback: Replace the whole card
                        card.innerHTML = await generateAdminEditViewHtml(order);
                        updateProductDropdown(card);
                    }
                } else {
                    // Original behavior for non-dispatch cards
                    card.innerHTML = await generateAdminEditViewHtml(order);
                    updateProductDropdown(card);
                }
            },
            'admin-save-changes-btn': async () => {
                if (!order) return;
                const updatedItems = Array.from(card.querySelectorAll('.edit-item-list li, .new-item-list li')).map(li => ({
                    productId: li.dataset.productId,
                    quantity: li.querySelector('.qty-input').value,
                    price: li.querySelector('.price-input').value
                }));

                await fetch('/api/admin/orders/edit', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order._id, updatedItems })
                });
                // SSE will handle reload
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
                            districtSelect.innerHTML = '<option value="">Error loading</option>';
                            talukSelect.innerHTML = '<option value="">Error loading</option>';
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
                    // Use admin endpoint for saving (assuming staff have permission via middleware)
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
                // No finally block needed if reloading the list anyway
            },
        };

        for (const cls in actions) {
            if (e.target.classList.contains(cls)) {
                actions[cls]();
                break;
            }
        }
    });

    // public/js/admin.js
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

    // --- (Keep apiUpdateStatus, apiApproveRate, apiAssignAgent functions) ---
    async function apiUpdateStatus(orderId, status, bodyData = {}) {
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
        }
    }

    async function apiApproveRate(orderId) {
        try {
            const res = await fetch(`/api/admin/orders/approve-rate`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || res.statusText);
            }
        } catch (error) {
            console.error("Error approving rate:", error);
            alert(`Failed to approve rate: ${error.message}`);
        }
    }

    async function apiAssignAgent(orderId, agentName, agentMobile, agentDescription, card) {
        const agentAddress = card.querySelector('.agent-address-input').value;
        const msgEl = card.querySelector('.edit-msg');
        const saveBtn = card.querySelector('.save-agent-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerText = 'Saving...';
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
        }
        catch (error) {
            if (msgEl) {
                msgEl.innerText = `Error saving agent: ${error.message}`; msgEl.style.color = 'red';
            }
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save Agent';
            }
        }
        if (msgEl) {
            setTimeout(() => { msgEl.innerText = ''; }, 3000);
        }
    }


    // --- (Keep resetProductForm, setupEditForm, attachProductEventListeners) ---
    function resetProductForm() {
        productForm.reset();
        productIdInput.value = '';
        productFormTitle.innerText = 'Add New Product';
        productSubmitBtn.innerText = 'Add Product';
        productCancelBtn.style.display = 'none';
    }

    function setupEditForm(product) {
        productIdInput.value = product._id;
        productNameInput.value = product.name;
        productDescInput.value = product.description;
        productPriceInput.value = product.price;
        productUnitInput.value = product.unit || '';
        productSkuInput.value = product.sku;
        productFormTitle.innerText = `Editing: ${product.name}`;
        productSubmitBtn.innerText = 'Update Product';
        productCancelBtn.style.display = 'inline-block';
        window.scrollTo(0, 0);
    }

    function attachProductEventListeners() {
        const list = document.getElementById('productList');
        list.addEventListener('click', async (e) => {
            const card = e.target.closest('.card');
            if (!card) return;

            if (e.target.closest('.order-card-header')) return;

            if (e.target.matches('.edit-btn')) {
                const product = allProducts.find(p => p._id === e.target.dataset.id);
                if (product) setupEditForm(product);
            } else if (e.target.matches('.delete-btn')) {
                if (confirm('Are you sure?')) {
                    await fetch(`/api/products/${e.target.dataset.id}`, { method: 'DELETE' });
                    loadProducts();
                }
            } else if (e.target.matches('.visibility-btn')) {
                await fetch(`/api/products/${e.target.dataset.id}/visibility`, { method: 'PATCH' });
                loadProducts();
            }
        });
    }


    // --- (Keep nav button listeners, login/logout/product form submit listeners) ---
    Object.keys(navButtons).forEach(key => {
        if (navButtons[key]) navButtons[key].addEventListener('click', () => showSection(key));
    });

    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const res = await fetch('/api/admin/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.value, password: password.value })
            });
            if (res.ok) showAdminPanel(); else loginMsg.innerText = 'Invalid login';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => { await fetch('/api/admin/logout', { method: 'POST' }); showLoginBox(); });
    }

    if (productCancelBtn) {
        productCancelBtn.addEventListener('click', resetProductForm);
    }

    if (productForm) {
        productForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const id = productIdInput.value;
            const url = id ? `/api/products/${id}` : '/api/products';
            const method = id ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: productNameInput.value, description: productDescInput.value,
                    price: productPriceInput.value, unit: productUnitInput.value, sku: productSkuInput.value,
                })
            });
            if (res.ok) {
                productFormMsg.innerText = `Product ${id ? 'updated' : 'added'}!`;
                resetProductForm(); loadProducts();
            } else {
                productFormMsg.innerText = `Error: ${(await res.json()).error}`;
            }
            setTimeout(() => { productFormMsg.innerText = '' }, 3000);
        });
    }

    // --- Initial Check ---
    checkAdmin();
});

