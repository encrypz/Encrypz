using MongoDB.Bson;
using MongoDB.Driver;

namespace Encrypz.Infrastructure.Data;

public static class MongoDatabaseSetup
{
    public static async Task InitializeAsync(IMongoDatabase database)
    {
        // Creating indexes also creates the collections. Never delete existing documents.
        var users = database.GetCollection<BsonDocument>("Users");
        await users.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
            Builders<BsonDocument>.IndexKeys.Ascending("GoogleSubject"),
            new CreateIndexOptions<BsonDocument>
            {
                Name = "GoogleSubject_unique", Unique = true,
                PartialFilterExpression = new BsonDocument("GoogleSubject", new BsonDocument("$type", "string"))
            }));
        await users.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
            Builders<BsonDocument>.IndexKeys.Ascending("NormalizedUsername"),
            new CreateIndexOptions<BsonDocument>
            {
                Name = "NormalizedUsername_unique", Unique = true,
                PartialFilterExpression = new BsonDocument("NormalizedUsername", new BsonDocument("$type", "string"))
            }));
        foreach (var collection in new[] { "EncryptedFiles", "Folders" })
        {
            await database.GetCollection<BsonDocument>(collection).Indexes.CreateOneAsync(
                new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys
                    .Ascending("UserId").Ascending("IsDeleted"), new CreateIndexOptions { Name = "UserId_IsDeleted" }));
        }

        var googleAccounts = database.GetCollection<BsonDocument>("GoogleAccounts");
        await googleAccounts.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
            Builders<BsonDocument>.IndexKeys.Ascending("GoogleSubject"),
            new CreateIndexOptions<BsonDocument>
            {
                Name = "GoogleAccounts_GoogleSubject_unique",
                Unique = true,
                PartialFilterExpression = new BsonDocument("GoogleSubject", new BsonDocument("$type", "string"))
            }));
        await googleAccounts.Indexes.CreateOneAsync(new CreateIndexModel<BsonDocument>(
            Builders<BsonDocument>.IndexKeys.Ascending("UserId"),
            new CreateIndexOptions<BsonDocument> { Name = "GoogleAccounts_UserId" }));

        // Migrate any existing users who have Google credentials into GoogleAccounts
        try
        {
            var usersWithGoogle = await users.Find(
                Builders<BsonDocument>.Filter.And(
                    Builders<BsonDocument>.Filter.Type("GoogleSubject", BsonType.String),
                    Builders<BsonDocument>.Filter.Ne("GoogleSubject", BsonNull.Value),
                    Builders<BsonDocument>.Filter.Type("GoogleRefreshToken", BsonType.String),
                    Builders<BsonDocument>.Filter.Ne("GoogleRefreshToken", BsonNull.Value)
                )).ToListAsync();

            foreach (var userDoc in usersWithGoogle)
            {
                var subject = userDoc.GetValue("GoogleSubject", "").AsString;
                var token = userDoc.GetValue("GoogleRefreshToken", "").AsString;
                if (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(token)) continue;

                var existing = await googleAccounts.Find(Builders<BsonDocument>.Filter.Eq("GoogleSubject", subject)).FirstOrDefaultAsync();
                if (existing == null)
                {
                    var userId = userDoc.GetValue("_id");
                    var username = userDoc.GetValue("Username", "").AsString;
                    await googleAccounts.InsertOneAsync(new BsonDocument
                    {
                        { "_id", BsonValue.Create(Guid.NewGuid()) },
                        { "UserId", userId },
                        { "GoogleSubject", subject },
                        { "Email", username.Contains('@') ? username : BsonNull.Value },
                        { "RefreshToken", token },
                        { "ConnectedAt", DateTime.UtcNow }
                    });
                }
            }
        }
        catch
        {
            // Ignore migration exceptions if collections are fresh
        }

        await database.GetCollection<BsonDocument>("DataProtectionKeys").Indexes.CreateOneAsync(
            new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("FriendlyName"),
                new CreateIndexOptions { Name = "FriendlyName" }));
    }
}
