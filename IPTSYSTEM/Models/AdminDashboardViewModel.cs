namespace IPTSYSTEM.Models
{
    // Admin Dashboard View Model
    public class AdminDashboardViewModel
    {
        public string ActiveMenu { get; set; } = "overview";
        public DashboardStats Stats { get; set; } = new();
        public List<UserInfo> RecentUsers { get; set; } = new();
        public List<ListingInfo> RecentListings { get; set; } = new();

        public class DashboardStats
        {
            public int TotalUsers { get; set; }
            public int TotalListings { get; set; }
            public decimal TotalRevenue { get; set; }
            public int ActiveTransactions { get; set; }
        }

        public class UserInfo
        {
            public string Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string JoinDate { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
        }

        public class ListingInfo
        {
            public string Title { get; set; } = string.Empty;
            public decimal Price { get; set; }
            public int Views { get; set; }
            public string Status { get; set; } = string.Empty;
        }
    }
}
