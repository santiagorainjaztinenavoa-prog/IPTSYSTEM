using System;

namespace IPTSYSTEM.Models
{
    /// <summary>
    /// Model representing a Firestore conversation document
    /// </summary>
    public class ConversationModel
    {
        public string Id { get; set; } = string.Empty;
        public string BuyerId { get; set; } = string.Empty;
        public string BuyerName { get; set; } = string.Empty;
        public string SellerId { get; set; } = string.Empty;
        public string SellerName { get; set; } = string.Empty;
        public string ListingId { get; set; } = string.Empty;
        public string ListingTitle { get; set; } = string.Empty;
        public string LastMessage { get; set; } = string.Empty;
        public DateTime LastMessageTime { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
