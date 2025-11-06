// ========== LOGIN CONTROLLER - Handles Login Logic ==========

class LoginController {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.passwordInput = document.getElementById('passwordInput');
        this.passwordToggle = document.getElementById('passwordToggle');
        this.passwordIcon = document.getElementById('passwordIcon');
        this.googleLoginBtn = document.getElementById('googleLoginBtn');
        this.facebookLoginBtn = document.getElementById('facebookLoginBtn');
        
        this.initializeEventListeners();
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Password toggle
        if (this.passwordToggle) {
            this.passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
        }

        // Social login buttons
        if (this.googleLoginBtn) {
            this.googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
        }

        if (this.facebookLoginBtn) {
            this.facebookLoginBtn.addEventListener('click', () => this.handleFacebookLogin());
        }

        // Enter key in password field
        if (this.passwordInput) {
            this.passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.form.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            });
        }
    }

    // Handle standard login form submission
    async handleLogin(e) {
        e.preventDefault();

        const formData = new FormData(this.form);
        const data = {
            emailOrUsername: formData.get('EmailOrUsername'),
            password: formData.get('Password'),
            rememberMe: formData.get('RememberMe') === 'true'
        };

        // Client-side validation
        if (!this.validateForm(data)) {
            return;
        }

        // Show loading state
        this.setLoadingState(true);

        try {
            // Prefer client-side Firebase sign-in if available
            if (typeof window.firebaseSignIn === 'function') {
                const result = await window.firebaseSignIn(data.emailOrUsername, data.password);

                if (result && result.success) {
                    // Try to establish a server-side session for UI personalization
                    try {
                        const email = (result.profile && result.profile.email) ? result.profile.email : data.emailOrUsername;
                        const serverResp = (typeof window.establishServerSession === 'function') ? await window.establishServerSession(email, result.uid) : null;
                        if (serverResp && serverResp.success) {
                            console.debug('Server session established');
                        } else {
                            console.warn('Server session not established', serverResp);
                        }
                    } catch (ex) {
                        console.warn('Error establishing server session', ex);
                    }

                    this.showToast('Success!', 'Login successful! Redirecting...', 'success');
                    setTimeout(() => { window.location.href = '/Home/Landing'; }, 800);
                } else {
                    const code = result?.code || null;

                    // More specific user-facing messages for common auth failures
                    if (code === 'user-doc-not-found') {
                        this.showToast('Login Failed', 'Your account is missing a profile in our database. Please register first.', 'error');
                    } else if (code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') {
                        // Map Firebase's combined invalid-login-credentials or user-not-found into a friendly message
                        this.showToast('Login Failed', "Your login credentials don't match an account in our system.", 'error');
                    } else if (code === 'auth/wrong-password') {
                        this.showToast('Login Failed', 'Incorrect password. Try again or use the Forgot Password option.', 'error');
                    } else if (code === 'auth/too-many-requests') {
                        this.showToast('Login Failed', 'Too many failed attempts. Please wait and try again later or reset your password.', 'error');
                    } else if (code === 'auth/invalid-email') {
                        this.showToast('Login Failed', 'The email address is not valid. Please check and try again.', 'error');
                    } else {
                        this.showToast('Login Failed', result?.message || 'Login failed', 'error');
                    }

                    this.setLoadingState(false);
                }
            } else {
                // Fallback to existing server-side login
                const response = await fetch('/Home/Login', {
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
                    setTimeout(() => { window.location.href = result.redirectUrl || '/Home/Landing'; }, 1000);
                } else {
                    this.showToast('Login Failed', result.message, 'error');
                    this.setLoadingState(false);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Error', 'An unexpected error occurred. Please try again.', 'error');
            this.setLoadingState(false);
        }
    }

    // Validate form data
    validateForm(data) {
        if (!data.emailOrUsername || data.emailOrUsername.trim() === '') {
            this.showToast('Validation Error', 'Please enter your email or username', 'warning');
            return false;
        }

        if (!data.password || data.password.trim() === '') {
            this.showToast('Validation Error', 'Please enter your password', 'warning');
            return false;
        }

        if (data.password.length < 6) {
            this.showToast('Validation Error', 'Password must be at least 6 characters', 'warning');
            return false;
        }

        return true;
    }

    // Toggle password visibility
    togglePasswordVisibility() {
        const isPassword = this.passwordInput.type === 'password';
        
        this.passwordInput.type = isPassword ? 'text' : 'password';
        
        // Update icon
        if (isPassword) {
            this.passwordIcon.classList.remove('bi-eye');
            this.passwordIcon.classList.add('bi-eye-slash');
        } else {
            this.passwordIcon.classList.remove('bi-eye-slash');
            this.passwordIcon.classList.add('bi-eye');
        }
    }

    // Handle Google login
    async handleGoogleLogin() {
        this.showToast('Google Login', 'Redirecting to Google authentication...', 'info');
        
        // Simulate Google OAuth flow
        setTimeout(() => {
            console.log('Google login initiated');
            // In production, redirect to: /Home/ExternalLogin?provider=Google
            this.showToast('Demo Mode', 'Google login would redirect in production', 'warning');
        }, 500);

        /* Production implementation:
        try {
            // Initialize Google OAuth
            window.location.href = '/Home/ExternalLogin?provider=Google';
        } catch (error) {
            console.error('Google login error:', error);
            this.showToast('Error', 'Failed to connect to Google', 'error');
        }
        */
    }

    // Handle Facebook login
    async handleFacebookLogin() {
        this.showToast('Facebook Login', 'Redirecting to Facebook authentication...', 'info');
        
        // Simulate Facebook OAuth flow
        setTimeout(() => {
            console.log('Facebook login initiated');
            // In production, redirect to: /Home/ExternalLogin?provider=Facebook
            this.showToast('Demo Mode', 'Facebook login would redirect in production', 'warning');
        }, 500);

        /* Production implementation:
        try {
            // Initialize Facebook OAuth
            window.location.href = '/Home/ExternalLogin?provider=Facebook';
        } catch (error) {
            console.error('Facebook login error:', error);
            this.showToast('Error', 'Failed to connect to Facebook', 'error');
        }
        */
    }

    // Set loading state for login button
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
        const toastElement = document.getElementById('loginToast');
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
    new LoginController();
});
