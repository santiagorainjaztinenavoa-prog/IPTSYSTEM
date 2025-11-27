using System.ComponentModel.DataAnnotations;

namespace IPTSYSTEM.Models
{
    public class RegisterViewModel
    {
        [Required(ErrorMessage = "Please select your account type")]
        [Display(Name = "Account Type")]
        public string AccountType { get; set; } = string.Empty;
        [Required(ErrorMessage = "Full name is required")]
        [Display(Name = "Full Name")]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters")]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email address")]
        [Display(Name = "Email Address")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Username is required")]
        [Display(Name = "Username")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "Username must be between 3 and 50 characters")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [DataType(DataType.Password)]
        [Display(Name = "Password")]
        [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 6 characters")]
        public string Password { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please confirm your password")]
        [DataType(DataType.Password)]
        [Display(Name = "Confirm Password")]
        [Compare("Password", ErrorMessage = "Passwords do not match")]
        public string ConfirmPassword { get; set; } = string.Empty;

        [Display(Name = "I agree to the Terms and Conditions")]
        public bool AgreeToTerms { get; set; }

        [Required(ErrorMessage = "Phone number is required")]
        [StringLength(20, MinimumLength = 10, ErrorMessage = "Phone number must be between 10 and 20 characters")]
        [Display(Name = "Phone Number")]
        public string PhoneNumber { get; set; } = string.Empty;
<<<<<<< HEAD

        // Address fields
        [Display(Name = "Region")]
        public string Region { get; set; } = string.Empty;
        [Display(Name = "Province")]
        public string Province { get; set; } = string.Empty;
        [Display(Name = "City/Municipality")]
        public string City { get; set; } = string.Empty;
        [Display(Name = "Barangay")]
        public string Barangay { get; set; } = string.Empty;
        [Display(Name = "Postal Code")]
        public string PostalCode { get; set; } = string.Empty;
        [Display(Name = "Street Address")]
        public string StreetAddress { get; set; } = string.Empty;
        [Display(Name = "Address")]
        public string Address { get; set; } = string.Empty; // Composed Region, Province, City, Barangay
=======
>>>>>>> e2e18df5de7dad35e0ef9ccd03e19d9e7a9fe69d
    }

    public class RegisterRequest
    {
        public string AccountType { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
        public bool AgreeToTerms { get; set; }
        public string PhoneNumber { get; set; } = string.Empty;
<<<<<<< HEAD

        // Address fields (optional server-side)
        public string Region { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Barangay { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string StreetAddress { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty; // Composed
=======
>>>>>>> e2e18df5de7dad35e0ef9ccd03e19d9e7a9fe69d
    }

    public class RegisterResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? RedirectUrl { get; set; }
    }
}
