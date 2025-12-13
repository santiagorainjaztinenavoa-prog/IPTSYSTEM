using System.Diagnostics;
using IPTSYSTEM.Models;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using IPTSYSTEM.Data;
using Microsoft.EntityFrameworkCore;
using IPTSYSTEM.Firebase;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using System.Collections.Concurrent;

namespace IPTSYSTEM.Controllers
{
    public partial class HomeController : Controller
    {
        // In-memory overrides for user status set by admin during runtime
        private static ConcurrentDictionary<string, string> _userStatus = new ConcurrentDictionary<string, string>();

                private static string NormalizeCategoryName(string name)
                {
                    if (string.IsNullOrWhiteSpace(name)) return name;
                    var trimmed = name.Trim();
                    if (string.Equals(trimmed, "Furniture", StringComparison.OrdinalIgnoreCase)) return "Vehicles";
                    return trimmed;
                }
        private record RegisteredUser(string Username, string PasswordHash, string UserType, string Email, string FullName);
        private static readonly List<RegisteredUser> _registeredUsers = new();
        private static string HashPassword(string pwd)
        {
            using var sha = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(pwd ?? string.Empty);
            var hash = sha.ComputeHash(bytes);
            return Convert.ToHexString(hash);
        }
        private readonly ILogger<HomeController> _logger;
        private readonly AppDbContext _db;
        private readonly FirestoreService _firestore;

        private static List<Listing> _listings = new List<Listing>();

        public HomeController(ILogger<HomeController> logger, AppDbContext db, FirestoreService firestore)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _db = db ?? throw new ArgumentNullException(nameof(db));
            _firestore = firestore ?? throw new ArgumentNullException(nameof(firestore));
            
            // ? FIX: Load listings from Firestore on startup
            if (_firestore.IsInitialized && _listings.Count == 0)
            {
                try
                {
                    // Load listings from Firestore into memory cache
                    var task = _firestore.GetAllListingsAsync();
                    task.Wait(); // Synchronous wait for startup
                    var firestoreListings = task.Result;
                    
                    if (firestoreListings != null && firestoreListings.Count > 0)
                    {
                        _listings = firestoreListings;
                        _logger.LogInformation("? Loaded {Count} listings from Firestore on startup", _listings.Count);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load listings from Firestore on startup");
                }
            }
        }

        public IActionResult Index()
        {
            var latest = _listings.Where(l => l.IsActive)
                                   .OrderByDescending(l => l.CreatedDate)
                                   .Take(20)
                                   .ToList();
            return View("Landing", latest);
        }
        public IActionResult Landing(string? q)
        {
            ViewBag.Query = q;
            var latest = _listings.Where(l => l.IsActive)
                                   .OrderByDescending(l => l.CreatedDate)
                                   .Take(20)
                                   .ToList();
            return View(latest);
        }
        public async Task<IActionResult> Categories()
        {
            try
            {
                List<Listing> sourceListings;
                if (_firestore != null && _firestore.IsInitialized)
                {
                    // Try to load from Firestore for accurate counts
                    var remote = await _firestore.GetAllListingsAsync();
                    sourceListings = remote ?? new List<Listing>();

                    // Mirror into server _listings for other server-side usage (best-effort)
                    try
                    {
                        // replace server cache with remote authoritative list
                        _listings = remote ?? new List<Listing>();
                    }
                    catch { /* non-fatal */ }
                }
                else
                {
                    sourceListings = _listings.Where(l => l.IsActive).ToList();
                }

                var categories = new[] { "Electronics", "Fashion", "Home & Living", "Books", "Sports", "Toys & Games", "Vehicles", "Beauty" };
                var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var cat in categories)
                {
                    counts[cat] = sourceListings.Count(l => l.IsActive && string.Equals(NormalizeCategoryName(l.Category), cat, StringComparison.OrdinalIgnoreCase));
                }

                ViewBag.CategoryCounts = counts;
                return View();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed compute category counts from Firestore, falling back to server cache");
                // fallback to previous behavior
                var activeListings = _listings.Where(l => l.IsActive).ToList();
                var categories = new[] { "Electronics", "Fashion", "Home & Living", "Books", "Sports", "Toys & Games", "Vehicles", "Beauty" };
                var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var cat in categories)
                {
                    counts[cat] = activeListings.Count(l => string.Equals(NormalizeCategoryName(l.Category), cat, StringComparison.OrdinalIgnoreCase));
                }
                ViewBag.CategoryCounts = counts;
                return View();
            }
        }
        public async Task<IActionResult> Browse(string? category, string? q)
        {
            try
            {
                List<Listing> listings;

                // Load all active listings from Firestore
                if (_firestore != null && _firestore.IsInitialized)
                {
                    var firestoreListings = await _firestore.GetAllListingsAsync();
                    listings = firestoreListings?.Where(l => l.IsActive).ToList() ?? new List<Listing>();

                    // Refresh in-memory cache for Landing/Categories
                    if (firestoreListings != null && firestoreListings.Count > 0)
                    {
                        _listings = firestoreListings;
                    }
                }
                else
                {
                    listings = _listings.Where(l => l.IsActive).ToList();
                }

                // Filter: Sellers should not see their own items in Browse
                var currentUserId = HttpContext.Session.GetString("UserId");
                var currentUserType = HttpContext.Session.GetString("UserType");
                if (!string.IsNullOrWhiteSpace(currentUserId) && string.Equals(currentUserType, "Seller", StringComparison.OrdinalIgnoreCase))
                {
                    listings = listings.Where(l => l.SellerUserId != currentUserId).ToList();
                    _logger.LogInformation("Filtered out seller's own listings for user {UserId}", currentUserId);
                }

                // Filters
                if (!string.IsNullOrWhiteSpace(category))
                {
                    listings = listings.Where(l => string.Equals(NormalizeCategoryName(l.Category), category, StringComparison.OrdinalIgnoreCase)).ToList();
                }
                if (!string.IsNullOrWhiteSpace(q))
                {
                    var query = q.ToLowerInvariant();
                    listings = listings.Where(l => (l.Title?.ToLowerInvariant().Contains(query) ?? false) || (l.Description?.ToLowerInvariant().Contains(query) ?? false)).ToList();
                }

                // Sort
                listings = listings.OrderByDescending(l => l.CreatedDate).ToList();

                ViewBag.SelectedCategory = category ?? string.Empty;
                ViewBag.Query = q ?? string.Empty;

                _logger.LogInformation("Browse page showing {Count} listings", listings.Count);
                return View(listings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading Browse page");
                ViewBag.SelectedCategory = category ?? string.Empty;
                ViewBag.Query = q ?? string.Empty;
                return View(new List<Listing>());
            }
        }

        public IActionResult SellerProfile() => View();

        // Profile - User's own profile with listings
        [HttpGet]
        public async Task<IActionResult> Profile()
        {
            var model = new UserProfileViewModel
            {
                UserId = HttpContext.Session.GetString("UserId") ?? string.Empty,
                Username = HttpContext.Session.GetString("Username") ?? string.Empty,
                FullName = HttpContext.Session.GetString("FullName") ?? string.Empty,
                AccountType = HttpContext.Session.GetString("UserType") ?? string.Empty,
                Email = HttpContext.Session.GetString("Email") ?? string.Empty,
                PhoneNumber = HttpContext.Session.GetString("PhoneNumber") ?? string.Empty,
                Region = HttpContext.Session.GetString("Region") ?? string.Empty,
                Province = HttpContext.Session.GetString("Province") ?? string.Empty,
                City = HttpContext.Session.GetString("City") ?? string.Empty,
                Barangay = HttpContext.Session.GetString("Barangay") ?? string.Empty,
                PostalCode = HttpContext.Session.GetString("PostalCode") ?? string.Empty,
                StreetAddress = HttpContext.Session.GetString("StreetAddress") ?? string.Empty,
                AddressFull = HttpContext.Session.GetString("Address") ?? string.Empty,
            };

            try
            {
                // Attempt to enrich with Firestore profile if available
                if (!string.IsNullOrWhiteSpace(model.UserId))
                {
                    var doc = await _firestore.GetUserAsync(model.UserId);
                    if (doc != null)
                    {
                        model.RawFirestore = doc;
                        if (doc.TryGetValue("full_name", out var fn) && fn is string s1 && !string.IsNullOrWhiteSpace(s1)) model.FullName = s1;
                        if (doc.TryGetValue("email", out var em) && em is string s2 && !string.IsNullOrWhiteSpace(s2)) model.Email = s2;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping Firestore user fetch");
            }

            return View(model);
        }

        // Account Settings
        [HttpGet]
        public async Task<IActionResult> AccountSettings()
        {
            var model = new UserProfileViewModel
            {
                UserId = HttpContext.Session.GetString("UserId") ?? string.Empty,
                Username = HttpContext.Session.GetString("Username") ?? string.Empty,
                FullName = HttpContext.Session.GetString("FullName") ?? string.Empty,
                AccountType = HttpContext.Session.GetString("UserType") ?? string.Empty,
                Email = HttpContext.Session.GetString("Email") ?? string.Empty,
                PhoneNumber = HttpContext.Session.GetString("PhoneNumber") ?? string.Empty,
                Region = HttpContext.Session.GetString("Region") ?? string.Empty,
                Province = HttpContext.Session.GetString("Province") ?? string.Empty,
                City = HttpContext.Session.GetString("City") ?? string.Empty,
                Barangay = HttpContext.Session.GetString("Barangay") ?? string.Empty,
                PostalCode = HttpContext.Session.GetString("PostalCode") ?? string.Empty,
                StreetAddress = HttpContext.Session.GetString("StreetAddress") ?? string.Empty,
                AddressFull = HttpContext.Session.GetString("Address") ?? string.Empty,
            };

            try
            {
                // Attempt to enrich with Firestore profile if available
                if (!string.IsNullOrWhiteSpace(model.UserId))
                {
                    var doc = await _firestore.GetUserAsync(model.UserId);
                    if (doc != null)
                    {
                        model.RawFirestore = doc;
                        if (doc.TryGetValue("full_name", out var fn) && fn is string s1 && !string.IsNullOrWhiteSpace(s1)) model.FullName = s1;
                        if (doc.TryGetValue("first_name", out var fname) && fname is string s2 && !string.IsNullOrWhiteSpace(s2)) model.FirstName = s2;
                        if (doc.TryGetValue("last_name", out var lname) && lname is string s3 && !string.IsNullOrWhiteSpace(s3)) model.LastName = s3;
                        if (doc.TryGetValue("middle_name", out var mname) && mname is string s4 && !string.IsNullOrWhiteSpace(s4)) model.MiddleName = s4;
                        if (doc.TryGetValue("email", out var em) && em is string s5 && !string.IsNullOrWhiteSpace(s5)) model.Email = s5;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping Firestore user fetch");
            }

            return View(model);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult UpdateProfile([FromBody] UserProfileUpdateRequest request)
        {
            try
            {
                if (request == null) return Json(new { success = false, message = "Invalid payload" });

                // Update session values as our minimal persistence
                if (!string.IsNullOrWhiteSpace(request.Username)) HttpContext.Session.SetString("Username", request.Username);
                if (!string.IsNullOrWhiteSpace(request.FullName)) HttpContext.Session.SetString("FullName", request.FullName);
                if (!string.IsNullOrWhiteSpace(request.PhoneNumber)) HttpContext.Session.SetString("PhoneNumber", request.PhoneNumber);

                var uid = HttpContext.Session.GetString("UserId") ?? (HttpContext.Session.GetString("Username") ?? string.Empty);
                var email = HttpContext.Session.GetString("Email") ?? string.Empty;

                // Mirror to Firestore when possible (best-effort)
                try
                {
                    _ = _firestore.MirrorUserAsync(uid, new
                    {
                        username = request.Username,
                        full_name = request.FullName,
                        first_name = request.FirstName,
                        last_name = request.LastName,
                        middle_name = request.MiddleName,
                        email,
                        phone_number = request.PhoneNumber,
                        additional_emails = request.AdditionalEmails,
                        additional_phones = request.AdditionalPhones,
                        date_last_updated_server = DateTime.UtcNow
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "MirrorUserAsync failed (non-fatal)");
                }

                return Json(new { success = true, message = "Profile updated" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateProfile error");
                return Json(new { success = false, message = "Server error" });
            }
        }

        public class ChangePasswordRequest
        {
            public string? CurrentPassword { get; set; }
            public string? NewPassword { get; set; }
            public string? ConfirmPassword { get; set; }
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult UpdatePassword([FromBody] ChangePasswordRequest req)
        {
            try
            {
                if (req == null) return Json(new { success = false, message = "Invalid payload" });
                if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
                    return Json(new { success = false, message = "New password must be at least 6 characters" });
                if (req.NewPassword != req.ConfirmPassword)
                    return Json(new { success = false, message = "Passwords do not match" });

                var username = HttpContext.Session.GetString("Username") ?? string.Empty;
                if (!string.IsNullOrWhiteSpace(username))
                {
                    var idx = _registeredUsers.FindIndex(u => string.Equals(u.Username, username, StringComparison.OrdinalIgnoreCase));
                    if (idx >= 0)
                    {
                        var u = _registeredUsers[idx];
                        if (!string.IsNullOrWhiteSpace(req.CurrentPassword))
                        {
                            var curHash = HashPassword(req.CurrentPassword);
                            if (!string.Equals(curHash, u.PasswordHash, StringComparison.Ordinal))
                                return Json(new { success = false, message = "Current password is incorrect" });
                        }
                        var updated = new RegisteredUser(u.Username, HashPassword(req.NewPassword!), u.UserType, u.Email, u.FullName);
                        _registeredUsers[idx] = updated;
                    }
                }

                return Json(new { success = true, message = "Password updated" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdatePassword error");
                return Json(new { success = false, message = "Server error" });
            }
        }

        public IActionResult Messages()
        {
            if (_db == null)
            {
                _logger.LogError("DbContext is null in Messages");
                return View(new List<Conversation>());
            }
            var conversations = _db.Conversations.AsNoTracking().OrderByDescending(c => c.LastMessageTime).ToList();
            return View(conversations);
        }

        [HttpGet] public IActionResult Login() => View(new LoginViewModel());

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (request == null)
                    return Json(new LoginResponse { Success = false, Message = "Invalid request payload" });
                if (string.IsNullOrWhiteSpace(request.EmailOrUsername) || string.IsNullOrWhiteSpace(request.Password))
                    return Json(new LoginResponse { Success = false, Message = "Email/Username and Password are required" });

                const string ADMIN_USERNAME = "admin@gmail.com";
                const string ADMIN_PASSWORD = "admin123!";
                var loginIdentifier = request.EmailOrUsername?.Trim() ?? string.Empty;
                var loginPassword = request.Password?.Trim() ?? string.Empty;

                if (string.Equals(loginIdentifier, ADMIN_USERNAME, StringComparison.OrdinalIgnoreCase) && string.Equals(loginPassword, ADMIN_PASSWORD, StringComparison.Ordinal))
                {
                    HttpContext.Session.SetString("IsAdmin", "true");
                    HttpContext.Session.SetString("Username", ADMIN_USERNAME);
                    HttpContext.Session.SetString("UserType", "admin");
                    HttpContext.Session.SetString("FullName", "Admin");
                    HttpContext.Session.SetString("UserId", "admin-user-id");
                    await Task.Delay(500);
                    return Json(new LoginResponse { Success = true, Message = "Admin login successful! Redirecting...", RedirectUrl = "/Home/Landing" });
                }

                var hashed = HashPassword(loginPassword);
                var regUser = _registeredUsers.FirstOrDefault(u => (string.Equals(u.Username, loginIdentifier, StringComparison.OrdinalIgnoreCase) || string.Equals(u.Email, loginIdentifier, StringComparison.OrdinalIgnoreCase)) && u.PasswordHash == hashed);
                if (regUser != null)
                {
                    // Check Firestore status (if available) to prevent login for deactivated accounts
                    // Try to determine Firestore uid: prefer username, then email lookup
                    var uidToCheck = regUser.Username ?? string.Empty;
                    if (string.IsNullOrWhiteSpace(uidToCheck) && !string.IsNullOrWhiteSpace(regUser.Email) && _firestore != null && _firestore.IsInitialized)
                    {
                        var doc = await _firestore.GetUserByFieldAsync("email", regUser.Email);
                        if (doc != null && doc.TryGetValue("__docId", out var idGuess))
                        {
                            uidToCheck = idGuess?.ToString() ?? regUser.Email;
                        }
                    }

                    var isActive = await IsFirestoreUserActiveAsync(uidToCheck);
                    if (!isActive)
                    {
                        return Json(new LoginResponse { Success = false, Message = "Access to your account has been temporarily disabled. This action was taken because the account was found to be in non-compliance with our platform's usage policies." });
                    }

                    HttpContext.Session.SetString("IsAdmin", "false");
                    HttpContext.Session.SetString("Username", regUser.Username);
                    HttpContext.Session.SetString("UserType", regUser.UserType);
                    HttpContext.Session.SetString("FullName", regUser.FullName ?? string.Empty);
                    HttpContext.Session.SetString("UserId", regUser.Username);
                    HttpContext.Session.SetString("Email", regUser.Email ?? string.Empty);
                    await Task.Delay(500);
                    return Json(new LoginResponse { Success = true, Message = $"{regUser.UserType.ToUpper()} login successful! Redirecting...", RedirectUrl = "/Home/Landing" });
                }

                return Json(new LoginResponse { Success = false, Message = "Invalid credentials. Please try again." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error");
                return Json(new LoginResponse { Success = false, Message = "An error occurred during login. Please try again." });
            }
        }

        [HttpGet] public IActionResult Register() => View(new RegisterViewModel());

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                if (request == null)
                    return Json(new RegisterResponse { Success = false, Message = "Invalid request payload" });
                if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                    return Json(new RegisterResponse { Success = false, Message = "All fields are required" });
                if (!request.Email.Contains("@")) return Json(new RegisterResponse { Success = false, Message = "Please enter a valid email address" });
                if (request.Password.Length < 6) return Json(new RegisterResponse { Success = false, Message = "Password must be at least 6 characters" });
                if (request.Password != request.ConfirmPassword) return Json(new RegisterResponse { Success = false, Message = "Passwords do not match" });
                if (!request.AgreeToTerms) return Json(new RegisterResponse { Success = false, Message = "You must agree to the Terms and Conditions" });
                await Task.Delay(200);
                if (_registeredUsers.Any(u => u.Username == request.Username || u.Email == request.Email))
                    return Json(new RegisterResponse { Success = false, Message = "Username or email already in use." });

                var userHash = HashPassword(request.Password);
                var userType = string.IsNullOrWhiteSpace(request.AccountType) ? "Buyer" : request.AccountType;
                _registeredUsers.Add(new RegisteredUser(request.Username, userHash, userType.ToLowerInvariant(), request.Email, request.FullName));

                _ = _firestore.MirrorUserAsync(request.Username, new
                {
                    username = request.Username,
                    email = request.Email,
                    full_name = request.FullName,
                    account_type = userType.ToLowerInvariant(),
                    phone_number = request.PhoneNumber,
                    region = request.Region,
                    province = request.Province,
                    city = request.City,
                    barangay = request.Barangay,
                    postal_code = request.PostalCode,
                    street_address = request.StreetAddress,
                    address_full = request.Address,
                    date_created_server = DateTime.UtcNow
                });

                HttpContext.Session.SetString("Email", request.Email ?? string.Empty);
                HttpContext.Session.SetString("PhoneNumber", request.PhoneNumber ?? string.Empty);
                HttpContext.Session.SetString("Region", request.Region ?? string.Empty);
                HttpContext.Session.SetString("Province", request.Province ?? string.Empty);
                HttpContext.Session.SetString("City", request.City ?? string.Empty);
                HttpContext.Session.SetString("Barangay", request.Barangay ?? string.Empty);
                HttpContext.Session.SetString("PostalCode", request.PostalCode ?? string.Empty);
                HttpContext.Session.SetString("StreetAddress", request.StreetAddress ?? string.Empty);
                HttpContext.Session.SetString("Address", request.Address ?? string.Empty);

                return Json(new RegisterResponse { Success = true, Message = "Account created successfully! Redirecting to login...", RedirectUrl = "/Home/Login" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration error");
                return Json(new RegisterResponse { Success = false, Message = "An error occurred during registration. Please try again." });
            }
        }

        [HttpGet] public IActionResult ExternalLogin(string provider)
        {
            _logger.LogInformation($"External login initiated for provider: {provider}");
            return RedirectToAction("Login");
        }
        [HttpGet] public async Task<IActionResult> ExternalLoginCallback() { await Task.CompletedTask; return RedirectToAction("Landing"); }
        [HttpPost] public IActionResult Logout() { HttpContext.Session.Clear(); return RedirectToAction("Login"); }

        public class ClientLoginRequest { public string? Email { get; set; } public string? Uid { get; set; } public string? Username { get; set; } public string? UserType { get; set; } public string? FullName { get; set; } public string? PhoneNumber { get; set; } public string? Region { get; set; } public string? Province { get; set; } public string? City { get; set; } public string? Barangay { get; set; } public string? PostalCode { get; set; } public string? StreetAddress { get; set; } public string? Address { get; set; } }
        [HttpPost]
        public async Task<IActionResult> ClientLogin([FromBody] ClientLoginRequest req)
         {
             try
             {
                 if (req == null || string.IsNullOrWhiteSpace(req.Email)) return Json(new LoginResponse { Success = false, Message = "Invalid request" });
                 if (!string.IsNullOrWhiteSpace(req.Username))
                 {
                    // If Firestore is available, check status by uid (prefer req.Uid then req.Username)
                    var uidToCheck = !string.IsNullOrWhiteSpace(req.Uid) ? req.Uid : req.Username;
                    var isActive = await IsFirestoreUserActiveAsync(uidToCheck);
                    if (!isActive)
                    {
                        return Json(new LoginResponse { Success = false, Message = "Access to your account has been temporarily disabled. This action was taken because the account was found to be in non-compliance with our platform's usage policies." });
                    }

                    HttpContext.Session.SetString("IsAdmin", "false");
                    HttpContext.Session.SetString("Username", req.Username);
                    HttpContext.Session.SetString("UserType", (req.UserType ?? "buyer").ToLowerInvariant());
                    HttpContext.Session.SetString("FullName", req.FullName ?? string.Empty);
                    HttpContext.Session.SetString("UserId", req.Uid ?? req.Username);
                    HttpContext.Session.SetString("Email", req.Email ?? string.Empty);
                    if (!string.IsNullOrWhiteSpace(req.PhoneNumber)) HttpContext.Session.SetString("PhoneNumber", req.PhoneNumber);
                    if (!string.IsNullOrWhiteSpace(req.Region)) HttpContext.Session.SetString("Region", req.Region);
                    if (!string.IsNullOrWhiteSpace(req.Province)) HttpContext.Session.SetString("Province", req.Province);
                    if (!string.IsNullOrWhiteSpace(req.City)) HttpContext.Session.SetString("City", req.City);
                    if (!string.IsNullOrWhiteSpace(req.Barangay)) HttpContext.Session.SetString("Barangay", req.Barangay);
                    if (!string.IsNullOrWhiteSpace(req.PostalCode)) HttpContext.Session.SetString("PostalCode", req.PostalCode);
                    if (!string.IsNullOrWhiteSpace(req.StreetAddress)) HttpContext.Session.SetString("StreetAddress", req.StreetAddress);
                    if (!string.IsNullOrWhiteSpace(req.Address)) HttpContext.Session.SetString("Address", req.Address);
                    return Json(new LoginResponse { Success = true, Message = "Server session established" });
                }
             }
             catch (Exception ex)
             {
                 _logger.LogError(ex, "ClientLogin error");
                 return Json(new LoginResponse { Success = false, Message = "An error occurred during login. Please try again." });
             }

             return Json(new LoginResponse { Success = false, Message = "Invalid login request" });
         }

        // Helper: check Firestore for user's status and determine if active (consults in-memory overrides first)
        private async Task<bool> IsFirestoreUserActiveAsync(string uid)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(uid)) return true;

                // Check in-memory admin-set status first
                if (_userStatus.TryGetValue(uid, out var inMemoryStatus) && !string.IsNullOrWhiteSpace(inMemoryStatus))
                {
                    return !string.Equals(inMemoryStatus, "inactive", StringComparison.OrdinalIgnoreCase);
                }

                if (_firestore == null || !_firestore.IsInitialized) return true;

                // First try to load by document id
                var doc = await _firestore.GetUserAsync(uid);
                Dictionary<string, object>? found = doc;

                // If not found by doc id, try lookup by email or username fields
                if (found == null)
                {
                    // Try treating uid as email
                    var byEmail = await _firestore.GetUserByFieldAsync("email", uid);
                    if (byEmail != null)
                    {
                        found = byEmail;
                    }
                    else
                    {
                        // Try username field
                        var byUsername = await _firestore.GetUserByFieldAsync("username", uid);
                        if (byUsername != null) found = byUsername;
                    }
                }

                if (found == null) return true;

                // status may be in the document fields
                if (found.TryGetValue("status", out var statusObj) && statusObj is string statusStr)
                {
                    return !string.Equals(statusStr, "inactive", StringComparison.OrdinalIgnoreCase);
                }

                if (found.TryGetValue("is_active", out var isActiveObj))
                {
                    if (isActiveObj is bool b) return b;
                    if (bool.TryParse(isActiveObj?.ToString(), out var parsed)) return parsed;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed to check Firestore user status for {Uid}", uid);
                return true; // fail-open: don't block login when status check fails
            }
        }

        [HttpGet]
        public IActionResult AdminDashboard(string? menu = "overview")
        {
            try
            {
                var model = new AdminDashboardViewModel
                {
                    ActiveMenu = string.IsNullOrWhiteSpace(menu) ? "overview" : menu
                };

                // Populate basic stats from in-memory or database where available
                try
                {
                    // Prefer server cache/listings for listing counts
                    model.Stats.TotalListings = _listings?.Count(l => l.IsActive) ?? 0;
                    model.Stats.TotalUsers = 0; // unknown without full user store
                    model.Stats.TotalRevenue = 0m;
                    model.Stats.ActiveTransactions = 0;

                    // If EF DbContext has data, try to populate conversations/messages counts
                    try
                    {
                        if (_db != null)
                        {
                            model.Stats.ActiveTransactions = _db.Conversations?.Count() ?? model.Stats.ActiveTransactions;
                        }
                    }
                    catch { /* non-fatal */ }
                }
                catch { /* non-fatal */ }

                // Recent users & listings - best-effort from firestore if available
                try
                {
                    if (_firestore != null && _firestore.IsInitialized)
                    {
                        // Firestore calls are async; don't block long here – return view with defaults
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var listings = await _firestore.GetAllListingsAsync();
                                if (listings != null)
                                {
                                    model.RecentListings = listings.Take(10).Select(l => new AdminDashboardViewModel.ListingInfo { Title = l.Title, Price = l.Price, Views = l.Views, Status = l.IsActive ? "active" : "inactive" }).ToList();
                                }
                            }
                            catch { }
                        });
                    }
                }
                catch { }

                return View(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AdminDashboard error");
                return View(new AdminDashboardViewModel { ActiveMenu = menu ?? "overview" });
            }
        }

        // Contact Admin Messages - for buyers/sellers to contact administrator
        [HttpGet]
        public IActionResult AdminMessages()
        {
            // User must be logged in
            var userId = HttpContext.Session.GetString("UserId");
            if (string.IsNullOrEmpty(userId))
            {
                return RedirectToAction("Login");
            }
            
            return View();
        }
    }
}
