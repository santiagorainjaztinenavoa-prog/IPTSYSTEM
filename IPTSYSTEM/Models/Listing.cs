namespace IPTSYSTEM.Models
{
    public class Listing
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
      public string Category { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
     public string ImageUrl { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        public bool IsActive { get; set; } = true;
        
        // Seller information
        public string SellerUsername { get; set; } = string.Empty;
        public string SellerFullName { get; set; } = string.Empty;
        public string SellerUserId { get; set; } = string.Empty;
        
        // Firebase user_id for Firestore sync
        public string UserId { get; set; } = string.Empty;

        // View count (optional) - some UI expects this field
        public int Views { get; set; } = 0;
    }
}
