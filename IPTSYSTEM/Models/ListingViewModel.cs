namespace IPTSYSTEM.Models
{
    public class ListingViewModel
    {
        public string ProductId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public DateTime DateCreated { get; set; }
        public string SellerName { get; set; } = string.Empty;
        public string SellerUsername { get; set; } = string.Empty;
    }
}
