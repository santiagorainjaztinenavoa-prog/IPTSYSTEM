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
        
        this.initializeEventListeners();
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
    }

    // Handle registration form submission
    async handleRegister(e) {
        e.preventDefault();

        const formData = new FormData(this.form);
        const firstName = (formData.get('FirstName') || '').toString().trim();
        const lastName = (formData.get('LastName') || '').toString().trim();
        const accountType = (formData.get('AccountType') || '').toString();
        const data = {
            // Combine first and last name into fullName for server-side compatibility
            fullName: `${firstName} ${lastName}`.trim(),
            email: formData.get('Email'),
            username: formData.get('Username'),
            password: formData.get('Password'),
            confirmPassword: formData.get('ConfirmPassword'),
            agreeToTerms: formData.get('AgreeToTerms') !== null
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
                const result = await window.firebaseRegister(firstName, lastName, data.email, data.password, data.username, accountType);

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
                                AgreeToTerms: data.agreeToTerms
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
                    body: JSON.stringify(data)
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
        // Full name validation
        if (!data.fullName || data.fullName.trim().length < 2) {
            this.showToast('Validation Error', 'Full name must be at least 2 characters', 'warning');
            return false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!data.email || !emailRegex.test(data.email)) {
            this.showToast('Validation Error', 'Please enter a valid email address', 'warning');
            return false;
        }

        // Username validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        if (!data.username || !usernameRegex.test(data.username)) {
            this.showToast('Validation Error', 'Username must be 3-50 characters (letters, numbers, underscore only)', 'warning');
            return false;
        }

        // Password validation
        if (!data.password || data.password.length < 6) {
            this.showToast('Validation Error', 'Password must be at least 6 characters', 'warning');
            return false;
        }

        // Password match validation
        if (data.password !== data.confirmPassword) {
            this.showToast('Validation Error', 'Passwords do not match', 'warning');
            return false;
        }

        // Terms agreement validation
        if (!data.agreeToTerms) {
            this.showToast('Validation Error', 'You must agree to the Terms and Conditions', 'warning');
            return false;
        }

        return true;
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
