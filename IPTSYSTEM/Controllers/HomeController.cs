using System.Diagnostics;
using IPTSYSTEM.Models;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using IPTSYSTEM.Data;
using Microsoft.EntityFrameworkCore;

namespace IPTSYSTEM.Controllers
{
    public class HomeController : Controller
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

        private static List<Listing> _listings = new List<Listing>();

        public HomeController(ILogger<HomeController> logger, AppDbContext db)
        {
            _logger = logger;
            _db = db;
        }

        public IActionResult Index() => View("Landing");
        public IActionResult Landing(string? q) { ViewBag.Query = q; return View(); }
        public IActionResult Categories() => View();
        public IActionResult Mylisting() => View(_listings.Where(l => l.IsActive).ToList());
        public IActionResult Browse() => View(_listings.Where(l => l.IsActive).ToList());
        public IActionResult SellerProfile() => View();
        public IActionResult Messages()
        {
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
                if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                    return Json(new RegisterResponse { Success = false, Message = "All fields are required" });
                if (!request.Email.Contains("@")) return Json(new RegisterResponse { Success = false, Message = "Please enter a valid email address" });
                if (request.Password.Length < 6) return Json(new RegisterResponse { Success = false, Message = "Password must be at least 6 characters" });
                if (request.Password != request.ConfirmPassword) return Json(new RegisterResponse { Success = false, Message = "Passwords do not match" });
                if (!request.AgreeToTerms) return Json(new RegisterResponse { Success = false, Message = "You must agree to the Terms and Conditions" });
                await Task.Delay(800);
                if (_registeredUsers.Any(u => u.Username == request.Username || u.Email == request.Email))
                    return Json(new RegisterResponse { Success = false, Message = "Username or email already in use." });
                var userHash = HashPassword(request.Password);
                var userType = string.IsNullOrWhiteSpace(request.AccountType) ? "Buyer" : request.AccountType;
                _registeredUsers.Add(new RegisteredUser(request.Username, userHash, userType.ToLowerInvariant(), request.Email, request.FullName));
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

        public class ClientLoginRequest { public string? Email { get; set; } public string? Uid { get; set; } public string? Username { get; set; } public string? UserType { get; set; } public string? FullName { get; set; } }
        [HttpPost]
        public IActionResult ClientLogin([FromBody] ClientLoginRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req?.Email)) return Json(new LoginResponse { Success = false, Message = "Invalid request" });
                if (!string.IsNullOrWhiteSpace(req.Username))
                {
                    HttpContext.Session.SetString("IsAdmin", "false");
                    HttpContext.Session.SetString("Username", req.Username);
                    HttpContext.Session.SetString("UserType", (req.UserType ?? "buyer").ToLowerInvariant());
                    HttpContext.Session.SetString("FullName", req.FullName ?? string.Empty);
                    HttpContext.Session.SetString("UserId", req.Uid ?? req.Username);
                    return Json(new LoginResponse { Success = true, Message = "Server session established" });
                }
                var regUser = _registeredUsers.FirstOrDefault(u => string.Equals(u.Email, req.Email, StringComparison.OrdinalIgnoreCase));
                if (regUser == null) return Json(new LoginResponse { Success = false, Message = "No server-side profile found for this account" });
                HttpContext.Session.SetString("IsAdmin", "false");
                HttpContext.Session.SetString("Username", regUser.Username);
                HttpContext.Session.SetString("UserType", regUser.UserType);
                HttpContext.Session.SetString("FullName", regUser.FullName ?? string.Empty);
                HttpContext.Session.SetString("UserId", req.Uid ?? regUser.Username);
                return Json(new LoginResponse { Success = true, Message = "Server session established" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ClientLogin error");
                return Json(new LoginResponse { Success = false, Message = "Server error" });
            }
        }

        // LISTINGS CRUD (still in-memory)
        [HttpGet]
        public IActionResult GetListing(int id)
        {
            var listing = _listings.FirstOrDefault(l => l.Id == id);
            if (listing == null) return NotFound();
            return Json(listing);
        }
        [HttpPost]
        public IActionResult CreateListing([FromBody] Listing listing)
        {
            try
            {
                listing.Id = _listings.Any() ? _listings.Max(l => l.Id) + 1 : 1;
                listing.CreatedDate = DateTime.Now;
                listing.IsActive = true;
                listing.SellerUsername = HttpContext.Session.GetString("Username") ?? "Anonymous";
                listing.SellerFullName = HttpContext.Session.GetString("FullName") ?? "Unknown";
                listing.SellerUserId = HttpContext.Session.GetString("UserId") ?? "";
                _listings.Add(listing);
                return Json(new { success = true, message = "Listing created successfully!", listing });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }
        [HttpPost]
        public IActionResult UpdateListing([FromBody] Listing listing)
        {
            try
            {
                var existingListing = _listings.FirstOrDefault(l => l.Id == listing.Id);
                if (existingListing == null) return Json(new { success = false, message = "Listing not found" });
                existingListing.Title = listing.Title;
                existingListing.Description = listing.Description;
                existingListing.Price = listing.Price;
                existingListing.Category = listing.Category;
                existingListing.Condition = listing.Condition;
                existingListing.ImageUrl = listing.ImageUrl;
                return Json(new { success = true, message = "Listing updated successfully!", listing = existingListing });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }
        [HttpPost]
        public IActionResult DeleteListing(int id)
        {
            try
            {
                var listing = _listings.FirstOrDefault(l => l.Id == id);
                if (listing == null) return Json(new { success = false, message = "Listing not found" });
                listing.IsActive = false;
                return Json(new { success = true, message = "Listing deleted successfully!" });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }

        // MESSAGING (now using EF Core)
        [HttpGet]
        public IActionResult GetMessages(int conversationId)
        {
            var msgs = _db.Messages.Where(m => m.ConversationId == conversationId).OrderBy(m => m.Timestamp).ToList();
            return Json(msgs);
        }
        [HttpPost]
        public IActionResult SendMessage([FromBody] ChatRequest request)
        {
            try
            {
                var convo = _db.Conversations.FirstOrDefault(c => c.Id == request.ConversationId);
                if (convo == null)
                {
                    convo = new Conversation
                    {
                        Id = request.ConversationId,
                        OtherUserId = "other",
                        OtherUserName = "Chat Partner",
                        LastMessageTime = DateTime.Now
                    };
                    _db.Conversations.Add(convo);
                }
                var newMessage = new Message
                {
                    ConversationId = convo.Id,
                    SenderId = HttpContext.Session.GetString("UserId") ?? "me",
                    SenderName = HttpContext.Session.GetString("FullName") ?? "You",
                    Content = request.Message,
                    Timestamp = DateTime.Now,
                    IsRead = true
                };
                _db.Messages.Add(newMessage);
                convo.LastMessage = request.Message;
                convo.LastMessageTime = DateTime.Now;
                _db.SaveChanges();
                return Json(new { success = true, message = newMessage });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }

        [HttpPost]
        public IActionResult AskBot([FromBody] BotRequest request)
        {
            try
            {
                var convo = _db.Conversations.FirstOrDefault(c => c.Id == 0);
                if (convo == null)
                {
                    convo = new Conversation { Id = 0, OtherUserId = "bot", OtherUserName = "AI Assistant", LastMessageTime = DateTime.Now };
                    _db.Conversations.Add(convo);
                }
                var userMessage = new Message
                {
                    ConversationId = 0,
                    SenderId = HttpContext.Session.GetString("UserId") ?? "me",
                    SenderName = HttpContext.Session.GetString("FullName") ?? "You",
                    Content = request.Message,
                    Timestamp = DateTime.Now,
                    IsRead = true
                };
                _db.Messages.Add(userMessage);
                var botResponse = GenerateBotResponse(request.Message.ToLower());
                var botMessage = new Message
                {
                    ConversationId = 0,
                    SenderId = "bot",
                    SenderName = "AI Assistant",
                    Content = botResponse,
                    Timestamp = DateTime.Now.AddSeconds(1),
                    IsRead = false,
                    IsFromBot = true
                };
                _db.Messages.Add(botMessage);
                convo.LastMessage = botResponse;
                convo.LastMessageTime = DateTime.Now;
                _db.SaveChanges();
                return Json(new { success = true, message = botMessage });
            }
            catch (Exception ex) { return Json(new { success = false, message = ex.Message }); }
        }

        private string GenerateBotResponse(string userMessage)
        {
            if (userMessage.Contains("hello") || userMessage.Contains("hi") || userMessage.Contains("hey")) return "Hello! I'm here to help. What would you like to know?";
            if (userMessage.Contains("price") || userMessage.Contains("cost") || userMessage.Contains("how much")) return "I can help with pricing. Ask about a product category.";
            if (userMessage.Contains("recommend") || userMessage.Contains("suggest")) return "What category interests you? (electronics, fashion, home, books, sports)";
            if (userMessage.Contains("problem") || userMessage.Contains("issue") || userMessage.Contains("help") || userMessage.Contains("concern")) return "Describe your issue (account, payment, listing, shipping, returns).";
            if (userMessage.Contains("ship") || userMessage.Contains("deliver")) return "Standard 5-7 days, Express 2-3 days, tracking provided.";
            if (userMessage.Contains("return") || userMessage.Contains("refund")) return "30-day return window, original condition, free return shipping.";
            if (userMessage.Contains("pay") || userMessage.Contains("payment")) return "We accept cards, PayPal, Apple Pay, Google Pay, bank transfer.";
            if (userMessage.Contains("account") || userMessage.Contains("profile")) return "You can update profile, password, notifications, order history.";
            if (userMessage.Contains("thank")) return "You're welcome! Anything else?";
            if (userMessage.Contains("bye") || userMessage.Contains("goodbye")) return "Goodbye! Feel free to come back anytime.";
            return $"You said: '{userMessage}'. Can you provide more details?";
        }

        public IActionResult Privacy() => View("Mylisting");

        [HttpGet]
        public IActionResult AdminDashboard(string menu = "overview")
        {
            if (HttpContext.Session.GetString("IsAdmin") != "true") return RedirectToAction("Login");
            var viewModel = new AdminDashboardViewModel
            {
                Stats = new DashboardStats { TotalUsers = 12453, TotalListings = 8921, TotalRevenue = 456230, ActiveTransactions = 342 },
                RecentUsers = new List<RecentUser>
                {
                    new RecentUser { Id = 1, Name = "Juan Dela Cruz", Email = "juan@example.com", JoinDate = "2025-10-25", Status = "active" },
                    new RecentUser { Id = 2, Name = "Maria Santos", Email = "maria@example.com", JoinDate = "2025-10-24", Status = "active" },
                    new RecentUser { Id = 3, Name = "Carlo Reyes", Email = "carlo@example.com", JoinDate = "2025-10-23", Status = "inactive" },
                    new RecentUser { Id = 4, Name = "Ana Garcia", Email = "ana@example.com", JoinDate = "2025-10-22", Status = "active" }
                },
                RecentListings = new List<RecentListing>
                {
                    new RecentListing { Id = 1, Title = "iPhone 14 Pro", Seller = "Juan Dela Cruz", Price = 35000, Views = 452, Status = "active" },
                    new RecentListing { Id = 2, Title = "Nike Air Max", Seller = "Maria Santos", Price = 4500, Views = 128, Status = "active" },
                    new RecentListing { Id = 3, Title = "MacBook Pro M2", Seller = "Carlo Reyes", Price = 89000, Views = 876, Status = "flagged" },
                    new RecentListing { Id = 4, Title = "Samsung 65\" TV", Seller = "Ana Garcia", Price = 28000, Views = 234, Status = "active" }
                },
                ActiveMenu = menu
            };
            return View(viewModel);
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
