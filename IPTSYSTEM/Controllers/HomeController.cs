using System.Diagnostics;
using IPTSYSTEM.Models;
// Server-side Firebase admin integration removed - client-side Firebase is used for registrations
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;

namespace IPTSYSTEM.Controllers
{
        public class HomeController : Controller
        {
            // In-memory registered users (populated by server-side Register fallback)
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
        // In-memory storage for demo - replace with database in production
        // In-memory storage for listings (populated from Firestore in production)
        private static List<Listing> _listings = new List<Listing>();

      // In-memory message storage (populated from Firestore in production)
        private static List<Conversation> _conversations = new List<Conversation>();

     private static Dictionary<int, List<Message>> _messages = new Dictionary<int, List<Message>>();

     public HomeController(ILogger<HomeController> logger)
   {
_logger = logger;
  }

   public IActionResult Index()
{
  // Default route renders the renamed Landing view
        return View("Landing");
        }

        // Explicit actions for your renamed/added views
        public IActionResult Landing(string? q)
        {
  ViewBag.Query = q;
            return View();
   }

        public IActionResult Categories()
        {
        return View();
  }

        public IActionResult Mylisting()
        {
    return View(_listings.Where(l => l.IsActive).ToList());
   }

        public IActionResult Browse()
        {
            // Show all active listings for buyers to browse
            return View(_listings.Where(l => l.IsActive).ToList());
        }

        public IActionResult SellerProfile()
        {
            // Show seller profile and their products
            return View();
        }

  public IActionResult Messages()
      {
         return View(_conversations);
        }

        // ========== AUTHENTICATION OPERATIONS ==========
        
        [HttpGet]
        public IActionResult Login()
        {
            return View(new LoginViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                // Validate input
                if (string.IsNullOrWhiteSpace(request.EmailOrUsername) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return Json(new LoginResponse
                    {
                        Success = false,
                        Message = "Email/Username and Password are required"
                    });
                }

                // Check for admin credentials (static account)
                const string ADMIN_USERNAME = "admin@gmail.com";
                const string ADMIN_PASSWORD = "admin123!";

                bool isAdmin = false;
                
                // Check if logging in as admin (trim and compare case-insensitively for username/email)
                var loginIdentifier = request.EmailOrUsername?.Trim() ?? string.Empty;
                var loginPassword = request.Password?.Trim() ?? string.Empty;

                if (string.Equals(loginIdentifier, ADMIN_USERNAME, StringComparison.OrdinalIgnoreCase) && string.Equals(loginPassword, ADMIN_PASSWORD, StringComparison.Ordinal))
                {
                    isAdmin = true;
                    
                    // Set admin session
                    HttpContext.Session.SetString("IsAdmin", "true");
                    HttpContext.Session.SetString("Username", ADMIN_USERNAME);
                    // Mark admin user type for display in header
                    HttpContext.Session.SetString("UserType", "admin");
                    // Also set a display name for admin to show in header
                    HttpContext.Session.SetString("FullName", "Admin");
                    HttpContext.Session.SetString("UserId", "admin-user-id");
                    
                    // Simulate authentication delay
                    await Task.Delay(500);

                    return Json(new LoginResponse
                    {
                        Success = true,
                        Message = "Admin login successful! Redirecting...",
                        RedirectUrl = "/Home/Landing"
                    });
                }

                // Check registered users (server-side fallback registration)
                var hashed = HashPassword(loginPassword);
                var regUser = _registeredUsers.FirstOrDefault(u => (string.Equals(u.Username, loginIdentifier, StringComparison.OrdinalIgnoreCase) || string.Equals(u.Email, loginIdentifier, StringComparison.OrdinalIgnoreCase)) && u.PasswordHash == hashed);
                if (regUser != null)
                {
                    HttpContext.Session.SetString("IsAdmin", "false");
                    HttpContext.Session.SetString("Username", regUser.Username);
                    HttpContext.Session.SetString("UserType", regUser.UserType);
                    // Persist full name in session so layout can show avatar initial and proper display name
                    HttpContext.Session.SetString("FullName", regUser.FullName ?? string.Empty);
                    // Set a placeholder UserId - will be updated when Firebase UID is available
                    HttpContext.Session.SetString("UserId", regUser.Username);
                    await Task.Delay(500);
                    return Json(new LoginResponse
                    {
                        Success = true,
                        Message = $"{regUser.UserType.ToUpper()} login successful! Redirecting...",
                        RedirectUrl = "/Home/Landing"
                    });
                }

                // No matching user found
                return Json(new LoginResponse
                {
                    Success = false,
                    Message = "Invalid credentials. Please try again."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error");
                return Json(new LoginResponse
                {
                    Success = false,
                    Message = "An error occurred during login. Please try again."
                });
            }
        }

        [HttpGet]
        public IActionResult Register()
        {
            return View(new RegisterViewModel());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                // Validate input
                if (string.IsNullOrWhiteSpace(request.FullName) || string.IsNullOrWhiteSpace(request.Email) || 
                    string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
                {
                    return Json(new RegisterResponse
                    {
                        Success = false,
                        Message = "All fields are required"
                    });
                }

                // Validate email format
                if (!request.Email.Contains("@"))
                {
                    return Json(new RegisterResponse
                    {
                        Success = false,
                        Message = "Please enter a valid email address"
                    });
                }

                // Validate password length
                if (request.Password.Length < 6)
                {
                    return Json(new RegisterResponse
                    {
                        Success = false,
                        Message = "Password must be at least 6 characters"
                    });
                }

                // Validate password match
                if (request.Password != request.ConfirmPassword)
                {
                    return Json(new RegisterResponse
                    {
                        Success = false,
                        Message = "Passwords do not match"
                    });
                }

                // Validate terms agreement
                if (!request.AgreeToTerms)
                {
                    return Json(new RegisterResponse
                    {
                        Success = false,
                        Message = "You must agree to the Terms and Conditions"
                    });
                }

                // Demo registration - Replace with actual user creation in production
                // Simulate registration delay
                await Task.Delay(800);

                // Registration persistence is handled on the client using Firebase Auth + Firestore.
                // Server-side Firestore writes have been intentionally removed to avoid storing service account credentials
                // on this project. If you later want server-side persistence, reintroduce admin SDK usage here.

                // For demo, persist user in an in-memory list so server-side login can use AccountType
                try
                {
                    // Prevent duplicate username/email
                    if (_registeredUsers.Any(u => u.Username == request.Username || u.Email == request.Email))
                    {
                        return Json(new RegisterResponse { Success = false, Message = "Username or email already in use." });
                    }

                    string HashPassword(string pwd)
                    {
                        using var sha = SHA256.Create();
                        var bytes = Encoding.UTF8.GetBytes(pwd ?? string.Empty);
                        var hash = sha.ComputeHash(bytes);
                        return Convert.ToHexString(hash);
                    }

                    var userHash = HashPassword(request.Password);
                    var userType = string.IsNullOrWhiteSpace(request.AccountType) ? "Buyer" : request.AccountType;

                    _registeredUsers.Add(new RegisteredUser(request.Username, userHash, userType.ToLowerInvariant(), request.Email, request.FullName));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to persist in-memory registered user");
                    return Json(new RegisterResponse { Success = false, Message = "Registration failed. Please try again." });
                }

                return Json(new RegisterResponse
                {
                    Success = true,
                    Message = "Account created successfully! Redirecting to login...",
                    RedirectUrl = "/Home/Login"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Registration error");
                return Json(new RegisterResponse
                {
                    Success = false,
                    Message = "An error occurred during registration. Please try again."
                });
            }
        }

        [HttpGet]
        public IActionResult ExternalLogin(string provider)
        {
            // Handle external authentication (Google, Facebook)
            // In production, implement OAuth flow
            _logger.LogInformation($"External login initiated for provider: {provider}");
            
            // Redirect to OAuth provider
            // Example: return Challenge(new AuthenticationProperties { RedirectUri = "/Home/ExternalLoginCallback" }, provider);
            
            return RedirectToAction("Login");
        }

        [HttpGet]
        public async Task<IActionResult> ExternalLoginCallback()
        {
            // Handle OAuth callback
            // Authenticate user and create session
            await Task.CompletedTask;
            return RedirectToAction("Landing");
        }

        [HttpPost]
        public IActionResult Logout()
        {
            // Clear all session data including admin status
            HttpContext.Session.Clear();
            
            return RedirectToAction("Login");
        }

        // Client-side helper: called after Firebase client sign-in to establish a server session
        public class ClientLoginRequest
        {
            public string? Email { get; set; }
            public string? Uid { get; set; }
            public string? Username { get; set; }
            public string? UserType { get; set; }
            public string? FullName { get; set; }
        }

        [HttpPost]
        public IActionResult ClientLogin([FromBody] ClientLoginRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req?.Email))
                {
                    return Json(new LoginResponse { Success = false, Message = "Invalid request" });
                }

                // If client passed Username/UserType, prefer those (useful when server-side persistence hasn't propagated yet)
                if (!string.IsNullOrWhiteSpace(req.Username))
                {
                    HttpContext.Session.SetString("IsAdmin", "false");
                    HttpContext.Session.SetString("Username", req.Username);
                    HttpContext.Session.SetString("UserType", (req.UserType ?? "buyer").ToLowerInvariant());
                    HttpContext.Session.SetString("FullName", req.FullName ?? string.Empty);
                    // Store Firebase UID as UserId
                    HttpContext.Session.SetString("UserId", req.Uid ?? req.Username);
                    return Json(new LoginResponse { Success = true, Message = "Server session established" });
                }

                // Find registered user by email as fallback
                var regUser = _registeredUsers.FirstOrDefault(u => string.Equals(u.Email, req.Email, StringComparison.OrdinalIgnoreCase));
                if (regUser == null)
                {
                    return Json(new LoginResponse { Success = false, Message = "No server-side profile found for this account" });
                }

                // Set server session values
                HttpContext.Session.SetString("IsAdmin", "false");
                HttpContext.Session.SetString("Username", regUser.Username);
                HttpContext.Session.SetString("UserType", regUser.UserType);
                HttpContext.Session.SetString("FullName", regUser.FullName ?? string.Empty);
                // Store Firebase UID as UserId
                HttpContext.Session.SetString("UserId", req.Uid ?? regUser.Username);

                return Json(new LoginResponse { Success = true, Message = "Server session established" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ClientLogin error");
                return Json(new LoginResponse { Success = false, Message = "Server error" });
            }
        }

     // ========== CRUD OPERATIONS FOR LISTINGS ==========
        
        [HttpGet]
        public IActionResult GetListing(int id)
        {
      var listing = _listings.FirstOrDefault(l => l.Id == id);
     if (listing == null)
           return NotFound();
            
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
         
         // Capture seller info from session
         listing.SellerUsername = HttpContext.Session.GetString("Username") ?? "Anonymous";
         listing.SellerFullName = HttpContext.Session.GetString("FullName") ?? "Unknown";
         listing.SellerUserId = HttpContext.Session.GetString("UserId") ?? "";
         
   _listings.Add(listing);
       
   return Json(new { success = true, message = "Listing created successfully!", listing });
       }
    catch (Exception ex)
            {
  return Json(new { success = false, message = ex.Message });
      }
        }

        [HttpPost]
public IActionResult UpdateListing([FromBody] Listing listing)
  {
       try
         {
  var existingListing = _listings.FirstOrDefault(l => l.Id == listing.Id);
       if (existingListing == null)
   return Json(new { success = false, message = "Listing not found" });

  existingListing.Title = listing.Title;
    existingListing.Description = listing.Description;
             existingListing.Price = listing.Price;
  existingListing.Category = listing.Category;
  existingListing.Condition = listing.Condition;
       existingListing.ImageUrl = listing.ImageUrl;

             return Json(new { success = true, message = "Listing updated successfully!", listing = existingListing });
 }
      catch (Exception ex)
     {
      return Json(new { success = false, message = ex.Message });
 }
 }

        [HttpPost]
    public IActionResult DeleteListing(int id)
   {
       try
  {
  var listing = _listings.FirstOrDefault(l => l.Id == id);
if (listing == null)
         return Json(new { success = false, message = "Listing not found" });

     listing.IsActive = false; // Soft delete
   // Or for hard delete: _listings.Remove(listing);

        return Json(new { success = true, message = "Listing deleted successfully!" });
  }
 catch (Exception ex)
    {
 return Json(new { success = false, message = ex.Message });
      }
      }

        // ========== MESSAGING OPERATIONS ==========

        [HttpGet]
     public IActionResult GetMessages(int conversationId)
        {
  if (!_messages.ContainsKey(conversationId))
          {
      _messages[conversationId] = new List<Message>();
}

        return Json(_messages[conversationId]);
        }

        [HttpPost]
        public IActionResult SendMessage([FromBody] ChatRequest request)
  {
            try
            {
     if (!_messages.ContainsKey(request.ConversationId))
    {
          _messages[request.ConversationId] = new List<Message>();
         }

     var newMessage = new Message
      {
    Id = _messages[request.ConversationId].Any() ? _messages[request.ConversationId].Max(m => m.Id) + 1 : 1,
            ConversationId = request.ConversationId,
   SenderId = "me",
          SenderName = "You",
        Content = request.Message,
     Timestamp = DateTime.Now,
          IsRead = true
        };

              _messages[request.ConversationId].Add(newMessage);

      // Update conversation last message
            var conversation = _conversations.FirstOrDefault(c => c.Id == request.ConversationId);
      if (conversation != null)
         {
      conversation.LastMessage = request.Message;
        conversation.LastMessageTime = DateTime.Now;
       }

 return Json(new { success = true, message = newMessage });
    }
     catch (Exception ex)
            {
    return Json(new { success = false, message = ex.Message });
 }
 }

 [HttpPost]
        public IActionResult AskBot([FromBody] BotRequest request)
        {
   try
 {
             // AI Bot Logic - Simulated intelligent responses
                string botResponse = GenerateBotResponse(request.Message.ToLower());

      // Add user message
    if (!_messages.ContainsKey(0))
    {
      _messages[0] = new List<Message>();
   }

        var userMessage = new Message
        {
         Id = _messages[0].Any() ? _messages[0].Max(m => m.Id) + 1 : 1,
        ConversationId = 0,
           SenderId = "me",
          SenderName = "You",
             Content = request.Message,
          Timestamp = DateTime.Now,
          IsRead = true
             };

      _messages[0].Add(userMessage);

   // Add bot response
                var botMessage = new Message
  {
             Id = _messages[0].Max(m => m.Id) + 1,
           ConversationId = 0,
           SenderId = "bot",
         SenderName = "AI Assistant",
      Content = botResponse,
   Timestamp = DateTime.Now.AddSeconds(1),
    IsRead = false,
         IsFromBot = true
           };

           _messages[0].Add(botMessage);

             // Update bot conversation
  var botConversation = _conversations.FirstOrDefault(c => c.Id == 0);
     if (botConversation != null)
      {
 botConversation.LastMessage = botResponse;
       botConversation.LastMessageTime = DateTime.Now;
        }

      return Json(new { success = true, message = botMessage });
         }
            catch (Exception ex)
      {
return Json(new { success = false, message = ex.Message });
            }
  }

 private string GenerateBotResponse(string userMessage)
        {
        // Smart pattern matching for common queries
        if (userMessage.Contains("hello") || userMessage.Contains("hi") || userMessage.Contains("hey"))
       {
                return "?? Hello! I'm here to help. What would you like to know about our marketplace?";
            }
            else if (userMessage.Contains("price") || userMessage.Contains("cost") || userMessage.Contains("how much"))
            {
       return "?? I can help you with pricing! Our items range from budget-friendly to premium options. Would you like recommendations in a specific category?";
   }
       else if (userMessage.Contains("recommend") || userMessage.Contains("suggest"))
       {
          return "?? I'd be happy to recommend items! What category interests you?\n\n?? Electronics\n?? Fashion\n?? Home & Living\n?? Books\n? Sports\n\nJust let me know!";
            }
    else if (userMessage.Contains("problem") || userMessage.Contains("issue") || userMessage.Contains("help") || userMessage.Contains("concern"))
  {
        return "?? I'm sorry you're experiencing an issue. I can help with:\n\n1. Account problems\n2. Payment issues\n3. Listing questions\n4. Shipping concerns\n5. Return policies\n\nPlease describe your specific problem and I'll assist you right away!";
            }
       else if (userMessage.Contains("ship") || userMessage.Contains("deliver"))
       {
   return "?? Shipping Information:\n\n?? Standard: 5-7 business days\n? Express: 2-3 business days\n?? Tracking provided for all orders\n?? Free shipping on orders over $50\n\nNeed more details?";
            }
 else if (userMessage.Contains("return") || userMessage.Contains("refund"))
  {
     return "?? Return Policy:\n\n? 30-day return window\n?? Items must be in original condition\n?? Full refund or exchange available\n?? Free return shipping\n\nWould you like to initiate a return?";
            }
            else if (userMessage.Contains("pay") || userMessage.Contains("payment"))
{
         return "?? We accept:\n\n?? Credit/Debit Cards\n??? PayPal\n?? Apple Pay\n?? Google Pay\n?? Bank Transfer\n\nAll transactions are secure and encrypted. Need payment assistance?";
  }
       else if (userMessage.Contains("account") || userMessage.Contains("profile"))
    {
            return "?? Account Help:\n\n?? Update profile information\n?? Change password\n?? Manage notifications\n?? View order history\n\nWhat would you like to do with your account?";
   }
            else if (userMessage.Contains("thank") || userMessage.Contains("thanks"))
     {
           return "?? You're very welcome! Is there anything else I can help you with today?";
         }
            else if (userMessage.Contains("bye") || userMessage.Contains("goodbye"))
      {
   return "?? Goodbye! Feel free to message me anytime you need assistance. Happy shopping!";
      }
    else
            {
     return "I understand you're asking about: \"" + userMessage + "\"\n\n?? I can help you with:\n\n?? Product recommendations\n?? Price inquiries\n?? Shipping & returns\n?? Account issues\n? General marketplace questions\n\nCould you please provide more specific details so I can assist you better?";
            }
        }

        public IActionResult Privacy()
    {
            // Map legacy Privacy action to the Mylisting view to avoid missing view errors
         return View("Mylisting");
        }

        // ========== ADMIN DASHBOARD ==========
        
        [HttpGet]
        public IActionResult AdminDashboard(string menu = "overview")
        {
            // Check if user is admin
            if (HttpContext.Session.GetString("IsAdmin") != "true")
            {
                return RedirectToAction("Login");
            }

            // Prepare dashboard data
            var viewModel = new AdminDashboardViewModel
            {
                Stats = new DashboardStats
                {
                    TotalUsers = 12453,
                    TotalListings = 8921,
                    TotalRevenue = 456230,
                    ActiveTransactions = 342
                },
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
        public IActionResult Error()
    {
    return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
   }
    }
}
