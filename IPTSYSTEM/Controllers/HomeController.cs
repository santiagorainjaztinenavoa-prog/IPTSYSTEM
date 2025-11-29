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

namespace IPTSYSTEM.Controllers
{
    public partial class HomeController : Controller
    {
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

                var categories = new[] { "Electronics", "Fashion", "Home & Living", "Books", "Sports", "Toys & Games", "Furniture", "Beauty" };
                var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var cat in categories)
                {
                    counts[cat] = sourceListings.Count(l => l.IsActive && string.Equals(l.Category?.Trim(), cat, StringComparison.OrdinalIgnoreCase));
                }

                ViewBag.CategoryCounts = counts;
                return View();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed compute category counts from Firestore, falling back to server cache");
                // fallback to previous behavior
                var activeListings = _listings.Where(l => l.IsActive).ToList();
                var categories = new[] { "Electronics", "Fashion", "Home & Living", "Books", "Sports", "Toys & Games", "Furniture", "Beauty" };
                var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var cat in categories)
                {
                    counts[cat] = activeListings.Count(l => string.Equals(l.Category?.Trim(), cat, StringComparison.OrdinalIgnoreCase));
                }
                ViewBag.CategoryCounts = counts;
                return View();
            }
        }
        public IActionResult Mylisting() => View(_listings.Where(l => l.IsActive).ToList());
        public IActionResult Browse(string? category, string? q)
        {
            var uid = HttpContext.Session.GetString("UserId") ?? string.Empty;
            var userType = (HttpContext.Session.GetString("UserType") ?? string.Empty).ToLowerInvariant();

            var listingsQuery = _listings.Where(l => l.IsActive);

            // Exclude seller's own items for sellers
            if (userType == "seller")
            {
                listingsQuery = listingsQuery.Where(l => l.SellerUserId != uid);
            }

            // Keep a normalizedCategory to use for selecting the option in the UI
            string normalizedCategory = category ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(category))
            {
                // Normalize incoming category values so HTML-encoded values or small variations
                // (e.g. "Toys &amp; Games", "Toys and Games", "Home and Living") map to the
                // canonical category strings stored on listings (e.g. "Toys & Games", "Home & Living").
                var cat = System.Net.WebUtility.HtmlDecode(category).Trim();
                // Accept both "and" and "&" as equivalent
                cat = System.Text.RegularExpressions.Regex.Replace(cat, "\\band\\b", "&", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                cat = cat.Replace("&&", "&");

                normalizedCategory = cat;

                listingsQuery = listingsQuery.Where(l => string.Equals(l.Category?.Trim(), cat, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(q))
            {
                var qtrim = q.Trim().ToLowerInvariant();
                listingsQuery = listingsQuery.Where(l => ((l.Title ?? string.Empty) + " " + (l.Description ?? string.Empty)).ToLower().Contains(qtrim));
                ViewBag.Query = q;
            }

            ViewBag.SelectedCategory = normalizedCategory ?? string.Empty;

            var listings = listingsQuery.OrderByDescending(l => l.CreatedDate).ToList();

            return View(listings);
        }

        public IActionResult SellerProfile() => View();

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
        public IActionResult ClientLogin([FromBody] ClientLoginRequest req)
        {
            try
            {
                if (req == null || string.IsNullOrWhiteSpace(req.Email)) return Json(new LoginResponse { Success = false, Message = "Invalid request" });
                if (!string.IsNullOrWhiteSpace(req.Username))
                {
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
                var regUser = _registeredUsers.FirstOrDefault(u => string.Equals(u.Email, req.Email, StringComparison.OrdinalIgnoreCase));
                if (regUser == null) return Json(new LoginResponse { Success = false, Message = "No server-side profile found for this account" });
                HttpContext.Session.SetString("IsAdmin", "false");
                HttpContext.Session.SetString("Username", regUser.Username);
                HttpContext.Session.SetString("UserType", regUser.UserType);
                HttpContext.Session.SetString("FullName", regUser.FullName ?? string.Empty);
                HttpContext.Session.SetString("UserId", req.Uid ?? regUser.Username);
                HttpContext.Session.SetString("Email", regUser.Email ?? string.Empty);
                return Json(new LoginResponse { Success = true, Message = "Server session established" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ClientLogin error");
                return Json(new LoginResponse { Success = false, Message = "Server error" });
            }
        }

        // LISTINGS CRUD
        [HttpGet]
        public IActionResult GetListing(int id)
        {
            var listing = _listings.FirstOrDefault(l => l.Id == id);
            if (listing == null) return NotFound();
            return Json(listing);
        }

        // Centralized Firestore sync for listings
        private void SyncListingToFirestore(Listing listing, string action)
        {
            try
            {
                _ = _firestore.MirrorListingAsync(listing.Id, new
                {
                    product_id = listing.Id,
                    title = listing.Title,
                    description = listing.Description,
                    price = listing.Price,
                    category = listing.Category,
                    condition = listing.Condition,
                    imageUrl = listing.ImageUrl,
                    is_active = listing.IsActive,
                    user_id = listing.SellerUserId,
                    seller_username = listing.SellerUsername,
                    seller_name = listing.SellerFullName,
                    date_created_server = listing.CreatedDate.ToUniversalTime(),
                    date_last_synced_server = DateTime.UtcNow,
                    last_sync_action = action
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed Firestore sync for listing {Id}", listing.Id);
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateListing()
        {
            try
            {
                // Ensure request body can be read multiple times
                Request.EnableBuffering();

                // Read raw body
                using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
                var raw = await reader.ReadToEndAsync();
                // rewind for other readers
                Request.Body.Position = 0;

                Listing? payload = null;

                if (!string.IsNullOrWhiteSpace(raw))
                {
                    try
                    {
                        var doc = JsonDocument.Parse(raw);
                        var root = doc.RootElement;
                        payload = new Listing
                        {
                            Id = root.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.Number ? idEl.GetInt32() : (root.TryGetProperty("Id", out var idEl2) && idEl2.ValueKind == JsonValueKind.Number ? idEl2.GetInt32() : 0),
                            Title = root.TryGetProperty("title", out var tEl) ? tEl.GetString() ?? string.Empty : (root.TryGetProperty("Title", out var tEl2) ? tEl2.GetString() ?? string.Empty : string.Empty),
                            Description = root.TryGetProperty("description", out var dEl) ? dEl.GetString() ?? string.Empty : (root.TryGetProperty("Description", out var dEl2) ? dEl2.GetString() ?? string.Empty : string.Empty),
                            Price = root.TryGetProperty("price", out var pEl) && pEl.TryGetDecimal(out var dec) ? dec : (root.TryGetProperty("Price", out var pEl2) && pEl2.TryGetDecimal(out var dec2) ? dec2 : 0m),
                            Category = root.TryGetProperty("category", out var cEl) ? cEl.GetString() ?? string.Empty : (root.TryGetProperty("Category", out var cEl2) ? cEl2.GetString() ?? string.Empty : string.Empty),
                            Condition = root.TryGetProperty("condition", out var condEl) ? condEl.GetString() ?? string.Empty : (root.TryGetProperty("Condition", out var condEl2) ? condEl2.GetString() ?? string.Empty : string.Empty),
                            ImageUrl = root.TryGetProperty("imageUrl", out var iEl) ? iEl.GetString() ?? string.Empty : (root.TryGetProperty("ImageUrl", out var iEl2) ? iEl2.GetString() ?? string.Empty : string.Empty)
                        };
                    }
                    catch (Exception jex)
                    {
                        _logger.LogDebug(jex, "Failed parse JSON body in CreateListing");
                    }
                }

                // If not JSON, try form
                if (payload == null && Request.HasFormContentType)
                {
                    var form = Request.Form;
                    payload = new Listing
                    {
                        Title = form.TryGetValue("title", out var t) ? t.ToString() : string.Empty,
                        Description = form.TryGetValue("description", out var d) ? d.ToString() : string.Empty,
                        Price = form.TryGetValue("price", out var p) && decimal.TryParse(p, out var dec) ? dec : 0m,
                        Category = form.TryGetValue("category", out var c) ? c.ToString() : string.Empty,
                        Condition = form.TryGetValue("condition", out var cond) ? cond.ToString() : string.Empty,
                        ImageUrl = form.TryGetValue("imageUrl", out var img) ? img.ToString() : string.Empty
                    };
                }

                if (payload == null)
                {
                    _logger.LogWarning("CreateListing called with empty or invalid payload. ContentType={ContentType} RawLength={RawLength}", Request.ContentType, raw?.Length ?? 0);
                    return Json(new { success = false, message = "Invalid listing payload" });
                }

                // Normalize and set defaults
                var sellerUsername = HttpContext.Session.GetString("Username") ?? "Anonymous";
                var sellerFullName = HttpContext.Session.GetString("FullName") ?? "Unknown";
                var sellerUserId = HttpContext.Session.GetString("UserId") ?? string.Empty;

                // If payload contained an Id and a listing with that Id already exists, update it instead of creating a duplicate
                if (payload.Id > 0)
                {
                    var existing = _listings.FirstOrDefault(l => l.Id == payload.Id);
                    if (existing != null)
                    {
                        // Only allow the owner or an admin to update the listing
                        var isAdmin = string.Equals(HttpContext.Session.GetString("IsAdmin"), "true", StringComparison.OrdinalIgnoreCase);
                        var isOwner = string.IsNullOrEmpty(existing.SellerUserId) || existing.SellerUserId == sellerUserId;
                        if (!isOwner && !isAdmin)
                        {
                            return Json(new { success = false, message = "You are not authorized to modify this listing" });
                        }

                        existing.Title = payload.Title?.Trim() ?? existing.Title;
                        existing.Description = payload.Description?.Trim() ?? existing.Description;
                        existing.Price = payload.Price;
                        existing.Category = payload.Category?.Trim() ?? existing.Category;
                        existing.Condition = payload.Condition?.Trim() ?? existing.Condition;
                        existing.ImageUrl = payload.ImageUrl?.Trim() ?? existing.ImageUrl;
                        // keep existing.CreatedDate as-is

                        SyncListingToFirestore(existing, "update");
                        return Json(new { success = true, message = "Listing updated successfully!", listing = existing });
                    }
                    // If Id provided but not found, fall through to create a new listing with a new Id
                }

                // Extra safety: if client didn't send an Id but a listing with the same title by the same seller exists,
                // treat this as an update to avoid creating accidental duplicates from the UI.
                if (!string.IsNullOrWhiteSpace(payload.Title))
                {
                    var candidateTitle = payload.Title.Trim();
                    var existingByTitle = _listings.FirstOrDefault(l => l.IsActive
                        && string.Equals(l.Title?.Trim(), candidateTitle, StringComparison.OrdinalIgnoreCase)
                        && (string.IsNullOrEmpty(l.SellerUserId) && string.IsNullOrEmpty(sellerUserId) || l.SellerUserId == sellerUserId));
                    if (existingByTitle != null)
                    {
                        // Owner/admin check
                        var isAdmin = string.Equals(HttpContext.Session.GetString("IsAdmin"), "true", StringComparison.OrdinalIgnoreCase);
                        var isOwner = string.IsNullOrEmpty(existingByTitle.SellerUserId) || existingByTitle.SellerUserId == sellerUserId;
                        if (!isOwner && !isAdmin)
                        {
                            return Json(new { success = false, message = "You are not authorized to modify this listing" });
                        }

                        existingByTitle.Description = payload.Description?.Trim() ?? existingByTitle.Description;
                        existingByTitle.Price = payload.Price;
                        existingByTitle.Category = payload.Category?.Trim() ?? existingByTitle.Category;
                        existingByTitle.Condition = payload.Condition?.Trim() ?? existingByTitle.Condition;
                        existingByTitle.ImageUrl = payload.ImageUrl?.Trim() ?? existingByTitle.ImageUrl;

                        SyncListingToFirestore(existingByTitle, "update");
                        return Json(new { success = true, message = "Listing updated successfully (merged with existing)!", listing = existingByTitle });
                    }
                }

                var newListing = new Listing
                {
                    Id = _listings.Any() ? _listings.Max(l => l.Id) + 1 : 1,
                    Title = payload.Title?.Trim() ?? string.Empty,
                    Description = payload.Description?.Trim() ?? string.Empty,
                    Price = payload.Price,
                    Category = payload.Category?.Trim() ?? string.Empty,
                    Condition = payload.Condition?.Trim() ?? string.Empty,
                    ImageUrl = payload.ImageUrl?.Trim() ?? string.Empty,
                    CreatedDate = DateTime.UtcNow,
                    IsActive = true,
                    SellerUsername = sellerUsername,
                    SellerFullName = sellerFullName,
                    SellerUserId = sellerUserId
                };

                _listings.Add(newListing);
                SyncListingToFirestore(newListing, "create");
                return Json(new { success = true, message = "Listing created successfully!", listing = newListing });
            }
            catch (Exception ex) { _logger.LogError(ex, "CreateListing error"); return Json(new { success = false, message = ex.Message }); }
        }

        [HttpPost]
        public async Task<IActionResult> UpdateListing()
        {
            try
            {
                Request.EnableBuffering();
                using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
                var raw = await reader.ReadToEndAsync();
                Request.Body.Position = 0;

                Listing? payload = null;

                if (!string.IsNullOrWhiteSpace(raw))
                {
                    try
                    {
                        var doc = JsonDocument.Parse(raw);
                        var root = doc.RootElement;
                        payload = new Listing
                        {
                            Id = root.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.Number ? idEl.GetInt32() : (root.TryGetProperty("Id", out var idEl2) && idEl2.ValueKind == JsonValueKind.Number ? idEl2.GetInt32() : 0),
                            Title = root.TryGetProperty("title", out var tEl) ? tEl.GetString() ?? string.Empty : (root.TryGetProperty("Title", out var tEl2) ? tEl2.GetString() ?? string.Empty : string.Empty),
                            Description = root.TryGetProperty("description", out var dEl) ? dEl.GetString() ?? string.Empty : (root.TryGetProperty("Description", out var dEl2) ? dEl2.GetString() ?? string.Empty : string.Empty),
                            Price = root.TryGetProperty("price", out var pEl) && pEl.TryGetDecimal(out var dec) ? dec : (root.TryGetProperty("Price", out var pEl2) && pEl2.TryGetDecimal(out var dec2) ? dec2 : 0m),
                            Category = root.TryGetProperty("category", out var cEl) ? cEl.GetString() ?? string.Empty : (root.TryGetProperty("Category", out var cEl2) ? cEl2.GetString() ?? string.Empty : string.Empty),
                            Condition = root.TryGetProperty("condition", out var condEl) ? condEl.GetString() ?? string.Empty : (root.TryGetProperty("Condition", out var condEl2) ? condEl2.GetString() ?? string.Empty : string.Empty),
                            ImageUrl = root.TryGetProperty("imageUrl", out var iEl) ? iEl.GetString() ?? string.Empty : (root.TryGetProperty("ImageUrl", out var iEl2) ? iEl2.GetString() ?? string.Empty : string.Empty)
                        };
                    }
                    catch (Exception jex)
                    {
                        _logger.LogDebug(jex, "Failed parse JSON body in UpdateListing");
                    }
                }

                if (payload == null && Request.HasFormContentType)
                {
                    var form = Request.Form;
                    payload = new Listing
                    {
                        Id = form.TryGetValue("id", out var idv) && int.TryParse(idv, out var iid) ? iid : 0,
                        Title = form.TryGetValue("title", out var t) ? t.ToString() : string.Empty,
                        Description = form.TryGetValue("description", out var d) ? d.ToString() : string.Empty,
                        Price = form.TryGetValue("price", out var p) && decimal.TryParse(p, out var dec) ? dec : 0m,
                        Category = form.TryGetValue("category", out var c) ? c.ToString() : string.Empty,
                        Condition = form.TryGetValue("condition", out var cond) ? cond.ToString() : string.Empty,
                        ImageUrl = form.TryGetValue("imageUrl", out var img) ? img.ToString() : string.Empty
                    };
                }

                if (payload == null)
                {
                    _logger.LogWarning("UpdateListing called with null payload. ContentType={ContentType}", Request.ContentType);
                    return Json(new { success = false, message = "Invalid listing payload" });
                }

                var existingListing = _listings.FirstOrDefault(l => l.Id == payload.Id);
                if (existingListing == null) return Json(new { success = false, message = "Listing not found" });

                // Authorization: only owner or admin can modify
                var currentUserId = HttpContext.Session.GetString("UserId") ?? string.Empty;
                var isAdminUser = string.Equals(HttpContext.Session.GetString("IsAdmin"), "true", StringComparison.OrdinalIgnoreCase);
                var isOwnerUser = string.IsNullOrEmpty(existingListing.SellerUserId) || existingListing.SellerUserId == currentUserId;
                if (!isOwnerUser && !isAdminUser)
                {
                    return Json(new { success = false, message = "You are not authorized to modify this listing" });
                }

                existingListing.Title = payload.Title?.Trim() ?? existingListing.Title;
                existingListing.Description = payload.Description?.Trim() ?? existingListing.Description;
                existingListing.Price = payload.Price;
                existingListing.Category = payload.Category?.Trim() ?? existingListing.Category;
                existingListing.Condition = payload.Condition?.Trim() ?? existingListing.Condition;
                existingListing.ImageUrl = payload.ImageUrl?.Trim() ?? existingListing.ImageUrl;
                // preserve CreatedDate and seller information
                SyncListingToFirestore(existingListing, "update");
                return Json(new { success = true, message = "Listing updated successfully!", listing = existingListing });
            }
            catch (Exception ex) { _logger.LogError(ex, "UpdateListing error"); return Json(new { success = false, message = ex.Message }); }
        }

        [HttpPost]
        public IActionResult DeleteListing(int id)
        {
            try
            {
                var listing = _listings.FirstOrDefault(l => l.Id == id);
                if (listing == null) return Json(new { success = false, message = "Listing not found" });
                listing.IsActive = false;
                SyncListingToFirestore(listing, "delete");
                return Json(new { success = true, message = "Listing deleted successfully!" });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }

        // New: expose user listings (server fallback for UI)
        [HttpGet]
        public IActionResult GetUserListings()
        {
            var uid = HttpContext.Session.GetString("UserId") ?? string.Empty;
            var listings = _listings.Where(l => l.IsActive && (string.IsNullOrEmpty(uid) || l.SellerUserId == uid)).ToList();
            return Json(new { success = true, listings });
        }

        public IActionResult Privacy() => View("Mylisting");
    }
}
