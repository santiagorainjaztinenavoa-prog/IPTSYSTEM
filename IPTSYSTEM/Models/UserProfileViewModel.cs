using System.Collections.Generic;

namespace IPTSYSTEM.Models
{
    public class UserProfileViewModel
    {
        public string UserId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string MiddleName { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string BackupEmail { get; set; } = string.Empty; // legacy
        public string PhoneNumber { get; set; } = string.Empty;
        public string EmergencyPhone { get; set; } = string.Empty; // legacy
        public string Region { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Barangay { get; set; } = string.Empty;
        public string PostalCode { get; set; } = string.Empty;
        public string StreetAddress { get; set; } = string.Empty;
        public string AddressFull { get; set; } = string.Empty;
        public string ProfileImageUrl { get; set; } = string.Empty;
        public Dictionary<string, object>? RawFirestore { get; set; }
        // New collections for multiple contact points
        public List<string> AdditionalEmails { get; set; } = new();
        public List<string> AdditionalPhones { get; set; } = new();
    }

    public class UserProfileUpdateRequest
    {
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string MiddleName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty; // primary
        public List<string> AdditionalEmails { get; set; } = new();
        public List<string> AdditionalPhones { get; set; } = new();
        // legacy fields retained but unused in new UI
        public string BackupEmail { get; set; } = string.Empty;
        public string EmergencyPhone { get; set; } = string.Empty;
    }
}
