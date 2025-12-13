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
        // Debug: log whether firebaseSignIn is available at controller init
        try {
            console.debug('LoginController initialized. firebaseSignIn available:', typeof window.firebaseSignIn);
            console.debug('Window firebaseRegister available:', typeof window.firebaseRegister);
            console.debug('Loaded firebase config (if any):', typeof window.__firebaseConfig !== 'undefined' ? window.__firebaseConfig : null);
        } catch (e) {
            console.debug('Error while printing firebase debug info', e);
        }
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
            const hasFirebaseSignIn = (typeof window.firebaseSignIn === 'function');
            const loginIdentifier = (data.emailOrUsername || '').toString().trim();
            const isAdminLogin = loginIdentifier.toLowerCase() === 'admin@gmail.com';
            console.debug('handleLogin: hasFirebaseSignIn =', hasFirebaseSignIn, 'isAdminLogin =', isAdminLogin);

            // If this is the admin account, prefer the server-side login (admin is server-only).
            if (hasFirebaseSignIn && !isAdminLogin) {
                const result = await window.firebaseSignIn(data.emailOrUsername, data.password);
                console.debug('handleLogin: firebaseSignIn returned', result);

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

                    // Handle user deleted or disabled (new login restriction system)
                    if (code === 'user-deleted') {
                        this.showAccountDeletedModal();
                        this.setLoadingState(false);
                        return;
                    }
                    
                    if (code === 'user-disabled') {
                        this.showAccountSuspendedModal();
                        this.setLoadingState(false);
                        return;
                    }

                    // Detect suspended/inactive accounts (server or client returned)
                    const serverMsg = (result && result.message) ? result.message.toString() : '';
                    const isSuspended = code === 'inactive' || /temporarily disabled|suspend|suspended|non-compliance/i.test(serverMsg);

                    // More specific user-facing messages for common auth failures
                    if (isSuspended) {
                        // Show professional suspension title and server-provided details
                        this.showAccountSuspendedModal();
                    } else if (code === 'user-doc-not-found') {
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
                    // Fallback to existing server-side login (used for admin or when firebaseSignIn unavailable/declined)
                    console.debug('handleLogin: using server-side login fallback');
                const response = await fetch('/Home/Login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'RequestVerificationToken': formData.get('__RequestVerificationToken')
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                    console.debug('handleLogin: server response', result);

                if (result.success) {
                    this.showToast('Success!', result.message, 'success');
                    setTimeout(() => { window.location.href = result.redirectUrl || '/Home/Landing'; }, 1000);
                } else {
                    // If server indicates suspension, show the professional suspension title
                    const srvMsg = (result && result.message) ? result.message.toString() : '';
                    if (/temporarily disabled|suspend|suspended|non-compliance/i.test(srvMsg)) {
                        this.showToast('Account Suspended: Policy Non-Compliance', srvMsg || 'Access to your account has been temporarily disabled due to policy non-compliance. Contact support for assistance.', 'error');
                    } else {
                        this.showToast('Login Failed', result.message, 'error');
                    }
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

    // Show Account Suspended Modal with animation
    showAccountSuspendedModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('accountSuspendedModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="accountSuspendedModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background: linear-gradient(145deg, #1a1a1a, #2d2d2d); border: 1px solid #dc2626; border-radius: 1rem;">
                        <div class="modal-body text-center p-5">
                            <div class="mb-4">
                                <div style="width: 80px; height: 80px; margin: 0 auto; background: #dc262620; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">
                                    <i class="bi bi-shield-exclamation" style="font-size: 2.5rem; color: #dc2626;"></i>
                                </div>
                            </div>
                            <h4 class="text-white mb-3" style="font-weight: 700;">Account Suspended</h4>
                            <p class="text-secondary mb-4" style="line-height: 1.6;">
                                Your account has been suspended by the administrator. 
                                <br><br>
                                Please contact the administrator for more information or to appeal this decision.
                            </p>
                            <button type="button" class="btn px-4 py-2" style="background: #dc2626; color: white; border-radius: 0.5rem; font-weight: 600;" data-bs-dismiss="modal">
                                <i class="bi bi-arrow-left me-2"></i>Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('accountSuspendedModal'));
        modal.show();
    }

    // Show Account Deleted Modal with animation
    showAccountDeletedModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('accountDeletedModal');
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div id="accountDeletedModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content" style="background: linear-gradient(145deg, #1a1a1a, #2d2d2d); border: 1px solid #ef4444; border-radius: 1rem;">
                        <div class="modal-body text-center p-5">
                            <div class="mb-4">
                                <div style="width: 80px; height: 80px; margin: 0 auto; background: #ef444420; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: shake 0.5s ease-in-out;">
                                    <i class="bi bi-person-x" style="font-size: 2.5rem; color: #ef4444;"></i>
                                </div>
                            </div>
                            <h4 class="text-white mb-3" style="font-weight: 700;">Account Deleted</h4>
                            <p class="text-secondary mb-4" style="line-height: 1.6;">
                                Your account has been deleted from our system.
                                <br><br>
                                If you believe this is an error, please contact the administrator.
                            </p>
                            <button type="button" class="btn px-4 py-2" style="background: #ef4444; color: white; border-radius: 0.5rem; font-weight: 600;" data-bs-dismiss="modal">
                                <i class="bi bi-arrow-left me-2"></i>Go Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('accountDeletedModal'));
        modal.show();
    }
}

// Initialize controller when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new LoginController();
});
