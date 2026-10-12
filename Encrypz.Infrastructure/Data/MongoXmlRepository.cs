using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Encrypz.Infrastructure.Data;

// Shared session-protection keys survive restarts and are available to every dyno.
public sealed class MongoXmlRepository : IXmlRepository
{
    private readonly IMongoCollection<BsonDocument> _keys;

    public MongoXmlRepository(IMongoDatabase database) =>
        _keys = database.GetCollection<BsonDocument>("DataProtectionKeys");

    public IReadOnlyCollection<XElement> GetAllElements() =>
        _keys.Find(FilterDefinition<BsonDocument>.Empty).ToList()
            .Select(document => XElement.Parse(document["Xml"].AsString)).ToArray();

    public void StoreElement(XElement element, string friendlyName) =>
        _keys.InsertOne(new BsonDocument
        {
            { "FriendlyName", friendlyName },
            { "Xml", element.ToString(SaveOptions.DisableFormatting) }
        });
}
