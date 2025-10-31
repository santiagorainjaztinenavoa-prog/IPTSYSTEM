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
                
                // Redirect after short delay
                setTimeout(() => {
                    window.location.href = result.redirectUrl || '/Home/Landing';
                }, 1000);
            } else {
                this.showToast('Login Failed', result.message, 'error');
                this.setLoadingState(false);
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
