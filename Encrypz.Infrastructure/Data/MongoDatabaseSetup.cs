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
        await database.GetCollection<BsonDocument>("DataProtectionKeys").Indexes.CreateOneAsync(
            new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("FriendlyName"),
                new CreateIndexOptions { Name = "FriendlyName" }));
    }
}
