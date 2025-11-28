using Microsoft.EntityFrameworkCore;
using IPTSYSTEM.Firebase;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// EF Core DbContext registration (SQL Server)
builder.Services.AddDbContext<IPTSYSTEM.Data.AppDbContext>(options =>
{
    var cs = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Server=.;Database=IPTSYSTEM;Trusted_Connection=True;TrustServerCertificate=True;";
    options.UseSqlServer(cs);
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
