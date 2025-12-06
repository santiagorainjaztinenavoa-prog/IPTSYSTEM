using System;

namespace IPTSYSTEM.Models
{
    /// <summary>
    /// Model representing a Firestore message document within a conversation
    /// </summary>
    public class MessageModel
    {
        public string Id { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
