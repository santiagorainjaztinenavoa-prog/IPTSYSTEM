using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;

public class AdminController : Controller
{
    // View all inactive sellers
    public async Task<IActionResult> InactiveSellers()
    {
        var users = await FirebaseAuth.DefaultInstance.ListUsersAsync(null).ToListAsync();
        var inactiveSellers = users.Where(u => u.CustomClaims.ContainsKey("role") &&
                                               u.CustomClaims["role"].ToString() == "seller" &&
                                               !u.Disabled);
        return View(inactiveSellers);
    }

    // Reactivate or update seller
    [HttpPost]
    public async Task<IActionResult> UpdateSeller(string uid, bool activate)
    {
        await FirebaseAuth.DefaultInstance.UpdateUserAsync(new UserRecordArgs
        {
            Uid = uid,
            Disabled = !activate
        });
        return RedirectToAction("InactiveSellers");
    }

    // Remove bogus buyer
    [HttpPost]
    public async Task<IActionResult> RemoveBuyer(string uid)
    {
        await FirebaseAuth.DefaultInstance.DeleteUserAsync(uid);
        return RedirectToAction("BuyerList");
    }
}
