document.addEventListener('DOMContentLoaded', async () => {
    let LOCS = {};
    const districtEl = document.getElementById('district');
    const talukEl = document.getElementById('taluk');
    const msgEl = document.getElementById('msg');

    // References to display and edit views
    const displayView = document.getElementById('displayView');
    const editView = document.getElementById('editView');

    // References to buttons
    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    // References to display elements
    const displayMobile = document.getElementById('display_mobile');
    const displayAltMobile = document.getElementById('display_altMobile');
    const displayName = document.getElementById('display_name');
    const displayEmail = document.getElementById('display_email');
    const displayDistrict = document.getElementById('display_district');
    const displayTaluk = document.getElementById('display_taluk');
    const displayAddress = document.getElementById('display_address');
    const displayPincode = document.getElementById('display_pincode');

    // References to form input elements
    const mobileInput = document.getElementById('mobile');
    const altMobileInput = document.getElementById('altMobile');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const addressInput = document.getElementById('address'); // Added address input
    const pincodeInput = document.getElementById('pincode');

    // --- Helper Functions ---

    // Fetch locations and populate districts
    async function fetchLocations() {
        try {
            const res = await fetch('/api/locations');
            if (!res.ok) throw new Error('Failed to fetch locations');
            LOCS = await res.json();
            districtEl.innerHTML = '<option value="">Select district</option>';
            // Sort districts alphabetically before adding
            const sortedDistricts = Object.keys(LOCS).sort();
            for (const d of sortedDistricts) {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                districtEl.appendChild(opt);
            }
        } catch (error) {
            console.error("Error fetching locations:", error);
            msgEl.innerText = "Error loading location data.";
            msgEl.style.color = 'red';
        }
    }

    // Populate taluks based on district selection
    districtEl.addEventListener('change', () => {
        talukEl.innerHTML = '<option value="">Select taluk</option>';
        const selectedDistrict = districtEl.value;
        const talukList = LOCS[selectedDistrict] || [];
        // Sort taluks alphabetically before adding
        const sortedTaluks = talukList.sort();
        for (const t of sortedTaluks) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            talukEl.appendChild(opt);
        }
    });

    // Helper to update display view elements
    function updateDisplayView(user) {
        displayMobile.textContent = user.mobile || 'N/A';
        displayAltMobile.textContent = user.altMobile || 'N/A';
        displayName.textContent = user.name || 'N/A';
        displayEmail.textContent = user.email || 'N/A';
        displayDistrict.textContent = user.district || 'N/A';
        displayTaluk.textContent = user.taluk || 'N/A';
        displayAddress.textContent = user.address || 'N/A'; // Update address display
        displayPincode.textContent = user.pincode || 'N/A';
    }

    // Fetch and populate current user profile (both views)
    async function loadProfile() {
        await fetchLocations(); // Load locations first
        try {
            const res = await fetch('/api/user/profile');
            if (!res.ok) {
                if (res.status === 401) {
                    msgEl.innerText = 'Please log in to view your profile.';
                    msgEl.style.color = 'red';
                    setTimeout(() => window.location.href = '/login.html', 1500);
                } else {
                    throw new Error(`Server error: ${res.status}`);
                }
                return;
            }
            const user = await res.json();

            // Populate Edit Form Fields
            mobileInput.value = user.mobile || '';
            altMobileInput.value = user.altMobile || '';
            nameInput.value = user.name || '';
            emailInput.value = user.email || '';
            addressInput.value = user.address || ''; // Populate address input
            pincodeInput.value = user.pincode || '';

            // Set dropdowns and trigger change for taluk population
            if (user.district) {
                districtEl.value = user.district;
                districtEl.dispatchEvent(new Event('change')); // Important to populate taluks
                // Need a slight delay for taluks to populate before setting value
                setTimeout(() => {
                    if (user.taluk) {
                        talukEl.value = user.taluk;
                    }
                }, 50); // Adjust delay if needed
            } else {
                 districtEl.dispatchEvent(new Event('change')); // Ensure taluk list is cleared if no district
            }


            // Populate Display View Elements
            updateDisplayView(user);

            // Show display view initially
            displayView.style.display = 'block';
            editView.style.display = 'none';

        } catch (error) {
            console.error("Error loading profile:", error);
            msgEl.innerText = 'Failed to load profile data.';
            msgEl.style.color = 'red';
        }
    }

    // --- Event Listeners for Mode Switching ---

    // Edit Button: Show Edit View, Hide Display View
    editProfileBtn.addEventListener('click', () => {
        displayView.style.display = 'none';
        editView.style.display = 'block';
        msgEl.innerText = ''; // Clear any previous messages
    });

    // Cancel Button: Show Display View, Hide Edit View
    cancelEditBtn.addEventListener('click', () => {
        displayView.style.display = 'block';
        editView.style.display = 'none';
        msgEl.innerText = ''; // Clear any previous messages
        // Re-load profile to reset any unsaved changes in the form
        loadProfile();
    });

    // Save Button (Previously Update Button): Handle profile update
    saveProfileBtn.addEventListener('click', async () => {
        msgEl.innerText = '';
        msgEl.style.color = 'red';

        // --- Validation Block (Updated for Address) ---
        const altMobile = altMobileInput.value.trim();
        const name = nameInput.value.trim();
        const address = addressInput.value.trim(); // Get address
        const pincode = pincodeInput.value.trim();
        const email = emailInput.value.trim(); // Get email for validation

        if (altMobile && (altMobile.length !== 10 || !/^\d{10}$/.test(altMobile))) {
            msgEl.innerText = 'Alternative mobile number must be exactly 10 digits.';
            return;
        }
        if (name.length > 29) { // Use maxlength from input
            msgEl.innerText = 'Name must be 29 characters or less.';
            return;
        }
         // Optional: Email format validation
        if (email && !/\S+@\S+\.\S+/.test(email)) {
             msgEl.innerText = 'Please enter a valid email address.';
             return;
        }
        if (address.length > 150) { // Check address length from textarea maxlength
            msgEl.innerText = 'Address must be 150 characters or less.';
            return;
        }
        if (pincode && (pincode.length !== 6 || !/^\d{6}$/.test(pincode))) {
            msgEl.innerText = 'Pincode must be exactly 6 digits.';
            return;
        }
        // --- End of Validation Block ---

        const profileData = {
            altMobile: altMobile,
            name: name,
            email: email,
            district: districtEl.value,
            taluk: talukEl.value,
            address: address, // Send address instead of place/landmark
            pincode: pincode
        };

        // Disable button while saving
        saveProfileBtn.disabled = true;
        saveProfileBtn.innerText = 'Saving...';

        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });

            const data = await res.json();
            if (res.ok) {
                msgEl.style.color = 'green';
                msgEl.innerText = 'Profile updated successfully!';

                // --- FIX: Read mobile from disabled input ---
                const currentMobile = mobileInput.value;

                // Update the display view with new data, including the mobile number
                updateDisplayView({ ...profileData, mobile: currentMobile });

                // Switch back to display view
                displayView.style.display = 'block';
                editView.style.display = 'none';

                // Clear message after a delay
                setTimeout(() => msgEl.innerText = '', 3000);

            } else {
                msgEl.style.color = 'red';
                msgEl.innerText = data.error || 'Failed to update profile.';
                // Stay in edit view on failure
            }
        } catch (error) {
             console.error("Error saving profile:", error);
             msgEl.style.color = 'red';
             msgEl.innerText = 'An error occurred while saving.';
        } finally {
            // Re-enable button
            saveProfileBtn.disabled = false;
            saveProfileBtn.innerText = 'Save Changes';
        }
    });

    // Initial load
    loadProfile();
});