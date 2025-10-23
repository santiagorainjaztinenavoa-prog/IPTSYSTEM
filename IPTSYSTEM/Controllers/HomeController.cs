using System.Diagnostics;
using IPTSYSTEM.Models;
using Microsoft.AspNetCore.Mvc;

namespace IPTSYSTEM.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        // In-memory storage for demo - replace with database in production
        private static List<Listing> _listings = new List<Listing>
        {
     new Listing { Id = 1, Title = "iPhone 13 Pro Max", Description = "Barely used iPhone 13 Pro Max. 256GB, Pacific Blue. Comes with original box and charger.", Price = 899, Category = "Electronics", Condition = "Like New", ImageUrl = "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=500&h=500&fit=crop" },
  new Listing { Id = 2, Title = "Vintage Denim Jacket", Description = "Classic 90s style denim jacket, size M. Perfect condition with minimal wear.", Price = 45, Category = "Fashion", Condition = "Good", ImageUrl = "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&h=500&fit=crop" },
        new Listing { Id = 3, Title = "Modern Table Lamp", Description = "Beautiful minimalist table lamp with adjustable brightness. White and gold finish.", Price = 35, Category = "Home & Living", Condition = "New", ImageUrl = "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&h=500&fit=crop" },
      new Listing { Id = 4, Title = "MacBook Pro M2", Description = "2023 MacBook Pro with M2 chip, 16GB RAM, 512GB SSD. Space Gray, excellent condition.", Price = 1499, Category = "Electronics", Condition = "Like New", ImageUrl = "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&h=500&fit=crop" },
    new Listing { Id = 5, Title = "Leather Crossbody Bag", Description = "Genuine leather crossbody bag in tan. Perfect everyday bag with adjustable strap.", Price = 65, Category = "Fashion", Condition = "Good", ImageUrl = "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&h=500&fit=crop" },
  new Listing { Id = 6, Title = "Wireless Headphones", Description = "Premium noise-canceling headphones. Black, barely used with original case and cables.", Price = 199, Category = "Electronics", Condition = "Like New", ImageUrl = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop" }
        };

   // In-memory message storage
        private static List<Conversation> _conversations = new List<Conversation>
        {
   new Conversation { Id = 1, OtherUserId = "user1", OtherUserName = "Tech Trader", OtherUserAvatar = "https://ui-avatars.com/api/?name=Tech+Trader&background=ff6b9d&color=fff&size=48", IsOnline = true, LastMessage = "Can you do $850?", LastMessageTime = DateTime.Now.AddMinutes(-10) },
     new Conversation { Id = 2, OtherUserId = "user2", OtherUserName = "Vintage Vibe", OtherUserAvatar = "https://ui-avatars.com/api/?name=Vintage+Vibe&background=fbbf24&color=fff&size=48", IsOnline = true, LastMessage = "Yes, it's available!", LastMessageTime = DateTime.Now.AddMinutes(-15) },
          new Conversation { Id = 3, OtherUserId = "user3", OtherUserName = "Home Decor Pro", OtherUserAvatar = "https://ui-avatars.com/api/?name=Home+Decor+Pro&background=f97316&color=fff&size=48", IsOnline = false, LastMessage = "Thanks for your interest", LastMessageTime = DateTime.Now.AddDays(-1) },
       new Conversation { Id = 0, OtherUserId = "bot", OtherUserName = "AI Assistant", OtherUserAvatar = "https://ui-avatars.com/api/?name=AI&background=8b5cf6&color=fff&size=48", IsOnline = true, LastMessage = "Hi! How can I help you today?", LastMessageTime = DateTime.Now }
 };

     private static Dictionary<int, List<Message>> _messages = new Dictionary<int, List<Message>>
        {
     [1] = new List<Message>
        {
                new Message { Id = 1, ConversationId = 1, SenderId = "user1", SenderName = "Tech Trader", Content = "Hi! Is this still available?", Timestamp = DateTime.Now.AddMinutes(-30) },
     new Message { Id = 2, ConversationId = 1, SenderId = "me", SenderName = "You", Content = "Yes, it's still available! Would you like to know more about it?", Timestamp = DateTime.Now.AddMinutes(-25) },
                new Message { Id = 3, ConversationId = 1, SenderId = "user1", SenderName = "Tech Trader", Content = "Can you do $850?", Timestamp = DateTime.Now.AddMinutes(-10) }
      },
     [0] = new List<Message>
     {
         new Message { Id = 1, ConversationId = 0, SenderId = "bot", SenderName = "AI Assistant", Content = "?? Hello! I'm your AI shopping assistant. I can help you with:\n\n• Product recommendations\n• Price negotiations\n• Listing questions\n• General marketplace info\n\nHow can I assist you today?", Timestamp = DateTime.Now.AddMinutes(-1), IsFromBot = true }
 }
        };

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

  public IActionResult Messages()
      {
         return View(_conversations);
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
          return "? I'd be happy to recommend items! What category interests you?\n\n• Electronics\n• Fashion\n• Home & Living\n• Books\n• Sports\n\nJust let me know!";
            }
    else if (userMessage.Contains("problem") || userMessage.Contains("issue") || userMessage.Contains("help") || userMessage.Contains("concern"))
  {
        return "?? I'm sorry you're experiencing an issue. I can help with:\n\n1. Account problems\n2. Payment issues\n3. Listing questions\n4. Shipping concerns\n5. Return policies\n\nPlease describe your specific problem and I'll assist you right away!";
            }
       else if (userMessage.Contains("ship") || userMessage.Contains("deliver"))
       {
   return "?? Shipping Information:\n\n• Standard: 5-7 business days\n• Express: 2-3 business days\n• Tracking provided for all orders\n• Free shipping on orders over $50\n\nNeed more details?";
            }
 else if (userMessage.Contains("return") || userMessage.Contains("refund"))
  {
     return "?? Return Policy:\n\n• 30-day return window\n• Items must be in original condition\n• Full refund or exchange available\n• Free return shipping\n\nWould you like to initiate a return?";
            }
            else if (userMessage.Contains("pay") || userMessage.Contains("payment"))
{
         return "?? We accept:\n\n• Credit/Debit Cards\n• PayPal\n• Apple Pay\n• Google Pay\n• Bank Transfer\n\nAll transactions are secure and encrypted. Need payment assistance?";
  }
       else if (userMessage.Contains("account") || userMessage.Contains("profile"))
    {
            return "?? Account Help:\n\n• Update profile information\n• Change password\n• Manage notifications\n• View order history\n\nWhat would you like to do with your account?";
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
     return "I understand you're asking about: \"" + userMessage + "\"\n\n?? I can help you with:\n\n• Product recommendations\n• Price inquiries\n• Shipping & returns\n• Account issues\n• General marketplace questions\n\nCould you please provide more specific details so I can assist you better?";
            }
        }

        public IActionResult Privacy()
    {
            // Map legacy Privacy action to the Mylisting view to avoid missing view errors
         return View("Mylisting");
        }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
    {
    return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
   }
}
}
