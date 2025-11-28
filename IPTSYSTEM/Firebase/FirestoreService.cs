using Google.Cloud.Firestore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System;
using System.Collections.Generic;

namespace IPTSYSTEM.Firebase
{
    // Server-side Firestore helper for automatic mirroring of critical data.
    // Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account json with Firestore access.
    public class FirestoreService
    {
        private readonly ILogger<FirestoreService> _logger;
        private readonly FirestoreDb _db;
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
                var collection = _db.Collection("users");
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
                var col = _db.Collection("tbl_listing");
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
                        var batch = _db.StartBatch();
                        foreach (var it in slice)
                        {
                            var (id, data) = map(it);
                            var docRef = _db.Collection(colName).Document(id);
                            batch.Set(docRef, data, SetOptions.MergeAll);
                        }
                        await batch.CommitAsync();
                        _logger.LogInformation("Committed {Count} docs to {Collection}", slice.Count, colName);
                    }
                }

                await CommitBatch("ph_regions", regions, r => (
                    r.GetProperty("code").GetString()!,
                    new Dictionary<string, object> { ["code"] = r.GetProperty("code").GetString(), ["name"] = r.TryGetProperty("regionName", out var rn) ? rn.GetString() : r.GetProperty("code").GetString() }
                ));

                await CommitBatch("ph_provinces", provinces, p => (
                    p.GetProperty("code").GetString()!,
                    new Dictionary<string, object> {
                        ["code"] = p.GetProperty("code").GetString(),
                        ["name"] = p.GetProperty("name").GetString(),
                        ["regionCode"] = p.GetProperty("regionCode").GetString()
                    }
                ));

                await CommitBatch("ph_cities", cities, c => (
                    c.GetProperty("code").GetString()!,
                    new Dictionary<string, object> {
                        ["code"] = c.GetProperty("code").GetString(),
                        ["name"] = c.GetProperty("name").GetString(),
                        ["regionCode"] = c.GetProperty("regionCode").GetString(),
                        ["provinceCode"] = c.TryGetProperty("provinceCode", out var pc) ? pc.GetString() : null
                    }
                ));

                if (includeBarangays && barangays.Count > 0)
                {
                    await CommitBatch("ph_barangays", barangays, b => (
                        b.GetProperty("code").GetString()!,
                        new Dictionary<string, object> {
                            ["code"] = b.GetProperty("code").GetString(),
                            ["name"] = b.GetProperty("name").GetString(),
                            ["cityCode"] = b.TryGetProperty("cityCode", out var cc) ? cc.GetString() : (b.TryGetProperty("municipalityCode", out var mc) ? mc.GetString() : null)
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
    }
}
