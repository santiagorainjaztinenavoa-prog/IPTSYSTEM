namespace IPTSYSTEM.Models
{
    // Dashboard Statistics Model
    public class DashboardStats
    {
        public int TotalUsers { get; set; }
        public int TotalListings { get; set; }
        public decimal TotalRevenue { get; set; }
        public int ActiveTransactions { get; set; }
    }

    // Recent User Model
    public class RecentUser
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string JoinDate { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }

    // Recent Listing Model
    public class RecentListing
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Seller { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Views { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    // Admin Dashboard View Model
    public class AdminDashboardViewModel
    {
        public DashboardStats Stats { get; set; } = new();
        public List<RecentUser> RecentUsers { get; set; } = new();
        public List<RecentListing> RecentListings { get; set; } = new();
        public string ActiveMenu { get; set; } = "overview";
    }
}
