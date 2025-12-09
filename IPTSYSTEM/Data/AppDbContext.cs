using Microsoft.EntityFrameworkCore;
using IPTSYSTEM.Models;

namespace IPTSYSTEM.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Message> Messages => Set<Message>();
        public DbSet<Conversation> Conversations => Set<Conversation>();

        // for adding categories
        public DbSet<CategoriesViewModel> Categories { get; set; }
    }


}
