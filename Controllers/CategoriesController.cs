using Google;
using IPTSYSTEM.Data;
using IPTSYSTEM.Firebase;
using IPTSYSTEM.Models;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace IPTSYSTEM.Controllers
{
    public class CategoriesController : Controller
    {
        private readonly AppDbContext _context;
        private readonly HttpClient _httpClient;
        private readonly FirestoreService _firestoreService;

        public CategoriesController(AppDbContext context, FirestoreService firestoreService)
        {
            _context = context;
            _firestoreService = firestoreService;
        }

        // GET: Categories/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: Categories/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(CategoriesViewModel category)
        {
            if (!ModelState.IsValid)
            {
                return View(category);
            }

            // Save to local DB
            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            // Save to Firebase
            bool firebaseResult = await _firestoreService.AddCategoryAsync(new
            {
                category_name = category.category_name
            });

            if (!firebaseResult)
            {
                TempData["Warning"] = "Category saved locally but failed to sync with Firebase.";
            }
            else
            {
                TempData["Success"] = "Category saved locally and synced with Firebase.";
            }

            return RedirectToAction(nameof(Index));
        }

        // GET: Categories
        public IActionResult Index()
        {
            var categories = _context.Categories;
            return View(categories);
        }
    }
}
