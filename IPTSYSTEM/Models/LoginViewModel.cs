using System.ComponentModel.DataAnnotations;

namespace IPTSYSTEM.Models
{
    public class LoginViewModel
    {
        [Required(ErrorMessage = "Email or Username is required")]
        [Display(Name = "Email or Username")]
        public string EmailOrUsername { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [DataType(DataType.Password)]
        [Display(Name = "Password")]
        public string Password { get; set; } = string.Empty;

        public bool RememberMe { get; set; }
    }

    public class LoginRequest
    {
        public string EmailOrUsername { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public bool RememberMe { get; set; }
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? RedirectUrl { get; set; }
    }

    public class SocialLoginRequest
    {
        public string Provider { get; set; } = string.Empty; // "Google" or "Facebook"
        public string Token { get; set; } = string.Empty;
    }
}
