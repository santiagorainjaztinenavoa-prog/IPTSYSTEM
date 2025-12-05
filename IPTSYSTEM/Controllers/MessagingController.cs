using Microsoft.AspNetCore.Mvc;
using IPTSYSTEM.Firebase;
using IPTSYSTEM.Models;
using System.Threading.Tasks;

namespace IPTSYSTEM.Controllers
{
    /// <summary>
    /// Controller for handling messaging operations with Firestore
    /// </summary>
    public class MessagingController : Controller
    {
        private readonly FirestoreService _firestoreService;

        public MessagingController(FirestoreService firestoreService)
        {
            _firestoreService = firestoreService;
        }

        /// <summary>
        /// Get all messages for a conversation
        /// </summary>
        /// <param name="conversationId">The conversation ID</param>
        /// <returns>JSON list of messages</returns>
        [HttpGet]
        public async Task<IActionResult> GetMessages(string conversationId)
        {
            if (string.IsNullOrWhiteSpace(conversationId))
            {
                return Json(new { success = false, message = "Conversation ID is required" });
            }

            var messages = await _firestoreService.GetMessagesAsync(conversationId);
            return Json(new { success = true, messages = messages });
        }

        /// <summary>
        /// Send a new message in a conversation
        /// </summary>
        /// <param name="conversationId">The conversation ID</param>
        /// <param name="senderId">The sender's user ID</param>
        /// <param name="senderName">The sender's display name</param>
        /// <param name="text">The message text</param>
        /// <returns>JSON result with success status</returns>
        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.ConversationId))
            {
                return Json(new { success = false, message = "Conversation ID is required" });
            }

            if (string.IsNullOrWhiteSpace(request.SenderId))
            {
                return Json(new { success = false, message = "Sender ID is required" });
            }

            if (string.IsNullOrWhiteSpace(request.Text))
            {
                return Json(new { success = false, message = "Message text is required" });
            }

            var result = await _firestoreService.AddMessageAsync(
                request.ConversationId,
                request.SenderId,
                request.SenderName ?? "Unknown",
                request.Text
            );

            if (result)
            {
                return Json(new { success = true, message = "Message sent successfully" });
            }
            else
            {
                return Json(new { success = false, message = "Failed to send message" });
            }
        }

        /// <summary>
        /// Get a specific conversation by ID
        /// </summary>
        /// <param name="conversationId">The conversation ID</param>
        /// <returns>JSON conversation data</returns>
        [HttpGet]
        public async Task<IActionResult> GetConversation(string conversationId)
        {
            if (string.IsNullOrWhiteSpace(conversationId))
            {
                return Json(new { success = false, message = "Conversation ID is required" });
            }

            var conversation = await _firestoreService.GetConversationByIdAsync(conversationId);
            
            if (conversation != null)
            {
                return Json(new { success = true, conversation = conversation });
            }
            else
            {
                return Json(new { success = false, message = "Conversation not found" });
            }
        }

        /// <summary>
        /// Get all conversations for a user (as buyer or seller)
        /// </summary>
        /// <param name="userId">The user ID</param>
        /// <returns>JSON list of conversations</returns>
        [HttpGet]
        public async Task<IActionResult> GetUserConversations(string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                return Json(new { success = false, message = "User ID is required" });
            }

            var conversations = await _firestoreService.GetUserConversationsAsync(userId);
            return Json(new { success = true, conversations = conversations });
        }

        /// <summary>
        /// Start or get existing conversation between buyer and seller for a listing
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> StartConversation([FromBody] StartConversationRequest request)
        {
            if (request == null)
            {
                return Json(new { success = false, message = "Invalid request" });
            }

            if (string.IsNullOrWhiteSpace(request.BuyerId))
            {
                return Json(new { success = false, message = "Buyer ID is required" });
            }

            if (string.IsNullOrWhiteSpace(request.SellerId))
            {
                return Json(new { success = false, message = "Seller ID is required" });
            }

            if (string.IsNullOrWhiteSpace(request.ListingId))
            {
                return Json(new { success = false, message = "Listing ID is required" });
            }

            var conversation = await _firestoreService.CreateOrGetConversationAsync(
                request.BuyerId,
                request.BuyerName ?? "Buyer",
                request.SellerId,
                request.SellerName ?? "Seller",
                request.ListingId,
                request.ListingTitle ?? "Item"
            );

            if (conversation != null)
            {
                return Json(new { success = true, conversation = conversation });
            }
            else
            {
                return Json(new { success = false, message = "Failed to create conversation" });
            }
        }
    }

    /// <summary>
    /// Request model for sending a message
    /// </summary>
    public class SendMessageRequest
    {
        public string ConversationId { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
    }

    /// <summary>
    /// Request model for starting a conversation
    /// </summary>
    public class StartConversationRequest
    {
        public string BuyerId { get; set; } = string.Empty;
        public string BuyerName { get; set; } = string.Empty;
        public string SellerId { get; set; } = string.Empty;
        public string SellerName { get; set; } = string.Empty;
        public string ListingId { get; set; } = string.Empty;
        public string ListingTitle { get; set; } = string.Empty;
    }
}
