namespace IPTSYSTEM.Models
{
  public class Message
    {
  public int Id { get; set; }
        public int ConversationId { get; set; }
 public string SenderId { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
  public string SenderAvatar { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;
      public bool IsRead { get; set; } = false;
        public bool IsFromBot { get; set; } = false;
    }

    public class Conversation
    {
        public int Id { get; set; }
      public string OtherUserId { get; set; } = string.Empty;
        public string OtherUserName { get; set; } = string.Empty;
        public string OtherUserAvatar { get; set; } = string.Empty;
        public bool IsOnline { get; set; } = false;
        public string LastMessage { get; set; } = string.Empty;
        public DateTime LastMessageTime { get; set; } = DateTime.Now;
        public int UnreadCount { get; set; } = 0;
    }

public class ChatRequest
    {
        public int ConversationId { get; set; }
     public string Message { get; set; } = string.Empty;
    }

    public class BotRequest
    {
   public string Message { get; set; } = string.Empty;
        public string Context { get; set; } = string.Empty;
    }
}
