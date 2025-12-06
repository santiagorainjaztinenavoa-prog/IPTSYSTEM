// ========== REGISTER CONTROLLER - Handles Registration Logic ==========
class RegisterController {
    constructor() {
        this.form = document.getElementById('registerForm');
        this.passwordInput = document.getElementById('passwordInput');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.passwordIcon = document.getElementById('passwordIcon');
        this.confirmPasswordInput = document.getElementById('confirmPasswordInput');
        this.confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
        this.confirmPasswordIcon = document.getElementById('confirmPasswordIcon');
        this.googleRegisterBtn = document.getElementById('googleRegisterBtn');
        this.facebookRegisterBtn = document.getElementById('facebookRegisterBtn');

        // Address elements
        this.regionSelect = document.getElementById('regionSelect');
        this.provinceSelect = document.getElementById('provinceSelect');
        this.citySelect = document.getElementById('citySelect');
        this.barangaySelect = document.getElementById('barangaySelect');
        this.addressDisplay = document.getElementById('AddressDisplay');
        this.postalCodeInput = document.getElementById('PostalCode');
        this.streetAddressInput = document.getElementById('StreetAddress');

        // Hidden mirror inputs for posting to server
        this.regionHidden = document.getElementById('Region');
        this.provinceHidden = document.getElementById('Province');
        this.cityHidden = document.getElementById('City');
        this.barangayHidden = document.getElementById('Barangay');

        // Firebase geo helper (populated by firebase-client.js)
        this.geo = window.firebaseGeo || null;
        // Fallback static minimal PH geo data (NCR and sample others)
        this.fallbackGeo = {
            regions: [
                { code: 'NCR', name: 'National Capital Region' },
                { code: 'REG4A', name: 'CALABARZON' }
            ],
            provincesByRegion: {
                'REG4A': [
                    { code: 'CAV', name: 'Cavite', regionCode: 'REG4A' },
                    { code: 'LAG', name: 'Laguna', regionCode: 'REG4A' }
                ]
            },
            citiesByRegion: {
                'NCR': [
                    { code: 'MNL', name: 'Manila', regionCode: 'NCR' },
                    { code: 'QZN', name: 'Quezon City', regionCode: 'NCR' }
                ]
            },
            citiesByProvince: {
                'CAV': [ { code: 'IMUS', name: 'Imus', provinceCode: 'CAV', regionCode: 'REG4A' } ],
                'LAG': [ { code: 'SCLR', name: 'Santa Clara (Sample)', provinceCode: 'LAG', regionCode: 'REG4A' } ]
            },
            barangaysByCity: {
                'MNL': [ { code: 'BRGY1', name: 'Barangay 1' }, { code: 'BRGY2', name: 'Barangay 2' } ],
                'QZN': [ { code: 'BRGYQ1', name: 'Commonwealth' } ],
                'IMUS': [ { code: 'IMUS1', name: 'Tanzang Luma' } ]
            }
        };
        this.initializeEventListeners();
        this.loadRegions();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Password toggle
        if (this.passwordToggle) {
            this.passwordToggle.addEventListener('click', () => this.togglePasswordVisibility('password'));
        }

        // Confirm password toggle
        if (this.confirmPasswordToggle) {
            this.confirmPasswordToggle.addEventListener('click', () => this.togglePasswordVisibility('confirm'));
        }

        // Social register buttons
        if (this.googleRegisterBtn) {
            this.googleRegisterBtn.addEventListener('click', () => this.handleGoogleRegister());
        }

        if (this.facebookRegisterBtn) {
            this.facebookRegisterBtn.addEventListener('click', () => this.handleFacebookRegister());
        }

        // Real-time password match validation
        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.addEventListener('input', () => this.validatePasswordMatch());
        }

        // Address cascading
        if (this.regionSelect) this.regionSelect.addEventListener('change', () => this.onRegionChange());
        if (this.provinceSelect) this.provinceSelect.addEventListener('change', () => this.onProvinceChange());
        if (this.citySelect) this.citySelect.addEventListener('change', () => this.onCityChange());
        if (this.barangaySelect) this.barangaySelect.addEventListener('change', () => this.updateAddressDisplay());
    }

    // ========== GEO DATA LOADING (Firebase) ==========
    async loadRegions() {
        if (!this.regionSelect) return;
        let regions = [];
        try {
            if (this.geo?.loadRegions) {
                regions = await this.geo.loadRegions();
            }
        } catch (e) { console.warn('Geo loadRegions failed, will use fallback', e); }
        if (!Array.isArray(regions) || regions.length === 0) {
            console.warn('Using fallback region data (Firestore empty or not seeded)');
            regions = this.fallbackGeo.regions;
        }
        this.regionSelect.innerHTML = '<option value="">Region</option>';
        regions.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
            .forEach(r=>{
                const opt=document.createElement('option');
                opt.value=r.code; opt.textContent=r.name||r.code; opt.dataset.name=r.name||''; this.regionSelect.appendChild(opt);
            });
    }

    async onRegionChange() {
        const code = this.regionSelect.value; const name = this.regionSelect.selectedOptions[0]?.dataset?.name || '';
        // Reflect hidden
        if (this.regionHidden) this.regionHidden.value = name;

        // Reset children
        this.provinceSelect.innerHTML = '<option value="">Province</option>';
        this.citySelect.innerHTML = '<option value="">City / Municipality</option>';
        this.barangaySelect.innerHTML = '<option value="">Barangay</option>';
        this.provinceSelect.disabled = true; this.citySelect.disabled = true; this.barangaySelect.disabled = true;

        this.updateAddressDisplay(); if (!code) return;
        // Try Firestore provinces
        let provinces = [];
        try { if (this.geo?.loadProvincesByRegion) provinces = await this.geo.loadProvincesByRegion(code); } catch { /* ignore */ }
        if ((!provinces || provinces.length===0) && this.fallbackGeo.provincesByRegion[code]) {
            provinces = this.fallbackGeo.provincesByRegion[code];
        }
        if (provinces && provinces.length>0) {
            this.provinceSelect.disabled = false;
            provinces.sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{ const opt=document.createElement('option'); opt.value=p.code; opt.textContent=p.name; opt.dataset.name=p.name; this.provinceSelect.appendChild(opt); });
        } else {
            // No provinces (e.g. NCR) -> load cities by region
            await this.loadCitiesByRegion(code);
        }
    }

    async loadCitiesByRegion(regionCode) {
        let cities = [];
        try { if (this.geo?.loadCitiesByRegion) cities = await this.geo.loadCitiesByRegion(regionCode); } catch { }
        if ((!cities || cities.length===0) && this.fallbackGeo.citiesByRegion[regionCode]) {
            cities = this.fallbackGeo.citiesByRegion[regionCode];
        }
        this.citySelect.innerHTML = '<option value="">City / Municipality</option>';
        this.citySelect.disabled = false;
        (cities||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{ const opt=document.createElement('option'); opt.value=c.code; opt.textContent=c.name; opt.dataset.name=c.name; this.citySelect.appendChild(opt); });
    }

    async onProvinceChange() {
        const provinceCode = this.provinceSelect.value; const name = this.provinceSelect.selectedOptions[0]?.dataset?.name || '';
        if (this.provinceHidden) this.provinceHidden.value = name;
        // Reset children
        this.citySelect.innerHTML = '<option value="">City / Municipality</option>';
        this.barangaySelect.innerHTML = '<option value="">Barangay</option>';
        this.citySelect.disabled = true; this.barangaySelect.disabled = true; this.updateAddressDisplay(); if (!provinceCode) return;
        let cities = [];
        try { if (this.geo?.loadCitiesByProvince) cities = await this.geo.loadCitiesByProvince(provinceCode); } catch { }
        if ((!cities || cities.length===0) && this.fallbackGeo.citiesByProvince[provinceCode]) cities = this.fallbackGeo.citiesByProvince[provinceCode];
        this.citySelect.disabled = false;
        (cities||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>{ const opt=document.createElement('option'); opt.value=c.code; opt.textContent=c.name; opt.dataset.name=c.name; this.citySelect.appendChild(opt); });
    }

    async onCityChange() {
        const cityCode = this.citySelect.value; const name = this.citySelect.selectedOptions[0]?.dataset?.name || '';
        if (this.cityHidden) this.cityHidden.value = name;
        this.barangaySelect.innerHTML = '<option value="">Barangay</option>';
        this.barangaySelect.disabled = true; this.updateAddressDisplay(); if (!cityCode) return;
        let brgys = [];
        try { if (this.geo?.loadBarangaysByCity) brgys = await this.geo.loadBarangaysByCity(cityCode); } catch { }
        if ((!brgys || brgys.length===0) && this.fallbackGeo.barangaysByCity[cityCode]) brgys = this.fallbackGeo.barangaysByCity[cityCode];
        this.barangaySelect.disabled = false;
        (brgys||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(b=>{ const opt=document.createElement('option'); opt.value=b.code; opt.textContent=b.name; opt.dataset.name=b.name; this.barangaySelect.appendChild(opt); });
    }

    updateAddressDisplay() {
        const regionName = this.regionSelect?.selectedOptions[0]?.dataset?.name || '';
        const provinceName = this.provinceSelect?.selectedOptions[0]?.dataset?.name || '';
        const cityName = this.citySelect?.selectedOptions[0]?.dataset?.name || '';
        const barangayName = this.barangaySelect?.selectedOptions[0]?.dataset?.name || '';

        if (this.regionHidden) this.regionHidden.value = regionName || '';
        if (this.provinceHidden) this.provinceHidden.value = provinceName || '';
        if (this.cityHidden) this.cityHidden.value = cityName || '';
        if (this.barangayHidden) this.barangayHidden.value = barangayName || '';

        const parts = [regionName, provinceName, cityName, barangayName].filter(Boolean);
        if (this.addressDisplay) this.addressDisplay.value = parts.join(', ');
    }

    // Handle registration form submission
    async handleRegister(e) {
        e.preventDefault();

        const formData = new FormData(this.form);
        const firstName = (formData.get('FirstName') || '').toString().trim();
        const lastName = (formData.get('LastName') || '').toString().trim();
        const accountType = (formData.get('AccountType') || '').toString();
        const phoneNumber = (formData.get('PhoneNumber') || '').toString().trim();
        const region = (formData.get('Region') || '').toString();
        const province = (formData.get('Province') || '').toString();
        const city = (formData.get('City') || '').toString();
        const barangay = (formData.get('Barangay') || '').toString();
        const postalCode = (formData.get('PostalCode') || '').toString();
        const streetAddress = (formData.get('StreetAddress') || '').toString();
        const composedAddress = (formData.get('Address') || this.addressDisplay?.value || '').toString();

        const data = {
            // Combine first and last name into fullName for server-side compatibility
            fullName: `${firstName} ${lastName}`.trim(),
            email: formData.get('Email'),
            username: formData.get('Username'),
            password: formData.get('Password'),
            confirmPassword: formData.get('ConfirmPassword'),
            agreeToTerms: formData.get('AgreeToTerms') !== null,
            accountType: accountType,
            phoneNumber: phoneNumber,
            region,
            province,
            city,
            barangay,
            postalCode,
            streetAddress,
            address: composedAddress
        };

        // Client-side validation
        if (!this.validateForm(data)) {
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            // Prefer client-side Firebase registration if available
            if (typeof window.firebaseRegister === 'function') {
                const result = await window.firebaseRegister(
                    firstName,
                    lastName,
                    data.email,
                    data.password,
                    data.username,
                    accountType,
                    phoneNumber,
                    region,
                    province,
                    city,
                    barangay,
                    postalCode,
                    streetAddress,
                    composedAddress
                );

                if (result && result.success) {
                    // Also notify server fallback so server can track registered users for demo login
                    try {
                        await fetch('/Home/Register', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'RequestVerificationToken': formData.get('__RequestVerificationToken')
                            },
                            body: JSON.stringify({
                                AccountType: accountType,
                                FullName: data.fullName,
                                Email: data.email,
                                Username: data.username,
                                Password: data.password,
                                ConfirmPassword: data.confirmPassword,
                                AgreeToTerms: data.agreeToTerms,
                                PhoneNumber: phoneNumber,
                                Region: region,
                                Province: province,
                                City: city,
                                Barangay: barangay,
                                PostalCode: postalCode,
                                StreetAddress: streetAddress,
                                Address: composedAddress
                            })
                        });
                    } catch (ex) {
                        console.warn('Server fallback registration failed (non-blocking):', ex);
                    }

                    this.showToast('Success!', 'Account created successfully! Redirecting to login...', 'success');
                    setTimeout(() => window.location.href = '/Home/Login', 1400);
                } else {
                    const code = result?.code ? result.code : null;
                    const message = result?.message || 'Unknown error';

                    // Helpful guidance for common Firebase errors
                    if (code === 'auth/operation-not-allowed') {
                        // Try to get projectId from the loaded config for a direct console link
                        const pid = (window.__firebaseConfig && window.__firebaseConfig.projectId) ? window.__firebaseConfig.projectId : null;
                        const consoleLink = pid ? `https://console.firebase.google.com/project/${pid}/authentication/providers` : 'https://console.firebase.google.com/project/_/authentication/providers';
                        this.showToast('Registration Failed: Email/Password sign-in disabled', 'Email/Password sign-in is not enabled for this Firebase project. Open the Firebase Console Authentication -> Sign-in method and enable Email/Password. See console for a link.', 'error');
                        console.error('Firebase auth error (operation-not-allowed). To fix: enable Email/Password provider in Firebase Console:', consoleLink);
                    } else if (code === 'auth/email-already-in-use') {
                        this.showToast('Registration Failed', 'That email is already in use. Try logging in or use a different email.', 'error');
                    } else if (code === 'auth/weak-password') {
                        this.showToast('Registration Failed', 'Password is too weak. Use at least 6 characters.', 'error');
                    } else {
                        const display = code ? '[' + code + '] ' + message : message;
                        this.showToast('Registration Failed: ' + display, 'error');
                    }

                    console.warn('Registration error response', result);
                    this.setLoadingState(false);
                }
            } else {
                // Fallback: server-side registration POST
                const response = await fetch('/Home/Register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'RequestVerificationToken': formData.get('__RequestVerificationToken')
                    },
                    body: JSON.stringify({
                        AccountType: accountType,
                        FullName: data.fullName,
                        Email: data.email,
                        Username: data.username,
                        Password: data.password,
                        ConfirmPassword: data.confirmPassword,
                        AgreeToTerms: data.agreeToTerms,
                        PhoneNumber: phoneNumber,
                        Region: region,
                        Province: province,
                        City: city,
                        Barangay: barangay,
                        PostalCode: postalCode,
                        StreetAddress: streetAddress,
                        Address: composedAddress
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.showToast('Success!', result.message, 'success');
                    setTimeout(() => window.location.href = result.redirectUrl || '/Home/Login', 1500);
                } else {
                    this.showToast('Registration Failed', result.message, 'error');
                    this.setLoadingState(false);
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Error', error?.message || 'An unexpected error occurred. Please try again.', 'error');
            this.setLoadingState(false);
        }
    }

    // Validate form data
    validateForm(data) {
        // Clear all previous validation errors
        this.clearValidationErrors();
        
        let isValid = true;
        
        // Account type validation
        const accountTypeSelect = document.getElementById('AccountType');
        if (!data.accountType || data.accountType.trim().length === 0) {
            this.showFieldError(accountTypeSelect, 'Please select an account type');
            if (isValid) { this.showToast('Validation Error', 'Please select an account type', 'warning'); isValid = false; }
        }
        
        // Full name validation
        const firstName = document.getElementById('FirstName');
        const lastName = document.getElementById('LastName');
        if (!data.fullName || data.fullName.trim().length < 2) {
            this.showFieldError(firstName, 'First name is required');
            this.showFieldError(lastName, 'Last name is required');
            if (isValid) { this.showToast('Validation Error', 'Full name must be at least 2 characters', 'warning'); isValid = false; }
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailInput = document.getElementById('Email');
        if (!data.email || !emailRegex.test(data.email)) {
            this.showFieldError(emailInput, 'Please enter a valid email address');
            if (isValid) { this.showToast('Validation Error', 'Please enter a valid email address', 'warning'); isValid = false; }
        }

        // Username validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        const usernameInput = document.getElementById('Username');
        if (!data.username || !usernameRegex.test(data.username)) {
            this.showFieldError(usernameInput, 'Username must be 3-50 characters (letters, numbers, underscore only)');
            if (isValid) { this.showToast('Validation Error', 'Username must be 3-50 characters (letters, numbers, underscore only)', 'warning'); isValid = false; }
        }

        // Phone number validation
        const phoneInput = document.getElementById('PhoneNumber');
        if (!data.phoneNumber || data.phoneNumber.trim().length === 0) {
            this.showFieldError(phoneInput, 'Phone number is required');
            if (isValid) { this.showToast('Validation Error', 'Phone number is required', 'warning'); isValid = false; }
        } else {
            // Basic phone number format validation (at least 10 digits)
            const phoneRegex = /^[\d\s\-\+\(\)]{10,20}$/;
            if (!phoneRegex.test(data.phoneNumber)) {
                this.showFieldError(phoneInput, 'Please enter a valid phone number');
                if (isValid) { this.showToast('Validation Error', 'Please enter a valid phone number', 'warning'); isValid = false; }
            }
        }

        // Location validation
        const locationValidation = document.getElementById('locationValidation');
        if (!data.region || !data.city || !data.barangay) {
            if (locationValidation) locationValidation.textContent = 'Please select Region, City/Municipality and Barangay';
            this.highlightField(this.regionSelect, !data.region);
            this.highlightField(this.citySelect, !data.city);
            this.highlightField(this.barangaySelect, !data.barangay);
            if (isValid) { this.showToast('Validation Error', 'Please select Region, City/Municipality and Barangay', 'warning'); isValid = false; }
        }

        // Postal code and street address validation
        const addressValidation = document.getElementById('addressValidation');
        const postalCodeInput = document.getElementById('PostalCode');
        const streetAddressInput = document.getElementById('StreetAddress');
        
        if (!data.postalCode || data.postalCode.trim().length === 0) {
            this.showFieldError(postalCodeInput, 'Postal code is required');
            if (addressValidation) addressValidation.textContent = 'Postal code is required';
            if (isValid) { this.showToast('Validation Error', 'Postal code is required', 'warning'); isValid = false; }
        }
        
        if (!data.streetAddress || data.streetAddress.trim().length === 0) {
            this.showFieldError(streetAddressInput, 'Street address is required');
            if (addressValidation && !addressValidation.textContent) addressValidation.textContent = 'Street address is required';
            else if (addressValidation && addressValidation.textContent) addressValidation.textContent = 'Postal code and street address are required';
            if (isValid) { this.showToast('Validation Error', 'Street address is required', 'warning'); isValid = false; }
        }

        // Password validation
        if (!data.password || data.password.length < 6) {
            this.showFieldError(this.passwordInput, 'Password must be at least 6 characters');
            if (isValid) { this.showToast('Validation Error', 'Password must be at least 6 characters', 'warning'); isValid = false; }
        }

        // Password match validation
        if (data.password !== data.confirmPassword) {
            this.showFieldError(this.confirmPasswordInput, 'Passwords do not match');
            if (isValid) { this.showToast('Validation Error', 'Passwords do not match', 'warning'); isValid = false; }
        }

        // Terms agreement validation
        const termsCheckbox = document.getElementById('agreeToTerms');
        if (!data.agreeToTerms) {
            if (termsCheckbox) termsCheckbox.classList.add('is-invalid');
            if (isValid) { this.showToast('Validation Error', 'You must agree to the Terms and Conditions', 'warning'); isValid = false; }
        }

        return isValid;
    }
    
    // Clear all validation error styling
    clearValidationErrors() {
        // Remove is-invalid class from all inputs
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        // Clear validation message spans
        document.querySelectorAll('.field-error').forEach(el => el.remove());
        const locationValidation = document.getElementById('locationValidation');
        const addressValidation = document.getElementById('addressValidation');
        if (locationValidation) locationValidation.textContent = '';
        if (addressValidation) addressValidation.textContent = '';
    }
    
    // Show field error with red border
    showFieldError(input, message) {
        if (!input) return;
        input.classList.add('is-invalid');
    }
    
    // Highlight field with red border
    highlightField(input, shouldHighlight) {
        if (!input) return;
        if (shouldHighlight) {
            input.classList.add('is-invalid');
        } else {
            input.classList.remove('is-invalid');
        }
    }

    // Validate password match in real-time
    validatePasswordMatch() {
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (confirmPassword.length > 0) {
            if (password === confirmPassword) {
                this.confirmPasswordInput.classList.remove('is-invalid');
                this.confirmPasswordInput.classList.add('is-valid');
            } else {
                this.confirmPasswordInput.classList.remove('is-valid');
                this.confirmPasswordInput.classList.add('is-invalid');
            }
        } else {
            this.confirmPasswordInput.classList.remove('is-valid', 'is-invalid');
        }
    }

    // Toggle password visibility
    togglePasswordVisibility(type) {
        if (type === 'password') {
            const isPassword = this.passwordInput.type === 'password';
            this.passwordInput.type = isPassword ? 'text' : 'password';
            
            if (isPassword) {
                this.passwordIcon.classList.remove('bi-eye');
                this.passwordIcon.classList.add('bi-eye-slash');
            } else {
                this.passwordIcon.classList.remove('bi-eye-slash');
                this.passwordIcon.classList.add('bi-eye');
            }
        } else if (type === 'confirm') {
            const isPassword = this.confirmPasswordInput.type === 'password';
            this.confirmPasswordInput.type = isPassword ? 'text' : 'password';
            
            if (isPassword) {
                this.confirmPasswordIcon.classList.remove('bi-eye');
                this.confirmPasswordIcon.classList.add('bi-eye-slash');
            } else {
                this.confirmPasswordIcon.classList.remove('bi-eye-slash');
                this.confirmPasswordIcon.classList.add('bi-eye');
            }
        }
    }

    // Handle Google registration
    async handleGoogleRegister() {
        this.showToast('Google Sign Up', 'Redirecting to Google authentication...', 'info');
        
        setTimeout(() => {
            console.log('Google registration initiated');
            this.showToast('Demo Mode', 'Google sign up would redirect in production', 'warning');
        }, 500);
    }

    // Handle Facebook registration
    async handleFacebookRegister() {
        this.showToast('Facebook Sign Up', 'Redirecting to Facebook authentication...', 'info');
        
        setTimeout(() => {
            console.log('Facebook registration initiated');
            this.showToast('Demo Mode', 'Facebook sign up would redirect in production', 'warning');
        }, 500);
    }

    // Set loading state for register button
    setLoadingState(isLoading) {
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnSpinner = submitBtn.querySelector('.btn-spinner');

        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.classList.add('loading');
            btnText.classList.add('d-none');
            btnSpinner.classList.remove('d-none');
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            btnText.classList.remove('d-none');
            btnSpinner.classList.add('d-none');
        }
    }

    // Show toast notification
    showToast(title, message, type = 'info') {
        const toastElement = document.getElementById('registerToast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');

        // Set content
        toastTitle.textContent = title;
        toastMessage.textContent = message;

        // Update icon and styling based on type
        toastElement.className = 'toast';
        toastElement.classList.add(`toast-${type}`);

        switch (type) {
            case 'success':
                toastIcon.className = 'bi bi-check-circle-fill me-2 text-success';
                break;
            case 'error':
                toastIcon.className = 'bi bi-x-circle-fill me-2 text-danger';
                break;
            case 'warning':
                toastIcon.className = 'bi bi-exclamation-triangle-fill me-2 text-warning';
                break;
            default:
                toastIcon.className = 'bi bi-info-circle-fill me-2 text-primary';
        }

        // Show toast
        const toast = new bootstrap.Toast(toastElement, {
            autohide: true,
            delay: 4000
        });
        toast.show();
    }
}

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new RegisterController();
});

// Debug: print loaded firebase config when present to help diagnose auth issues
try {
    if (typeof window.__firebaseConfig !== 'undefined') {
        console.debug('Loaded firebase config:', window.__firebaseConfig);
    }
} catch (e) {
    console.debug('No firebase config available:', e);
}
