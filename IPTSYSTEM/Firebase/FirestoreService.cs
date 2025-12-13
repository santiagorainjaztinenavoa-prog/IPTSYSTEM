using Google.Cloud.Firestore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System;
using System.Collections.Generic;
using System.Linq;
using IPTSYSTEM.Models;

namespace IPTSYSTEM.Firebase
{
    // Server-side Firestore helper for automatic mirroring of critical data.
    // Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account json with Firestore access.
    public class FirestoreService
    {
        private readonly ILogger<FirestoreService> _logger;
        private readonly FirestoreDb? _db;
        public bool IsInitialized { get; }

        public FirestoreService(ILogger<FirestoreService> logger, IConfiguration config)
        {
            _logger = logger;
            try
            {
                var projectId = config["Firebase:ProjectId"] ?? "carousell-c3b3f"; // fallback to existing web config projectId
                _db = FirestoreDb.Create(projectId);
                IsInitialized = true;
                _logger.LogInformation("Firestore server initialized for project {ProjectId}", projectId);
            }
            catch (Exception ex)
            {
                IsInitialized = false;
                _logger.LogWarning(ex, "Firestore initialization failed. Mirroring/seeding disabled.");
            }
        }

        public async Task MirrorUserAsync(string uid, object userDoc)
        {
            if (!IsInitialized) return;
            try
            {
                var collection = _db!.Collection("users");
                var docRef = collection.Document(uid);
                await docRef.SetAsync(userDoc, SetOptions.MergeAll);
                _logger.LogInformation("Mirrored user {Uid} to Firestore", uid);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mirror user {Uid}", uid);
            }
        }

        public async Task MirrorListingAsync(int serverListingId, object listingDoc)
        {
            if (!IsInitialized) return;
            try
            {
                var col = _db!.Collection("tbl_listing");
                // Use server id as a stable product_id field; Firestore doc id based on server id string
                var docRef = col.Document(serverListingId.ToString());
                await docRef.SetAsync(listingDoc, SetOptions.MergeAll);
                _logger.LogInformation("Mirrored listing {ListingId} to Firestore", serverListingId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to mirror listing {ListingId}", serverListingId);
            }
        }

        // New: fetch all listings from Firestore and map to server Listing model
        public async Task<List<Listing>> GetAllListingsAsync()
        {
            var result = new List<Listing>();
            if (!IsInitialized) return result;
            try
            {
                var col = _db!.Collection("tbl_listing");
                await foreach (var docRef in col.ListDocumentsAsync())
                {
                    try
                    {
                        var snap = await docRef.GetSnapshotAsync();
                        if (!snap.Exists) continue;
                        var dict = snap.ToDictionary();
                        var listing = new Listing();

                        // id (try product_id or document id)
                        if (dict.TryGetValue("product_id", out var pid) && pid != null)
                        {
                            if (int.TryParse(pid.ToString(), out var iid)) listing.Id = iid;
                        }
                        else if (int.TryParse(docRef.Id, out var did))
                        {
                            listing.Id = did;
                        }

                        if (dict.TryGetValue("title", out var t) && t != null) listing.Title = t.ToString() ?? string.Empty;
                        if (dict.TryGetValue("description", out var d) && d != null) listing.Description = d.ToString() ?? string.Empty;

                        // price may be double/long/string
                        if (dict.TryGetValue("price", out var p) && p != null)
                        {
                            if (p is double dp) listing.Price = Convert.ToDecimal(dp);
                            else if (p is float fp) listing.Price = Convert.ToDecimal(fp);
                            else if (p is long lp) listing.Price = Convert.ToDecimal(lp);
                            else if (decimal.TryParse(p.ToString(), out var dec)) listing.Price = dec;
                        }

                        if (dict.TryGetValue("category", out var c) && c != null) listing.Category = c.ToString() ?? string.Empty;
                        if (dict.TryGetValue("condition", out var cond) && cond != null) listing.Condition = cond.ToString() ?? string.Empty;
                        if (dict.TryGetValue("imageUrl", out var img) && img != null) listing.ImageUrl = img.ToString() ?? string.Empty;
                        if (dict.TryGetValue("seller_username", out var sun) && sun != null) listing.SellerUsername = sun.ToString() ?? string.Empty;
                        if (dict.TryGetValue("seller_name", out var sname) && sname != null) listing.SellerFullName = sname.ToString() ?? string.Empty;
                        if (dict.TryGetValue("user_id", out var uid) && uid != null) listing.SellerUserId = uid.ToString() ?? string.Empty;

                        // is_active
                        if (dict.TryGetValue("is_active", out var ia) && ia is bool ib) listing.IsActive = ib;

                        // date_created_server may be Timestamp or string
                        if (dict.TryGetValue("date_created_server", out var dcs) && dcs != null)
                        {
                            if (dcs is Google.Cloud.Firestore.Timestamp ts) listing.CreatedDate = ts.ToDateTime();
                            else if (dcs is DateTime dt) listing.CreatedDate = dt;
                            else if (DateTime.TryParse(dcs.ToString(), out var parsed)) listing.CreatedDate = parsed;
                        }

                        result.Add(listing);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to parse listing document {DocId}", docRef.Id);
                    }
                }

                _logger.LogInformation("Loaded {Count} listings from Firestore", result.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load listings from Firestore");
            }

            return result;
        }

        public async Task<(bool ok, string message)> SeedPhilippineGeoAsync(bool includeBarangays = true)
        {
            if (!IsInitialized) return (false, "Firestore not initialized");
            try
            {
                using var http = new HttpClient();
                async Task<List<JsonElement>> GetList(string url)
                {
                    var resp = await http.GetAsync(url);
                    resp.EnsureSuccessStatusCode();
                    var json = await resp.Content.ReadAsStringAsync();
                    var doc = JsonDocument.Parse(json);
                    var list = new List<JsonElement>();
                    foreach (var el in doc.RootElement.EnumerateArray()) list.Add(el);
                    return list;
                }

                var regions = await GetList("https://psgc.gitlab.io/api/regions/");
                var provinces = await GetList("https://psgc.gitlab.io/api/provinces/");
                var cities = await GetList("https://psgc.gitlab.io/api/cities-municipalities/");
                List<JsonElement> barangays = includeBarangays ? await GetList("https://psgc.gitlab.io/api/barangays/") : new();

                async Task CommitBatch<T>(string colName, List<T> items, Func<T, (string id, Dictionary<string, object> data)> map)
                {
                    const int chunk = 400;
                    for (int i = 0; i < items.Count; i += chunk)
                    {
                        var slice = items.GetRange(i, Math.Min(chunk, items.Count - i));
                        var batch = _db!.StartBatch();
                        foreach (var it in slice)
                        {
                            var (id, data) = map(it);
                            var docRef = _db!.Collection(colName).Document(id);
                            batch.Set(docRef, data, SetOptions.MergeAll);
                        }
                        await batch.CommitAsync();
                        _logger.LogInformation("Committed {Count} docs to {Collection}", slice.Count, colName);
                    }
                }

                await CommitBatch("ph_regions", regions, r => (
                    r.GetProperty("code").GetString()!,
                    new Dictionary<string, object> { ["code"] = r.GetProperty("code").GetString() ?? string.Empty, ["name"] = r.TryGetProperty("regionName", out var rn) ? (rn.GetString() ?? string.Empty) : (r.GetProperty("code").GetString() ?? string.Empty) }
                ));

                await CommitBatch("ph_provinces", provinces, p => (
                    p.GetProperty("code").GetString()!,
                    new Dictionary<string, object> {
                        ["code"] = p.GetProperty("code").GetString() ?? string.Empty,
                        ["name"] = p.GetProperty("name").GetString() ?? string.Empty,
                        ["regionCode"] = p.GetProperty("regionCode").GetString() ?? string.Empty
                    }
                ));

                await CommitBatch("ph_cities", cities, c => (
                    c.GetProperty("code").GetString()!,
                    new Dictionary<string, object> {
                        ["code"] = c.GetProperty("code").GetString() ?? string.Empty,
                        ["name"] = c.GetProperty("name").GetString() ?? string.Empty,
                        ["regionCode"] = c.GetProperty("regionCode").GetString() ?? string.Empty,
                        ["provinceCode"] = c.TryGetProperty("provinceCode", out var pc) ? (pc.GetString() ?? string.Empty) : string.Empty
                    }
                ));

                if (includeBarangays && barangays.Count > 0)
                {
                    await CommitBatch("ph_barangays", barangays, b => (
                        b.GetProperty("code").GetString()!,
                        new Dictionary<string, object> {
                            ["code"] = b.GetProperty("code").GetString() ?? string.Empty,
                            ["name"] = b.GetProperty("name").GetString() ?? string.Empty,
                            ["cityCode"] = b.TryGetProperty("cityCode", out var cc) ? (cc.GetString() ?? string.Empty) : (b.TryGetProperty("municipalityCode", out var mc) ? (mc.GetString() ?? string.Empty) : string.Empty)
                        }
                    ));
                }

                return (true, "Seeding completed");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Seeding PH geo failed");
                return (false, ex.Message);
            }
        }

        public async Task<Dictionary<string, object>?> GetUserAsync(string uid)
        {
            if (!IsInitialized || string.IsNullOrWhiteSpace(uid)) return null;
            try
            {
                var docRef = _db!.Collection("users").Document(uid);
                var snap = await docRef.GetSnapshotAsync();
                return snap.Exists ? snap.ToDictionary() : null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load Firestore user {Uid}", uid);
                return null;
            }
        }

        // Try to find a user document by an indexed field (email or username). Returns first match or null.
        public async Task<Dictionary<string, object>?> GetUserByFieldAsync(string fieldName, string value)
        {
            if (!IsInitialized || string.IsNullOrWhiteSpace(fieldName) || string.IsNullOrWhiteSpace(value)) return null;
            try
            {
                var col = _db!.Collection("users");
                var query = col.WhereEqualTo(fieldName, value).Limit(1);
                var snapshot = await query.GetSnapshotAsync();
                if (snapshot.Count == 0) return null;
                var doc = snapshot.Documents[0];
                if (!doc.Exists) return null;
                var dict = doc.ToDictionary();
                // include document id so callers can identify the doc
                dict["__docId"] = doc.Id;
                return dict;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GetUserByFieldAsync failed for {Field}={Value}", fieldName, value);
                return null;
            }
        }

        // ========== MESSAGING METHODS ==========

        /// <summary>
        /// Get a conversation by ID
        /// </summary>
        public async Task<ConversationModel?> GetConversationByIdAsync(string conversationId)
        {
            if (!IsInitialized || string.IsNullOrWhiteSpace(conversationId)) return null;
            try
            {
                var docRef = _db!.Collection("conversations").Document(conversationId);
                var snap = await docRef.GetSnapshotAsync();
                
                if (!snap.Exists) return null;

                var dict = snap.ToDictionary();
                return new ConversationModel
                {
                    Id = snap.Id,
                    BuyerId = dict.TryGetValue("buyerId", out var buyerId) ? buyerId?.ToString() ?? string.Empty : string.Empty,
                    BuyerName = dict.TryGetValue("buyerName", out var buyerName) ? buyerName?.ToString() ?? string.Empty : string.Empty,
                    SellerId = dict.TryGetValue("sellerId", out var sellerId) ? sellerId?.ToString() ?? string.Empty : string.Empty,
                    SellerName = dict.TryGetValue("sellerName", out var sellerName) ? sellerName?.ToString() ?? string.Empty : string.Empty,
                    ListingId = dict.TryGetValue("listingId", out var listingId) ? listingId?.ToString() ?? string.Empty : string.Empty,
                    ListingTitle = dict.TryGetValue("listingTitle", out var listingTitle) ? listingTitle?.ToString() ?? string.Empty : string.Empty,
                    LastMessage = dict.TryGetValue("lastMessage", out var lastMessage) ? lastMessage?.ToString() ?? string.Empty : string.Empty,
                    LastMessageTime = dict.TryGetValue("lastMessageTime", out var lmt) && lmt is Google.Cloud.Firestore.Timestamp lmtTs 
                        ? lmtTs.ToDateTime() : DateTime.UtcNow,
                    CreatedAt = dict.TryGetValue("createdAt", out var ca) && ca is Google.Cloud.Firestore.Timestamp caTs 
                        ? caTs.ToDateTime() : DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get conversation {ConversationId}", conversationId);
                return null;
            }
        }

        /// <summary>
        /// Get all messages for a conversation, ordered by timestamp ascending
        /// </summary>
        public async Task<List<MessageModel>> GetMessagesAsync(string conversationId)
        {
            var result = new List<MessageModel>();
            if (!IsInitialized || string.IsNullOrWhiteSpace(conversationId)) return result;
            
            try
            {
                var messagesRef = _db!.Collection("conversations").Document(conversationId).Collection("messages");
                var query = messagesRef.OrderBy("timestamp");
                var snapshot = await query.GetSnapshotAsync();

                foreach (var doc in snapshot.Documents)
                {
                    var dict = doc.ToDictionary();
                    result.Add(new MessageModel
                    {
                        Id = doc.Id,
                        SenderId = dict.TryGetValue("senderId", out var sid) ? sid?.ToString() ?? string.Empty : string.Empty,
                        SenderName = dict.TryGetValue("senderName", out var sname) ? sname?.ToString() ?? string.Empty : string.Empty,
                        Text = dict.TryGetValue("text", out var txt) ? txt?.ToString() ?? string.Empty : string.Empty,
                        Timestamp = dict.TryGetValue("timestamp", out var ts) && ts is Google.Cloud.Firestore.Timestamp fsTs 
                            ? fsTs.ToDateTime() : DateTime.UtcNow
                    });
                }

                _logger.LogInformation("Loaded {Count} messages for conversation {ConversationId}", result.Count, conversationId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get messages for conversation {ConversationId}", conversationId);
            }

            return result;
        }

        /// <summary>
        /// Add a new message to a conversation and update the last message
        /// </summary>
        public async Task<bool> AddMessageAsync(string conversationId, string senderId, string senderName, string text)
        {
            if (!IsInitialized || string.IsNullOrWhiteSpace(conversationId)) return false;
            
            try
            {
                // Add message to subcollection
                var messagesRef = _db!.Collection("conversations").Document(conversationId).Collection("messages");
                var messageData = new Dictionary<string, object>
                {
                    ["senderId"] = senderId,
                    ["senderName"] = senderName,
                    ["text"] = text,
                    ["timestamp"] = FieldValue.ServerTimestamp
                };
                
                await messagesRef.AddAsync(messageData);
                _logger.LogInformation("Added message to conversation {ConversationId}", conversationId);

                // Update parent conversation's lastMessage and lastMessageTime
                await UpdateLastMessageAsync(conversationId, text);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to add message to conversation {ConversationId}", conversationId);
                return false;
            }
        }

        /// <summary>
        /// Update the lastMessage and lastMessageTime fields of a conversation
        /// </summary>
        public async Task<bool> UpdateLastMessageAsync(string conversationId, string lastMessage)
        {
            if (!IsInitialized || string.IsNullOrWhiteSpace(conversationId)) return false;
            
            try
            {
                var conversationRef = _db!.Collection("conversations").Document(conversationId);
                var updateData = new Dictionary<string, object>
                {
                    ["lastMessage"] = lastMessage,
                    ["lastMessageTime"] = FieldValue.ServerTimestamp
                };
                
                await conversationRef.UpdateAsync(updateData);
                _logger.LogInformation("Updated last message for conversation {ConversationId}", conversationId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update last message for conversation {ConversationId}", conversationId);
                return false;
            }
        }

        /// <summary>
        /// Get all conversations for a user (where user is either buyer or seller)
        /// </summary>
        public async Task<List<ConversationModel>> GetUserConversationsAsync(string userId)
        {
            var result = new List<ConversationModel>();
            if (!IsInitialized || string.IsNullOrWhiteSpace(userId)) return result;
            
            try
            {
                var conversationsRef = _db!.Collection("conversations");
                
                // Query where user is buyer
                var buyerQuery = conversationsRef.WhereEqualTo("buyerId", userId);
                var buyerSnapshot = await buyerQuery.GetSnapshotAsync();
                
                // Query where user is seller
                var sellerQuery = conversationsRef.WhereEqualTo("sellerId", userId);
                var sellerSnapshot = await sellerQuery.GetSnapshotAsync();

                var processedIds = new HashSet<string>();

                foreach (var doc in buyerSnapshot.Documents.Concat(sellerSnapshot.Documents))
                {
                    if (processedIds.Contains(doc.Id)) continue;
                    processedIds.Add(doc.Id);

                    var dict = doc.ToDictionary();
                    result.Add(new ConversationModel
                    {
                        Id = doc.Id,
                        BuyerId = dict.TryGetValue("buyerId", out var buyerId) ? buyerId?.ToString() ?? string.Empty : string.Empty,
                        BuyerName = dict.TryGetValue("buyerName", out var buyerName) ? buyerName?.ToString() ?? string.Empty : string.Empty,
                        SellerId = dict.TryGetValue("sellerId", out var sellerId) ? sellerId?.ToString() ?? string.Empty : string.Empty,
                        SellerName = dict.TryGetValue("sellerName", out var sellerName) ? sellerName?.ToString() ?? string.Empty : string.Empty,
                        ListingId = dict.TryGetValue("listingId", out var listingId) ? listingId?.ToString() ?? string.Empty : string.Empty,
                        ListingTitle = dict.TryGetValue("listingTitle", out var listingTitle) ? listingTitle?.ToString() ?? string.Empty : string.Empty,
                        LastMessage = dict.TryGetValue("lastMessage", out var lastMessage) ? lastMessage?.ToString() ?? string.Empty : string.Empty,
                        LastMessageTime = dict.TryGetValue("lastMessageTime", out var lmt) && lmt is Google.Cloud.Firestore.Timestamp lmtTs 
                            ? lmtTs.ToDateTime() : DateTime.UtcNow,
                        CreatedAt = dict.TryGetValue("createdAt", out var ca) && ca is Google.Cloud.Firestore.Timestamp caTs 
                            ? caTs.ToDateTime() : DateTime.UtcNow
                    });
                }

                // Sort by lastMessageTime descending
                result = result.OrderByDescending(c => c.LastMessageTime).ToList();
                _logger.LogInformation("Loaded {Count} conversations for user {UserId}", result.Count, userId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to get conversations for user {UserId}", userId);
            }

            return result;
        }

        /// <summary>
        /// Create a new conversation or get existing one between buyer and seller for a listing
        /// </summary>
        public async Task<ConversationModel?> CreateOrGetConversationAsync(
            string buyerId, string buyerName, 
            string sellerId, string sellerName, 
            string listingId, string listingTitle)
        {
            if (!IsInitialized) return null;
            
            try
            {
                var conversationsRef = _db!.Collection("conversations");
                
                // Check if conversation already exists for this buyer-seller-listing combination
                var existingQuery = conversationsRef
                    .WhereEqualTo("buyerId", buyerId)
                    .WhereEqualTo("sellerId", sellerId)
                    .WhereEqualTo("listingId", listingId);
                    
                var existingSnapshot = await existingQuery.GetSnapshotAsync();
                
                if (existingSnapshot.Documents.Count > 0)
                {
                    // Return existing conversation
                    var doc = existingSnapshot.Documents[0];
                    var dict = doc.ToDictionary();
                    _logger.LogInformation("Found existing conversation {ConversationId}", doc.Id);
                    
                    return new ConversationModel
                    {
                        Id = doc.Id,
                        BuyerId = dict.TryGetValue("buyerId", out var bid) ? bid?.ToString() ?? string.Empty : string.Empty,
                        BuyerName = dict.TryGetValue("buyerName", out var bname) ? bname?.ToString() ?? string.Empty : string.Empty,
                        SellerId = dict.TryGetValue("sellerId", out var sid) ? sid?.ToString() ?? string.Empty : string.Empty,
                        SellerName = dict.TryGetValue("sellerName", out var sname) ? sname?.ToString() ?? string.Empty : string.Empty,
                        ListingId = dict.TryGetValue("listingId", out var lid) ? lid?.ToString() ?? string.Empty : string.Empty,
                        ListingTitle = dict.TryGetValue("listingTitle", out var ltitle) ? ltitle?.ToString() ?? string.Empty : string.Empty,
                        LastMessage = dict.TryGetValue("lastMessage", out var lm) ? lm?.ToString() ?? string.Empty : string.Empty,
                        LastMessageTime = dict.TryGetValue("lastMessageTime", out var lmt) && lmt is Google.Cloud.Firestore.Timestamp lmtTs 
                            ? lmtTs.ToDateTime() : DateTime.UtcNow,
                        CreatedAt = dict.TryGetValue("createdAt", out var ca) && ca is Google.Cloud.Firestore.Timestamp caTs 
                            ? caTs.ToDateTime() : DateTime.UtcNow
                    };
                }
                
                // Create new conversation
                var conversationData = new Dictionary<string, object>
                {
                    ["buyerId"] = buyerId,
                    ["buyerName"] = buyerName,
                    ["sellerId"] = sellerId,
                    ["sellerName"] = sellerName,
                    ["listingId"] = listingId,
                    ["listingTitle"] = listingTitle,
                    ["lastMessage"] = "",
                    ["lastMessageTime"] = FieldValue.ServerTimestamp,
                    ["createdAt"] = FieldValue.ServerTimestamp
                };
                
                var newDocRef = await conversationsRef.AddAsync(conversationData);
                _logger.LogInformation("Created new conversation {ConversationId}", newDocRef.Id);
                
                return new ConversationModel
                {
                    Id = newDocRef.Id,
                    BuyerId = buyerId,
                    BuyerName = buyerName,
                    SellerId = sellerId,
                    SellerName = sellerName,
                    ListingId = listingId,
                    ListingTitle = listingTitle,
                    LastMessage = "",
                    LastMessageTime = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create or get conversation");
                return null;
            }
        }
    }
}
