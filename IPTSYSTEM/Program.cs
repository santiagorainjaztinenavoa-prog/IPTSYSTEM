using Microsoft.EntityFrameworkCore;
using IPTSYSTEM.Firebase;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// EF Core DbContext registration (SQLite default to avoid SQL Server connectivity issues)
builder.Services.AddDbContext<IPTSYSTEM.Data.AppDbContext>(options =>
{
    // Use SQLite file database by default
    var cs = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(cs))
    {
        cs = "Data Source=IPTSYSTEM.db";
    }
    options.UseSqlite(cs);
});

// Add Session support for admin authentication
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Firestore server-side mirroring (optional). Requires GOOGLE_APPLICATION_CREDENTIALS env var.
builder.Services.AddSingleton<FirestoreService>();

var app = builder.Build();

// Auto-create/update the SQLite database schema so required tables exist
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IPTSYSTEM.Data.AppDbContext>();
    try
    {
        // Create tables if they don't exist
        db.Database.EnsureCreated();
    }
    catch (Exception ex)
    {
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
        logger.LogError(ex, "Failed to ensure database is created");
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// Enable session middleware
app.UseSession();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
