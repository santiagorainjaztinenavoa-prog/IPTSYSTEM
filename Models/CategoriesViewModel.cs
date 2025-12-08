using System.ComponentModel.DataAnnotations;

namespace IPTSYSTEM.Models
{
    public class CategoriesViewModel
    {
       [Key]
       public int category_id { get; set; }
        
       [Required(ErrorMessage = "Category name cannot be blank.")]
       [StringLength(100, ErrorMessage = "Name of the category cannot exceed 100 characters.")]
       public string category_name { get; set; } = string.Empty;
    }
}
